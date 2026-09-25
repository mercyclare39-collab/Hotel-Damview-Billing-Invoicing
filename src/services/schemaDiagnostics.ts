/**
 * SCHEMA DIAGNOSTICS & BIDIRECTIONAL VERIFICATION ENGINE
 * Hotel Damview (Kenya)
 * 
 * Provides comprehensive schema definitions, bidirectional key parity verification,
 * and diagnostic utilities comparing local JSON schemas against Google Sheets structures.
 */

import { BillingDocument, Client, PaymentRecord, LineItem, Reservation, POSOrder, ExpenseRecord, StatementRecord, HotelProfile } from '../types';
import { normalizeKraPin, normalizePhoneNumber, normalizeCurrency } from './sync';

export type SupportedEntityType =
  | 'INVOICE'
  | 'QUOTATION'
  | 'PROFORMA'
  | 'CLIENT'
  | 'RECEIPT'
  | 'LINE_ITEM'
  | 'RESERVATION'
  | 'POS_ORDER'
  | 'EXPENSE'
  | 'STATEMENT'
  | 'HOTEL_PROFILE';

export type SchemaDataType =
  | 'string'
  | 'number'
  | 'currency'
  | 'date'
  | 'datetime'
  | 'code'
  | 'array'
  | 'boolean'
  | 'enum';

export interface FieldMappingDefinition {
  localKey: string;
  localType: string;
  expectedSheetHeader: string;
  gasCanonicalKey: string;
  supportedAliases: string[];
  dataType: SchemaDataType;
  required: boolean;
  defaultValue?: any;
  normalizerRule?: string;
  defensiveShieldRule?: string;
  description: string;
}

export interface EntitySchemaDefinition {
  entityType: SupportedEntityType;
  tabName: string;
  primaryKey: string;
  secondaryKey?: string;
  description: string;
  fields: FieldMappingDefinition[];
  expectedHeaders: string[];
}

export interface FieldMismatchDetail {
  fieldKey: string;
  expectedHeader: string;
  actualHeader?: string;
  issueType: 'MISSING_IN_LOCAL' | 'MISSING_IN_SHEET' | 'HEADER_RENAMED' | 'TYPE_MISMATCH' | 'NULL_VALUE_ON_REQUIRED' | 'EXTRA_UNKNOWN_KEY' | 'FORMAT_DRIFT';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  expectedType: string;
  actualType?: string;
  actualValue?: any;
  suggestion: string;
  autoHealable: boolean;
}

export interface SchemaVerificationReport {
  entityType: SupportedEntityType;
  targetTab: string;
  checkedAt: string;
  isFullyCompliant: boolean;
  parityScore: number; // 0 to 100%
  totalFieldsCount: number;
  matchedFieldsCount: number;
  missingRequiredCount: number;
  missingOptionalCount: number;
  typeMismatchesCount: number;
  unknownExtraKeysCount: number;
  mismatches: FieldMismatchDetail[];
  summaryMessage: string;
}

export interface SheetHeaderParityReport {
  tabName: string;
  expectedHeaders: string[];
  actualHeaders: string[];
  matchedHeaders: string[];
  missingHeaders: string[];
  extraHeaders: string[];
  reorderedHeaders: boolean;
  parityPercentage: number;
  status: 'PERFECT' | 'COMPLIANT_WITH_EXTRAS' | 'DRIFTED_ORDER' | 'MISSING_COLUMNS' | 'TAB_NOT_FOUND';
  remedyAction: string;
}

export interface BidirectionalKeyVerificationResult {
  direction: 'OUTBOUND_PUSH' | 'INBOUND_PULL';
  entityType: SupportedEntityType;
  sourceKeys: string[];
  resolvedTargetKeys: Record<string, string>;
  unresolvedKeys: string[];
  missingCriticalKeys: string[];
  coercedFields: { field: string; from: any; to: any; rule: string }[];
  passed: boolean;
}

export interface ComprehensiveSchemaAuditReport {
  timestamp: string;
  overallParityScore: number; // 0 to 100%
  totalEntitiesAudited: number;
  passedEntitiesCount: number;
  failedEntitiesCount: number;
  sheetsAudited: number;
  sheetParityReports: SheetHeaderParityReport[];
  entityReports: SchemaVerificationReport[];
  driftVectorsIdentified: string[];
  remediationPlan: string[];
}

// ============================================================================
// AUTHORITATIVE SCHEMA SPECIFICATIONS
// ============================================================================

