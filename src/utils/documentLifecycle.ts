import { BillingDocument, DocumentStatus, PaymentRecord } from '../types';

export interface DocumentStatusMeta {
  label: DocumentStatus;
  badgeClass: string;
  dotClass: string;
  description: string;
}

export const DOCUMENT_STATUS_CONFIG: Record<DocumentStatus, DocumentStatusMeta> = {
  Draft: {
    label: 'Draft',
    badgeClass: 'bg-stone-100 text-stone-700 border-stone-300 hover:bg-stone-200',
    dotClass: 'bg-stone-400',
    description: 'Internal draft; pending transmission or dispatch',
  },
  Sent: {
    label: 'Sent',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-300 hover:bg-sky-100',
    dotClass: 'bg-sky-500',
    description: 'Issued & delivered to client; awaiting settlement',
  },
  Partial: {
    label: 'Partial',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100',
    dotClass: 'bg-amber-500',
    description: 'Partially settled; balance due remains',
  },
  Paid: {
    label: 'Paid',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100',
    dotClass: 'bg-emerald-500',
    description: 'Settled in full; zero outstanding balance',
  },
  Overdue: {
    label: 'Overdue',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100',
    dotClass: 'bg-rose-500 animate-pulse',
    description: 'Outstanding balance past specified due date',
  },
};

export const ALL_DOCUMENT_STATUSES: DocumentStatus[] = [
  'Draft',
  'Sent',
  'Partial',
  'Paid',
  'Overdue',
];

/**
 * Normalizes any string or legacy status to a strictly typed DocumentStatus
 */
export function normalizeDocumentStatus(raw?: string | null): DocumentStatus {
  if (!raw) return 'Draft';
  const clean = raw.trim().toUpperCase();
  if (clean === 'PAID' || clean === 'SETTLED') return 'Paid';
  if (clean === 'PARTIAL' || clean === 'PARTIALLY PAID' || clean === 'PARTIAL PAYMENT') return 'Partial';
  if (clean === 'OVERDUE' || clean === 'EXPIRED') return 'Overdue';
  if (clean === 'SENT' || clean === 'ISSUED' || clean === 'DISPATCHED') return 'Sent';
  if (clean === 'DRAFT') return 'Draft';
  return 'Draft';
}

/**
 * Deterministically computes the automated lifecycle status of a document
 * based on its payment reconciliation, grand total, balance due, and due date.
 */
export function computeDocumentStatus(
  doc: BillingDocument,
  todayStr?: string,
  ignoreOverride = false
): DocumentStatus {
  if (!ignoreOverride && doc.isManualStatusOverride && doc.status) {
    return normalizeDocumentStatus(doc.status);
  }

  const today = todayStr || new Date().toISOString().split('T')[0];
  const grandTotal = Number(doc.grandTotal) || 0;
  const amountPaid = Number(doc.amountPaid) || 0;
  const balanceDue = Number(doc.balanceDue) !== undefined ? Number(doc.balanceDue) : Math.max(0, grandTotal - amountPaid);
  const isPastDue = Boolean(doc.dueDate && doc.dueDate.trim() && doc.dueDate < today);

  // Invoices Lifecycle Logic
  if (doc.documentType === 'INVOICE') {
    // 1. Fully settled
    if (grandTotal > 0 && balanceDue <= 0.001) {
      return 'Paid';
    }
    // 2. Partial payment received
    if (amountPaid > 0 && balanceDue > 0.001) {
      return 'Partial';
    }
    // 3. No payment received
    if (amountPaid <= 0) {
      if (doc.status === 'Draft' && !doc.driveFileUrl && !doc.syncedToGoogle) {
        return 'Draft';
      }
      if (isPastDue) {
        return 'Overdue';
      }
      return 'Sent';
    }
  }

  // Quotation & Proforma Lifecycle Logic
  if (doc.documentType === 'QUOTATION' || doc.documentType === 'PROFORMA') {
    if (doc.status === 'Paid') return 'Paid';
    if (doc.status === 'Draft') return 'Draft';
    if (isPastDue) return 'Overdue';
    return 'Sent';
  }

  return 'Draft';
}

/**
 * Reconciles a single document's status and returns a copy if updated.
 */
export function reconcileDocumentLifecycle(
  doc: BillingDocument,
  todayStr?: string,
  forceRecalculate = false
): { doc: BillingDocument; hasChanged: boolean } {
  const nextStatus = computeDocumentStatus(doc, todayStr, forceRecalculate);
  if (doc.status !== nextStatus) {
    return {
      doc: {
        ...doc,
        status: nextStatus,
        isManualStatusOverride: forceRecalculate ? false : doc.isManualStatusOverride,
        updatedAt: new Date().toISOString(),
      },
      hasChanged: true,
    };
  }
  return { doc, hasChanged: false };
}

/**
 * Mass lifecycle reconciliation across all documents against recorded payments
 */
export function reconcileAllDocumentLifecycles(
  documents: BillingDocument[],
  payments: PaymentRecord[],
  todayStr?: string
): { updatedDocuments: BillingDocument[]; changedCount: number } {
  const today = todayStr || new Date().toISOString().split('T')[0];
  let changedCount = 0;

  // Build payment sums mapped by documentId and documentNumber
  const paymentSumByDocId = new Map<string, number>();
  const paymentSumByDocNum = new Map<string, number>();

  for (const p of payments) {
    const amt = Number(p.amount) || 0;
    if (p.documentId) {
      paymentSumByDocId.set(p.documentId, (paymentSumByDocId.get(p.documentId) || 0) + amt);
    }
    if (p.documentNumber) {
      const cleanNum = p.documentNumber.trim().toUpperCase();
      paymentSumByDocNum.set(cleanNum, (paymentSumByDocNum.get(cleanNum) || 0) + amt);
    }
  }

  const updatedDocuments = documents.map((doc) => {
    let reconciledPaid = doc.amountPaid || 0;
    if (doc.documentType === 'INVOICE') {
      const sumById = paymentSumByDocId.get(doc.id);
      const sumByNum = paymentSumByDocNum.get(doc.documentNumber.trim().toUpperCase());
      const accuratePaid = sumById !== undefined ? sumById : (sumByNum !== undefined ? sumByNum : (doc.amountPaid || 0));
      reconciledPaid = Math.round(accuratePaid * 100) / 100;
    }

    const grandTotal = Number(doc.grandTotal) || 0;
    const reconciledBal = Math.max(0, Math.round((grandTotal - reconciledPaid) * 100) / 100);

    const docWithBalances: BillingDocument = {
      ...doc,
      amountPaid: reconciledPaid,
      balanceDue: reconciledBal,
    };

    const nextStatus = computeDocumentStatus(docWithBalances, today, false);
    const hasStatusChanged = doc.status !== nextStatus;
    const hasBalancesChanged = doc.amountPaid !== reconciledPaid || doc.balanceDue !== reconciledBal;

    if (hasStatusChanged || hasBalancesChanged) {
      changedCount++;
      return {
        ...docWithBalances,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      };
    }

    return doc;
  });

  return { updatedDocuments, changedCount };
}
