import { dbService } from './db';
import {
  BillingDocument,
  Client,
  PaymentRecord,
  HotelProfile,
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

type TelemetryListener = (telemetry: SyncTelemetry) => void;

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
            await this.handleQueueItemFailure(item, errorMsg);
          }
        } catch (itemErr: any) {
          console.warn(`[SyncManager] Item ${itemId} sync attempt failed:`, itemErr);
          await this.handleQueueItemFailure(item, itemErr?.message || 'Network dispatch error');
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
   * Handles individual item failure with exponential backoff and jitter
   */
  private async handleQueueItemFailure(item: SyncQueueItem, errorMsg: string): Promise<void> {
    const currentRetries = (item.retryCount || 0) + 1;
    const isSystemBusy = errorMsg.includes('System busy') || errorMsg.includes('busy processing');
    const isTimeout = errorMsg.includes('timed out') || errorMsg.includes('Network timeout') || errorMsg.includes('AbortError');
    const isHtmlError = errorMsg.includes('HTML page instead of JSON');
    const is404 = errorMsg.includes('404') || errorMsg.includes('not found');
    const isTransient = isSystemBusy || isTimeout;

    // Intelligent backoff calculation
    let backoffMs: number;
    if (isSystemBusy) {
      // Fast random backoff for lock contention (1.5s - 3s)
      backoffMs = 1500 + Math.floor(Math.random() * 1500);
    } else if (isTimeout) {
      // 4s - 7s retry for network timeout
      backoffMs = 4000 + Math.floor(Math.random() * 3000);
    } else if (is404 || isHtmlError) {
      // 30s backoff for misconfiguration / missing endpoint to prevent console log storm
      backoffMs = 30000;
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

    // Lock busy & timeout are transient self-healing conditions handled automatically in background.
    // NEVER trigger alarming floating UI warning popups for lock busy or transient network timeouts.
    if (typeof window !== 'undefined') {
      if (!isTransient) {
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
    }
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
   * Resilient HTTP POST to Google Apps Script Web App
   */
  public async postToScript(url: string, payload: any, customTimeoutMs = 90000): Promise<any> {
    // Sanitize & Auto-Heal Web App URL
    let cleanUrl = (url || '').trim();
    if (cleanUrl.includes('/dev')) {
      cleanUrl = cleanUrl.replace(/\/dev(\/|\?|$)/, '/exec$1');
    }
    cleanUrl = cleanUrl.replace(/[\s\r\n'"]/g, '');

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
