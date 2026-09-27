import { dbService } from './db';
import {
  BillingDocument,
  Client,
  PaymentRecord,
  HotelProfile,
  StatementRecord,
  SyncQueueItem,
  SyncTelemetry,
  SyncHumanStatus,
  SyncEntityType,
  SyncActionType,
  Reservation,
  POSOrder,
  ExpenseRecord,
  CatalogueItem,
} from '../types';
import {
  normalizePayloadBeforeJson,
  normalizeKraPin,
  normalizePhoneNumber,
  normalizeCurrency,
  normalizeCurrencyString,
  normalizeCodeString,
  normalizeDate,
  normalizeText,
  prepareQueueItemPayloadForDispatch,
} from './sync';
import { apiRateLimiter } from './apiRateLimiter';

type TelemetryListener = (telemetry: SyncTelemetry) => void;

export interface MultipartPdfUploadOptions {
  pdfBlob?: Blob;
  pdfBase64?: string;
  fileName: string;
  folderName?: string;
  documentNumber?: string;
  receiptNumber?: string;
  statementNumber?: string;
  document?: BillingDocument;
  payment?: PaymentRecord;
  statement?: StatementRecord;
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

export interface MultipartPdfUploadResult {
  success: boolean;
  driveUrl?: string;
  driveFileId?: string;
  fileName?: string;
  byteLength?: number;
  uploadVerified?: boolean;
  error?: string;
  serverAck?: any;
}

class EnterpriseSyncManager {
  private isProcessing = false;
  private syncMutex = false;
  private pollIntervalTimer: any = null;
  private listeners: Set<TelemetryListener> = new Set();
  private lastSyncTimestamp: string | null = null;
  private lastError: string | null = null;
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  constructor() {
    this.initLifecycleListeners();
    this.startPeriodicDaemon();
  }