export const CANONICAL_ENTITY_SCHEMAS: Record<SupportedEntityType, EntitySchemaDefinition> = {
  INVOICE: {
    entityType: 'INVOICE',
    tabName: 'Invoices',
    primaryKey: 'documentNumber',
    secondaryKey: 'id',
    description: 'Master Invoices register with tax breakdown, payment tracking, and Drive PDF archives',
    expectedHeaders: [
      'Invoice #',
      'Issue Date',
      'Due Date',
      'Client Name',
      'KRA PIN',
      'Client Address',
      'Gross Subtotal (Ksh)',
      'Discount (Ksh)',
      'Net Subtotal (Ksh)',
      'VAT 16% (Ksh)',
      'Grand Total (Ksh)',
      'Paid (Ksh)',
      'Balance (Ksh)',
      'Status',
      'Drive PDF Link',
      'Last Updated',
      'Doc ID',
    ],
    fields: [
      {
        localKey: 'documentNumber',
        localType: 'string',
        expectedSheetHeader: 'Invoice #',
        gasCanonicalKey: 'documentNumber',
        supportedAliases: ['invoicenum', 'invoice', 'invoicenumber', 'docnum', 'number', 'invoiceno', 'invoiceno.'],
        dataType: 'code',
        required: true,
        normalizerRule: 'Uppercase string regex (INV-YYYY-XXXX)',
        defensiveShieldRule: 'Primary key: Non-destructive overwrite safeguard',
        description: 'Unique sequential invoice code (e.g. INV-2026-0001)',
      },
      {
        localKey: 'issueDate',
        localType: 'string',
        expectedSheetHeader: 'Issue Date',
        gasCanonicalKey: 'issueDate',
        supportedAliases: ['issuedate', 'date', 'invoicedate', 'billdate', 'createddate'],
        dataType: 'date',
        required: true,
        normalizerRule: 'Pinned YYYY-MM-DD Nairobi timezone string',
        description: 'Invoice billing issuance date',
      },
      {
        localKey: 'dueDate',
        localType: 'string',
        expectedSheetHeader: 'Due Date',
        gasCanonicalKey: 'dueDate',
        supportedAliases: ['duedate', 'validuntil', 'paymentdue', 'expirydate', 'paymentduedate'],
        dataType: 'date',
        required: true,
        normalizerRule: 'Pinned YYYY-MM-DD Nairobi timezone string',
        description: 'Payment due date / credit terms deadline',
      },
      {
        localKey: 'clientName',
        localType: 'string',
        expectedSheetHeader: 'Client Name',
        gasCanonicalKey: 'clientName',
        supportedAliases: ['clientname', 'companyname', 'guestname', 'customername', 'client', 'customer', 'companyguestname'],
        dataType: 'text' as any,
        required: true,
        defensiveShieldRule: 'Preserve local non-empty client name against empty remote cell',
        description: 'Billed corporate entity or individual guest',
      },
      {
        localKey: 'clientKraPin',
        localType: 'string',
        expectedSheetHeader: 'KRA PIN',
        gasCanonicalKey: 'clientKraPin',
        supportedAliases: ['krapin', 'pin', 'taxpin', 'clientkrapin', 'clientpin', 'vatpin'],
        dataType: 'code',
        required: false,
        normalizerRule: 'Regex [A-Z]\\d{9}[A-Z] uppercase',
        defensiveShieldRule: 'Apostrophe prefix in Sheets to preserve exact casing and format',
        description: 'Kenyan Revenue Authority Tax PIN',
      },
      {
        localKey: 'clientAddress',
        localType: 'string',
        expectedSheetHeader: 'Client Address',
        gasCanonicalKey: 'clientAddress',
        supportedAliases: ['clientaddress', 'address', 'physicalpostaladdress', 'physicaladdress', 'postaladdress', 'location'],
        dataType: 'text' as any,
        required: false,
        defensiveShieldRule: 'Preserves linebreaks and prevents formula injection',
        description: 'Physical and postal address of client',
      },
      {
        localKey: 'grossSubtotal',
        localType: 'number',
        expectedSheetHeader: 'Gross Subtotal (Ksh)',
        gasCanonicalKey: 'grossSubtotal',
        supportedAliases: ['grosssubtotalksh', 'grosssubtotal', 'subtotalgross', 'grossamount'],
        dataType: 'currency',
        required: false,
        normalizerRule: '2-decimal float normalized via Number.EPSILON',
        description: 'Sum of line items before overall document discount',
      },
      {
        localKey: 'discount',
        localType: 'number',
        expectedSheetHeader: 'Discount (Ksh)',
        gasCanonicalKey: 'discount',
        supportedAliases: ['discountksh', 'discount', 'discountamount', 'lessdiscount', 'totaldiscount'],
        dataType: 'currency',
        required: false,
        normalizerRule: '2-decimal float normalized >= 0',
        description: 'Total document-level discount applied',
      },
      {
        localKey: 'subtotal',
        localType: 'number',
        expectedSheetHeader: 'Net Subtotal (Ksh)',
        gasCanonicalKey: 'subtotal',
        supportedAliases: ['netsubtotalksh', 'netsubtotal', 'subtotal', 'taxablesubtotal', 'taxablesubtotalksh', 'taxableamount', 'netamount'],
        dataType: 'currency',
        required: true,
        normalizerRule: 'Statutory 16% VAT-exclusive taxable base (discountedTotal / 1.16)',
        description: 'Net taxable subtotal excluding 16% statutory VAT',
      },
      {
        localKey: 'vatAmount',
        localType: 'number',
        expectedSheetHeader: 'VAT 16% (Ksh)',
        gasCanonicalKey: 'vatAmount',
        supportedAliases: ['vat16ksh', 'vatamount', 'vat16', 'vat', 'tax', 'vat16amount', 'vat16%ksh', 'vat(16%)', 'vat16%', 'vat16percent'],
        dataType: 'currency',
        required: true,
        normalizerRule: 'Statutory 16% VAT amount (discountedTotal - subtotal)',
        description: 'Kenyan statutory 16% Value Added Tax amount',
      },
      {
        localKey: 'grandTotal',
        localType: 'number',
        expectedSheetHeader: 'Grand Total (Ksh)',
        gasCanonicalKey: 'grandTotal',
        supportedAliases: ['grandtotalksh', 'grandtotal', 'totalamountksh', 'totalamount', 'total', 'billtotal', 'invoicetotal'],
        dataType: 'currency',
        required: true,
        normalizerRule: 'Gross inclusive total payable',
        description: 'Final invoice gross total payable (Ksh)',
      },
      {
        localKey: 'amountPaid',
        localType: 'number',
        expectedSheetHeader: 'Paid (Ksh)',
        gasCanonicalKey: 'amountPaid',
        supportedAliases: ['paidksh', 'paid', 'amountpaidksh', 'amountpaid', 'settled', 'payments', 'totalpaid'],
        dataType: 'currency',
        required: true,
        defaultValue: 0,
        normalizerRule: 'Reconciled sum of linked receipt records',
        description: 'Total payments received against this invoice',
      },
      {
        localKey: 'balanceDue',
        localType: 'number',
        expectedSheetHeader: 'Balance (Ksh)',
        gasCanonicalKey: 'balanceDue',
        supportedAliases: ['balanceksh', 'balance', 'balancedueksh', 'balancedue', 'outstanding', 'amountdue', 'currentbalance'],
        dataType: 'currency',
        required: true,
        normalizerRule: 'grandTotal - amountPaid (clamped to 2 decimals)',
        description: 'Remaining unpaid balance on invoice',
      },
      {
        localKey: 'status',
        localType: 'DocumentStatus',
        expectedSheetHeader: 'Status',
        gasCanonicalKey: 'status',
        supportedAliases: ['status', 'paymentstatus', 'docstatus', 'state'],
        dataType: 'enum',
        required: true,
        normalizerRule: 'Draft | Sent | Partial | Paid | Overdue',
        description: 'Lifecycle settlement and dispatch status',
      },
      {
        localKey: 'driveFileUrl',
        localType: 'string',
        expectedSheetHeader: 'Drive PDF Link',
        gasCanonicalKey: 'driveFileUrl',
        supportedAliases: ['drivepdflink', 'drivefileurl', 'driveurl', 'pdfurl', 'drivelink', 'documentlink', 'pdflink', 'webviewlink'],
        dataType: 'string',
        required: false,
        description: 'Public Google Drive PDF archive link',
      },
      {
        localKey: 'updatedAt',
        localType: 'string',
        expectedSheetHeader: 'Last Updated',
        gasCanonicalKey: 'updatedAt',
        supportedAliases: ['lastupdated', 'updatedat', 'modifiedat', 'timestamp'],
        dataType: 'datetime',
        required: true,
        normalizerRule: 'ISO 8601 UTC timestamp',
        description: 'Timestamp of last modification for conflict resolution',
      },
      {
        localKey: 'id',
        localType: 'string',
        expectedSheetHeader: 'Doc ID',
        gasCanonicalKey: 'id',
        supportedAliases: ['docid', 'id', 'documentid', 'uid'],
        dataType: 'code',
        required: true,
        description: 'Internal unique GUID primary key',
      },
    ],
  },

  QUOTATION: {
    entityType: 'QUOTATION',
    tabName: 'Quotations',
    primaryKey: 'documentNumber',
    secondaryKey: 'id',
    description: 'Master Quotations & Estimates register',
    expectedHeaders: [
      'Quotation #',
      'Issue Date',
      'Valid Until',
      'Client Name',
      'KRA PIN',
      'Client Address',
      'Gross Subtotal (Ksh)',
      'Discount (Ksh)',
      'Net Subtotal (Ksh)',
      'VAT 16% (Ksh)',
      'Grand Total (Ksh)',
      'Status',
      'Drive PDF Link',
      'Last Updated',
      'Doc ID',
    ],
    fields: [
      {
        localKey: 'documentNumber',
        localType: 'string',
        expectedSheetHeader: 'Quotation #',
        gasCanonicalKey: 'documentNumber',
        supportedAliases: ['quotationnum', 'quotation', 'quotationnumber', 'docnum', 'number', 'quotationno'],
        dataType: 'code',
        required: true,
        description: 'Unique quotation reference (e.g. QT-2026-0001)',
      },
      {
        localKey: 'issueDate',
        localType: 'string',
        expectedSheetHeader: 'Issue Date',
        gasCanonicalKey: 'issueDate',
        supportedAliases: ['issuedate', 'date', 'quotationdate', 'createddate'],
        dataType: 'date',
        required: true,
        description: 'Quotation creation date',
      },
      {
        localKey: 'dueDate',
        localType: 'string',
        expectedSheetHeader: 'Valid Until',
        gasCanonicalKey: 'dueDate',
        supportedAliases: ['validuntil', 'duedate', 'validity', 'expirydate', 'validtodate'],
        dataType: 'date',
        required: true,
        description: 'Validity expiration date',
      },
      {
        localKey: 'clientName',
        localType: 'string',
        expectedSheetHeader: 'Client Name',
        gasCanonicalKey: 'clientName',
        supportedAliases: ['clientname', 'companyname', 'guestname', 'customername', 'client', 'customer'],
        dataType: 'string',
        required: true,
        description: 'Prospective client / organization',
      },
      {
        localKey: 'clientKraPin',
        localType: 'string',
        expectedSheetHeader: 'KRA PIN',
        gasCanonicalKey: 'clientKraPin',
        supportedAliases: ['krapin', 'pin', 'taxpin', 'clientkrapin', 'clientpin'],
        dataType: 'code',
        required: false,
        description: 'Tax PIN for corporate quotation',
      },
      {
        localKey: 'clientAddress',
        localType: 'string',
        expectedSheetHeader: 'Client Address',
        gasCanonicalKey: 'clientAddress',
        supportedAliases: ['clientaddress', 'address', 'physicalpostaladdress', 'location'],
        dataType: 'string',
        required: false,
        description: 'Client physical or postal address',
      },
      {
        localKey: 'grossSubtotal',
        localType: 'number',
        expectedSheetHeader: 'Gross Subtotal (Ksh)',
        gasCanonicalKey: 'grossSubtotal',
        supportedAliases: ['grosssubtotalksh', 'grosssubtotal', 'subtotalgross'],
        dataType: 'currency',
        required: false,
        description: 'Gross line items sum',
      },
      {
        localKey: 'discount',
        localType: 'number',
        expectedSheetHeader: 'Discount (Ksh)',
        gasCanonicalKey: 'discount',
        supportedAliases: ['discountksh', 'discount', 'discountamount', 'lessdiscount'],
        dataType: 'currency',
        required: false,
        description: 'Promotional discount amount',
      },
      {
        localKey: 'subtotal',
        localType: 'number',
        expectedSheetHeader: 'Net Subtotal (Ksh)',
        gasCanonicalKey: 'subtotal',
        supportedAliases: ['netsubtotalksh', 'netsubtotal', 'subtotal', 'taxablesubtotal'],
        dataType: 'currency',
        required: true,
        description: 'Net taxable subtotal (excl. VAT)',
      },
      {
        localKey: 'vatAmount',
        localType: 'number',
        expectedSheetHeader: 'VAT 16% (Ksh)',
        gasCanonicalKey: 'vatAmount',
        supportedAliases: ['vat16ksh', 'vatamount', 'vat16', 'vat', 'tax'],
        dataType: 'currency',
        required: true,
        description: '16% VAT value',
      },
      {
        localKey: 'grandTotal',
        localType: 'number',
        expectedSheetHeader: 'Grand Total (Ksh)',
        gasCanonicalKey: 'grandTotal',
        supportedAliases: ['grandtotalksh', 'grandtotal', 'totalamountksh', 'totalamount'],
        dataType: 'currency',
        required: true,
        description: 'Total quote amount payable',
      },
      {
        localKey: 'status',
        localType: 'DocumentStatus',
        expectedSheetHeader: 'Status',
        gasCanonicalKey: 'status',
        supportedAliases: ['status', 'docstatus', 'state'],
        dataType: 'enum',
        required: true,
        description: 'Quotation lifecycle status (Draft, Sent)',
      },
      {
        localKey: 'driveFileUrl',
        localType: 'string',
        expectedSheetHeader: 'Drive PDF Link',
        gasCanonicalKey: 'driveFileUrl',
        supportedAliases: ['drivepdflink', 'drivefileurl', 'driveurl', 'pdfurl', 'drivelink'],
        dataType: 'string',
        required: false,
        description: 'Google Drive PDF link',
      },
      {
        localKey: 'updatedAt',
        localType: 'string',
        expectedSheetHeader: 'Last Updated',
        gasCanonicalKey: 'updatedAt',
        supportedAliases: ['lastupdated', 'updatedat', 'modifiedat'],
        dataType: 'datetime',
        required: true,
        description: 'Last update timestamp',
      },
      {
        localKey: 'id',
        localType: 'string',
        expectedSheetHeader: 'Doc ID',
        gasCanonicalKey: 'id',
        supportedAliases: ['docid', 'id', 'documentid', 'uid'],
        dataType: 'code',
        required: true,
        description: 'Internal GUID',
      },
    ],
  },

  PROFORMA: {
    entityType: 'PROFORMA',
    tabName: 'Proformas',
    primaryKey: 'documentNumber',
    secondaryKey: 'id',
    description: 'Master Proforma Invoices register',
    expectedHeaders: [
      'Proforma #',
      'Issue Date',
      'Due Date',
      'Client Name',
      'KRA PIN',
      'Client Address',
      'Gross Subtotal (Ksh)',
      'Discount (Ksh)',
      'Net Subtotal (Ksh)',
      'VAT 16% (Ksh)',
      'Grand Total (Ksh)',
      'Status',
      'Drive PDF Link',
      'Last Updated',
      'Doc ID',
    ],
    fields: [
      {
        localKey: 'documentNumber',
        localType: 'string',
        expectedSheetHeader: 'Proforma #',
        gasCanonicalKey: 'documentNumber',
        supportedAliases: ['proformanum', 'proforma', 'proformanumber', 'docnum', 'number', 'proformano'],
        dataType: 'code',
        required: true,
        description: 'Unique proforma code (e.g. PI-2026-0001)',
      },
      {
        localKey: 'issueDate',
        localType: 'string',
        expectedSheetHeader: 'Issue Date',
        gasCanonicalKey: 'issueDate',
        supportedAliases: ['issuedate', 'date', 'proformadate'],
        dataType: 'date',
        required: true,
        description: 'Proforma issuance date',
      },
      {
        localKey: 'dueDate',
        localType: 'string',
        expectedSheetHeader: 'Due Date',
        gasCanonicalKey: 'dueDate',
        supportedAliases: ['duedate', 'validuntil', 'validity', 'paymentdue'],
        dataType: 'date',
        required: true,
        description: 'Advance payment due date',
      },
      {
        localKey: 'clientName',
        localType: 'string',
        expectedSheetHeader: 'Client Name',
        gasCanonicalKey: 'clientName',
        supportedAliases: ['clientname', 'companyname', 'guestname', 'customername', 'client'],
        dataType: 'string',
        required: true,
        description: 'Client name',
      },
      {
        localKey: 'clientKraPin',
        localType: 'string',
        expectedSheetHeader: 'KRA PIN',
        gasCanonicalKey: 'clientKraPin',
        supportedAliases: ['krapin', 'pin', 'taxpin', 'clientkrapin', 'clientpin'],
        dataType: 'code',
        required: false,
        description: 'Client Tax PIN',
      },
      {
        localKey: 'clientAddress',
        localType: 'string',
        expectedSheetHeader: 'Client Address',
        gasCanonicalKey: 'clientAddress',
        supportedAliases: ['clientaddress', 'address', 'location'],
        dataType: 'string',
        required: false,
        description: 'Physical/Postal address',
      },
      {
        localKey: 'grossSubtotal',
        localType: 'number',
        expectedSheetHeader: 'Gross Subtotal (Ksh)',
        gasCanonicalKey: 'grossSubtotal',
        supportedAliases: ['grosssubtotalksh', 'grosssubtotal'],
        dataType: 'currency',
        required: false,
        description: 'Sum before discount',
      },
      {
        localKey: 'discount',
        localType: 'number',
        expectedSheetHeader: 'Discount (Ksh)',
        gasCanonicalKey: 'discount',
        supportedAliases: ['discountksh', 'discount'],
        dataType: 'currency',
        required: false,
        description: 'Discount amount',
      },
      {
        localKey: 'subtotal',
        localType: 'number',
        expectedSheetHeader: 'Net Subtotal (Ksh)',
        gasCanonicalKey: 'subtotal',
        supportedAliases: ['netsubtotalksh', 'netsubtotal', 'subtotal'],
        dataType: 'currency',
        required: true,
        description: 'Taxable subtotal',
      },
      {
        localKey: 'vatAmount',
        localType: 'number',
        expectedSheetHeader: 'VAT 16% (Ksh)',
        gasCanonicalKey: 'vatAmount',
        supportedAliases: ['vat16ksh', 'vatamount', 'vat16'],
        dataType: 'currency',
        required: true,
        description: '16% statutory VAT',
      },
      {
        localKey: 'grandTotal',
        localType: 'number',
        expectedSheetHeader: 'Grand Total (Ksh)',
        gasCanonicalKey: 'grandTotal',
        supportedAliases: ['grandtotalksh', 'grandtotal', 'totalamountksh', 'total'],
        dataType: 'currency',
        required: true,
        description: 'Total proforma amount',
      },
      {
        localKey: 'status',
        localType: 'DocumentStatus',
        expectedSheetHeader: 'Status',
        gasCanonicalKey: 'status',
        supportedAliases: ['status', 'docstatus'],
        dataType: 'enum',
        required: true,
        description: 'Proforma status',
      },
      {
        localKey: 'driveFileUrl',
        localType: 'string',
        expectedSheetHeader: 'Drive PDF Link',
        gasCanonicalKey: 'driveFileUrl',
        supportedAliases: ['drivepdflink', 'drivefileurl', 'driveurl', 'pdfurl'],
        dataType: 'string',
        required: false,
        description: 'Drive PDF link',
      },
      {
        localKey: 'updatedAt',
        localType: 'string',
        expectedSheetHeader: 'Last Updated',
        gasCanonicalKey: 'updatedAt',
        supportedAliases: ['lastupdated', 'updatedat'],
        dataType: 'datetime',
        required: true,
        description: 'Last updated timestamp',
      },
      {
        localKey: 'id',
        localType: 'string',
        expectedSheetHeader: 'Doc ID',
        gasCanonicalKey: 'id',
        supportedAliases: ['docid', 'id', 'documentid'],
        dataType: 'code',
        required: true,
        description: 'Unique internal ID',
      },
    ],
  },

  CLIENT: {
    entityType: 'CLIENT',
    tabName: 'Clients',
    primaryKey: 'id',
    secondaryKey: 'name',
    description: 'Master Client Directory with Phone & KRA PIN protection',
    expectedHeaders: [
      'Client ID',
      'Company / Guest Name',
      'Contact Person',
      'KRA PIN',
      'Email',
      'Phone',
      'Physical / Postal Address',
      'Registered Date',
      'Last Updated',
    ],
    fields: [
      {
        localKey: 'id',
        localType: 'string',
        expectedSheetHeader: 'Client ID',
        gasCanonicalKey: 'id',
        supportedAliases: ['clientid', 'id', 'customerid', 'uid'],
        dataType: 'code',
        required: true,
        description: 'Client unique identifier',
      },
      {
        localKey: 'name',
        localType: 'string',
        expectedSheetHeader: 'Company / Guest Name',
        gasCanonicalKey: 'name',
        supportedAliases: ['companyguestname', 'clientname', 'companyname', 'guestname', 'name', 'client', 'customer'],
        dataType: 'string',
        required: true,
        defensiveShieldRule: 'Non-destructive preservation against empty incoming strings',
        description: 'Client or Company legal name',
      },
      {
        localKey: 'contactPerson',
        localType: 'string',
        expectedSheetHeader: 'Contact Person',
        gasCanonicalKey: 'contactPerson',
        supportedAliases: ['contactperson', 'contact', 'person', 'attn', 'contactname'],
        dataType: 'string',
        required: false,
        description: 'Representative or liaison name',
      },
      {
        localKey: 'kraPin',
        localType: 'string',
        expectedSheetHeader: 'KRA PIN',
        gasCanonicalKey: 'kraPin',
        supportedAliases: ['krapin', 'pin', 'taxpin', 'clientkrapin', 'vatnumber'],
        dataType: 'code',
        required: false,
        normalizerRule: 'Regex [A-Z]\\d{9}[A-Z] uppercase',
        description: 'Client KRA PIN',
      },
      {
        localKey: 'email',
        localType: 'string',
        expectedSheetHeader: 'Email',
        gasCanonicalKey: 'email',
        supportedAliases: ['email', 'emailaddress', 'contactemail', 'clientemail'],
        dataType: 'string',
        required: false,
        normalizerRule: 'Lowercase email regex validation',
        description: 'Official correspondence email',
      },
      {
        localKey: 'phone',
        localType: 'string',
        expectedSheetHeader: 'Phone',
        gasCanonicalKey: 'phone',
        supportedAliases: ['phone', 'phonenumber', 'telephone', 'mobile', 'cell', 'tel', 'contactphone'],
        dataType: 'code',
        required: false,
        normalizerRule: 'Canonical Kenyan E.164 string format (+254...)',
        defensiveShieldRule: 'Apostrophe prefix in Sheets to prevent scientific notation (e.g. 2.54E+11)',
        description: 'Primary phone number',
      },
      {
        localKey: 'address',
        localType: 'string',
        expectedSheetHeader: 'Physical / Postal Address',
        gasCanonicalKey: 'address',
        supportedAliases: ['physicalpostaladdress', 'physicaladdress', 'postaladdress', 'address', 'location', 'clientaddress'],
        dataType: 'string',
        required: false,
        description: 'Physical location and postal box address',
      },
      {
        localKey: 'createdAt',
        localType: 'string',
        expectedSheetHeader: 'Registered Date',
        gasCanonicalKey: 'createdAt',
        supportedAliases: ['registereddate', 'createdat', 'datecreated', 'registrationdate', 'enrolleddate'],
        dataType: 'date',
        required: true,
        description: 'Client account enrollment date',
      },
      {
        localKey: 'updatedAt',
        localType: 'string',
        expectedSheetHeader: 'Last Updated',
        gasCanonicalKey: 'updatedAt',
        supportedAliases: ['lastupdated', 'updatedat', 'timestamp', 'modifiedat'],
        dataType: 'datetime',
        required: true,
        description: 'Last modification timestamp',
      },
    ],
  },

  RECEIPT: {
    entityType: 'RECEIPT',
    tabName: 'Receipts',
    primaryKey: 'receiptNumber',
    secondaryKey: 'id',
    description: 'Master Payment Receipts Register with reconciliation links',
    expectedHeaders: [
      'Receipt #',
      'Date',
      'Client Name',
      'Settled Doc #',
      'Payment Mode',
      'Amount (Ksh)',
      'Reference Note',
      'Drive PDF Link',
      'Recorded At',
      'Payment ID',
    ],
    fields: [
      {
        localKey: 'receiptNumber',
        localType: 'string',
        expectedSheetHeader: 'Receipt #',
        gasCanonicalKey: 'receiptNumber',
        supportedAliases: ['receiptnum', 'receipt', 'receiptno', 'number', 'docnum', 'recnum', 'receiptno.'],
        dataType: 'code',
        required: true,
        description: 'Unique receipt code (e.g. REC-2026-0001)',
      },
      {
        localKey: 'date',
        localType: 'string',
        expectedSheetHeader: 'Date',
        gasCanonicalKey: 'date',
        supportedAliases: ['date', 'paymentdate', 'receiptdate', 'transactiondate'],
        dataType: 'date',
        required: true,
        description: 'Payment transaction date (YYYY-MM-DD)',
      },
      {
        localKey: 'clientName',
        localType: 'string',
        expectedSheetHeader: 'Client Name',
        gasCanonicalKey: 'clientName',
        supportedAliases: ['clientname', 'customername', 'guestname', 'client', 'receivedfrom', 'payer'],
        dataType: 'string',
        required: true,
        description: 'Client or guest who paid',
      },
      {
        localKey: 'documentNumber',
        localType: 'string',
        expectedSheetHeader: 'Settled Doc #',
        gasCanonicalKey: 'documentNumber',
        supportedAliases: ['settleddocnum', 'settleddoc', 'invoicenumber', 'invoicenum', 'docnum', 'settleddocument', 'invoiceno'],
        dataType: 'code',
        required: false,
        description: 'Reference to invoice settled by this payment',
      },
      {
        localKey: 'paymentMode',
        localType: 'string',
        expectedSheetHeader: 'Payment Mode',
        gasCanonicalKey: 'paymentMode',
        supportedAliases: ['paymentmode', 'method', 'mode', 'paymentmethod', 'channel'],
        dataType: 'enum',
        required: true,
        description: 'M-Pesa, Bank Transfer, Cash, Credit Card, or Cheque',
      },
      {
        localKey: 'amount',
        localType: 'number',
        expectedSheetHeader: 'Amount (Ksh)',
        gasCanonicalKey: 'amount',
        supportedAliases: ['amountksh', 'amount', 'paidamount', 'totalpaid', 'receivedamount'],
        dataType: 'currency',
        required: true,
        normalizerRule: '2-decimal float normalized >= 0.01',
        description: 'Gross receipt amount paid in Ksh',
      },
      {
        localKey: 'referenceNote',
        localType: 'string',
        expectedSheetHeader: 'Reference Note',
        gasCanonicalKey: 'referenceNote',
        supportedAliases: ['referencenote', 'reference', 'note', 'mpesacode', 'transactioncode', 'details', 'chequeno'],
        dataType: 'string',
        required: false,
        description: 'M-Pesa code, cheque number, or bank transaction reference',
      },
      {
        localKey: 'driveFileUrl',
        localType: 'string',
        expectedSheetHeader: 'Drive PDF Link',
        gasCanonicalKey: 'driveFileUrl',
        supportedAliases: ['drivepdflink', 'drivefileurl', 'driveurl', 'receipturl', 'pdfurl', 'drivelink', 'pdflink', 'webviewlink'],
        dataType: 'string',
        required: false,
        description: 'Google Drive PDF receipt archive link',
      },
      {
        localKey: 'createdAt',
        localType: 'string',
        expectedSheetHeader: 'Recorded At',
        gasCanonicalKey: 'createdAt',
        supportedAliases: ['recordedat', 'createdat', 'timestamp'],
        dataType: 'datetime',
        required: true,
        description: 'Timestamp when receipt was recorded',
      },
      {
        localKey: 'id',
        localType: 'string',
        expectedSheetHeader: 'Payment ID',
        gasCanonicalKey: 'id',
        supportedAliases: ['paymentid', 'id', 'receiptid', 'uid'],
        dataType: 'code',
        required: true,
        description: 'Internal unique GUID',
      },
    ],
  },

  LINE_ITEM: {
    entityType: 'LINE_ITEM',
    tabName: 'Line_Items_Breakdown',
    primaryKey: 'id',
    secondaryKey: 'documentNumber',
    description: 'Itemized Breakdown for Accommodations, Dining & Services',
    expectedHeaders: [
      'Document #',
      'Doc Type',
      'Issue Date',
      'Client Name',
      'Service / Particulars',
      'Quantity',
      'Days / Units',
      'Unit Rate (Ksh)',
      'Discount (Ksh)',
      'Total Amount (Ksh)',
      'Item ID',
    ],
    fields: [
      {
        localKey: 'documentNumber',
        localType: 'string',
        expectedSheetHeader: 'Document #',
        gasCanonicalKey: 'documentNumber',
        supportedAliases: ['documentnum', 'docnum', 'invoicenum', 'number', 'invoiceno'],
        dataType: 'code',
        required: true,
        description: 'Parent document code (e.g. INV-2026-0001)',
      },
      {
        localKey: 'documentType',
        localType: 'string',
        expectedSheetHeader: 'Doc Type',
        gasCanonicalKey: 'documentType',
        supportedAliases: ['doctype', 'documenttype', 'type'],
        dataType: 'string',
        required: true,
        description: 'Parent document type (INVOICE, QUOTATION, PROFORMA)',
      },
      {
        localKey: 'issueDate',
        localType: 'string',
        expectedSheetHeader: 'Issue Date',
        gasCanonicalKey: 'issueDate',
        supportedAliases: ['issuedate', 'date'],
        dataType: 'date',
        required: true,
        description: 'Parent document issue date',
      },
      {
        localKey: 'clientName',
        localType: 'string',
        expectedSheetHeader: 'Client Name',
        gasCanonicalKey: 'clientName',
        supportedAliases: ['clientname', 'customername', 'guestname', 'client'],
        dataType: 'string',
        required: true,
        description: 'Client name on parent document',
      },
      {
        localKey: 'particulars',
        localType: 'string',
        expectedSheetHeader: 'Service / Particulars',
        gasCanonicalKey: 'particulars',
        supportedAliases: ['serviceparticulars', 'particulars', 'description', 'item', 'service', 'itemdescription'],
        dataType: 'string',
        required: true,
        description: 'Item or service description',
      },
      {
        localKey: 'quantity',
        localType: 'number',
        expectedSheetHeader: 'Quantity',
        gasCanonicalKey: 'quantity',
        supportedAliases: ['quantity', 'qty', 'count'],
        dataType: 'number',
        required: true,
        description: 'Count or number of delegates',
      },
      {
        localKey: 'days',
        localType: 'number',
        expectedSheetHeader: 'Days / Units',
        gasCanonicalKey: 'days',
        supportedAliases: ['daysunits', 'days', 'units', 'nights', 'duration'],
        dataType: 'number',
        required: true,
        description: 'Nights, days, or service multiplier',
      },
      {
        localKey: 'rate',
        localType: 'number',
        expectedSheetHeader: 'Unit Rate (Ksh)',
        gasCanonicalKey: 'rate',
        supportedAliases: ['unitrateksh', 'unitrate', 'rate', 'price', 'unitprice'],
        dataType: 'currency',
        required: true,
        description: 'Per-unit rate in Ksh',
      },
      {
        localKey: 'discount',
        localType: 'number',
        expectedSheetHeader: 'Discount (Ksh)',
        gasCanonicalKey: 'discount',
        supportedAliases: ['discountksh', 'discount', 'itemdiscount'],
        dataType: 'currency',
        required: false,
        defaultValue: 0,
        description: 'Line item discount in Ksh',
      },
      {
        localKey: 'amount',
        localType: 'number',
        expectedSheetHeader: 'Total Amount (Ksh)',
        gasCanonicalKey: 'totalAmount',
        supportedAliases: ['totalamountksh', 'totalamount', 'amount', 'total', 'lineamount', 'amountksh'],
        dataType: 'currency',
        required: true,
        normalizerRule: '(quantity * days * rate) - discount',
        description: 'Total calculated line amount in Ksh',
      },
      {
        localKey: 'id',
        localType: 'string',
        expectedSheetHeader: 'Item ID',
        gasCanonicalKey: 'id',
        supportedAliases: ['itemid', 'id', 'lineitemid', 'uid'],
        dataType: 'code',
        required: true,
        description: 'Unique line item GUID',
      },
    ],
  },

  RESERVATION: {
    entityType: 'RESERVATION',
    tabName: 'Reservations',
    primaryKey: 'id',
    secondaryKey: 'folioNumber',
    description: 'Room Bookings & Accommodation Schedule',
    expectedHeaders: [
      'Reservation ID',
      'Guest Name',
      'Phone / Contact',
      'Room / Accommodation',
      'Check-In Date',
      'Check-Out Date',
      'Status',
      'Total Amount (Ksh)',
      'Paid (Ksh)',
      'Balance (Ksh)',
      'Last Updated',
    ],
    fields: [
      {
        localKey: 'id',
        localType: 'string',
        expectedSheetHeader: 'Reservation ID',
        gasCanonicalKey: 'id',
        supportedAliases: ['reservationid', 'id', 'bookingnumber', 'bookingid', 'resno', 'folioNumber'],
        dataType: 'code',
        required: true,
        description: 'Unique reservation ID or Folio code',
      },
      {
        localKey: 'guestName',
        localType: 'string',
        expectedSheetHeader: 'Guest Name',
        gasCanonicalKey: 'guestName',
        supportedAliases: ['guestname', 'name', 'clientname', 'customer'],
        dataType: 'string',
        required: true,
        description: 'Primary guest name',
      },
      {
        localKey: 'guestPhone',
        localType: 'string',
        expectedSheetHeader: 'Phone / Contact',
        gasCanonicalKey: 'phone',
        supportedAliases: ['phonecontact', 'phone', 'contact', 'mobile', 'guestPhone'],
        dataType: 'code',
        required: false,
        normalizerRule: 'Canonical Kenyan E.164 phone string',
        description: 'Guest phone number',
      },
      {
        localKey: 'unitName',
        localType: 'string',
        expectedSheetHeader: 'Room / Accommodation',
        gasCanonicalKey: 'room',
        supportedAliases: ['roomaccommodation', 'room', 'roomnumber', 'accommodation', 'unitName'],
        dataType: 'string',
        required: true,
        description: 'Assigned room number or conference space',
      },
      {
        localKey: 'checkInDate',
        localType: 'string',
        expectedSheetHeader: 'Check-In Date',
        gasCanonicalKey: 'checkInDate',
        supportedAliases: ['checkindate', 'checkin', 'arrivaldate', 'fromdate'],
        dataType: 'date',
        required: true,
        description: 'Scheduled arrival date',
      },
      {
        localKey: 'checkOutDate',
        localType: 'string',
        expectedSheetHeader: 'Check-Out Date',
        gasCanonicalKey: 'checkOutDate',
        supportedAliases: ['checkoutdate', 'checkout', 'departuredate', 'todate'],
        dataType: 'date',
        required: true,
        description: 'Scheduled departure date',
      },
      {
        localKey: 'status',
        localType: 'string',
        expectedSheetHeader: 'Status',
        gasCanonicalKey: 'status',
        supportedAliases: ['status', 'reservationstatus'],
        dataType: 'enum',
        required: true,
        description: 'Reserved, Checked-In, Checked-Out, or Cancelled',
      },
      {
        localKey: 'totalAmount',
        localType: 'number',
        expectedSheetHeader: 'Total Amount (Ksh)',
        gasCanonicalKey: 'totalAmount',
        supportedAliases: ['totalamountksh', 'totalamount', 'total', 'grandtotal'],
        dataType: 'currency',
        required: true,
        description: 'Total accommodation cost',
      },
      {
        localKey: 'amountPaid',
        localType: 'number',
        expectedSheetHeader: 'Paid (Ksh)',
        gasCanonicalKey: 'amountPaid',
        supportedAliases: ['paidksh', 'amountpaid', 'paid'],
        dataType: 'currency',
        required: true,
        defaultValue: 0,
        description: 'Deposit or payments settled',
      },
      {
        localKey: 'balanceDue',
        localType: 'number',
        expectedSheetHeader: 'Balance (Ksh)',
        gasCanonicalKey: 'balance',
        supportedAliases: ['balanceksh', 'balance', 'remaining', 'balanceDue'],
        dataType: 'currency',
        required: true,
        description: 'Outstanding reservation balance',
      },
      {
        localKey: 'updatedAt',
        localType: 'string',
        expectedSheetHeader: 'Last Updated',
        gasCanonicalKey: 'updatedAt',
        supportedAliases: ['lastupdated', 'updatedat', 'timestamp'],
        dataType: 'datetime',
        required: true,
        description: 'Modification timestamp',
      },
    ],
  },

  POS_ORDER: {
    entityType: 'POS_ORDER',
    tabName: 'POS_Orders',
    primaryKey: 'orderNumber',
    secondaryKey: 'id',
    description: 'Dining & Bar Orders Ledger',
    expectedHeaders: [
      'Order #',
      'Order Date',
      'Guest / Table',
      'Location / Station',
      'Items Summary',
      'Subtotal (Ksh)',
      'Tax (Ksh)',
      'Total Amount (Ksh)',
      'Payment Mode',
      'Status',
      'Last Updated',
    ],
    fields: [
      {
        localKey: 'orderNumber',
        localType: 'string',
        expectedSheetHeader: 'Order #',
        gasCanonicalKey: 'orderNumber',
        supportedAliases: ['ordernum', 'ordernumber', 'order', 'orderno', 'id'],
        dataType: 'code',
        required: true,
        description: 'POS order code (e.g. POS-2026-0001)',
      },
      {
        localKey: 'createdAt',
        localType: 'string',
        expectedSheetHeader: 'Order Date',
        gasCanonicalKey: 'orderDate',
        supportedAliases: ['orderdate', 'date', 'createdat'],
        dataType: 'date',
        required: true,
        description: 'Order placement timestamp',
      },
      {
        localKey: 'tableOrRoom',
        localType: 'string',
        expectedSheetHeader: 'Guest / Table',
        gasCanonicalKey: 'guestTable',
        supportedAliases: ['guesttable', 'guest', 'table', 'tableno', 'guestname', 'customer', 'tableOrRoom'],
        dataType: 'string',
        required: true,
        description: 'Table number or Guest folio',
      },
      {
        localKey: 'guestOrClientName',
        localType: 'string',
        expectedSheetHeader: 'Location / Station',
        gasCanonicalKey: 'location',
        supportedAliases: ['locationstation', 'location', 'station', 'point', 'guestOrClientName'],
        dataType: 'string',
        required: false,
        description: 'Restaurant, Terrace, Bar, or Room Service',
      },
      {
        localKey: 'items',
        localType: 'POSOrderItem[]',
        expectedSheetHeader: 'Items Summary',
        gasCanonicalKey: 'itemsSummary',
        supportedAliases: ['itemssummary', 'items', 'summary', 'particulars'],
        dataType: 'string',
        required: true,
        description: 'Concatenated list of ordered items and counts',
      },
      {
        localKey: 'subtotal',
        localType: 'number',
        expectedSheetHeader: 'Subtotal (Ksh)',
        gasCanonicalKey: 'subtotal',
        supportedAliases: ['subtotalksh', 'subtotal', 'grosssubtotal'],
        dataType: 'currency',
        required: true,
        description: 'Net food & beverage subtotal',
      },
      {
        localKey: 'vatAmount',
        localType: 'number',
        expectedSheetHeader: 'Tax (Ksh)',
        gasCanonicalKey: 'tax',
        supportedAliases: ['taxksh', 'tax', 'vat', 'vatamount'],
        dataType: 'currency',
        required: true,
        description: 'Applicable VAT/Catering levy',
      },
      {
        localKey: 'grandTotal',
        localType: 'number',
        expectedSheetHeader: 'Total Amount (Ksh)',
        gasCanonicalKey: 'totalAmount',
        supportedAliases: ['totalamountksh', 'totalamount', 'total', 'grandtotal'],
        dataType: 'currency',
        required: true,
        description: 'Total bill payable',
      },
      {
        localKey: 'paymentMode',
        localType: 'string',
        expectedSheetHeader: 'Payment Mode',
        gasCanonicalKey: 'paymentMode',
        supportedAliases: ['paymentmode', 'mode', 'paymentmethod'],
        dataType: 'enum',
        required: true,
        description: 'Cash, M-Pesa, Room Charge, or Credit Card',
      },
      {
        localKey: 'status',
        localType: 'string',
        expectedSheetHeader: 'Status',
        gasCanonicalKey: 'status',
        supportedAliases: ['status', 'orderstatus'],
        dataType: 'enum',
        required: true,
        description: 'Completed, Pending, or Billed to Room',
      },
      {
        localKey: 'createdAt',
        localType: 'string',
        expectedSheetHeader: 'Last Updated',
        gasCanonicalKey: 'updatedAt',
        supportedAliases: ['lastupdated', 'updatedat', 'timestamp'],
        dataType: 'datetime',
        required: true,
        description: 'Modification timestamp',
      },
    ],
  },

  EXPENSE: {
    entityType: 'EXPENSE',
    tabName: 'Expenses',
    primaryKey: 'id',
    secondaryKey: 'expenseNumber',
    description: 'Operating & Vendor Outflow Journal',
    expectedHeaders: [
      'Expense ID',
      'Expense Date',
      'Category',
      'Vendor / Payee',
      'Description',
      'Amount (Ksh)',
      'Payment Mode',
      'Approved By',
      'Last Updated',
    ],
    fields: [
      {
        localKey: 'expenseNumber',
        localType: 'string',
        expectedSheetHeader: 'Expense ID',
        gasCanonicalKey: 'id',
        supportedAliases: ['expenseid', 'id', 'expno', 'expid', 'expenseNumber'],
        dataType: 'code',
        required: true,
        description: 'Expense voucher code (e.g. EXP-2026-0001)',
      },
      {
        localKey: 'date',
        localType: 'string',
        expectedSheetHeader: 'Expense Date',
        gasCanonicalKey: 'date',
        supportedAliases: ['expensedate', 'date', 'createdat'],
        dataType: 'date',
        required: true,
        description: 'Voucher date (YYYY-MM-DD)',
      },
      {
        localKey: 'category',
        localType: 'string',
        expectedSheetHeader: 'Category',
        gasCanonicalKey: 'category',
        supportedAliases: ['category', 'expensetype', 'type'],
        dataType: 'enum',
        required: true,
        description: 'Expense category (e.g. Kitchen Supplies, Utilities)',
      },
      {
        localKey: 'paidTo',
        localType: 'string',
        expectedSheetHeader: 'Vendor / Payee',
        gasCanonicalKey: 'vendor',
        supportedAliases: ['vendorpayee', 'vendor', 'payee', 'supplier', 'paidTo'],
        dataType: 'string',
        required: true,
        description: 'Vendor or staff payee name',
      },
      {
        localKey: 'description',
        localType: 'string',
        expectedSheetHeader: 'Description',
        gasCanonicalKey: 'description',
        supportedAliases: ['description', 'details', 'particulars', 'item'],
        dataType: 'string',
        required: true,
        description: 'Narrative description of outflow',
      },
      {
        localKey: 'amount',
        localType: 'number',
        expectedSheetHeader: 'Amount (Ksh)',
        gasCanonicalKey: 'amount',
        supportedAliases: ['amountksh', 'amount', 'totalamount', 'total'],
        dataType: 'currency',
        required: true,
        description: 'Expense amount in Ksh',
      },
      {
        localKey: 'paymentMode',
        localType: 'string',
        expectedSheetHeader: 'Payment Mode',
        gasCanonicalKey: 'paymentMode',
        supportedAliases: ['paymentmode', 'mode', 'paymentmethod'],
        dataType: 'enum',
        required: true,
        description: 'Cash, M-Pesa, Bank Transfer, or Cheque',
      },
      {
        localKey: 'receiptRef',
        localType: 'string',
        expectedSheetHeader: 'Approved By',
        gasCanonicalKey: 'approvedBy',
        supportedAliases: ['approvedby', 'approver', 'manager', 'staff', 'receiptRef'],
        dataType: 'string',
        required: false,
        description: 'Authorizing manager or receipt reference',
      },
      {
        localKey: 'createdAt',
        localType: 'string',
        expectedSheetHeader: 'Last Updated',
        gasCanonicalKey: 'updatedAt',
        supportedAliases: ['lastupdated', 'updatedat', 'timestamp'],
        dataType: 'datetime',
        required: true,
        description: 'Record timestamp',
      },
    ],
  },

  STATEMENT: {
    entityType: 'STATEMENT',
    tabName: 'Statements_Ledger',
    primaryKey: 'id',
    secondaryKey: 'statementNumber',
    description: 'Client Statement of Account dynamic summary',
    expectedHeaders: [
      'Client ID',
      'Client / Company Name',
      'KRA PIN',
      'Total Invoiced (Ksh)',
      'Total Paid (Ksh)',
      'Current Balance Due (Ksh)',
      'Account Status',
      'Last Transaction Date',
    ],
    fields: [
      {
        localKey: 'clientId',
        localType: 'string',
        expectedSheetHeader: 'Client ID',
        gasCanonicalKey: 'clientId',
        supportedAliases: ['clientid', 'id', 'customerid'],
        dataType: 'code',
        required: true,
        description: 'Client identifier',
      },
      {
        localKey: 'clientName',
        localType: 'string',
        expectedSheetHeader: 'Client / Company Name',
        gasCanonicalKey: 'clientName',
        supportedAliases: ['clientname', 'companyname', 'guestname', 'client'],
        dataType: 'string',
        required: true,
        description: 'Company or guest account name',
      },
      {
        localKey: 'clientKraPin',
        localType: 'string',
        expectedSheetHeader: 'KRA PIN',
        gasCanonicalKey: 'clientKraPin',
        supportedAliases: ['krapin', 'pin', 'taxpin', 'clientkrapin'],
        dataType: 'code',
        required: false,
        description: 'Client Tax PIN',
      },
      {
        localKey: 'totalDebit',
        localType: 'number',
        expectedSheetHeader: 'Total Invoiced (Ksh)',
        gasCanonicalKey: 'totalDebit',
        supportedAliases: ['totaldebit', 'totalinvoiced', 'debitksh', 'totalinvoicedksh'],
        dataType: 'currency',
        required: true,
        description: 'Cumulative invoiced sum',
      },
      {
        localKey: 'totalCredit',
        localType: 'number',
        expectedSheetHeader: 'Total Paid (Ksh)',
        gasCanonicalKey: 'totalCredit',
        supportedAliases: ['totalcredit', 'totalpaid', 'creditksh', 'totalpaidksh'],
        dataType: 'currency',
        required: true,
        description: 'Cumulative settled payments sum',
      },
      {
        localKey: 'closingBalance',
        localType: 'number',
        expectedSheetHeader: 'Current Balance Due (Ksh)',
        gasCanonicalKey: 'closingBalance',
        supportedAliases: ['closingbalance', 'balance', 'balancedue', 'currentbalance'],
        dataType: 'currency',
        required: true,
        description: 'Outstanding balance payable',
      },
      {
        localKey: 'issueDate',
        localType: 'string',
        expectedSheetHeader: 'Account Status',
        gasCanonicalKey: 'status',
        supportedAliases: ['accountstatus', 'status'],
        dataType: 'string',
        required: false,
        description: 'Settled or Active Debtor',
      },
      {
        localKey: 'updatedAt',
        localType: 'string',
        expectedSheetHeader: 'Last Transaction Date',
        gasCanonicalKey: 'lastTransactionDate',
        supportedAliases: ['lasttransactiondate', 'date', 'updatedat'],
        dataType: 'date',
        required: false,
        description: 'Date of most recent invoice or payment',
      },
    ],
  },

  HOTEL_PROFILE: {
    entityType: 'HOTEL_PROFILE',
    tabName: 'Hotel_Profile',
    primaryKey: 'name',
    description: 'Centralized Property Details, Bank Info & Tax PIN',
    expectedHeaders: ['Property', 'Value', 'Last Updated'],
    fields: [
      {
        localKey: 'name',
        localType: 'string',
        expectedSheetHeader: 'Property',
        gasCanonicalKey: 'name',
        supportedAliases: ['property', 'name', 'hotelname'],
        dataType: 'string',
        required: true,
        description: 'Hotel enterprise name',
      },
      {
        localKey: 'kraPin',
        localType: 'string',
        expectedSheetHeader: 'Value',
        gasCanonicalKey: 'kraPin',
        supportedAliases: ['krapin', 'pin', 'taxpin'],
        dataType: 'code',
        required: true,
        description: 'Hotel official KRA Tax PIN',
      },
    ],
  },
};

