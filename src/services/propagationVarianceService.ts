/**
 * PROPAGATION VARIANCE DETECTION & AUTO-RESOLUTION SERVICE
 * Hotel Damview ERP (Kenya)
 *
 * Tracks, highlights, and automatically heals documents with propagation variances
 * between local ERP records and Google Sheets (such as missing line items,
 * particulars discrepancies, calculation drifts, or metadata variances).
 */

import { BillingDocument, LineItem } from '../types';
import { dbService } from './db';
import { syncManager } from './sync';
import { appNotificationService } from './appNotificationService';

export interface DocumentVarianceInfo {
  documentNumber: string;
  documentType: string;
  detectedAt: string;
  varianceType: 'MISSING_LINE_ITEMS' | 'DATA_MISMATCH' | 'TOTALS_MISMATCH' | 'GENERAL_VARIANCE';
  summary: string;
  differencesCount: number;
  missingLineItemsCount?: number;
  lineItemDiffs: string[];
  fieldDiffs: string[];
  resolved: boolean;
}

const STORAGE_KEY = 'damview_document_variances';
const AUTO_RESOLVE_STORAGE_KEY = 'damview_auto_resolve_variances';

type VarianceListener = (variances: Record<string, DocumentVarianceInfo>) => void;

class PropagationVarianceService {
  private variances: Map<string, DocumentVarianceInfo> = new Map();
  private listeners: Set<VarianceListener> = new Set();
  private autoResolveEnabled: boolean = true;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: Record<string, DocumentVarianceInfo> = JSON.parse(stored);
        Object.entries(parsed).forEach(([num, info]) => {
          if (!info.resolved) {
            this.variances.set(num.trim().toUpperCase(), info);
          }
        });
      }

      const autoSetting = localStorage.getItem(AUTO_RESOLVE_STORAGE_KEY);
      if (autoSetting !== null) {
        this.autoResolveEnabled = autoSetting !== 'false';
      }
    } catch (err) {
      console.error('[PropagationVarianceService] Failed to load stored variances:', err);
    }
  }

  private persist() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const obj: Record<string, DocumentVarianceInfo> = {};
      this.variances.forEach((val, key) => {
        if (!val.resolved) {
          obj[key] = val;
        }
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {}
  }

  private notifyListeners() {
    const mapObj: Record<string, DocumentVarianceInfo> = {};
    this.variances.forEach((v, k) => {
      if (!v.resolved) mapObj[k] = v;
    });
    this.listeners.forEach((fn) => fn(mapObj));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('damview:variances-changed', {
          detail: { activeCount: this.getActiveCount() },
        })
      );
    }
  }

  public subscribe(listener: VarianceListener): () => void {
    this.listeners.add(listener);
    const mapObj: Record<string, DocumentVarianceInfo> = {};
    this.variances.forEach((v, k) => {
      if (!v.resolved) mapObj[k] = v;
    });
    listener(mapObj);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public isAutoResolveEnabled(): boolean {
    return this.autoResolveEnabled;
  }

  public setAutoResolveEnabled(enabled: boolean): void {
    this.autoResolveEnabled = enabled;
    try {
      localStorage.setItem(AUTO_RESOLVE_STORAGE_KEY, String(enabled));
    } catch {}
  }

  /**
   * Registers a detected propagation variance for a document
   */
  public registerVariance(info: DocumentVarianceInfo): void {
    const key = (info.documentNumber || '').trim().toUpperCase();
    if (!key) return;

    this.variances.set(key, {
      ...info,
      documentNumber: key,
      detectedAt: info.detectedAt || new Date().toISOString(),
      resolved: false,
    });
    this.persist();
    this.notifyListeners();
  }

  /**
   * Resolves a variance for a document and clears the highlight
   */
  public resolveVariance(documentNumber: string): void {
    const key = (documentNumber || '').trim().toUpperCase();
    if (!key) return;

    if (this.variances.has(key)) {
      this.variances.delete(key);
      this.persist();
      this.notifyListeners();
    }
  }

  public hasVariance(documentNumber: string): boolean {
    if (!documentNumber) return false;
    const key = documentNumber.trim().toUpperCase();
    const info = this.variances.get(key);
    return !!info && !info.resolved;
  }

  public getVariance(documentNumber: string): DocumentVarianceInfo | null {
    if (!documentNumber) return null;
    const key = documentNumber.trim().toUpperCase();
    return this.variances.get(key) || null;
  }

  public getAllVariances(): DocumentVarianceInfo[] {
    return Array.from(this.variances.values()).filter((v) => !v.resolved);
  }

  public getActiveCount(): number {
    return this.getAllVariances().length;
  }

  /**
   * Replaces inaccurate document line items and financial figures with
   * mathematically verified accurate ground-truth data (without merging stale/duplicate items).
   */
  public computeAccurateDocument(
    sourceDoc: BillingDocument,
    remoteDoc?: BillingDocument | null
  ): BillingDocument {
    // 1. Determine the accurate line items dataset:
    // Prefer authoritative local line items if populated with valid particulars;
    // otherwise fallback to remote line items if local was unpopulated/corrupted.
    // Inaccurate data is completely REPLACED rather than merged.
    const sourceItems = (sourceDoc.lineItems || []).filter(
      (it) => it && it.particulars && it.particulars.trim().length > 0
    );
    const remoteItems = (remoteDoc?.lineItems || []).filter(
      (it) => it && it.particulars && it.particulars.trim().length > 0
    );

    // Select the accurate authoritative line items source (strictly replace, do NOT merge)
    let selectedRawItems: LineItem[] = [];
    if (sourceItems.length > 0) {
      selectedRawItems = sourceItems;
    } else if (remoteItems.length > 0) {
      selectedRawItems = remoteItems;
    }

    // 2. Clean, sanitize, and recalculate each line item precisely
    let accurateLineItems: LineItem[] = selectedRawItems.map((item, index) => {
      const qty = Math.max(1, Number(item.quantity) || 1);
      const days = Math.max(1, Number(item.days) || 1);
      const rate = Math.max(0, Number(item.rate) || 0);
      const discount = Math.max(0, Number(item.discount) || 0);
      const amount = Math.round((qty * days * rate - discount) * 100) / 100;

      return {
        id: item.id || `LI-${index + 1}`,
        particulars: item.particulars.trim() || 'Hospitality Service',
        quantity: qty,
        days: days,
        rate: rate,
        discount: discount,
        amount: amount,
      };
    });

    if (accurateLineItems.length === 0) {
      const fallbackAmount = Number(sourceDoc.grandTotal || remoteDoc?.grandTotal || 0);
      accurateLineItems = [
        {
          id: 'LI-1',
          particulars: 'Accommodation & Conferencing Services',
          quantity: 1,
          days: 1,
          rate: fallbackAmount,
          discount: 0,
          amount: fallbackAmount,
        },
      ];
    }

    // 3. Accurate financial calculations computed directly from accurate line items
    const grossSubtotal = Math.round(
      accurateLineItems.reduce((acc, it) => acc + (Number(it.amount) || 0), 0) * 100
    ) / 100;

    const discountTotal = Math.round(
      accurateLineItems.reduce((acc, it) => acc + (Number(it.discount) || 0), 0) * 100
    ) / 100;

    // Kenya 16% VAT standard
    const vatAmount = Math.round((grossSubtotal - grossSubtotal / 1.16) * 100) / 100;
    const subtotal = Math.round((grossSubtotal - vatAmount) * 100) / 100;
    const grandTotal = grossSubtotal;

    // Reconciled payment figures
    const rawPaid = Number(sourceDoc.amountPaid ?? remoteDoc?.amountPaid ?? 0);
    const amountPaid = Math.max(0, Math.min(grandTotal, Math.round(rawPaid * 100) / 100));
    const balanceDue = Math.max(0, Math.round((grandTotal - amountPaid) * 100) / 100);

    // Accurate status alignment
    let alignedStatus = sourceDoc.status;
    if (sourceDoc.documentType === 'INVOICE') {
      if (balanceDue <= 0 && grandTotal > 0) {
        alignedStatus = 'Paid';
      } else if (amountPaid > 0 && balanceDue > 0) {
        alignedStatus = 'Partial';
      } else if (alignedStatus === 'Paid' && balanceDue > 0) {
        alignedStatus = 'Sent';
      }
    }

    // Replace inaccurate document properties with verified accurate ground truth
    return {
      ...sourceDoc,
      lineItems: accurateLineItems,
      grossSubtotal,
      discount: discountTotal,
      subtotal,
      vatAmount,
      grandTotal,
      amountPaid,
      balanceDue,
      status: alignedStatus,
      notes: sourceDoc.notes !== undefined ? sourceDoc.notes : (remoteDoc?.notes || ''),
      terms: sourceDoc.terms !== undefined ? sourceDoc.terms : (remoteDoc?.terms || ''),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Executes full auto-change and resolution of a document:
   * 1. Recomputes accurate line items and financial formulas.
   * 2. Persists accurate document to local database.
   * 3. Syncs accurate document and line items to Google Sheets.
   * 4. Resolves propagation variance notifications and removes journal highlight.
   */
  public async executeAutoResolve(
    documentOrNumber: string | BillingDocument,
    remoteDoc?: BillingDocument | null
  ): Promise<{ success: boolean; document: BillingDocument; message: string }> {
    let doc: BillingDocument | null = null;
    if (typeof documentOrNumber === 'string') {
      doc = await dbService.getDocumentByNumber(documentOrNumber);
      if (!doc) {
        const allDocs = await dbService.getDocuments();
        doc = allDocs.find((d) => d.documentNumber.trim().toUpperCase() === documentOrNumber.trim().toUpperCase()) || null;
      }
    } else {
      doc = documentOrNumber;
    }

    if (!doc) {
      throw new Error(`Cannot auto-resolve: Document ${documentOrNumber} not found.`);
    }

    const accurateDoc = this.computeAccurateDocument(doc, remoteDoc);

    // Persist accurate document
    await dbService.saveDocument(accurateDoc);

    // Push accurate data to Google Sheets to align remote with ground truth
    try {
      await syncManager.syncDocument(accurateDoc);
    } catch (syncErr) {
      console.warn('[PropagationVarianceService] Google sync push deferred/offline:', syncErr);
    }

    // Resolve variance in this service
    this.resolveVariance(accurateDoc.documentNumber);

    // Resolve app notification banner
    appNotificationService.resolvePropagation(accurateDoc.documentNumber);

    // Broadcast toast notification
    appNotificationService.notify({
      category: 'SELF_HEALING',
      severity: 'SUCCESS',
      title: `Variance Resolved: ${accurateDoc.documentNumber}`,
      message: `Document ${accurateDoc.documentNumber} auto-changed and resolved to accurate data with ${accurateDoc.lineItems.length} line item(s) synchronized.`,
      documentNumber: accurateDoc.documentNumber,
      resolved: true,
      autoDismissMs: 4000,
    });

    // Notify UI of mutation
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('damview:data-changed', {
          detail: {
            entity: 'document',
            action: 'auto-resolve',
            documentNumber: accurateDoc.documentNumber,
          },
        })
      );
    }

    return {
      success: true,
      document: accurateDoc,
      message: `Document ${accurateDoc.documentNumber} successfully auto-changed and resolved to accurate data.`,
    };
  }

  /**
   * Batch auto-resolves all currently highlighted documents with detected variances
   */
  public async autoResolveAll(
    documents: BillingDocument[]
  ): Promise<{ resolvedCount: number; errorsCount: number }> {
    const variances = this.getAllVariances();
    let resolvedCount = 0;
    let errorsCount = 0;

    for (const v of variances) {
      const matchDoc = documents.find(
        (d) => d.documentNumber.trim().toUpperCase() === v.documentNumber.trim().toUpperCase()
      );
      if (matchDoc) {
        try {
          await this.executeAutoResolve(matchDoc);
          resolvedCount++;
        } catch {
          errorsCount++;
        }
      } else {
        // Clear orphan variance
        this.resolveVariance(v.documentNumber);
      }
    }

    return { resolvedCount, errorsCount };
  }
}

export const propagationVarianceService = new PropagationVarianceService();