  /**
   * Lifecycle & Network Event Listeners
   */
  private initLifecycleListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notifyTelemetry();
      // Immediately trigger queue flush upon regaining connectivity
      this.triggerBackgroundSync();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notifyTelemetry();
    });

    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.isOnline) {
        this.triggerBackgroundSync();
      }
    });

    window.addEventListener('damview:sync-trigger', () => {
      this.triggerBackgroundSync();
    });
  }

  /**
   * Periodic polling daemon (every 30-45 seconds when idle and online)
   */
  private startPeriodicDaemon(): void {
    if (typeof window === 'undefined') return;
    if (this.pollIntervalTimer) clearInterval(this.pollIntervalTimer);

    this.pollIntervalTimer = setInterval(() => {
      if (this.isOnline && !this.isProcessing) {
        this.triggerBackgroundSync();
      }
    }, 35000);
  }

  /**
   * Non-blocking background trigger scheduled via requestIdleCallback or microtask
   */
  public triggerBackgroundSync(): void {
    if (typeof window === 'undefined') return;

    if (typeof (window as any).requestIdleCallback === 'function') {
      (window as any).requestIdleCallback(
        () => {
          this.processQueue().catch((err) =>
            console.warn('[SyncManager] Background sync warning:', err)
          );
        },
        { timeout: 2000 }
      );
    } else {
      setTimeout(() => {
        this.processQueue().catch((err) =>
          console.warn('[SyncManager] Background sync warning:', err)
        );
      }, 50);
    }
  }

  /**
   * Immediate Push: Forces queue drain without waiting for idle timer
   */
  public triggerImmediatePush(): void {
    if (typeof window === 'undefined') return;
    this.processQueue(true).catch((err) =>
      console.warn('[SyncManager] Immediate push warning:', err)
    );
  }

  /**
   * Force Sync Now: Resets backoff timestamps, clears retry gates, and drains queue immediately
   */
  public async forceSyncNow(): Promise<{ success: boolean; message: string; processedCount: number }> {
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!this.isOnline) {
      this.notifyTelemetry();
      return {
        success: false,
        message: 'Device is offline. All records are safely committed in local IndexedDB.',
        processedCount: 0,
      };
    }

    const profile = await dbService.getHotelProfile();
    if (!profile.googleWebAppUrl) {
      return {
        success: false,
        message: 'Google Apps Script Web App URL is not configured.',
        processedCount: 0,
      };
    }

    // Reset backoff on all queue items so they process immediately
    const queue = await dbService.getSyncQueue();
    const nowIso = new Date().toISOString();
    for (const item of queue) {
      if (item.status === 'FAILED' || item.status === 'failed') {
        const resetItem: SyncQueueItem = {
          ...item,
          status: 'PENDING',
          nextRetryAt: 0,
          updatedAt: nowIso,
        };
        await dbService.updateSyncQueueItem(resetItem);
      }
    }

    const processed = await this.processQueue(true);
    return {
      success: true,
      message: processed > 0 ? `Successfully synchronized ${processed} mutation(s) to cloud.` : 'Cloud is completely up to date.',
      processedCount: processed,
    };
  }

  /**
   * Primary Concurrency-Guarded Queue Processor
   */
  public async processQueue(isForced = false): Promise<number> {
    if (this.syncMutex || this.isProcessing) {
      return 0;
    }

    this.syncMutex = true;
    this.isProcessing = true;
    this.notifyTelemetry();

    let processedItemsCount = 0;

    try {
      const profile = await dbService.getHotelProfile();
      let webAppUrl = profile.googleWebAppUrl || '';

      // Self-Healing URL Patch: Auto-correct /dev or /edit URLs to production /exec URLs
      if (webAppUrl.includes('/dev')) {
        webAppUrl = webAppUrl.replace(/\/dev(\/|\?|$)/, '/exec$1');
        profile.googleWebAppUrl = webAppUrl;
        await dbService.saveHotelProfile(profile);
      }

      if (!webAppUrl || !this.isOnline) {
        return 0;
      }

      const queue = await dbService.getSyncQueue();
      if (!queue || queue.length === 0) {
        return 0;
      }

      // Filter eligible items: PENDING, or FAILED items past their exponential backoff window
      const nowMs = Date.now();
      const eligibleItems = queue
        .filter((item) => {
          const status = (item.status || 'PENDING').toUpperCase();
          if (status === 'PENDING') return true;
          if (status === 'FAILED') {
            if (isForced) return true;
            return !item.nextRetryAt || item.nextRetryAt <= nowMs;
          }
          return false;
        })
        .sort((a, b) => {
          const tA = new Date(a.createdAt || a.timestamp || 0).getTime();
          const tB = new Date(b.createdAt || b.timestamp || 0).getTime();
          return tA - tB;
        });

      if (eligibleItems.length === 0) {
        return 0;
      }

      // Process eligible mutations sequentially or in optimized batches
      for (const item of eligibleItems) {
        const itemId = String(item.id || '');
        if (!itemId) continue;

        // Mark item as SYNCING
        const syncingItem: SyncQueueItem = {
          ...item,
          status: 'SYNCING',
          updatedAt: new Date().toISOString(),
        };
        await dbService.updateSyncQueueItem(syncingItem);
        this.notifyTelemetry();

        try {
          const preparedPayload = prepareQueueItemPayloadForDispatch(item);
          const normalizedPayload = normalizePayloadBeforeJson({
            ...preparedPayload,
            syncQueueId: itemId,
            entityType: item.entityType || preparedPayload.entityType,
            entityId: item.entityId || preparedPayload.entityId,
          });

          // Post to Google Apps Script Web App
          const response = await this.postToScript(webAppUrl, normalizedPayload);

          if (response && response.success) {
            // Check for cloud sequential renumbering resolution
            if (response.renumbered) {
              const { originalNumber, newNumber, entityId, docId, paymentId } = response.renumbered;
              if (item.entityType === 'DOCUMENT' && (docId || entityId)) {
                await dbService.handleDocumentRenumbering(originalNumber, newNumber, docId || entityId);
              } else if (item.entityType === 'PAYMENT' && (paymentId || entityId)) {
                await dbService.handleReceiptRenumbering(originalNumber, newNumber, paymentId || entityId);
              }
            }

            // Update entity's native sync status in IndexedDB
            await this.updateEntitySyncSuccess(item.entityType || 'DOCUMENT', item.entityId || itemId, response);

            // Prune / delete item from durable syncQueue
            await dbService.removeSyncQueueItem(itemId);
            processedItemsCount++;
            this.lastSyncTimestamp = new Date().toISOString();
            this.lastError = null;
          } else {
            const errorMsg = response?.error || 'Cloud sync rejected mutation';
            const wasHaltingConfigError = await this.handleQueueItemFailure(item, errorMsg);
            if (wasHaltingConfigError) {
              // Endpoint misconfigured or missing (HTTP 404 or HTML auth error) - halt remaining batch to prevent thrashing
              break;
            }
          }
        } catch (itemErr: any) {
          console.warn(`[SyncManager] Item ${itemId} sync attempt failed:`, itemErr);
          const errorMsg = itemErr?.message || 'Network dispatch error';
          
          // Detect network connection drop
          if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError') || errorMsg.includes('net::ERR')) {
            this.isOnline = false;
            this.lastError = 'Network connection dropped. Queue held safely in local IndexedDB.';
            // Reset item back to PENDING status without incrementing retry count excessively
            const pendingItem: SyncQueueItem = {
              ...item,
              status: 'PENDING',
              updatedAt: new Date().toISOString(),
            };
            await dbService.updateSyncQueueItem(pendingItem);
            break; // Stop batch execution immediately until network recovers
          }

          const wasHaltingConfigError = await this.handleQueueItemFailure(item, errorMsg);
          if (wasHaltingConfigError) {
            break;
          }
        }
      }

      if (processedItemsCount > 0) {
        await dbService.saveHotelProfile({ lastSyncTimestamp: this.lastSyncTimestamp || undefined });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('damview:data-changed'));
        }
      }

      return processedItemsCount;
    } catch (globalErr: any) {
      this.lastError = globalErr?.message || 'Batch sync orchestration error';
      console.error('[SyncManager] Queue run error:', globalErr);
      return processedItemsCount;
    } finally {
      this.isProcessing = false;
      this.syncMutex = false;
      this.notifyTelemetry();
    }
  }

  /**
   * Handles individual item failure with exponential backoff, jitter, and poison-pill quarantine
   * Returns true if error is a structural configuration error requiring batch execution halt.
   */
  private async handleQueueItemFailure(item: SyncQueueItem, errorMsg: string): Promise<boolean> {
    const currentRetries = (item.retryCount || 0) + 1;
    const isSystemBusy = errorMsg.includes('System busy') || errorMsg.includes('busy processing');
    const isTimeout = errorMsg.includes('timed out') || errorMsg.includes('Network timeout') || errorMsg.includes('AbortError');
    const isHtmlError = errorMsg.includes('HTML page instead of JSON');
    const is404 = errorMsg.includes('404') || errorMsg.includes('not found');
    const isTransient = isSystemBusy || isTimeout;

    // Poison Pill / Dead-Letter Isolation Guard:
    // If an item fails more than 10 times with a non-transient error, isolate it as QUARANTINED so it does not block the queue
    if (currentRetries >= 10 && !isTransient && !is404 && !isHtmlError) {
      const quarantinedItem: SyncQueueItem = {
        ...item,
        status: 'QUARANTINED' as any,
        retryCount: currentRetries,
        lastError: `Quarantined after ${currentRetries} retries: ${errorMsg}`,
        errorMessage: errorMsg,
        updatedAt: new Date().toISOString(),
      };

      await dbService.updateSyncQueueItem(quarantinedItem);
      this.lastError = `Item ${item.id} quarantined to prevent queue corruption`;
      
      try {
        await dbService.recordAuditLog({
          entityType: 'SYNC',
          entityId: String(item.id || item.entityId || 'queue-item'),
          action: 'WARNING',
          details: `Sync item isolated to quarantine after ${currentRetries} failed attempts: ${errorMsg}`,
        });
      } catch {}

      return false;
    }

    // Intelligent backoff calculation
    let backoffMs: number;
    if (isSystemBusy) {
      backoffMs = 1500 + Math.floor(Math.random() * 1500);
    } else if (isTimeout) {
      backoffMs = 4000 + Math.floor(Math.random() * 3000);
    } else if (is404 || isHtmlError) {
      backoffMs = 60000; // 60s backoff for endpoint configuration errors
    } else {
      backoffMs = Math.min(300000, Math.pow(2, Math.min(currentRetries, 8)) * 1500 + Math.floor(Math.random() * 1500));
    }

    const nextRetryAt = Date.now() + backoffMs;

    const failedItem: SyncQueueItem = {
      ...item,
      status: 'FAILED',
      retryCount: currentRetries,
      lastError: errorMsg,
      errorMessage: errorMsg,
      nextRetryAt,
      updatedAt: new Date().toISOString(),
    };

    this.lastError = errorMsg;
    await dbService.updateSyncQueueItem(failedItem);

    // Notify user with actionable button if configuration issue detected
    if (is404) {
      try {
        const { appNotificationService } = await import('./appNotificationService');
        appNotificationService.notifyConfigError(
          'Google Web App Endpoint Not Found (404)',
          'The configured Google Apps Script Web App URL returned HTTP 404. Please verify or update the Web App deployment URL in Settings.'
        );
      } catch {}
      return true; // Signal processQueue to halt remaining batch execution
    }

    if (isHtmlError) {
      try {
        const { appNotificationService } = await import('./appNotificationService');
        appNotificationService.notifyConfigError(
          'Google Web App Access Restricted',
          'Google returned an HTML page instead of JSON. Ensure Web App deployment is set to "Execute as: Me" and "Who has access: Anyone".'
        );
      } catch {}
      return true; // Signal processQueue to halt remaining batch execution
    }

    // Transient system busy and timeout notices are handled silently in background
    if (typeof window !== 'undefined' && !isTransient) {
      window.dispatchEvent(
        new CustomEvent('damview:sync-warning', {
          detail: {
            item,
            errorMsg,
            retries: currentRetries,
            timestamp: Date.now(),
          },
        })
      );
    }

    return false;
  }

  /**
   * Resets all quarantined sync queue items back to PENDING state for re-evaluation
   */
  public async retryQuarantinedItems(): Promise<number> {
    const queue = await dbService.getSyncQueue();
    let resetCount = 0;
    const nowIso = new Date().toISOString();

    for (const item of queue) {
      const status = String(item.status || '').toUpperCase();
      if (status === 'QUARANTINED') {
        const resetItem: SyncQueueItem = {
          ...item,
          status: 'PENDING',
          retryCount: 0,
          nextRetryAt: 0,
          lastError: null,
          errorMessage: undefined,
          updatedAt: nowIso,
        };
        await dbService.updateSyncQueueItem(resetItem);
        resetCount++;
      }
    }

    if (resetCount > 0) {
      this.triggerBackgroundSync();
    }
    return resetCount;
  }

  /**
   * Clears all quarantined sync queue items from IndexedDB storage
   */
  public async clearQuarantinedItems(): Promise<number> {
    const queue = await dbService.getSyncQueue();
    let clearedCount = 0;

    for (const item of queue) {
      const status = String(item.status || '').toUpperCase();
      if (status === 'QUARANTINED' && item.id) {
        await dbService.removeSyncQueueItem(String(item.id));
        clearedCount++;
      }
    }

    this.notifyTelemetry();
    return clearedCount;
  }

  /**
   * Updates native entity record with synced confirmation flags
   */
  private async updateEntitySyncSuccess(entityType: SyncEntityType, entityId: string, response: any): Promise<void> {
    const nowIso = new Date().toISOString();
    try {
      if (entityType === 'DOCUMENT') {
        const doc = await dbService.getDocumentById(entityId);
        if (doc) {
          await dbService.saveDocument({
            ...doc,
            syncedToGoogle: true,
            syncedAt: nowIso,
            lastSyncStatus: 'synced',
            driveFileUrl: response.driveFileUrl || response.pdfUrl || doc.driveFileUrl,
            driveFileId: response.driveFileId || response.fileId || doc.driveFileId,
          });
        }
      } else if (entityType === 'PAYMENT') {
        const pay = await dbService.getPaymentById(entityId);
        if (pay) {
          await dbService.savePayment({
            ...pay,
            syncedToGoogle: true,
            lastSyncStatus: 'synced',
            driveFileUrl: response.driveFileUrl || pay.driveFileUrl,
            driveFileId: response.driveFileId || pay.driveFileId,
          });
        }
      }
    } catch (e) {
      console.warn('[SyncManager] Failed to update entity sync status:', e);
    }
  }

  /**
   * Resilient HTTP POST to Google Apps Script Web App (Rate-Limited, De-duplicated & Circuit-Protected)
   */
  public async postToScript(url: string, payload: any, customTimeoutMs = 90000): Promise<any> {
    // Sanitize & Auto-Heal Web App URL
    let cleanUrl = (url || '').trim();
    if (cleanUrl.includes('/dev')) {
      cleanUrl = cleanUrl.replace(/\/dev(\/|\?|$)/, '/exec$1');
    }
    cleanUrl = cleanUrl.replace(/[\s\r\n'"]/g, '');

    const action = String(payload?.action || payload?.type || '').toUpperCase();
    const isReadOnly = action === 'GET_SHEET_DATA' || action === 'PING' || action === 'HEALTHCHECK';
    const cacheTtlMs = isReadOnly ? 12000 : 0; // 12-second TTL for read queries

    return apiRateLimiter.execute(
      cleanUrl,
      payload,
      async () => {
        const serialized = JSON.stringify(payload);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), customTimeoutMs);

        try {
          const res = await fetch(cleanUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: serialized,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (res.status === 404) {
            throw new Error(`HTTP error 404: Google Apps Script Web App URL not found. Please verify the Web App deployment URL in Settings.`);
          }

          if (res.status === 429) {
            throw new Error(`HTTP error 429: Too Many Requests (Rate limit reached on Google Apps Script). Pausing before retry.`);
          }

          if (!res.ok) {
            throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
          }

          const text = await res.text();
          const trimmedText = text.trim();

          if (
            trimmedText.startsWith('<') ||
            trimmedText.toLowerCase().includes('<!doctype') ||
            trimmedText.toLowerCase().includes('<html')
          ) {
            throw new Error('Google Apps Script returned an HTML page instead of JSON. Please ensure the Web App is deployed with "Execute as: Me" and "Who has access: Anyone".');
          }

          try {
            return JSON.parse(text);
          } catch {
            return { success: true, raw: text };
          }
        } catch (err: any) {
          clearTimeout(timeoutId);
          if (err.name === 'AbortError') {
            throw new Error(`Request to Google Apps Script timed out. The operation might still be processing in Google Sheets.`);
          }
          throw err;
        }
      },
      {
        priority: isReadOnly ? 2 : 5,
        cacheTtlMs,
        timeoutMs: customTimeoutMs,
      }
    );
  }

  /**
   * Robust, retry-capable Google Drive PDF upload handler using fetch with a multipart/form-data payload.
   * Uploads PDF binary blobs/base64 to Google Apps Script Web App endpoint and verifies server acknowledgement.
   */
  public async uploadPdfWithMultipartFormData(
    options: MultipartPdfUploadOptions
  ): Promise<MultipartPdfUploadResult> {
    const {
      pdfBlob,
      pdfBase64: initialBase64,
      fileName,
      folderName,
      documentNumber,
      receiptNumber,
      statementNumber,
      document,
      payment,
      statement,
      maxRetries = 3,
      retryDelayMs = 2000,
      timeoutMs = 90000,
    } = options;

    if (!this.isOnline && typeof navigator !== 'undefined' && !navigator.onLine) {
      return {
        success: false,
        error: 'Cannot upload PDF to Google Drive while offline.',
      };
    }

    const profile = await dbService.getHotelProfile();
    const webAppUrl = profile?.googleWebAppUrl;

    if (!webAppUrl || typeof webAppUrl !== 'string' || !webAppUrl.trim().startsWith('http')) {
      return {
        success: false,
        error: 'Google Apps Script Web App URL is not configured. Please verify in Settings.',
      };
    }

    let cleanUrl = webAppUrl.trim();
    if (cleanUrl.includes('/dev')) {
      cleanUrl = cleanUrl.replace(/\/dev(\/|\?|$)/, '/exec$1');
    }
    cleanUrl = cleanUrl.replace(/[\s\r\n'"]/g, '');

    // Ensure we have a valid pdfBase64 string
    let finalBase64 = initialBase64 || '';
    if (!finalBase64 && pdfBlob) {
      try {
        finalBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            const commaIdx = result.indexOf(',');
            resolve(commaIdx >= 0 ? result.substring(commaIdx + 1) : result);
          };
          reader.onerror = reject;
          reader.readAsDataURL(pdfBlob);
        });
      } catch (readErr: any) {
        return {
          success: false,
          error: `Failed to read PDF blob into base64 stream: ${readErr.message}`,
        };
      }
    }

    const targetFolder = folderName || profile?.googleDriveFolder || 'Hotel Damview Archives';

    let attempt = 0;
    let lastError = 'Upload failed';

    while (attempt < maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        // Construct FormData for multipart/form-data delivery
        const formData = new FormData();
        formData.append('action', 'ARCHIVE_PDF');
        formData.append('fileName', fileName);
        formData.append('folderName', targetFolder);

        if (documentNumber) formData.append('documentNumber', documentNumber);
        if (receiptNumber) formData.append('receiptNumber', receiptNumber);
        if (statementNumber) formData.append('statementNumber', statementNumber);

        if (finalBase64) {
          formData.append('pdfBase64', finalBase64);
        }

        if (pdfBlob) {
          formData.append('file', pdfBlob, fileName);
        }

        const payloadObj = {
          action: 'ARCHIVE_PDF',
          fileName,
          folderName: targetFolder,
          documentNumber,
          receiptNumber,
          statementNumber,
          document,
          payment,
          statement,
          pdfBase64: finalBase64,
          timestamp: new Date().toISOString(),
        };
        formData.append('payload', JSON.stringify(payloadObj));

        // Note: Do NOT manually set Content-Type header when fetching with FormData!
        // Browser automatically inserts multipart/form-data boundary parameter.
        const res = await fetch(cleanUrl, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
        }

        const rawText = await res.text();
        const trimmedText = rawText.trim();

        if (
          trimmedText.startsWith('<') ||
          trimmedText.toLowerCase().includes('<!doctype') ||
          trimmedText.toLowerCase().includes('<html')
        ) {
          if (trimmedText.includes('ServiceLogin') || trimmedText.includes('accounts.google.com')) {
            throw new Error(
              'Google Apps Script authorization error: Access restricted. Set "Who has access" to "Anyone" in Web App deployment settings.'
            );
          }
          throw new Error('Google Apps Script endpoint returned HTML page instead of JSON acknowledgement.');
        }

        let parsed: any;
        try {
          parsed = JSON.parse(rawText);
        } catch {
          throw new Error(`Could not parse server JSON response: ${trimmedText.substring(0, 100)}`);
        }

        if (parsed && parsed.success === false) {
          throw new Error(parsed.error || parsed.message || 'Server rejected PDF archive request');
        }

        const driveUrl =
          parsed?.driveUrl ||
          parsed?.webViewLink ||
          parsed?.pdfArchived?.webViewLink ||
          parsed?.pdfArchived?.url ||
          parsed?.pdfArchived?.driveUrl;

        const driveFileId =
          parsed?.driveFileId ||
          parsed?.pdfArchived?.fileId ||
          parsed?.pdfArchived?.driveFileId;

        const uploadVerified = Boolean(
          parsed?.success &&
            (parsed?.pdfArchived?.status === 'ARCHIVED' || (driveUrl && typeof driveUrl === 'string' && driveUrl.startsWith('http')))
        );

        if (uploadVerified && driveUrl) {
          // Local DB Write-Through update
          if (document) {
            await dbService.saveDocument({
              ...document,
              driveFileUrl: driveUrl,
              driveFileId: driveFileId || document.driveFileId,
              syncedToGoogle: true,
              lastSyncStatus: 'synced',
            });
          }
          if (payment) {
            await dbService.savePayment({
              ...payment,
              driveFileUrl: driveUrl,
              driveFileId: driveFileId || payment.driveFileId,
              syncedToGoogle: true,
              lastSyncStatus: 'synced',
            });
          }
          if (statement) {
            await dbService.saveStatement({
              ...statement,
              driveFileUrl: driveUrl,
              driveFileId: driveFileId || statement.driveFileId,
            });
          }

          this.notifyTelemetry();

          return {
            success: true,
            driveUrl,
            driveFileId,
            fileName: parsed?.fileName || fileName,
            byteLength: parsed?.byteLength || (pdfBlob ? pdfBlob.size : finalBase64.length),
            uploadVerified: true,
            serverAck: parsed,
          };
        }

        throw new Error('Server response missing driveUrl or file verification confirmation.');
      } catch (err: any) {
        clearTimeout(timeoutId);
        lastError = err?.message || String(err);
        console.warn(`[SyncManager:MultipartUpload] Attempt ${attempt}/${maxRetries} failed: ${lastError}`);

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs * Math.pow(1.5, attempt - 1)));
        }
      }
    }

    // Fallback attempt via postToScript JSON payload if multipart failed
    try {
      console.info('[SyncManager:MultipartUpload] Attempting JSON postToScript fallback route...');
      const fallbackPayload = {
        action: 'ARCHIVE_PDF',
        pdfBase64: finalBase64,
        fileName,
        folderName: targetFolder,
        documentNumber,
        receiptNumber,
        statementNumber,
        document,
        payment,
        statement,
        timestamp: new Date().toISOString(),
      };
      const fallbackRes = await this.postToScript(cleanUrl, fallbackPayload, timeoutMs);
      if (fallbackRes && fallbackRes.success && (fallbackRes.driveUrl || fallbackRes.pdfArchived?.url)) {
        const driveUrl = fallbackRes.driveUrl || fallbackRes.pdfArchived?.url || fallbackRes.webViewLink;
        const driveFileId = fallbackRes.driveFileId || fallbackRes.pdfArchived?.fileId;

        if (document) {
          await dbService.saveDocument({ ...document, driveFileUrl: driveUrl, driveFileId });
        }
        if (payment) {
          await dbService.savePayment({ ...payment, driveFileUrl: driveUrl, driveFileId });
        }
        if (statement) {
          await dbService.saveStatement({ ...statement, driveFileUrl: driveUrl, driveFileId });
        }

        this.notifyTelemetry();

        return {
          success: true,
          driveUrl,
          driveFileId,
          fileName: fallbackRes.fileName || fileName,
          byteLength: fallbackRes.byteLength,
          uploadVerified: true,
          serverAck: fallbackRes,
        };
      }
    } catch (fallbackErr: any) {
      console.warn('[SyncManager:MultipartUpload] Fallback route also failed:', fallbackErr);
    }

    return {
      success: false,
      error: `Google Drive PDF upload failed after ${maxRetries} attempts: ${lastError}`,
    };
  }

  /**
   * Retry-capable multipart/form-data upload handler for PDF binary blobs and base64 payloads
   */
  public async uploadPdfBlobWithRetry(
    options: MultipartPdfUploadOptions
  ): Promise<MultipartPdfUploadResult> {
    return this.uploadPdfWithMultipartFormData(options);
  }

  /**
   * Subscribes to reactive sync telemetry updates
   */
  public subscribeTelemetry(listener: TelemetryListener): () => void {
    this.listeners.add(listener);
    // Emit current state immediately
    this.getTelemetry().then((tel) => listener(tel)).catch(() => {});

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Broadcasts telemetry updates to all UI subscribers and custom window events
   */
  public async notifyTelemetry(): Promise<void> {
    const telemetry = await this.getTelemetry();
    this.listeners.forEach((listener) => {
      try {
        listener(telemetry);
      } catch (e) {
        console.error('[SyncManager] Telemetry listener error:', e);
      }
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('damview:sync-telemetry', { detail: telemetry })
      );
    }
  }

  /**
   * Computes comprehensive telemetry snapshot
   */
  public async getTelemetry(): Promise<SyncTelemetry> {
    let queue: SyncQueueItem[] = [];
    try {
      queue = await dbService.getSyncQueue();
    } catch {
      queue = [];
    }

    const pendingCount = queue.filter(
      (q) => (q.status || 'PENDING').toUpperCase() === 'PENDING'
    ).length;
    const syncingCount = queue.filter(
      (q) => (q.status || '').toUpperCase() === 'SYNCING'
    ).length;
    const failedCount = queue.filter(
      (q) => (q.status || '').toUpperCase() === 'FAILED'
    ).length;
    const totalQueuedCount = queue.length;

    let humanStatus: SyncHumanStatus = 'All Changes Saved Locally';
    let statusText = 'All Changes Saved Locally';

    if (!this.isOnline) {
      humanStatus = totalQueuedCount > 0 ? 'Offline - Queued' : 'Offline - Local Secure';
      statusText = totalQueuedCount > 0 ? `Offline (${totalQueuedCount} queued)` : 'Offline (Local-First Active)';
    } else if (this.isProcessing || syncingCount > 0) {
      humanStatus = 'Syncing';
      statusText = `Syncing (${pendingCount + syncingCount} items in flight)...`;
    } else if (failedCount > 0 && pendingCount === 0) {
      humanStatus = 'Sync Paused - Retrying';
      statusText = `Retrying ${failedCount} item(s) with backoff`;
    } else if (totalQueuedCount === 0) {
      humanStatus = 'Cloud Synced';
      statusText = 'All records fully synchronized';
    } else {
      humanStatus = 'All Changes Saved Locally';
      statusText = `${totalQueuedCount} mutation(s) pending background sync`;
    }

    return {
      isOnline: this.isOnline,
      isSyncing: this.isProcessing,
      pendingCount,
      syncingCount,
      failedCount,
      totalQueuedCount,
      lastSyncTimestamp: this.lastSyncTimestamp,
      lastError: this.lastError,
      statusText,
      humanStatus,
    };
  }

  /**
   * Diagnostic utility function to trace the lifecycle of a document action from UI trigger to XHR/Fetch completion,
   * logging any promise rejections, network state, and silent failures in EnterpriseSyncManager to the browser console.
   */
  private lifecycleTraces: Array<{
    traceId: string;
    actionType: string;
    documentId?: string;
    documentNumber?: string;
    triggeredAt: string;
    completedAt?: string;
    durationMs?: number;
    status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'SILENT_FAILURE_DETECTED';
    networkState: {
      isOnline: boolean;
      effectiveType?: string;
      rtt?: number;
    };
    error?: string;
    payloadSummary?: any;
  }> = [];

  public async traceDocumentActionLifecycle<T>(
    actionType: string,
    actionFn: () => Promise<T>,
    metadata?: { documentId?: string; documentNumber?: string; payload?: any }
  ): Promise<T> {
    const traceId = 'trace-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
    const triggeredAt = new Date().toISOString();
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const connection = typeof navigator !== 'undefined' ? (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection : undefined;
    const networkState = {
      isOnline,
      effectiveType: connection?.effectiveType,
      rtt: connection?.rtt,
    };

    const traceRecord: {
      traceId: string;
      actionType: string;
      documentId?: string;
      documentNumber?: string;
      triggeredAt: string;
      completedAt?: string;
      durationMs?: number;
      status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'SILENT_FAILURE_DETECTED';
      networkState: {
        isOnline: boolean;
        effectiveType?: string;
        rtt?: number;
      };
      error?: string;
      payloadSummary?: any;
    } = {
      traceId,
      actionType,
      documentId: metadata?.documentId,
      documentNumber: metadata?.documentNumber,
      triggeredAt,
      status: 'PENDING',
      networkState,
      payloadSummary: metadata?.payload ? { keys: Object.keys(metadata.payload), sizeBytes: JSON.stringify(metadata.payload).length } : undefined,
    };

    this.lifecycleTraces.unshift(traceRecord);
    if (this.lifecycleTraces.length > 200) this.lifecycleTraces.pop();

    console.info(`[EnterpriseSyncManager:DiagnosticTrace:Trigger] Action "${actionType}" started`, {
      traceId,
      triggeredAt,
      networkState,
      metadata,
    });

    const startTime = Date.now();
    try {
      const result = await actionFn();
      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startTime;
      traceRecord.status = 'SUCCESS';
      traceRecord.completedAt = completedAt;
      traceRecord.durationMs = durationMs;

      console.info(`[EnterpriseSyncManager:DiagnosticTrace:Success] Action "${actionType}" completed successfully in ${durationMs}ms`, {
        traceId,
        completedAt,
        durationMs,
        networkState: { isOnline: navigator.onLine },
        resultSummary: result ? (typeof result === 'object' ? { success: (result as any).success, id: (result as any).id } : 'primitive') : 'void',
      });
      return result;
    } catch (err: any) {
      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startTime;
      const errorMsg = err?.message || String(err);
      
      const isSilentFailure = errorMsg.includes('silent') || (!navigator.onLine && errorMsg.includes('fetch'));
      traceRecord.status = isSilentFailure ? 'SILENT_FAILURE_DETECTED' : 'FAILED';
      traceRecord.completedAt = completedAt;
      traceRecord.durationMs = durationMs;
      traceRecord.error = errorMsg;

      console.error(`[EnterpriseSyncManager:DiagnosticTrace:Error] Action "${actionType}" failed/rejected after ${durationMs}ms`, {
        traceId,
        error: errorMsg,
        stack: err?.stack,
        networkState: { isOnline: navigator.onLine },
        status: traceRecord.status,
      });
      throw err;
    }
  }

  public getDocumentActionTraces(): any[] {
    return this.lifecycleTraces;
  }

  /**
   * Cloud sequence number coordinator for non-colliding serials
   */
  public async getCloudSequenceNumber(
    docType: 'INVOICE' | 'QUOTATION' | 'PROFORMA' | 'RECEIPT' | 'STATEMENT'
  ): Promise<string | null> {
    try {
      const profile = await dbService.getHotelProfile();
      if (!profile?.googleWebAppUrl || !this.isOnline) return null;
      const res = await this.postToScript(profile.googleWebAppUrl, {
        action: 'GET_NEXT_DOCUMENT_NUMBER',
        docType: docType.toUpperCase(),
      });
      if (res?.success && res.nextNumber) {
        return res.nextNumber;
      }
      return null;
    } catch {
      return null;
    }
  }
}

export const syncManager = new EnterpriseSyncManager();

// Wire up atomic cloud sequence coordinator to dbService
dbService.setCloudSequenceResolver(async (type) => syncManager.getCloudSequenceNumber(type));
