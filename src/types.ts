export type DocumentType = 'QUOTATION' | 'PROFORMA' | 'INVOICE';

export type DocumentStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue';

export interface LineItem {
  id: string;
  particulars: string;
  quantity: number;
  days: number;
  rate: number;
  discount?: number;
  amount: number;
}

export interface Client {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  kraPin: string;
  address: string;
  createdAt: string;
  updatedAt?: string;
}

export interface HotelProfile {
  name: string;
  tagline?: string;
  kraPin: string;
  email: string;
  phone: string;
  physicalLocation: string;
  postalAddress: string;
  logoBase64: string;
  bankName: string;
  bankBranch: string;
  accountHolder: string;
  accountNumber: string;
  mpesaTillNumber: string;
  vatRate: number; // e.g. 16
  googleWebAppUrl?: string;
  googleDriveFolder?: string;
  googleSheetEmbedUrl?: string;
  googleSheetUrl?: string;
  googleDriveFolderUrl?: string;
  autoSyncEnabled?: boolean;
  lastSyncTimestamp?: string;
}

export interface BillingDocument {
  id: string;
  documentType: DocumentType;
  documentNumber: string; // e.g. Q-0001, PI-0001, INV-0001
  clientId: string;
  clientName: string;
  clientKraPin: string;
  clientAddress: string;
  clientPhone?: string;
  clientEmail?: string;
  issueDate: string; // YYYY-MM-DD
  validityDays: number;
  dueDate: string; // YYYY-MM-DD
  lineItems: LineItem[];
  subtotal: number;
  discount?: number;
  vatAmount: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  status: DocumentStatus;
  notes: string;
  terms: string;
  relatedDocId?: string; // Reference to source quotation/proforma
  relatedDocNumber?: string;
  createdAt: string;
  updatedAt: string;
  syncedToGoogle?: boolean;
  syncedAt?: string;
  driveFileUrl?: string;
  driveFileId?: string;
  lastSyncStatus?: 'synced' | 'pending' | 'failed';
  isArchived?: boolean;
}

export interface PaymentRecord {
  id: string;
  receiptNumber: string;
  documentId: string;
  documentNumber: string;
  clientId: string;
  clientName: string;
  date: string; // YYYY-MM-DD
  amount: number;
  paymentMode: 'M-Pesa' | 'Bank Transfer' | 'Cash' | 'Credit Card' | 'Cheque';
  referenceNote: string;
  createdAt: string;
  syncedToGoogle?: boolean;
  driveFileUrl?: string;
  driveFileId?: string;
  lastSyncStatus?: 'synced' | 'pending' | 'failed';
}

export interface LedgerEntry {
  rowNumber: number;
  date: string;
  reference: string;
  documentType?: string;
  description: string;
  debit: number; // Invoiced
  credit: number; // Settled
  cumulativeBalance: number;
  status?: 'Settled' | 'Partially Settled' | 'Unsettled' | 'Payment';
}

export interface SyncQueueItem {
  id: string;
  action:
    | 'UPSERT_CLIENT'
    | 'UPSERT_DOCUMENT'
    | 'RECORD_PAYMENT'
    | 'ARCHIVE_PDF'
    | 'CASCADE_DELETE_DOCUMENT'
    | 'CASCADE_DELETE_CLIENT'
    | 'CASCADE_DELETE_PAYMENT'
    | 'UPSERT_PROFILE';
  payload: any;
  timestamp: string;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed';
  errorMessage?: string;
}

export interface DashboardMetrics {
  activeQuotationsValue: number;
  activeQuotationsCount: number;
  pendingInvoicesValue: number; // Accounts receivable
  pendingInvoicesCount: number;
  totalSettledMTD: number;
  totalSettledYTD: number;
  totalClientsCount: number;
  overdueInvoicesCount: number;
  monthlyRevenue: { month: string; invoiced: number; collected: number }[];
  clientRevenueDistribution: { clientName: string; totalAmount: number; percentage: number }[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  entityType: 'DOCUMENT' | 'CLIENT' | 'PAYMENT' | 'PROFILE' | 'SYNC';
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'MUTATION_GUARDED' | 'SELF_HEALED' | 'MERGED';
  details: string;
  snapshot?: any;
}
