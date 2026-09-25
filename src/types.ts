export type DocumentType = 'QUOTATION' | 'PROFORMA' | 'INVOICE';

export type DocumentStatus = 'Draft' | 'Sent' | 'Partial' | 'Paid' | 'Overdue';

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
  googleSheetsSpreadsheetId?: string;
  googleSheetEmbedUrl?: string;
  googleSheetUrl?: string;
  googleDriveFolderUrl?: string;
  autoSyncEnabled?: boolean;
  lastSyncTimestamp?: string;
}

export interface BillingDocument {
  id: string;
  documentType: DocumentType;
  documentNumber: string; // e.g. QT-0001, PI-0001, INV-0001
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
  isManualStatusOverride?: boolean;
  manualStatusNote?: string;
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

export interface StatementRecord {
  id: string;
  statementNumber: string; // e.g. SOA-MAC-20260923
  clientId: string;
  clientName: string;
  clientKraPin?: string;
  issueDate: string; // YYYY-MM-DD
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  totalDebit: number; // Total Invoiced
  totalCredit: number; // Total Settled
  closingBalance: number; // Outstanding Balance
  entriesCount: number;
  pdfGenerated?: boolean;
  driveFileUrl?: string;
  driveFileId?: string;
  createdAt: string;
  updatedAt?: string;
}

export type SyncEntityType =
  | 'DOCUMENT'
  | 'CLIENT'
  | 'PAYMENT'
  | 'RESERVATION'
  | 'POS_ORDER'
  | 'EXPENSE'
  | 'CATALOGUE'
  | 'PROFILE';

export type SyncActionType =
  | 'UPSERT'
  | 'CASCADE_DELETE'
  | 'ARCHIVE_PDF'
  | 'UPSERT_CLIENT'
  | 'UPSERT_DOCUMENT'
  | 'RECORD_PAYMENT'
  | 'ARCHIVE_STATEMENT_PDF'
  | 'CASCADE_DELETE_DOCUMENT'
  | 'CASCADE_DELETE_CLIENT'
  | 'CASCADE_DELETE_PAYMENT'
  | 'UPSERT_PROFILE';

export type SyncItemStatus =
  | 'PENDING'
  | 'SYNCING'
  | 'FAILED'
  | 'COMPLETED'
  | 'pending'
  | 'syncing'
  | 'failed';

export interface SyncQueueItem {
  id?: number | string; // Auto-increment integer primary key (or string)
  entityType?: SyncEntityType;
  entityId?: string;
  action: SyncActionType | string;
  payload: any;
  status?: SyncItemStatus;
  retryCount?: number;
  lastError?: string | null;
  errorMessage?: string; // Backward compatibility alias
  createdAt?: string; // ISO 8601 string
  updatedAt?: string; // ISO 8601 string
  timestamp?: string; // Backward compatibility alias
  nextRetryAt?: number; // Milliseconds timestamp for exponential backoff scheduling
}

export type SyncHumanStatus =
  | 'All Changes Saved Locally'
  | 'Syncing'
  | 'Cloud Synced'
  | 'Offline - Queued'
  | 'Offline - Local Secure'
  | 'Sync Paused - Retrying';

export interface SyncTelemetry {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  syncingCount: number;
  failedCount: number;
  totalQueuedCount: number;
  lastSyncTimestamp: string | null;
  lastError: string | null;
  statusText: string;
  humanStatus: SyncHumanStatus;
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
  entityType: 'DOCUMENT' | 'CLIENT' | 'PAYMENT' | 'PROFILE' | 'SYNC' | 'SYSTEM' | 'RESERVATION' | 'POS';
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'MUTATION_GUARDED' | 'SELF_HEALED' | 'MERGED' | 'ERROR' | 'WARNING' | 'RECONCILE' | 'SYNC';
  details: string;
  snapshot?: any;
}

export interface Reservation {
  id: string;
  folioNumber: string; // e.g. FOL-2026-001
  guestName: string;
  guestPhone?: string;
  guestEmail?: string;
  guestKraPin?: string;
  clientId?: string;
  clientName?: string;
  unitType: 'Room' | 'Hall';
  unitName: string; // e.g. Executive Suite 101, Maruba Banquet Hall
  checkInDate: string; // YYYY-MM-DD
  checkOutDate: string; // YYYY-MM-DD
  ratePerNight: number;
  nightsOrDays: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  status: 'Reserved' | 'Checked-In' | 'Checked-Out' | 'Cancelled';
  specialRequests?: string;
  invoicedDocId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface POSOrderItem {
  id: string;
  name: string;
  category: 'Breakfast' | 'Starters & Snacks' | 'Main Dishes' | 'Beverages & Juices' | 'Bar & Cocktails' | 'Conference Packages';
  price: number;
  quantity: number;
  amount: number;
}

export interface POSOrder {
  id: string;
  orderNumber: string; // e.g. POS-2026-0089
  tableOrRoom: string; // Table 4, Room 102, Garden Terrace
  guestOrClientName: string;
  items: POSOrderItem[];
  subtotal: number;
  vatAmount: number;
  grandTotal: number;
  paymentMode: 'Cash' | 'M-Pesa' | 'Room Charge' | 'Credit Card' | 'Complimentary';
  status: 'Completed' | 'Pending' | 'Billed to Room';
  receiptNumber?: string;
  createdAt: string;
}

export interface ExpenseRecord {
  id: string;
  expenseNumber: string; // e.g. EXP-2026-0012
  category:
    | 'Kitchen & Food Supplies'
    | 'Beverages & Bar Restock'
    | 'Utilities (Water/Power)'
    | 'Housekeeping & Laundry'
    | 'Repairs & Maintenance'
    | 'Staff & Casual Wages'
    | 'Administrative & Other'
    | 'Maintenance & Repairs'
    | 'Staff & Operations'
    | 'Taxes & Levies'
    | 'Other';
  description: string;
  amount: number;
  date: string;
  paidTo: string;
  paymentMode: 'Cash' | 'M-Pesa' | 'Bank Transfer' | 'Cheque';
  receiptRef?: string;
  createdAt: string;
}

export interface CatalogueItem {
  id: string;
  particulars: string;
  category: 'Accommodation' | 'Conference & Banqueting' | 'Food & Beverage' | 'Equipment & Services';
  standardRate: number;
  taxable: boolean;
  defaultUnit: 'Day' | 'Person/Day' | 'Night' | 'Item' | 'Session';
}

export interface POSMenuItem {
  id: string;
  name: string;
  category: 'Breakfast' | 'Starters & Snacks' | 'Main Dishes' | 'Beverages & Juices' | 'Bar & Cocktails' | 'Conference Packages';
  unitRate: number;
  taxApplicable: boolean;
  description?: string;
  available?: boolean;
  updatedAt?: string;
}

export interface RoomSpaceItem {
  id: string;
  code: string;
  name: string;
  spaceType: 'Room' | 'Conference Hall' | 'Auxiliary Space';
  baseRate: number;
  capacity: string;
  description?: string;
  status: 'Available' | 'Occupied' | 'Maintenance';
  updatedAt?: string;
}

export type ParticularsPreset = CatalogueItem;