// ============================================================================
// DIAGNOSTIC COMPARISON & VERIFICATION ALGORITHMS
// ============================================================================

/**
 * Normalizes a header or key for loose comparison (strips non-alphanumeric, lowercases)
 */
export function normalizeSchemaKey(key: string): string {
  if (!key) return '';
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Compares a local document object against the expected Google Sheets structure.
 * Checks for missing required keys, irregular types, and field mapping alignment.
 */
export function verifyDocumentSchema(
  doc: any,
  entityType: 'INVOICE' | 'QUOTATION' | 'PROFORMA' = 'INVOICE'
): SchemaVerificationReport {
  const schemaDef = CANONICAL_ENTITY_SCHEMAS[entityType];
  const mismatches: FieldMismatchDetail[] = [];
  const checkedAt = new Date().toISOString();

  if (!doc || typeof doc !== 'object') {
    return {
      entityType,
      targetTab: schemaDef.tabName,
      checkedAt,
      isFullyCompliant: false,
      parityScore: 0,
      totalFieldsCount: schemaDef.fields.length,
      matchedFieldsCount: 0,
      missingRequiredCount: schemaDef.fields.filter((f) => f.required).length,
      missingOptionalCount: schemaDef.fields.filter((f) => !f.required).length,
      typeMismatchesCount: 0,
      unknownExtraKeysCount: 0,
      mismatches: [
        {
          fieldKey: 'root',
          expectedHeader: 'Root Document Object',
          issueType: 'MISSING_IN_LOCAL',
          severity: 'CRITICAL',
          expectedType: 'object',
          suggestion: 'Pass a valid BillingDocument JSON object.',
          autoHealable: false,
        },
      ],
      summaryMessage: 'Document payload is null or not a valid object.',
    };
  }

  let matchedFieldsCount = 0;
  let missingRequiredCount = 0;
  let missingOptionalCount = 0;
  let typeMismatchesCount = 0;

  for (const field of schemaDef.fields) {
    const rawVal = doc[field.localKey];
    const isPresent = rawVal !== undefined && rawVal !== null;

    if (!isPresent) {
      if (field.required) {
        missingRequiredCount++;
        mismatches.push({
          fieldKey: field.localKey,
          expectedHeader: field.expectedSheetHeader,
          issueType: 'MISSING_IN_LOCAL',
          severity: 'CRITICAL',
          expectedType: field.localType,
          actualValue: undefined,
          suggestion: `Field '${field.localKey}' is required for ${entityType} synchronization to Google Sheets '${schemaDef.tabName}'. Provide a non-null ${field.localType}.`,
          autoHealable: field.defaultValue !== undefined,
        });
      } else {
        missingOptionalCount++;
      }
      continue;
    }

    // Check type compatibility
    let typeOk = true;
    const actualJsType = typeof rawVal;

    if (field.dataType === 'currency' || field.dataType === 'number') {
      if (typeof rawVal !== 'number' || isNaN(rawVal)) {
        typeOk = false;
        typeMismatchesCount++;
        mismatches.push({
          fieldKey: field.localKey,
          expectedHeader: field.expectedSheetHeader,
          issueType: 'TYPE_MISMATCH',
          severity: 'WARNING',
          expectedType: 'number (float)',
          actualType: actualJsType,
          actualValue: rawVal,
          suggestion: `Numeric field '${field.localKey}' is currently ${actualJsType} (${JSON.stringify(rawVal)}). Run normalizeCurrency() to coerce.`,
          autoHealable: true,
        });
      }
    } else if (field.dataType === 'date') {
      const dateStr = String(rawVal).trim();
      const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
      if (!isIsoDate) {
        typeMismatchesCount++;
        mismatches.push({
          fieldKey: field.localKey,
          expectedHeader: field.expectedSheetHeader,
          issueType: 'FORMAT_DRIFT',
          severity: 'WARNING',
          expectedType: 'YYYY-MM-DD string',
          actualType: actualJsType,
          actualValue: rawVal,
          suggestion: `Date field '${field.localKey}' should be formatted as YYYY-MM-DD to avoid Google Sheets timezone shift.`,
          autoHealable: true,
        });
      }
    } else if (field.dataType === 'code' && field.localKey.toLowerCase().includes('krapin')) {
      const pinStr = String(rawVal).trim().toUpperCase();
      if (pinStr && !/^[A-Z]\d{9}[A-Z]$/.test(pinStr)) {
        mismatches.push({
          fieldKey: field.localKey,
          expectedHeader: field.expectedSheetHeader,
          issueType: 'FORMAT_DRIFT',
          severity: 'WARNING',
          expectedType: 'KRA PIN pattern [A-Z]\\d{9}[A-Z]',
          actualType: 'string',
          actualValue: rawVal,
          suggestion: `KRA PIN '${rawVal}' does not strictly match Kenyan statutory format [A-Z]\\d{9}[A-Z].`,
          autoHealable: true,
        });
      }
    }

    if (typeOk) {
      matchedFieldsCount++;
    }
  }

  // Check for unknown or extraneous keys on the document object
  const knownKeys = new Set(schemaDef.fields.map((f) => f.localKey));
  // Add common runtime metadata keys
  const allowedExtraKeys = new Set(['lineItems', 'syncedToGoogle', 'syncedAt', 'lastSyncStatus', 'isArchived', 'terms', 'notes', 'relatedDocId', 'relatedDocNumber', 'isManualStatusOverride', 'manualStatusNote', 'validityDays', 'clientId', 'clientPhone', 'clientEmail', 'discountedTotal']);
  
  let unknownExtraKeysCount = 0;
  for (const docKey of Object.keys(doc)) {
    if (!knownKeys.has(docKey) && !allowedExtraKeys.has(docKey)) {
      unknownExtraKeysCount++;
      mismatches.push({
        fieldKey: docKey,
        expectedHeader: 'N/A',
        issueType: 'EXTRA_UNKNOWN_KEY',
        severity: 'INFO',
        expectedType: 'None',
        actualType: typeof doc[docKey],
        actualValue: doc[docKey],
        suggestion: `Unmapped local JSON key '${docKey}' will not be persisted in Google Sheets columns.`,
        autoHealable: false,
      });
    }
  }

  const totalRequired = schemaDef.fields.filter((f) => f.required).length;
  const parityScore = Math.max(
    0,
    Math.round(((totalRequired - missingRequiredCount) / Math.max(1, totalRequired)) * 100)
  );

  const isFullyCompliant = missingRequiredCount === 0 && typeMismatchesCount === 0;

  return {
    entityType,
    targetTab: schemaDef.tabName,
    checkedAt,
    isFullyCompliant,
    parityScore,
    totalFieldsCount: schemaDef.fields.length,
    matchedFieldsCount,
    missingRequiredCount,
    missingOptionalCount,
    typeMismatchesCount,
    unknownExtraKeysCount,
    mismatches,
    summaryMessage: isFullyCompliant
      ? `Document JSON strictly matches Google Sheets '${schemaDef.tabName}' canonical structure with 100% field parity.`
      : `Identified ${missingRequiredCount} missing required keys and ${typeMismatchesCount} format/type discrepancies for Google Sheets synchronization.`,
  };
}

/**
 * Compares client JSON object against the expected Google Sheets structure.
 */
export function verifyClientSchema(client: any): SchemaVerificationReport {
  const schemaDef = CANONICAL_ENTITY_SCHEMAS.CLIENT;
  const mismatches: FieldMismatchDetail[] = [];
  const checkedAt = new Date().toISOString();

  if (!client || typeof client !== 'object') {
    return {
      entityType: 'CLIENT',
      targetTab: schemaDef.tabName,
      checkedAt,
      isFullyCompliant: false,
      parityScore: 0,
      totalFieldsCount: schemaDef.fields.length,
      matchedFieldsCount: 0,
      missingRequiredCount: schemaDef.fields.filter((f) => f.required).length,
      missingOptionalCount: schemaDef.fields.filter((f) => !f.required).length,
      typeMismatchesCount: 0,
      unknownExtraKeysCount: 0,
      mismatches: [],
      summaryMessage: 'Client payload is null or not a valid object.',
    };
  }

  let matchedFieldsCount = 0;
  let missingRequiredCount = 0;
  let missingOptionalCount = 0;
  let typeMismatchesCount = 0;

  for (const field of schemaDef.fields) {
    const rawVal = client[field.localKey];
    const isPresent = rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '';

    if (!isPresent) {
      if (field.required) {
        missingRequiredCount++;
        mismatches.push({
          fieldKey: field.localKey,
          expectedHeader: field.expectedSheetHeader,
          issueType: 'MISSING_IN_LOCAL',
          severity: 'CRITICAL',
          expectedType: field.localType,
          suggestion: `Client field '${field.localKey}' is required.`,
          autoHealable: false,
        });
      } else {
        missingOptionalCount++;
      }
      continue;
    }

    if (field.localKey === 'phone') {
      const phoneStr = String(rawVal).trim();
      const e164 = /^\+254\d{9}$/.test(phoneStr) || /^0[17]\d{8}$/.test(phoneStr);
      if (!e164) {
        typeMismatchesCount++;
        mismatches.push({
          fieldKey: 'phone',
          expectedHeader: 'Phone',
          issueType: 'FORMAT_DRIFT',
          severity: 'WARNING',
          expectedType: 'E.164 phone string (+254...)',
          actualValue: phoneStr,
          suggestion: 'Normalize phone number to Kenyan E.164 format (+254...) to prevent Google Sheets scientific notation truncation.',
          autoHealable: true,
        });
      }
    }

    if (field.localKey === 'kraPin') {
      const pinStr = String(rawVal).trim().toUpperCase();
      if (!/^[A-Z]\d{9}[A-Z]$/.test(pinStr)) {
        typeMismatchesCount++;
        mismatches.push({
          fieldKey: 'kraPin',
          expectedHeader: 'KRA PIN',
          issueType: 'FORMAT_DRIFT',
          severity: 'WARNING',
          expectedType: '11-character statutory KRA PIN pattern [A-Z]\\d{9}[A-Z]',
          actualValue: pinStr,
          suggestion: 'Normalize KRA PIN with uppercase letters and 9 central digits.',
          autoHealable: true,
        });
      }
    }

    matchedFieldsCount++;
  }

  const totalRequired = schemaDef.fields.filter((f) => f.required).length;
  const parityScore = Math.max(
    0,
    Math.round(((totalRequired - missingRequiredCount) / Math.max(1, totalRequired)) * 100)
  );

  return {
    entityType: 'CLIENT',
    targetTab: schemaDef.tabName,
    checkedAt,
    isFullyCompliant: missingRequiredCount === 0 && typeMismatchesCount === 0,
    parityScore,
    totalFieldsCount: schemaDef.fields.length,
    matchedFieldsCount,
    missingRequiredCount,
    missingOptionalCount,
    typeMismatchesCount,
    unknownExtraKeysCount: 0,
    mismatches,
    summaryMessage: missingRequiredCount === 0
      ? `Client record aligns with Google Sheets 'Clients' schema.`
      : `Client missing ${missingRequiredCount} required field(s).`,
  };
}

/**
 * Compares Payment/Receipt record against expected Google Sheets schema
 */
export function verifyPaymentSchema(payment: any): SchemaVerificationReport {
  const schemaDef = CANONICAL_ENTITY_SCHEMAS.RECEIPT;
  const mismatches: FieldMismatchDetail[] = [];
  const checkedAt = new Date().toISOString();

  if (!payment || typeof payment !== 'object') {
    return {
      entityType: 'RECEIPT',
      targetTab: schemaDef.tabName,
      checkedAt,
      isFullyCompliant: false,
      parityScore: 0,
      totalFieldsCount: schemaDef.fields.length,
      matchedFieldsCount: 0,
      missingRequiredCount: schemaDef.fields.filter((f) => f.required).length,
      missingOptionalCount: schemaDef.fields.filter((f) => !f.required).length,
      typeMismatchesCount: 0,
      unknownExtraKeysCount: 0,
      mismatches: [],
      summaryMessage: 'Payment record is null.',
    };
  }

  let matchedFieldsCount = 0;
  let missingRequiredCount = 0;
  let missingOptionalCount = 0;
  let typeMismatchesCount = 0;

  for (const field of schemaDef.fields) {
    const rawVal = payment[field.localKey];
    const isPresent = rawVal !== undefined && rawVal !== null;

    if (!isPresent) {
      if (field.required) {
        missingRequiredCount++;
        mismatches.push({
          fieldKey: field.localKey,
          expectedHeader: field.expectedSheetHeader,
          issueType: 'MISSING_IN_LOCAL',
          severity: 'CRITICAL',
          expectedType: field.localType,
          suggestion: `Payment field '${field.localKey}' is mandatory.`,
          autoHealable: false,
        });
      } else {
        missingOptionalCount++;
      }
      continue;
    }

    if (field.dataType === 'currency') {
      if (typeof rawVal !== 'number' || isNaN(rawVal) || rawVal <= 0) {
        typeMismatchesCount++;
        mismatches.push({
          fieldKey: field.localKey,
          expectedHeader: field.expectedSheetHeader,
          issueType: 'TYPE_MISMATCH',
          severity: 'WARNING',
          expectedType: 'positive number',
          actualValue: rawVal,
          suggestion: 'Receipt amount must be a positive float number.',
          autoHealable: true,
        });
      }
    }

    matchedFieldsCount++;
  }

  const totalRequired = schemaDef.fields.filter((f) => f.required).length;
  const parityScore = Math.max(
    0,
    Math.round(((totalRequired - missingRequiredCount) / Math.max(1, totalRequired)) * 100)
  );

  return {
    entityType: 'RECEIPT',
    targetTab: schemaDef.tabName,
    checkedAt,
    isFullyCompliant: missingRequiredCount === 0 && typeMismatchesCount === 0,
    parityScore,
    totalFieldsCount: schemaDef.fields.length,
    matchedFieldsCount,
    missingRequiredCount,
    missingOptionalCount,
    typeMismatchesCount,
    unknownExtraKeysCount: 0,
    mismatches,
    summaryMessage: missingRequiredCount === 0
      ? `Receipt record aligns with Google Sheets 'Receipts' schema.`
      : `Receipt missing ${missingRequiredCount} required field(s).`,
  };
}

/**
 * Verifies live Google Sheets headers against canonical expected headers for a tab
 */
export function verifySheetHeadersAgainstSchema(
  tabName: string,
  actualHeaders: string[] = []
): SheetHeaderParityReport {
  // Find matching canonical definition
  let matchedEntityKey: SupportedEntityType | null = null;
  for (const [key, schema] of Object.entries(CANONICAL_ENTITY_SCHEMAS)) {
    if (schema.tabName.toLowerCase() === tabName.toLowerCase() || key.toLowerCase() === tabName.toLowerCase()) {
      matchedEntityKey = key as SupportedEntityType;
      break;
    }
  }

  if (!matchedEntityKey) {
    return {
      tabName,
      expectedHeaders: [],
      actualHeaders,
      matchedHeaders: [],
      missingHeaders: [],
      extraHeaders: actualHeaders,
      reorderedHeaders: false,
      parityPercentage: 0,
      status: 'TAB_NOT_FOUND',
      remedyAction: `Worksheet '${tabName}' is not defined in standard Hotel Damview ERP schema.`,
    };
  }

  const schemaDef = CANONICAL_ENTITY_SCHEMAS[matchedEntityKey];
  const expectedHeaders = schemaDef.expectedHeaders;

  const normActual = actualHeaders.map(normalizeSchemaKey);
  const matchedHeaders: string[] = [];
  const missingHeaders: string[] = [];

  for (const exp of expectedHeaders) {
    const normExp = normalizeSchemaKey(exp);
    const foundIdx = normActual.findIndex((a) => a === normExp || a.includes(normExp) || normExp.includes(a));
    if (foundIdx >= 0) {
      matchedHeaders.push(exp);
    } else {
      missingHeaders.push(exp);
    }
  }

  const extraHeaders = actualHeaders.filter((act) => {
    const nAct = normalizeSchemaKey(act);
    return !expectedHeaders.some((exp) => {
      const nExp = normalizeSchemaKey(exp);
      return nAct === nExp || nAct.includes(nExp) || nExp.includes(nAct);
    });
  });

  const parityPercentage = Math.round((matchedHeaders.length / Math.max(1, expectedHeaders.length)) * 100);

  let status: SheetHeaderParityReport['status'] = 'PERFECT';
  let remedyAction = 'Headers are 100% aligned with canonical schema.';

  if (missingHeaders.length > 0) {
    status = 'MISSING_COLUMNS';
    remedyAction = `Run 'Deduplicate Tabs' or deploy updated Code.gs to append missing columns: ${missingHeaders.join(', ')}.`;
  } else if (extraHeaders.length > 0) {
    status = 'COMPLIANT_WITH_EXTRAS';
    remedyAction = `Sheet contains ${extraHeaders.length} custom column(s) which will be safely preserved.`;
  } else if (actualHeaders.length === expectedHeaders.length) {
    const isStrictOrder = actualHeaders.every((h, i) => h === expectedHeaders[i]);
    if (!isStrictOrder) {
      status = 'DRIFTED_ORDER';
      remedyAction = 'Columns are reordered; dynamic header lookup in Code.gs will auto-resolve positions.';
    }
  }

  return {
    tabName: schemaDef.tabName,
    expectedHeaders,
    actualHeaders,
    matchedHeaders,
    missingHeaders,
    extraHeaders,
    reorderedHeaders: status === 'DRIFTED_ORDER',
    parityPercentage,
    status,
    remedyAction,
  };
}

/**
 * Evaluates bidirectional key resolution during serialization/deserialization
 */
export function verifyBidirectionalSyncKeys(
  payload: any,
  direction: 'OUTBOUND_PUSH' | 'INBOUND_PULL',
  entityType: SupportedEntityType,
  expectedHeaders?: string[]
): BidirectionalKeyVerificationResult {
  const schemaDef = CANONICAL_ENTITY_SCHEMAS[entityType];
  const sourceKeys = payload && typeof payload === 'object' ? Object.keys(payload) : [];
  const resolvedTargetKeys: Record<string, string> = {};
  const unresolvedKeys: string[] = [];
  const missingCriticalKeys: string[] = [];
  const coercedFields: { field: string; from: any; to: any; rule: string }[] = [];

  if (direction === 'OUTBOUND_PUSH') {
    // Local JSON -> Google Sheets row mapping
    for (const field of schemaDef.fields) {
      if (sourceKeys.includes(field.localKey)) {
        resolvedTargetKeys[field.localKey] = field.expectedSheetHeader;
        const val = payload[field.localKey];
        if (field.dataType === 'currency' && typeof val === 'number') {
          const norm = normalizeCurrency(val);
          if (norm !== val) {
            coercedFields.push({ field: field.localKey, from: val, to: norm, rule: 'normalizeCurrency' });
          }
        } else if (field.dataType === 'code' && field.localKey === 'clientKraPin' && val) {
          const normPin = normalizeKraPin(val);
          if (normPin !== val) {
            coercedFields.push({ field: field.localKey, from: val, to: normPin, rule: 'normalizeKraPin' });
          }
        } else if (field.dataType === 'code' && field.localKey === 'phone' && val) {
          const normPhone = normalizePhoneNumber(val);
          if (normPhone !== val) {
            coercedFields.push({ field: field.localKey, from: val, to: normPhone, rule: 'normalizePhoneNumber' });
          }
        }
      } else if (field.required) {
        missingCriticalKeys.push(field.localKey);
      }
    }

    for (const k of sourceKeys) {
      if (!resolvedTargetKeys[k]) {
        unresolvedKeys.push(k);
      }
    }
  } else {
    // Inbound Pull: Remote Row/Object -> Local JSON model
    const normSourceMap = new Map<string, string>();
    for (const k of sourceKeys) {
      normSourceMap.set(normalizeSchemaKey(k), k);
    }

    for (const field of schemaDef.fields) {
      const normCanonical = normalizeSchemaKey(field.gasCanonicalKey);
      const normHeader = normalizeSchemaKey(field.expectedSheetHeader);
      
      let matchedSourceKey: string | undefined = undefined;
      if (normSourceMap.has(normCanonical)) {
        matchedSourceKey = normSourceMap.get(normCanonical);
      } else if (normSourceMap.has(normHeader)) {
        matchedSourceKey = normSourceMap.get(normHeader);
      } else {
        for (const alias of field.supportedAliases) {
          const normAlias = normalizeSchemaKey(alias);
          if (normSourceMap.has(normAlias)) {
            matchedSourceKey = normSourceMap.get(normAlias);
            break;
          }
        }
      }

      if (matchedSourceKey) {
        resolvedTargetKeys[matchedSourceKey] = field.localKey;
      } else if (field.required) {
        missingCriticalKeys.push(field.localKey);
      }
    }

    for (const k of sourceKeys) {
      if (!resolvedTargetKeys[k]) {
        unresolvedKeys.push(k);
      }
    }
  }

  const passed = missingCriticalKeys.length === 0;

  return {
    direction,
    entityType,
    sourceKeys,
    resolvedTargetKeys,
    unresolvedKeys,
    missingCriticalKeys,
    coercedFields,
    passed,
  };
}

/**
 * Runs a comprehensive schema audit across all local documents, clients, receipts,
 * and live Google Sheets tabs, generating an executive diagnostic report.
 */
export function runComprehensiveSchemaAudit(
  localData: {
    documents?: BillingDocument[];
    clients?: Client[];
    payments?: PaymentRecord[];
    reservations?: Reservation[];
    posOrders?: POSOrder[];
    expenses?: ExpenseRecord[];
  },
  liveSheets?: { discoveredTabs?: { name: string; headers: string[]; rowCount: number; rows: any[][] }[] } | null
): ComprehensiveSchemaAuditReport {
  const timestamp = new Date().toISOString();
  const entityReports: SchemaVerificationReport[] = [];
  const sheetParityReports: SheetHeaderParityReport[] = [];
  const driftVectorsIdentified: string[] = [];
  const remediationPlan: string[] = [];

  // 1. Audit Documents
  const docs = localData.documents || [];
  for (const doc of docs) {
    const report = verifyDocumentSchema(doc, doc.documentType || 'INVOICE');
    entityReports.push(report);
    if (!report.isFullyCompliant) {
      driftVectorsIdentified.push(
        `Document ${doc.documentNumber} (${doc.documentType}): ${report.mismatches.map((m) => `${m.fieldKey} (${m.issueType})`).join(', ')}`
      );
    }
  }

  // 2. Audit Clients
  const clients = localData.clients || [];
  for (const client of clients) {
    const report = verifyClientSchema(client);
    entityReports.push(report);
    if (!report.isFullyCompliant) {
      driftVectorsIdentified.push(
        `Client ${client.name} (${client.id}): ${report.mismatches.map((m) => `${m.fieldKey} (${m.issueType})`).join(', ')}`
      );
    }
  }

  // 3. Audit Payments
  const payments = localData.payments || [];
  for (const payment of payments) {
    const report = verifyPaymentSchema(payment);
    entityReports.push(report);
    if (!report.isFullyCompliant) {
      driftVectorsIdentified.push(
        `Receipt ${payment.receiptNumber}: ${report.mismatches.map((m) => `${m.fieldKey} (${m.issueType})`).join(', ')}`
      );
    }
  }

  // 4. Audit Live Sheets tabs if discovered
  if (liveSheets?.discoveredTabs && liveSheets.discoveredTabs.length > 0) {
    for (const tab of liveSheets.discoveredTabs) {
      const sheetReport = verifySheetHeadersAgainstSchema(tab.name, tab.headers);
      sheetParityReports.push(sheetReport);
      if (sheetReport.status === 'MISSING_COLUMNS') {
        driftVectorsIdentified.push(`Google Sheet tab '${tab.name}' missing columns: ${sheetReport.missingHeaders.join(', ')}`);
        remediationPlan.push(`Execute tab deduplication to auto-align '${tab.name}' columns.`);
      }
    }
  }

  const totalEntitiesAudited = entityReports.length;
  const passedEntitiesCount = entityReports.filter((r) => r.isFullyCompliant).length;
  const failedEntitiesCount = totalEntitiesAudited - passedEntitiesCount;

  const overallParityScore = totalEntitiesAudited > 0
    ? Math.round((passedEntitiesCount / totalEntitiesAudited) * 100)
    : 100;

  if (driftVectorsIdentified.length === 0) {
    remediationPlan.push('All local JSON models and Google Sheets columns are 100% synchronized with zero schema drift.');
  }

  return {
    timestamp,
    overallParityScore,
    totalEntitiesAudited,
    passedEntitiesCount,
    failedEntitiesCount,
    sheetsAudited: sheetParityReports.length,
    sheetParityReports,
    entityReports,
    driftVectorsIdentified,
    remediationPlan,
  };
}
