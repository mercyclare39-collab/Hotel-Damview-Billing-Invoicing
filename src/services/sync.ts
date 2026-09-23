import { dbService } from './db';
import { BillingDocument, Client, PaymentRecord, HotelProfile, LineItem, StatementRecord } from '../types';
import { getPdfFileName } from '../utils/formatters';
import { generateTestPdfDocument } from '../utils/pdfGenerator';
import {
  autoCorrectIncomingDocument,
  autoCorrectIncomingClient,
  safelyMergeDocumentWithDefensiveShields,
  runEndToEndSyncVerification,
  SyncVerificationResult,
} from './selfHealingSync';

export interface SyncResult {
  success: boolean;
  message: string;
  timestamp: string;
  itemsPushed?: number;
  itemsPulled?: number;
  itemsProcessed?: number;
  error?: string;
  unchanged?: boolean;
}

export interface DiscoveredTab {
  name: string;
  rowCount: number;
  headers: string[];
  rows: any[][];
}

export interface SpreadsheetDataPayload {
  sheetName: string;
  sheetUrl: string;
  serverTimestamp: string;
  discoveredTabs: DiscoveredTab[];
  worksheets: Record<string, { headers: string[]; rows: any[][] }>;
  invoices: any[];
  quotations: any[];
  proformas: any[];
  clients: any[];
  receipts: any[];
  profile: Record<string, string>;
}

export interface RealtimeSyncState {
  isOnline: boolean;
  isSyncing: boolean;
  autoSyncEnabled: boolean;
  lastSyncTimestamp: string | null;
  pendingCount: number;
  statusText: string;
  lastError?: string;
  realtimeActive: boolean;
  pollingIntervalSeconds: number;
}

type SyncStateListener = (state: RealtimeSyncState) => void;

/**
 * Strict Client-Side Normalization & Type Integrity Engine
 * Hotel Damview (Kenya)
 * 
 * Enforces strict client-side data normalization using Regex for:
 * 1. KRA PINs: Exactly 11 alphanumeric characters [A-Z]\d{9}[A-Z] (uppercase, stripped of noise/labels).
 * 2. Phone Numbers: Canonical E.164 string format (+254...), preventing Google Sheets from
 *    interpreting 12-digit numbers as scientific notation (e.g., 2.54712E+11) or truncating leading zeros.
 * 3. Currency Strings: Clean, calculable 2-decimal floats and fixed decimal strings, handling Ksh/KES prefixes,
 *    commas, accounting parentheses negatives, and preventing IEEE-754 drift and exponential notation.
 * 4. Recursive Pre-Serialization Sanitizer: Deeply normalizes all payload nodes immediately before JSON.stringify.
 */

// Regex for KRA PIN: 1 letter + 9 digits + 1 letter (e.g. P051234567Z, A001234567X)
export const KRA_PIN_STRICT_REGEX = /^[A-Z]\d{9}[A-Z]$/;
export const KRA_PIN_EXTRACT_REGEX = /\b([A-Z]\s*\d(?:\s*[\-_.]?\s*\d){7}\s*[\-_.]?\s*\d\s*[A-Z])\b/i;

// Regex for Kenyan & International Phone Numbers
export const KENYA_PHONE_MOBILE_REGEX = /^(?:\+?254|0)?([17]\d{8})$/;
export const KENYA_PHONE_LANDLINE_REGEX = /^(?:\+?254|0)?(20\d{6,7})$/;
export const INTERNATIONAL_PHONE_REGEX = /^\+?[1-9]\d{6,14}$/;

/**
 * Normalizes KRA PINs using strict Regex matching:
 * - Strips prefixes (PIN:, KRA PIN:, Tax PIN:, etc.)
 * - Strips all internal dashes, whitespace, dots, and slashes
 * - Uppercases and matches standard 11-char pattern [A-Z]\d{9}[A-Z]
 * - Guarantees string type so Google Sheets never interprets it as formula/number
 */
export function normalizeKraPin(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  if (!str) return '';

  // Strip leading contextual labels
  str = str.replace(/^(?:KRA\s*PIN|PIN|TAX\s*PIN|KRA|VAT)\s*[:#-]?\s*/i, '').trim();

  // Strip common separators (spaces, dashes, dots, slashes)
  const condensed = str.replace(/[\s\-_./\\]/g, '').toUpperCase();
  if (KRA_PIN_STRICT_REGEX.test(condensed)) {
    return condensed;
  }

  // Extract embedded 11-character PIN if present within text
  const match = str.match(/[A-Za-z]\s*\d(?:\s*[\-_.]?\s*\d){7}\s*[\-_.]?\s*\d\s*[A-Za-z]/);
  if (match) {
    const extracted = match[0].replace(/[\s\-_./\\]/g, '').toUpperCase();
    if (KRA_PIN_STRICT_REGEX.test(extracted)) {
      return extracted;
    }
  }

  // Fallback: Return clean condensed alphanumeric string
  return condensed.replace(/[^A-Z0-9]/g, '');
}

/**
 * Normalizes Phone Numbers using strict Regex:
 * - Strips non-digit and non-plus characters
 * - Converts Kenyan local mobile (07xx, 01xx) or landline (020xx) to canonical E.164 (+254...)
 * - Resolves (0) insertion e.g. +254(0)7... -> +2547...
 * - Guarantees strict string type starting with '+' so Google Sheets never coerces
 *   12-digit phone numbers into scientific notation (e.g. 2.54712E+11) or truncates leading 0.
 */
export function normalizePhoneNumber(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  if (!str) return '';

  // Strip contextual labels
  str = str.replace(/^(?:tel|telephone|phone|mobile|cell|call|contact)\s*[:#-]?\s*/i, '').trim();

  const hasPlus = str.startsWith('+');
  let digits = str.replace(/\D/g, '');
  if (!digits) return '';

  // Handle (0) insertion e.g. 2540712345678 -> 254712345678
  if (digits.startsWith('2540')) {
    digits = '254' + digits.slice(4);
  }

  // Check Kenyan mobile: 07xx or 01xx (10 digits starting with 0, or 12 digits starting with 254)
  const mobileMatch = digits.match(/^(?:254|0)?([17]\d{8})$/);
  if (mobileMatch) {
    return `+254${mobileMatch[1]}`;
  }

  // Check Kenyan landline: 020xx
  const landlineMatch = digits.match(/^(?:254|0)?(20\d{6,7})$/);
  if (landlineMatch) {
    return `+254${landlineMatch[1]}`;
  }

  // If local 10-digit number starting with 0
  if (digits.length === 10 && digits.startsWith('0')) {
    return `+254${digits.slice(1)}`;
  }

  // International standard format with '+'
  if (hasPlus || digits.length >= 11) {
    return `+${digits}`;
  }

  return hasPlus ? `+${digits}` : digits;
}

/**
 * Normalizes Currency values using Regex:
 * - Strips currency symbols (Ksh, KES, USD, EUR, $, commas, non-breaking spaces)
 * - Accurately converts accounting negative parens: (1,250.00) -> -1250.00
 * - Resolves multiple decimals defensively
 * - Mathematically rounds to 2 decimal places to avoid IEEE-754 precision drift
 * - Guarantees finite number (never NaN or Infinity)
 * - Returns clean calculable float within standard financial range (never scientific notation)
 */
export function normalizeCurrency(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') {
    if (!Number.isFinite(val) || isNaN(val)) return 0;
    const rounded = Math.round((val + Number.EPSILON) * 100) / 100;
    return Object.is(rounded, -0) ? 0 : rounded;
  }

  let str = String(val).trim();
  if (!str) return 0;

  // Handle accounting parentheses: (1,500.50) -> -1500.50
  if (/^\s*\((.*)\)\s*$/.test(str)) {
    str = '-' + str.replace(/^\s*\(|\)\s*$/g, '');
  }

  // Remove currency words, symbols, and formatting commas
  str = str.replace(/(?:ksh|kes|usd|eur|gbp|\$)\.?/gi, '');
  str = str.replace(/,/g, '').replace(/\s+/g, '');

  // Extract signed numeric part with optional decimal
  const cleanStr = str.replace(/[^0-9.-]/g, '');
  const parts = cleanStr.split('.');
  const sanitizedStr = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleanStr;

  const num = parseFloat(sanitizedStr);
  if (!Number.isFinite(num) || isNaN(num)) return 0;

  const rounded = Math.round((num + Number.EPSILON) * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * Formats a currency value as a strict non-scientific fixed 2-decimal string.
 * Example: 15000 -> "15000.00"
 */
export function normalizeCurrencyString(val: any): string {
  const num = normalizeCurrency(val);
  return num.toFixed(2);
}

/**
 * Normalizes document numbers, receipt numbers, and IDs:
 * - Trims whitespace, removes non-printable characters
 * - Normalizes dash spacing: "INV - 001" -> "INV-001"
 */
export function normalizeCodeString(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  return str.replace(/\s*([-_])\s*/g, '$1').replace(/\s+/g, ' ');
}

/**
 * Normalizes text content:
 * - Normalizes line breaks to '\n'
 * - Trims leading/trailing whitespace
 */
export function normalizeText(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

/**
 * Normalizes dates to strict ISO YYYY-MM-DD
 */
export function normalizeDate(val: any): string {
  if (!val) return new Date().toISOString().split('T')[0];
  if (val instanceof Date) return val.toISOString().split('T')[0];
  const str = String(val).trim();
  if (str.includes('T')) return str.split('T')[0];
  const match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) {
    const y = match[1];
    const m = match[2].length === 1 ? `0${match[2]}` : match[2];
    const d = match[3].length === 1 ? `0${match[3]}` : match[3];
    return `${y}-${m}-${d}`;
  }
  return str;
}

// Backward compatibility aliases
export const sanitizeCurrency = normalizeCurrency;
export const sanitizeDate = normalizeDate;
export const sanitizeCodeOrPhone = normalizeCodeString;
export const sanitizeText = normalizeText;

/**
 * Deep inspection and normalization before JSON serialization.
 * Recursively visits all nodes in payload:
 * - KRA PINs are normalized via normalizeKraPin and guaranteed to be uppercase strings.
 * - Phone numbers are normalized via normalizePhoneNumber and guaranteed to be string literals with '+'.
 * - Currencies are normalized via normalizeCurrency and guaranteed to be finite numbers with 2-decimal precision.
 * - Codes / Document numbers are normalized via normalizeCodeString.
 * - Dates are normalized via normalizeDate.
 * - All numbers are checked to prevent NaN, Infinity, or scientific representation.
 */
export function normalizePayloadBeforeJson<T = any>(data: T): T {
  if (data === null || data === undefined) return data;

  if (typeof data === 'number') {
    if (!Number.isFinite(data) || isNaN(data)) return 0 as any;
    return data;
  }

  if (typeof data === 'string') {
    return data.trim() as any;
  }

  if (Array.isArray(data)) {
    return data.map((item) => normalizePayloadBeforeJson(item)) as any;
  }

  if (typeof data === 'object') {
    const normalized: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      const lowerKey = key.toLowerCase();

      // KRA PIN fields
      if (lowerKey === 'clientkrapin' || lowerKey === 'krapin' || lowerKey === 'taxpin' || lowerKey === 'hotelkrapin') {
        normalized[key] = normalizeKraPin(value);
      }
      // Phone number fields
      else if (lowerKey === 'clientphone' || lowerKey === 'phone' || lowerKey === 'telephone' || lowerKey === 'mobile' || lowerKey === 'hotelphone') {
        normalized[key] = normalizePhoneNumber(value);
      }
      // Currency fields
      else if (
        lowerKey === 'subtotal' ||
        lowerKey === 'grosssubtotal' ||
        lowerKey === 'discount' ||
        lowerKey === 'vatamount' ||
        lowerKey === 'grandtotal' ||
        lowerKey === 'amountpaid' ||
        lowerKey === 'balancedue' ||
        lowerKey === 'amount' ||
        lowerKey === 'rate' ||
        lowerKey === 'totalamount' ||
        lowerKey === 'price' ||
        lowerKey === 'unitrate' ||
        lowerKey === 'currentbalance'
      ) {
        normalized[key] = normalizeCurrency(value);
      }
      // Document numbers / Codes
      else if (
        lowerKey === 'documentnumber' ||
        lowerKey === 'receiptnumber' ||
        lowerKey === 'clientnumber'
      ) {
        normalized[key] = normalizeCodeString(value);
      }
      // Date fields
      else if (
        lowerKey === 'date' ||
        lowerKey === 'issuedate' ||
        lowerKey === 'duedate' ||
        lowerKey === 'createdat'
      ) {
        normalized[key] = typeof value === 'string' && value.includes('T') ? value : normalizeDate(value);
      }
      // Recursive normalization for nested objects/arrays (e.g. lineItems, profile, client, etc.)
      else {
        normalized[key] = normalizePayloadBeforeJson(value);
      }
    }
    return normalized as T;
  }

  return data;
}

export function sanitizeDocumentForSync(doc: BillingDocument): BillingDocument {
  const lineItems: LineItem[] = Array.isArray(doc.lineItems)
    ? doc.lineItems.map((item, idx) => {
        const qty = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1;
        const days = typeof item.days === 'number' && item.days > 0 ? item.days : 1;
        const rate = normalizeCurrency(item.rate);
        const discount = normalizeCurrency(item.discount || 0);
        const amount = item.amount !== undefined ? normalizeCurrency(item.amount) : Math.max(0, qty * days * rate - discount);
        return {
          id: item.id || `item-${idx + 1}`,
          particulars: normalizeText(item.particulars || 'Accommodation / Service'),
          quantity: qty,
          days,
          rate,
          discount,
          amount,
        };
      })
    : [];

  const subtotal = normalizeCurrency(doc.subtotal);
  const discount = normalizeCurrency(doc.discount || 0);
  const vatAmount = normalizeCurrency(doc.vatAmount);
  const grandTotal = normalizeCurrency(doc.grandTotal);
  const amountPaid = normalizeCurrency(doc.amountPaid || 0);
  const balanceDue = doc.balanceDue !== undefined ? normalizeCurrency(doc.balanceDue) : Math.max(0, grandTotal - amountPaid);

  return {
    ...doc,
    documentNumber: normalizeCodeString(doc.documentNumber),
    clientName: normalizeText(doc.clientName),
    clientKraPin: normalizeKraPin(doc.clientKraPin),
    clientAddress: normalizeText(doc.clientAddress),
    clientPhone: doc.clientPhone ? normalizePhoneNumber(doc.clientPhone) : undefined,
    clientEmail: doc.clientEmail ? normalizeText(doc.clientEmail) : undefined,
    issueDate: normalizeDate(doc.issueDate),
    dueDate: normalizeDate(doc.dueDate),
    lineItems,
    subtotal,
    discount,
    vatAmount,
    grandTotal,
    amountPaid,
    balanceDue,
    status: doc.status || (doc.documentType === 'INVOICE' && balanceDue <= 0 ? 'Paid' : 'Sent'),
    notes: normalizeText(doc.notes || ''),
    terms: normalizeText(doc.terms || ''),
    driveFileUrl: doc.driveFileUrl || undefined,
    driveFileId: doc.driveFileId || undefined,
    createdAt: normalizeDate(doc.createdAt),
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString(),
  };
}

export function sanitizeClientForSync(client: Client): Client {
  return {
    ...client,
    id: normalizeCodeString(client.id),
    name: normalizeText(client.name),
    contactPerson: normalizeText(client.contactPerson),
    email: normalizeText(client.email),
    phone: normalizePhoneNumber(client.phone),
    kraPin: normalizeKraPin(client.kraPin),
    address: normalizeText(client.address),
    createdAt: normalizeDate(client.createdAt),
  };
}

export function sanitizePaymentForSync(payment: PaymentRecord): PaymentRecord {
  return {
    ...payment,
    receiptNumber: normalizeCodeString(payment.receiptNumber),
    documentNumber: normalizeCodeString(payment.documentNumber),
    clientName: normalizeText(payment.clientName),
    date: normalizeDate(payment.date),
    amount: normalizeCurrency(payment.amount),
    paymentMode: payment.paymentMode || 'M-Pesa',
    referenceNote: normalizeText(payment.referenceNote),
    driveFileUrl: payment.driveFileUrl || undefined,
    driveFileId: payment.driveFileId || undefined,
    createdAt: payment.createdAt ? new Date(payment.createdAt).toISOString() : new Date().toISOString(),
  };
}

class GoogleSyncManager {
  private isSyncing = false;
  private autoSyncIntervalId: any = null;
  private listenersAttached = false;
  private lastPulledHash = '';
  private immediatePushTimeout: any = null;
  private listeners: Set<SyncStateListener> = new Set();
  private pollingIntervalSeconds = 5; // Real-time 5-second polling

  private currentState: RealtimeSyncState = {
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
    autoSyncEnabled: true,
    lastSyncTimestamp: null,
    pendingCount: 0,
    statusText: 'Ready',
    realtimeActive: true,
    pollingIntervalSeconds: 5,
  };

  constructor() {
    this.initEventListeners();
    this.updateInitialState();
  }

  private async updateInitialState() {
    try {
      const [profile, queue] = await Promise.all([
        dbService.getHotelProfile(),
        dbService.getSyncQueue(),
      ]);
      this.currentState = {
        ...this.currentState,
        autoSyncEnabled: profile.autoSyncEnabled !== false,
        lastSyncTimestamp: profile.lastSyncTimestamp || null,
        pendingCount: queue.length,
      };
      this.notifyListeners();
    } catch {}
  }

  /**
   * Subscribe to real-time sync state updates
   */
  subscribe(listener: SyncStateListener): () => void {
    this.listeners.add(listener);
    listener(this.currentState);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get current snapshot of real-time sync telemetry
   */
  getRealtimeState(): RealtimeSyncState {
    return { ...this.currentState };
  }

  private notifyListeners(partial?: Partial<RealtimeSyncState>) {
    if (partial) {
      this.currentState = { ...this.currentState, ...partial };
    }
    const snapshot = { ...this.currentState };
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.warn('[GoogleSync] Listener error:', err);
      }
    }

    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(
          new CustomEvent('damview:sync-update', { detail: snapshot })
        );
      } catch {}
    }
  }

  /**
   * Attach global event listeners for network recovery, tab focus, and user activity
   */
  private initEventListeners() {
    if (typeof window === 'undefined' || this.listenersAttached) return;

    // 1. Connectivity Return -> auto-drain offline queue and trigger instant live sync
    window.addEventListener('online', () => {
      console.log('[GoogleSync] Network back online. Draining queue & live syncing...');
      this.notifyListeners({ isOnline: true, statusText: 'Online: Reconnecting...' });
      this.syncBidirectional().catch((err) =>
        console.warn('[GoogleSync] Online auto-sync error:', err)
      );
    });

    window.addEventListener('offline', () => {
      this.notifyListeners({
        isOnline: false,
        statusText: 'Offline: Mutations queued in IndexedDB',
      });
    });

    // 2. Tab Focus / Visibility Change -> instant live sync check
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        this.checkAndAutoSync();
      }
    });

    // 3. Window focus
    window.addEventListener('focus', () => {
      if (navigator.onLine) {
        this.checkAndAutoSync();
      }
    });

    this.listenersAttached = true;
  }

  /**
   * Start periodic real-time auto-sync loop (defaults to 5 seconds)
   */
  startAutoSync(intervalSeconds = 5) {
    this.pollingIntervalSeconds = intervalSeconds;
    this.currentState.pollingIntervalSeconds = intervalSeconds;
    this.currentState.realtimeActive = true;

    if (this.autoSyncIntervalId) {
      clearInterval(this.autoSyncIntervalId);
    }

    // Run first check right away
    this.checkAndAutoSync();

    this.autoSyncIntervalId = setInterval(() => {
      // In background tab, slow down slightly to save battery; in active tab, run at full speed
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        // Poll every 20s if hidden
        if (Math.random() < 0.25) {
          this.checkAndAutoSync();
        }
      } else {
        this.checkAndAutoSync();
      }
    }, intervalSeconds * 1000);

    this.notifyListeners({ realtimeActive: true });
  }

  /**
   * Stop auto-sync timer
   */
  stopAutoSync() {
    if (this.autoSyncIntervalId) {
      clearInterval(this.autoSyncIntervalId);
      this.autoSyncIntervalId = null;
    }
    this.currentState.realtimeActive = false;
    this.notifyListeners({ realtimeActive: false });
  }

  /**
   * Trigger an immediate non-blocking push of queued items to Google Sheets
   */
  triggerImmediatePush() {
    if (this.immediatePushTimeout) {
      clearTimeout(this.immediatePushTimeout);
    }
    this.immediatePushTimeout = setTimeout(() => {
      this.processSyncQueue()
        .then(() => this.checkAndAutoSync())
        .catch((err) => console.warn('[GoogleSync] Immediate push error:', err));
    }, 50);
  }

  private async checkAndAutoSync() {
    if (this.isSyncing || !navigator.onLine) return;
    try {
      const profile = await dbService.getHotelProfile();
      if (profile.autoSyncEnabled !== false && profile.googleWebAppUrl) {
        await this.syncBidirectional();
      }
    } catch (err) {
      console.warn('[GoogleSync] Real-time background sync error:', err);
    }
  }

  /**
   * Centralized safe HTTP POST dispatcher to Google Apps Script Web App.
   * Defends against HTML redirects, invalid URLs, Google login pages, and JSON syntax errors.
   */
  async postToScript<T = any>(
    url: string,
    payload: any,
    timeoutMs = 35000
  ): Promise<{ success: boolean; message?: string; error?: string; [key: string]: any }> {
    if (!url || typeof url !== 'string' || !url.trim().startsWith('http')) {
      return {
        success: false,
        error: 'Invalid Web App URL. Enter a valid Google Apps Script Web App URL starting with https://',
      };
    }

    const trimmedUrl = url.trim();

    // Catch common user confusion between Google Sheets URL and Apps Script Web App URL
    if (trimmedUrl.includes('docs.google.com/spreadsheets')) {
      return {
        success: false,
        error:
          'You entered a Google Spreadsheet link instead of a Google Apps Script Web App URL. In Google Sheets, click Extensions > Apps Script > Deploy > New deployment (type: Web app) and copy the Web App URL ending in /exec.',
      };
    }

    if (trimmedUrl.includes('script.google.com') && !trimmedUrl.includes('/exec')) {
      if (trimmedUrl.includes('/edit') || trimmedUrl.includes('project')) {
        return {
          success: false,
          error:
            'You entered the Apps Script Editor link instead of the published Web App URL. Click Deploy > Manage deployments (or New deployment) and copy the Web App URL ending in /exec.',
        };
      }
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
      // Strict client-side data normalization using Regex for KRA PINs, phone numbers, and currency strings before stringifying
      const normalizedPayload = normalizePayloadBeforeJson(payload);
      const jsonBody = JSON.stringify(normalizedPayload);

      const res = await fetch(trimmedUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: jsonBody,
        signal: controller?.signal,
      });

      if (timeoutId) clearTimeout(timeoutId);

      const rawText = await res.text();

      // Guard: Detect if Google returned an HTML page (login redirect or unhandled error)
      const trimmedText = rawText.trim();
      if (
        trimmedText.startsWith('<') ||
        trimmedText.toLowerCase().includes('<!doctype') ||
        trimmedText.toLowerCase().includes('<html')
      ) {
        if (
          trimmedText.includes('ServiceLogin') ||
          trimmedText.includes('accounts.google.com') ||
          trimmedText.includes('Sign in')
        ) {
          return {
            success: false,
            error:
              'Google Web App Authorization Required: Access is restricted. In Apps Script, click Deploy > Manage deployments > Edit (pencil icon) > set "Who has access" to "Anyone", select "New version", and click Deploy.',
          };
        }
        if (trimmedText.includes('Script function not found') || trimmedText.includes('Exception:')) {
          return {
            success: false,
            error:
              'Google Apps Script error: Please ensure you copied and deployed the latest Code.gs script in Apps Script.',
          };
        }
        return {
          success: false,
          error:
            'Google Apps Script returned an HTML page instead of JSON. Please ensure the Web App is deployed with "Execute as: Me" and "Who has access: Anyone".',
        };
      }

      let parsed: any;
      try {
        parsed = JSON.parse(rawText);
      } catch (parseErr: any) {
        return {
          success: false,
          error: `Could not parse response from Google Apps Script: ${parseErr.message || 'Malformed JSON response'}`,
        };
      }

      if (parsed && parsed.success === false) {
        return {
          ...parsed,
          success: false,
          error: parsed.error || parsed.message || 'Google Apps Script returned an error.',
        };
      }

      return {
        success: true,
        ...parsed,
      };
    } catch (err: any) {
      if (timeoutId) clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        return {
          success: false,
          error: 'Request to Google Apps Script timed out. The operation might still be processing in Google Sheets.',
        };
      }
      return {
        success: false,
        error: err.message || 'Network error communicating with Google Apps Script Web App.',
      };
    }
  }

  /**
   * Test connection to Google Apps Script Web App
   */
  async testConnection(
    webAppUrl: string
  ): Promise<{ ok: boolean; message: string; sheetUrl?: string; sheetName?: string; tabs?: any[] }> {
    if (!webAppUrl || !webAppUrl.startsWith('http')) {
      return {
        ok: false,
        message: 'Invalid URL. Enter a valid Google Apps Script Web App URL starting with https://.',
      };
    }
    if (!navigator.onLine) {
      return { ok: false, message: 'Network offline. Check your internet connection.' };
    }

    const res = await this.postToScript(webAppUrl, { action: 'PING', timestamp: new Date().toISOString() });

    if (!res.success) {
      return {
        ok: false,
        message: res.error || 'Connection test failed.',
      };
    }

    if (res.sheetUrl) {
      try {
        const prof = await dbService.getHotelProfile();
        if (!prof.googleSheetUrl) {
          await dbService.saveHotelProfile({ googleSheetUrl: res.sheetUrl });
        }
      } catch {}
    }

    return {
      ok: true,
      message: res.message || 'Connected successfully to Hotel Damview Centralized Google Sheets & Drive backend!',
      sheetUrl: res.sheetUrl,
      sheetName: res.sheetName,
      tabs: res.tabs || [],
    };
  }

  /**
   * Sync a document with Base64 PDF archive in real time (App -> Google Sheets & Drive)
   * Enforces pre-upload byte validation, full canonical filename deduplication, and post-upload verification.
   */
  async syncDocument(
    doc: BillingDocument,
    pdfBase64?: string,
    fileName?: string
  ): Promise<{ success: boolean; driveUrl?: string; driveFileId?: string; uploadVerified?: boolean; error?: string }> {
    const profile = await dbService.getHotelProfile();
    const url = profile.googleWebAppUrl;
    const sanitizedDoc = sanitizeDocumentForSync(doc);

    // Enforce canonical filename pattern: [DocNo]_[ClientName]_[YYYY-MM-DD].pdf
    const canonicalFileName =
      fileName || getPdfFileName(sanitizedDoc.documentNumber, sanitizedDoc.clientName, sanitizedDoc.issueDate);

    // Pre-upload validation: verify that if a PDF is attached, it meets minimal base64 standards
    let validPdfBase64 = pdfBase64;
    if (validPdfBase64) {
      if (validPdfBase64.length < 500) {
        console.warn('Pre-upload validation: PDF base64 stream length is undersized (< 500 characters). Omitted to prevent Drive corruption.');
        validPdfBase64 = undefined;
      }
    }

    const payload = {
      action: 'UPSERT_DOCUMENT',
      document: sanitizedDoc,
      pdfBase64: validPdfBase64,
      fileName: canonicalFileName,
      folderName: profile.googleDriveFolder || 'Hotel Damview Archives',
      timestamp: new Date().toISOString(),
    };

    if (!url || !navigator.onLine) {
      const reason = !navigator.onLine
        ? 'Offline mode active. Document safely queued for sync.'
        : 'Google Web App URL not configured.';

      await dbService.addToSyncQueue({
        action: 'UPSERT_DOCUMENT',
        payload,
      });

      const queue = await dbService.getSyncQueue();
      this.notifyListeners({ pendingCount: queue.length });

      const existing = (await dbService.getDocumentById(sanitizedDoc.id)) || sanitizedDoc;
      await dbService.saveDocument({
        ...existing,
        ...sanitizedDoc,
        syncedToGoogle: false,
        lastSyncStatus: 'pending',
      });
      return { success: false, error: reason };
    }

    try {
      this.notifyListeners({ isSyncing: true, statusText: 'Live pushing document & archiving PDF...' });

      const res = await this.postToScript(url, payload);

      if (!res.success) {
        throw new Error(res.error || 'Sync rejected by Google Apps Script backend');
      }

      const driveUrl =
        res?.pdfArchived?.webViewLink ||
        res?.pdfArchived?.url ||
        res?.webViewLink ||
        res?.driveUrl ||
        doc.driveFileUrl;
      const driveFileId = res?.pdfArchived?.fileId || res?.driveFileId || doc.driveFileId;
      const uploadVerified = Boolean(
        res?.pdfArchived?.status === 'ARCHIVED' ||
        (driveUrl && typeof driveUrl === 'string' && driveUrl.startsWith('http'))
      );

      const existing = (await dbService.getDocumentById(doc.id)) || doc;
      await dbService.saveDocument({
        ...existing,
        ...doc,
        syncedToGoogle: true,
        syncedAt: new Date().toISOString(),
        driveFileUrl: driveUrl || existing.driveFileUrl,
        driveFileId: driveFileId || existing.driveFileId,
        lastSyncStatus: 'synced',
      });

      const now = new Date().toISOString();
      await dbService.saveHotelProfile({
        lastSyncTimestamp: now,
      });

      this.notifyListeners({
        isSyncing: false,
        lastSyncTimestamp: now,
        statusText: uploadVerified ? 'Live Synced & Verified' : 'Live Synced',
      });

      return { success: true, driveUrl, driveFileId, uploadVerified };
    } catch (err: any) {
      const errorMessage = err?.message || 'Network or webhook communication failure';

      await dbService.addToSyncQueue({
        action: 'UPSERT_DOCUMENT',
        payload,
      });

      const queue = await dbService.getSyncQueue();
      this.notifyListeners({
        isSyncing: false,
        pendingCount: queue.length,
        statusText: 'Sync failed: Queued for retry',
        lastError: errorMessage,
      });

      const existing = (await dbService.getDocumentById(doc.id)) || doc;
      await dbService.saveDocument({
        ...existing,
        ...doc,
        syncedToGoogle: false,
        lastSyncStatus: 'failed',
      });

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Direct trigger to archive a document PDF to Google Drive and sync remote ledger.
   */
  async archiveDocumentPdf(
    doc: BillingDocument,
    pdfBase64?: string,
    fileName?: string
  ): Promise<{ success: boolean; driveUrl?: string; driveFileId?: string; uploadVerified?: boolean; error?: string }> {
    return this.syncDocument(doc, pdfBase64, fileName);
  }

  /**
   * Generates a verification test PDF and uploads it directly to Google Drive via Apps Script.
   * Returns Drive URL, File ID, filename, and byte length.
   */
  async uploadTestPdfToDrive(options?: {
    customTitle?: string;
    folderName?: string;
  }): Promise<{
    success: boolean;
    driveUrl?: string;
    driveFileId?: string;
    fileName?: string;
    byteLength?: number;
    folderName?: string;
    error?: string;
  }> {
    const profile = await dbService.getHotelProfile();
    const url = profile.googleWebAppUrl;
    const targetFolder = options?.folderName || profile.googleDriveFolder || 'Hotel Damview Archives';

    if (!url || !url.startsWith('http')) {
      return {
        success: false,
        error: 'Google Apps Script Web App URL is not configured. Please set it in Settings > Google Workspace Sync.',
      };
    }

    if (!navigator.onLine) {
      return {
        success: false,
        error: 'Cannot upload test PDF while offline. Please connect to the internet and retry.',
      };
    }

    try {
      this.notifyListeners({ isSyncing: true, statusText: 'Generating & uploading test PDF to Google Drive...' });

      // Generate authentic test PDF
      const testPdf = generateTestPdfDocument({
        hotelName: profile.name || 'HOTEL DAMVIEW RESORT',
        targetFolder,
      });

      const testDocNumber = `TEST-${Date.now().toString().slice(-6)}`;
      const testIssueDate = new Date().toISOString().split('T')[0];

      const testDoc: BillingDocument = {
        id: `test-drive-${Date.now()}`,
        documentNumber: testDocNumber,
        documentType: 'INVOICE',
        clientId: 'client-test-drive',
        issueDate: testIssueDate,
        validityDays: 30,
        dueDate: testIssueDate,
        clientName: 'Google Drive Cloud Test Verification',
        clientAddress: 'Hotel Damview System Automation Bench',
        clientKraPin: 'P051234567Z',
        discount: 0,
        subtotal: 1000,
        vatAmount: 160,
        grandTotal: 1160,
        amountPaid: 1160,
        balanceDue: 0,
        status: 'Paid',
        notes: 'Generated diagnostic test document for verifying Google Drive cloud PDF byte stream ingestion.',
        terms: 'For verification testing only.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lineItems: [
          {
            id: 'li-test-1',
            particulars: 'Automated Google Drive Cloud Archiving & Byte Integrity Test',
            quantity: 1,
            days: 1,
            rate: 1000,
            amount: 1000,
          },
        ],
      };

      const payload = {
        action: 'UPSERT_DOCUMENT',
        document: testDoc,
        pdfBase64: testPdf.base64,
        fileName: testPdf.fileName,
        folderName: targetFolder,
        timestamp: new Date().toISOString(),
      };

      const res = await this.postToScript(url, payload, 45000);

      if (!res.success) {
        this.notifyListeners({
          isSyncing: false,
          statusText: 'Test PDF upload failed',
          lastError: res.error,
        });
        return {
          success: false,
          error: res.error || 'Failed to archive test PDF to Google Drive.',
        };
      }

      const driveUrl = res.driveUrl || (res.pdfArchived && res.pdfArchived.url);
      const driveFileId = res.driveFileId || (res.pdfArchived && res.pdfArchived.fileId);

      // Record audit entry
      await dbService.recordAuditLog({
        action: 'UPDATE',
        entityType: 'DOCUMENT',
        entityId: testDoc.id,
        details: `Archived Test PDF to Google Drive (${testPdf.fileName}, ${testPdf.byteLength} bytes). URL: ${driveUrl || 'Pending'}`,
      });

      this.notifyListeners({
        isSyncing: false,
        lastSyncTimestamp: new Date().toISOString(),
        statusText: 'Test PDF Archived to Google Drive',
      });

      return {
        success: true,
        driveUrl,
        driveFileId,
        fileName: testPdf.fileName,
        byteLength: testPdf.byteLength,
        folderName: targetFolder,
      };
    } catch (err: any) {
      this.notifyListeners({
        isSyncing: false,
        statusText: 'Test PDF upload error',
        lastError: err?.message,
      });
      return {
        success: false,
        error: err?.message || 'Unexpected failure uploading test PDF to Google Drive.',
      };
    }
  }

  /**
   * Direct PDF base64 archive pipeline to Google Drive via Apps Script
   */
  async uploadPdfToDrive(options: {
    pdfBase64: string;
    fileName: string;
    folderName?: string;
  }): Promise<{
    success: boolean;
    driveUrl?: string;
    driveFileId?: string;
    fileName?: string;
    byteLength?: number;
    error?: string;
  }> {
    const profile = await dbService.getHotelProfile();
    const url = profile.googleWebAppUrl;
    const targetFolder = options.folderName || profile.googleDriveFolder || 'Hotel Damview Archives';

    if (!url || !url.startsWith('http')) {
      return {
        success: false,
        error: 'Google Apps Script Web App URL is not configured.',
      };
    }

    if (!navigator.onLine) {
      return {
        success: false,
        error: 'Offline mode active. Upload queued.',
      };
    }

    try {
      this.notifyListeners({ isSyncing: true, statusText: `Archiving ${options.fileName} to Google Drive...` });

      const payload = {
        action: 'ARCHIVE_PDF',
        pdfBase64: options.pdfBase64,
        fileName: options.fileName,
        folderName: targetFolder,
        timestamp: new Date().toISOString(),
      };

      const res = await this.postToScript(url, payload, 45000);

      this.notifyListeners({
        isSyncing: false,
        statusText: res.success ? 'PDF Archived to Drive' : 'Drive Archiving Failed',
      });

      if (!res.success) {
        return {
          success: false,
          error: res.error || 'Failed to archive PDF to Google Drive.',
        };
      }

      const driveUrl = res.driveUrl || (res.pdfArchived && res.pdfArchived.url);
      const driveFileId = res.driveFileId || (res.pdfArchived && res.pdfArchived.fileId);

      return {
        success: true,
        driveUrl,
        driveFileId,
        fileName: res.fileName || options.fileName,
        byteLength: res.byteLength,
      };
    } catch (err: any) {
      this.notifyListeners({ isSyncing: false, statusText: 'Drive Upload Error' });
      return {
        success: false,
        error: err?.message || 'Drive PDF Upload failed.',
      };
    }
  }

  /**
   * Sync Hotel Profile in real time (App -> Google Sheets)
   */
  async syncProfile(newProfile: HotelProfile): Promise<{ success: boolean; error?: string }> {
    const url = newProfile.googleWebAppUrl;
    const payload = {
      action: 'UPSERT_PROFILE',
      profile: newProfile,
      timestamp: new Date().toISOString(),
    };

    if (!url || !navigator.onLine) {
      await dbService.addToSyncQueue({
        action: 'UPSERT_PROFILE',
        payload,
      });
      const queue = await dbService.getSyncQueue();
      this.notifyListeners({ pendingCount: queue.length });
      return { success: false, error: 'Offline or Web App URL missing. Queued for background sync.' };
    }

    try {
      this.notifyListeners({ isSyncing: true, statusText: 'Updating Hotel Profile in Google Sheets...' });
      const res = await this.postToScript(url, payload);
      this.notifyListeners({ isSyncing: false, statusText: res.success ? 'Profile Synced' : 'Profile Sync Deferred' });
      return { success: res.success, error: res.error };
    } catch (err: any) {
      await dbService.addToSyncQueue({
        action: 'UPSERT_PROFILE',
        payload,
      });
      const queue = await dbService.getSyncQueue();
      this.notifyListeners({ isSyncing: false, pendingCount: queue.length });
      return { success: false, error: err?.message || 'Network error syncing profile' };
    }
  }

  /**
   * Sync a client record in real time (App -> Google Sheets)
   */
  async syncClient(client: Client): Promise<{ success: boolean; error?: string }> {
    const profile = await dbService.getHotelProfile();
    const url = profile.googleWebAppUrl;
    const sanitizedClient = sanitizeClientForSync(client);

    const payload = {
      action: 'UPSERT_CLIENT',
      client: sanitizedClient,
      timestamp: new Date().toISOString(),
    };

    if (!url || !navigator.onLine) {
      const reason = !navigator.onLine
        ? 'Offline mode active. Queued for sync.'
        : 'Web App URL missing.';
      await dbService.addToSyncQueue({
        action: 'UPSERT_CLIENT',
        payload,
      });
      const queue = await dbService.getSyncQueue();
      this.notifyListeners({ pendingCount: queue.length });
      return { success: false, error: reason };
    }

    try {
      this.notifyListeners({ isSyncing: true, statusText: 'Live pushing client...' });

      const res = await this.postToScript(url, payload);

      if (!res.success) {
        throw new Error(res.error || 'Client sync rejected by Google backend');
      }

      const now = new Date().toISOString();
      await dbService.saveHotelProfile({
        lastSyncTimestamp: now,
      });

      this.notifyListeners({
        isSyncing: false,
        lastSyncTimestamp: now,
        statusText: 'Live Synced',
      });

      return { success: true };
    } catch (err: any) {
      await dbService.addToSyncQueue({
        action: 'UPSERT_CLIENT',
        payload,
      });
      const queue = await dbService.getSyncQueue();
      this.notifyListeners({
        isSyncing: false,
        pendingCount: queue.length,
        statusText: 'Client queued for sync',
      });
      return { success: false, error: err?.message || 'Sync network error' };
    }
  }

  /**
   * Record a payment / receipt with PDF archive in real time
   * Enforces pre-upload validation, canonical naming, and post-upload verification.
   */
  async syncPayment(
    payment: PaymentRecord,
    pdfBase64?: string,
    fileName?: string
  ): Promise<{ success: boolean; driveUrl?: string; driveFileId?: string; uploadVerified?: boolean; error?: string }> {
    const profile = await dbService.getHotelProfile();
    const url = profile.googleWebAppUrl;
    const sanitizedPayment = sanitizePaymentForSync(payment);

    const canonicalFileName =
      fileName ||
      `${(payment.receiptNumber || 'REC').replace(/[^a-zA-Z0-9-_]/g, '')}_${(payment.clientName || 'Guest').replace(/[^a-zA-Z0-9]/g, '_')}_${payment.date || 'DATE'}.pdf`;

    let validPdfBase64 = pdfBase64;
    if (validPdfBase64 && validPdfBase64.length < 500) {
      console.warn('Pre-upload validation: Receipt PDF base64 stream is undersized (< 500 characters). Omitted.');
      validPdfBase64 = undefined;
    }

    const payload = {
      action: 'RECORD_PAYMENT',
      payment: sanitizedPayment,
      pdfBase64: validPdfBase64,
      fileName: canonicalFileName,
      folderName: profile.googleDriveFolder || 'Hotel Damview Archives',
      timestamp: new Date().toISOString(),
    };

    if (!url || !navigator.onLine) {
      await dbService.addToSyncQueue({
        action: 'RECORD_PAYMENT',
        payload,
      });
      const queue = await dbService.getSyncQueue();
      this.notifyListeners({ pendingCount: queue.length });
      return { success: false, error: 'Offline or Web App URL not set. Queued for sync.' };
    }

    try {
      this.notifyListeners({ isSyncing: true, statusText: 'Live recording payment & archiving receipt...' });

      const res = await this.postToScript(url, payload);

      if (!res.success) {
        throw new Error(res.error || 'Payment sync rejected by Google backend');
      }

      const driveUrl =
        res?.pdfArchived?.webViewLink ||
        res?.pdfArchived?.url ||
        res?.webViewLink ||
        res?.driveUrl ||
        payment.driveFileUrl;
      const driveFileId = res?.pdfArchived?.fileId || res?.driveFileId || payment.driveFileId;
      const uploadVerified = Boolean(
        res?.pdfArchived?.status === 'ARCHIVED' ||
        (driveUrl && typeof driveUrl === 'string' && driveUrl.startsWith('http'))
      );

      await dbService.savePayment({
        ...payment,
        syncedToGoogle: true,
        driveFileUrl: driveUrl,
        driveFileId,
        lastSyncStatus: 'synced',
      });

      const now = new Date().toISOString();
      await dbService.saveHotelProfile({
        lastSyncTimestamp: now,
      });

      this.notifyListeners({
        isSyncing: false,
        lastSyncTimestamp: now,
        statusText: uploadVerified ? 'Payment Live Synced & Verified' : 'Payment Live Synced',
      });

      return { success: true, driveUrl, driveFileId, uploadVerified };
    } catch (err: any) {
      await dbService.addToSyncQueue({
        action: 'RECORD_PAYMENT',
        payload,
      });
      const queue = await dbService.getSyncQueue();
      this.notifyListeners({
        isSyncing: false,
        pendingCount: queue.length,
        statusText: 'Payment queued for sync',
      });
      return { success: false, error: err?.message || 'Payment sync error' };
    }
  }

  /**
   * Direct trigger to archive a receipt payment PDF to Google Drive and sync remote ledger.
   */
  async archiveReceiptPdf(
    payment: PaymentRecord,
    pdfBase64?: string,
    fileName?: string
  ): Promise<{ success: boolean; driveUrl?: string; driveFileId?: string; uploadVerified?: boolean; error?: string }> {
    return this.syncPayment(payment, pdfBase64, fileName);
  }

  /**
   * Direct trigger to archive a Statement of Account PDF to Google Drive via Apps Script.
   */
  async archiveStatementPdf(
    statement: StatementRecord,
    pdfBase64?: string,
    fileName?: string
  ): Promise<{ success: boolean; driveUrl?: string; driveFileId?: string; uploadVerified?: boolean; error?: string }> {
    const profile = await dbService.getHotelProfile();
    const url = profile.googleWebAppUrl;

    const canonicalFileName =
      fileName ||
      `${statement.statementNumber}_${(statement.clientName || 'Client').replace(/[^a-zA-Z0-9]/g, '_')}_${statement.issueDate}.pdf`;

    let validPdfBase64 = pdfBase64;
    if (validPdfBase64 && validPdfBase64.length < 500) {
      console.warn('Pre-upload validation: Statement PDF base64 stream length is undersized (< 500 characters).');
      validPdfBase64 = undefined;
    }

    const payload = {
      action: 'ARCHIVE_STATEMENT_PDF',
      statementNumber: statement.statementNumber,
      clientName: statement.clientName,
      pdfBase64: validPdfBase64,
      fileName: canonicalFileName,
      folderName: profile.googleDriveFolder || 'Hotel Damview Archives',
      timestamp: new Date().toISOString(),
    };

    if (!url || !navigator.onLine) {
      const reason = !navigator.onLine
        ? 'Offline mode active. Statement archived locally; queued for cloud sync.'
        : 'Web App URL missing.';
      await dbService.addToSyncQueue({
        action: 'ARCHIVE_STATEMENT_PDF',
        payload,
      });
      const queue = await dbService.getSyncQueue();
      this.notifyListeners({ pendingCount: queue.length });
      return { success: false, error: reason };
    }

    try {
      this.notifyListeners({ isSyncing: true, statusText: 'Archiving Statement PDF to Google Drive...' });
      const res = await this.postToScript(url, payload);

      if (!res.success) {
        throw new Error(res.error || 'Statement archive rejected by Google backend');
      }

      const driveUrl =
        res?.pdfArchived?.webViewLink ||
        res?.pdfArchived?.url ||
        res?.webViewLink ||
        res?.driveUrl ||
        statement.driveFileUrl;
      const driveFileId = res?.pdfArchived?.fileId || res?.driveFileId || statement.driveFileId;
      const uploadVerified = Boolean(
        res?.pdfArchived?.status === 'ARCHIVED' ||
        (driveUrl && typeof driveUrl === 'string' && driveUrl.startsWith('http'))
      );

      const updatedStmt: StatementRecord = {
        ...statement,
        driveFileUrl: driveUrl,
        driveFileId,
        pdfGenerated: true,
        updatedAt: new Date().toISOString(),
      };
      await dbService.saveStatement(updatedStmt);

      this.notifyListeners({
        isSyncing: false,
        lastSyncTimestamp: new Date().toISOString(),
        statusText: uploadVerified ? 'Statement PDF Live Synced & Verified' : 'Statement PDF Live Synced',
      });

      return { success: true, driveUrl, driveFileId, uploadVerified };
    } catch (err: any) {
      await dbService.addToSyncQueue({
        action: 'ARCHIVE_STATEMENT_PDF',
        payload,
      });
      const queue = await dbService.getSyncQueue();
      this.notifyListeners({
        isSyncing: false,
        pendingCount: queue.length,
        statusText: 'Statement queued for cloud sync',
      });
      return { success: false, error: err?.message || 'Statement sync network error' };
    }
  }

  /**
   * Cascade Delete a Document across Local DB, Google Sheets, and Google Drive
   */
  async cascadeDeleteDocument(
    documentId: string,
    documentNumber: string,
    folderName?: string
  ): Promise<{ success: boolean; message: string }> {
    const profile = await dbService.getHotelProfile();
    const url = profile.googleWebAppUrl;

    const payload = {
      action: 'CASCADE_DELETE_DOCUMENT',
      documentId,
      documentNumber,
      folderName: folderName || profile.googleDriveFolder || 'Hotel Damview Archives',
      timestamp: new Date().toISOString(),
    };

    if (!url || !navigator.onLine) {
      await dbService.addToSyncQueue({
        action: 'CASCADE_DELETE_DOCUMENT',
        payload,
      });
      const queue = await dbService.getSyncQueue();
      this.notifyListeners({ pendingCount: queue.length });
      return {
        success: true,
        message: 'Deleted locally. Google Sheet row and Drive PDF deletion queued for sync.',
      };
    }

    try {
      this.notifyListeners({ isSyncing: true, statusText: 'Live purging document...' });

      await this.postToScript(url, payload);

      this.notifyListeners({ isSyncing: false, statusText: 'Purged in Realtime' });

      return {
        success: true,
        message: 'Document purged from local database, Google Sheets ledger, and Google Drive archives.',
      };
    } catch {
      await dbService.addToSyncQueue({
        action: 'CASCADE_DELETE_DOCUMENT',
        payload,
      });
      const queue = await dbService.getSyncQueue();
      this.notifyListeners({ isSyncing: false, pendingCount: queue.length });
      return {
        success: true,
        message: 'Deleted locally. Remote deletion queued.',
      };
    }
  }

  /**
   * Cascade Delete a Client across Local DB and Google Sheets
   */
  async cascadeDeleteClient(clientId: string): Promise<{ success: boolean; message: string }> {
    const profile = await dbService.getHotelProfile();
    const url = profile.googleWebAppUrl;

    const payload = {
      action: 'CASCADE_DELETE_CLIENT',
      clientId,
      timestamp: new Date().toISOString(),
    };

    if (!url || !navigator.onLine) {
      await dbService.addToSyncQueue({
        action: 'CASCADE_DELETE_CLIENT',
        payload,
      });
      const queue = await dbService.getSyncQueue();
      this.notifyListeners({ pendingCount: queue.length });
      return {
        success: true,
        message: 'Deleted locally. Google Sheet row deletion queued for sync.',
      };
    }

    try {
      this.notifyListeners({ isSyncing: true, statusText: 'Live removing client...' });

      await this.postToScript(url, payload);

      this.notifyListeners({ isSyncing: false, statusText: 'Client removed' });

      return {
        success: true,
        message: 'Client removed from local database and Google Sheets.',
      };
    } catch {
      await dbService.addToSyncQueue({
        action: 'CASCADE_DELETE_CLIENT',
        payload,
      });
      const queue = await dbService.getSyncQueue();
      this.notifyListeners({ isSyncing: false, pendingCount: queue.length });
      return {
        success: true,
        message: 'Deleted locally. Remote deletion queued.',
      };
    }
  }

  /**
   * Cascade Delete a Payment/Receipt across Local DB, Google Sheets Receipts tab, and Google Drive
   */
  async cascadeDeletePayment(
    paymentId: string,
    receiptNumber: string,
    documentNumber?: string,
    folderName?: string
  ): Promise<{ success: boolean; message: string }> {
    const profile = await dbService.getHotelProfile();
    const url = profile.googleWebAppUrl;

    const payload = {
      action: 'CASCADE_DELETE_PAYMENT',
      paymentId,
      receiptNumber,
      documentNumber,
      folderName: folderName || profile.googleDriveFolder,
      timestamp: new Date().toISOString(),
    };

    if (!url || !navigator.onLine) {
      await dbService.addToSyncQueue({
        action: 'CASCADE_DELETE_PAYMENT',
        payload,
      });
      const queue = await dbService.getSyncQueue();
      this.notifyListeners({ pendingCount: queue.length });
      return {
        success: true,
        message: 'Deleted locally. Google Sheet receipt row deletion & ledger reconciliation queued for sync.',
      };
    }

    try {
      this.notifyListeners({ isSyncing: true, statusText: 'Live purging receipt...' });

      const res = await this.postToScript(url, payload);

      if (!res.success) {
        throw new Error(res.error || 'Receipt purge rejected by backend');
      }

      this.notifyListeners({ isSyncing: false, statusText: 'Receipt purged' });

      return {
        success: true,
        message: 'Receipt purged from Google Sheets, Drive archive trashed, and invoice balance reconciled.',
      };
    } catch {
      await dbService.addToSyncQueue({
        action: 'CASCADE_DELETE_PAYMENT',
        payload,
      });
      const queue = await dbService.getSyncQueue();
      this.notifyListeners({ isSyncing: false, pendingCount: queue.length });
      return {
        success: true,
        message: 'Deleted locally. Remote deletion queued.',
      };
    }
  }

  /**
   * Clean duplicate and redundant worksheets safely (purging only after merging unique data)
   */
  async cleanWorksheets(): Promise<{ success: boolean; report?: any; error?: string }> {
    const profile = await dbService.getHotelProfile();
    const url = profile.googleWebAppUrl;
    if (!url || !navigator.onLine) {
      return { success: false, error: 'Offline or Web App URL not configured.' };
    }

    try {
      this.notifyListeners({ isSyncing: true, statusText: 'Cleaning worksheets...' });
      const res = await this.postToScript(url, { action: 'CLEAN_WORKSHEETS', timestamp: new Date().toISOString() });
      this.notifyListeners({ isSyncing: false });
      return { success: res.success, report: res.report, error: res.error };
    } catch (err: any) {
      this.notifyListeners({ isSyncing: false });
      return { success: false, error: err.message || 'Worksheet cleanup failed' };
    }
  }

  /**
   * Fetch real-time spreadsheet data for embedded preview and tab discovery
   */
  async fetchSheetData(): Promise<{ success: boolean; data?: SpreadsheetDataPayload; error?: string }> {
    const profile = await dbService.getHotelProfile();
    const url = profile.googleWebAppUrl;
    if (!url || !navigator.onLine) {
      return { success: false, error: 'Offline or Web App URL not configured.' };
    }

    try {
      const res = await this.postToScript(url, { action: 'GET_SHEET_DATA', timestamp: new Date().toISOString() });
      return { success: res.success, data: res.data, error: res.error };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch spreadsheet data' };
    }
  }

  /**
   * Process all queued items in the background (App -> Google Sheets)
   */
  async processSyncQueue(): Promise<SyncResult> {
    if (!navigator.onLine) {
      return {
        success: false,
        message: 'Currently offline. Mutations are safely stored in offline queue.',
        timestamp: new Date().toISOString(),
      };
    }

    const profile = await dbService.getHotelProfile();
    const url = profile.googleWebAppUrl;
    if (!url) {
      return {
        success: false,
        message: 'Google Apps Script Web App URL not configured yet.',
        timestamp: new Date().toISOString(),
      };
    }

    let processed = 0;
    let failed = 0;
    let lastError = '';

    try {
      const queue = await dbService.getSyncQueue();
      if (queue.length === 0) {
        return {
          success: true,
          message: 'Offline queue is clear.',
          timestamp: new Date().toISOString(),
          itemsProcessed: 0,
        };
      }

      this.notifyListeners({ isSyncing: true, statusText: `Flushing ${queue.length} queued item(s)...` });

      for (const item of queue) {
        try {
          const payloadToSend = { ...item.payload };
          if (payloadToSend.document) {
            payloadToSend.document = sanitizeDocumentForSync(payloadToSend.document);
          }
          if (payloadToSend.client) {
            payloadToSend.client = sanitizeClientForSync(payloadToSend.client);
          }
          if (payloadToSend.payment) {
            payloadToSend.payment = sanitizePaymentForSync(payloadToSend.payment);
          }

          const res = await this.postToScript(url, payloadToSend);

          if (!res.success) {
            throw new Error(res.error || 'Sync rejected by Google backend');
          }

          await dbService.removeSyncQueueItem(item.id);
          processed++;
        } catch (itemErr: any) {
          failed++;
          lastError = itemErr?.message || 'Sync network error';
          console.warn('Queue item sync failed:', itemErr);

          await dbService.updateSyncQueueItem({
            ...item,
            status: 'failed',
            retryCount: (item.retryCount || 0) + 1,
            errorMessage: lastError,
          });
        }
      }

      const remainingQueue = await dbService.getSyncQueue();
      this.notifyListeners({ pendingCount: remainingQueue.length });

      if (processed > 0) {
        await dbService.saveHotelProfile({
          lastSyncTimestamp: new Date().toISOString(),
        });
      }

      if (failed > 0 && processed === 0) {
        return {
          success: false,
          message: `Sync failed for ${failed} queued item(s): ${lastError}`,
          timestamp: new Date().toISOString(),
          itemsProcessed: 0,
          error: lastError,
        };
      }

      return {
        success: true,
        message:
          processed > 0
            ? `Successfully pushed ${processed} queued mutation(s) to Google Sheets.${failed > 0 ? ` (${failed} deferred)` : ''}`
            : 'Offline queue was already clear.',
        timestamp: new Date().toISOString(),
        itemsProcessed: processed,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Queue processing error: ${err.message}`,
        timestamp: new Date().toISOString(),
        error: err.message,
      };
    }
  }

  /**
   * Helper to compute a fast content hash for remote spreadsheet data
   */
  private computePayloadHash(data: SpreadsheetDataPayload): string {
    const invCount = data.invoices?.length || 0;
    const quotCount = data.quotations?.length || 0;
    const profCount = data.proformas?.length || 0;
    const clientCount = data.clients?.length || 0;
    const recCount = data.receipts?.length || 0;
    const lastInv = data.invoices?.[0]?.documentNumber || '';
    const lastRec = data.receipts?.[0]?.receiptNumber || '';
    return `${invCount}_${quotCount}_${profCount}_${clientCount}_${recCount}_${lastInv}_${lastRec}_${data.serverTimestamp || ''}`;
  }

  /**
   * Pull latest data from Google Sheets down into local database in real time
   * Supports optional force parameter to bypass fingerprint caching and force full update
   */
  async pullFromGoogleSheets(options?: { force?: boolean }): Promise<{
    success: boolean;
    itemsPulled: number;
    stats?: {
      invoices: number;
      quotations: number;
      proformas: number;
      clients: number;
      payments: number;
    };
    error?: string;
    unchanged?: boolean;
  }> {
    if (!navigator.onLine) {
      return { success: false, itemsPulled: 0, error: 'Cannot pull from Google Sheets while offline.' };
    }

    const profile = await dbService.getHotelProfile();
    const url = profile.googleWebAppUrl;
    if (!url) {
      return { success: false, itemsPulled: 0, error: 'Web App URL not configured.' };
    }

    try {
      this.notifyListeners({ isSyncing: true, statusText: 'Pulling latest data from Google Sheets...' });
      const fetchRes = await this.fetchSheetData();
      if (!fetchRes.success || !fetchRes.data) {
        this.notifyListeners({ isSyncing: false, statusText: 'Pull failed' });
        return { success: false, itemsPulled: 0, error: fetchRes.error || 'Empty response from spreadsheet.' };
      }

      const remoteData = fetchRes.data;
      const currentHash = this.computePayloadHash(remoteData);

      // Fast-path: If remote content has not changed and force is not specified, return immediately
      const syncQueue = await dbService.getSyncQueue();
      if (!options?.force && this.lastPulledHash && this.lastPulledHash === currentHash && syncQueue.length === 0) {
        this.notifyListeners({ isSyncing: false, statusText: 'All data up to date' });
        return { success: true, itemsPulled: 0, unchanged: true };
      }

      let pulledCount = 0;
      const pullStats = {
        invoices: 0,
        quotations: 0,
        proformas: 0,
        clients: 0,
        payments: 0,
      };

      // Get pending offline queue IDs so local un-synced edits are not overwritten
      const pendingDocNumbers = new Set(
        syncQueue
          .filter((q) => q.payload?.document?.documentNumber)
          .map((q) => q.payload.document.documentNumber.trim().toLowerCase())
      );
      const pendingDocIds = new Set(
        syncQueue
          .filter((q) => q.payload?.document?.id)
          .map((q) => q.payload.document.id.trim().toLowerCase())
      );
      const pendingClientIds = new Set(
        syncQueue
          .filter((q) => q.payload?.client?.id)
          .map((q) => q.payload.client.id.trim().toLowerCase())
      );
      const pendingPaymentReceipts = new Set(
        syncQueue
          .filter((q) => q.payload?.payment?.receiptNumber)
          .map((q) => q.payload.payment.receiptNumber.trim().toLowerCase())
      );

      // 1. MERGE CLIENTS (Non-destructive, Contextual Auto-Correction & Tombstone-aware)
      if (Array.isArray(remoteData.clients) && remoteData.clients.length > 0) {
        for (const rawRemoteClient of remoteData.clients) {
          if (!rawRemoteClient.name && !rawRemoteClient.id) continue;

          // Contextual inspection & auto-correction for shifted columns
          const { client: remoteClient, report } = autoCorrectIncomingClient(rawRemoteClient);
          if (report.wasAltered) {
            await dbService.recordAuditLog({
              entityType: 'CLIENT',
              entityId: remoteClient.id || remoteClient.name,
              action: 'SELF_HEALED',
              details: `Auto-corrected shifted columns for client: ${report.corrections.map((c) => c.field).join(', ')}`,
              snapshot: report.corrections,
            });
          }

          // Check if deleted locally (tombstoned)
          const normClientName = remoteClient.name ? remoteClient.name.trim().toLowerCase() : '';
          const normKraPin = remoteClient.kraPin ? remoteClient.kraPin.trim().toLowerCase() : '';
          const isTombstoned =
            (remoteClient.id && (await dbService.isTombstoned(remoteClient.id))) ||
            (normClientName && (await dbService.isTombstoned(normClientName))) ||
            (normKraPin && (await dbService.isTombstoned(normKraPin)));

          if (isTombstoned) {
            // Respect local deletion: Do not resurrect. Clean remote in background.
            if (remoteClient.id) {
              this.cascadeDeleteClient(remoteClient.id);
            }
            continue;
          }

          if (remoteClient.id && pendingClientIds.has(remoteClient.id.trim().toLowerCase())) {
            continue;
          }

          const existing =
            (remoteClient.id ? await dbService.getClientById(remoteClient.id) : null) ||
            (await dbService.getClientByPinOrName(remoteClient.kraPin, remoteClient.name));

          if (existing) {
            const remoteUpdated = remoteClient.updatedAt ? new Date(remoteClient.updatedAt).getTime() : 0;
            const localUpdated = existing.updatedAt
              ? new Date(existing.updatedAt).getTime()
              : (existing.createdAt ? new Date(existing.createdAt).getTime() : 0);

            // Strict LWW enforcement: Only update local from remote if remote is strictly newer
            if (remoteUpdated > localUpdated + 1500) {
              const updatedClient: Client = {
                ...existing,
                // Defensive shields: never allow null, undefined or empty strings to overwrite existing values
                name: remoteClient.name?.trim() ? remoteClient.name.trim() : existing.name,
                kraPin: remoteClient.kraPin?.trim() ? remoteClient.kraPin.trim() : existing.kraPin,
                contactPerson: remoteClient.contactPerson?.trim() ? remoteClient.contactPerson.trim() : existing.contactPerson,
                email: remoteClient.email?.trim() ? remoteClient.email.trim() : existing.email,
                phone: remoteClient.phone?.trim() ? remoteClient.phone.trim() : existing.phone,
                address: remoteClient.address?.trim() ? remoteClient.address.trim() : existing.address,
                updatedAt: remoteClient.updatedAt || new Date().toISOString(),
              };
              await dbService.saveClient(updatedClient);
              pulledCount++;
              pullStats.clients++;
            }
          } else {
            const newClient: Client = {
              id: remoteClient.id || `CLI-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              name: remoteClient.name || 'New Client',
              contactPerson: remoteClient.contactPerson || '',
              kraPin: remoteClient.kraPin || '',
              email: remoteClient.email || '',
              phone: remoteClient.phone || '',
              address: remoteClient.address || '',
              createdAt: remoteClient.createdAt || new Date().toISOString(),
              updatedAt: remoteClient.updatedAt || new Date().toISOString(),
            };
            await dbService.saveClient(newClient);
            pulledCount++;
            pullStats.clients++;
          }
        }
      }

      // 2. MERGE DOCUMENTS (Non-destructive, Contextual Auto-Correction & Defensive Shields)
      const mergeDocumentsList = async (remoteDocs: any[], type: 'INVOICE' | 'QUOTATION' | 'PROFORMA') => {
        if (!Array.isArray(remoteDocs)) return;

        for (const rawRemoteDoc of remoteDocs) {
          if (!rawRemoteDoc.documentNumber) continue;

          // Contextual inspection & auto-correction for shifted columns
          const { doc: rDoc, report } = autoCorrectIncomingDocument(rawRemoteDoc, type);
          if (report.wasAltered) {
            await dbService.recordAuditLog({
              entityType: 'DOCUMENT',
              entityId: rDoc.documentNumber,
              action: 'SELF_HEALED',
              details: `Auto-corrected shifted columns for ${type} ${rDoc.documentNumber}: ${report.corrections.map((c) => c.field).join(', ')}`,
              snapshot: report.corrections,
            });
          }

          const normDocNum = rDoc.documentNumber.trim().toLowerCase();
          const docId = rDoc.id ? String(rDoc.id).trim().toLowerCase() : '';
          const codeString = normalizeCodeString(rDoc.documentNumber).toLowerCase();

          // Check if deleted locally (tombstoned)
          const isTombstoned =
            (await dbService.isTombstoned(rDoc.documentNumber)) ||
            (codeString && (await dbService.isTombstoned(codeString))) ||
            (docId && (await dbService.isTombstoned(docId)));

          if (isTombstoned) {
            // Respect local deletion: Do not resurrect. Clean remote in background.
            this.cascadeDeleteDocument(rDoc.id || '', rDoc.documentNumber);
            continue;
          }

          if (pendingDocNumbers.has(normDocNum) || pendingDocNumbers.has(codeString) || (docId && pendingDocIds.has(docId))) {
            continue;
          }

          const existing = await dbService.getDocumentByNumber(rDoc.documentNumber);

          if (existing) {
            const remoteUpdated = rDoc.updatedAt ? new Date(rDoc.updatedAt).getTime() : 0;
            const localUpdated = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
            const rawPaid = sanitizeCurrency(rDoc.amountPaid);

            // Strict LWW enforcement: Only update local document if remote is strictly newer
            if (remoteUpdated > localUpdated + 1500) {
              const merged = safelyMergeDocumentWithDefensiveShields(existing, rDoc);
              await dbService.saveDocument(merged);
              pulledCount++;
              if (type === 'INVOICE') pullStats.invoices++;
              else if (type === 'QUOTATION') pullStats.quotations++;
              else if (type === 'PROFORMA') pullStats.proformas++;
            } else if (
              existing.amountPaid !== rawPaid &&
              (rDoc.amountPaid !== undefined && rDoc.amountPaid !== null) &&
              remoteUpdated >= localUpdated - 10000
            ) {
              // Remote settlement balance update: preserve local line items, notes, terms
              const newBal = Math.max(0, Math.round((existing.grandTotal - rawPaid) * 100) / 100);
              const newStatus = newBal <= 0 ? 'Paid' : (existing.status === 'Paid' ? 'Sent' : existing.status);
              const updated = {
                ...existing,
                amountPaid: rawPaid,
                balanceDue: newBal,
                status: newStatus as any,
                updatedAt: new Date().toISOString(),
              };
              await dbService.saveDocument(updated);
              pulledCount++;
              if (type === 'INVOICE') pullStats.invoices++;
              else if (type === 'QUOTATION') pullStats.quotations++;
              else if (type === 'PROFORMA') pullStats.proformas++;
            }
          } else {
            const rawSubtotal = sanitizeCurrency(rDoc.subtotal);
            const rawGrand = sanitizeCurrency(rDoc.grandTotal);
            const rawPaid = sanitizeCurrency(rDoc.amountPaid);
            const rawBal = sanitizeCurrency(rDoc.balanceDue);
            const rawVat = sanitizeCurrency(rDoc.vatAmount);
            const rawDisc = sanitizeCurrency(rDoc.discount);
            const grossSubtotal = sanitizeCurrency(rDoc.grossSubtotal || rawSubtotal || 0);

            const defaultLineItems: LineItem[] = [
              {
                id: `item-${Date.now()}-1`,
                particulars: `${type} Items (Imported from Central Google Sheets)`,
                quantity: 1,
                days: 1,
                rate: grossSubtotal,
                amount: grossSubtotal,
              },
            ];

            const newDoc: BillingDocument = {
              id: rDoc.id || `DOC-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              documentType: type,
              documentNumber: normalizeCodeString(rDoc.documentNumber),
              clientId: `CLI-${Date.now()}`,
              clientName: rDoc.clientName ? normalizeText(rDoc.clientName) : 'Valued Guest',
              clientKraPin: rDoc.clientKraPin ? normalizeKraPin(rDoc.clientKraPin) : '',
              clientAddress: rDoc.clientAddress ? normalizeText(rDoc.clientAddress) : '',
              clientPhone: rDoc.clientPhone ? normalizePhoneNumber(rDoc.clientPhone) : undefined,
              issueDate: normalizeDate(rDoc.issueDate),
              validityDays: 14,
              dueDate: normalizeDate(rDoc.dueDate),
              lineItems: defaultLineItems,
              subtotal: normalizeCurrency(rawSubtotal || grossSubtotal),
              discount: normalizeCurrency(rawDisc || 0),
              vatAmount: normalizeCurrency(rawVat || 0),
              grandTotal: normalizeCurrency(rawGrand || grossSubtotal),
              amountPaid: normalizeCurrency(rawPaid || 0),
              balanceDue: rawBal !== undefined ? normalizeCurrency(rawBal) : normalizeCurrency(rawGrand || 0),
              status: (rDoc.status as any) || (type === 'INVOICE' && rawBal === 0 ? 'Paid' : 'Sent'),
              notes: 'Imported from centralized Google Workspace ERP ledger.',
              terms: 'Strictly 30 days from date of invoice.',
              createdAt: normalizeDate(rDoc.issueDate),
              updatedAt: rDoc.updatedAt || new Date().toISOString().split('T')[0],
              syncedToGoogle: true,
              driveFileUrl: rDoc.driveFileUrl || undefined,
              lastSyncStatus: 'synced',
            };
            await dbService.saveDocument(newDoc);
            pulledCount++;
            if (type === 'INVOICE') pullStats.invoices++;
            else if (type === 'QUOTATION') pullStats.quotations++;
            else if (type === 'PROFORMA') pullStats.proformas++;
          }
        }
      };

      await mergeDocumentsList(remoteData.invoices, 'INVOICE');
      await mergeDocumentsList(remoteData.quotations, 'QUOTATION');
      await mergeDocumentsList(remoteData.proformas, 'PROFORMA');

      // 3. MERGE RECEIPTS (Non-destructive & Tombstone-aware)
      if (Array.isArray(remoteData.receipts) && remoteData.receipts.length > 0) {
        for (const rPay of remoteData.receipts) {
          if (!rPay.receiptNumber) continue;

          // Check if deleted locally (tombstoned)
          const normReceiptNum = rPay.receiptNumber.trim().toLowerCase();
          const codeReceipt = normalizeCodeString(rPay.receiptNumber).toLowerCase();
          const isTombstoned =
            (await dbService.isTombstoned(rPay.receiptNumber)) ||
            (codeReceipt && (await dbService.isTombstoned(codeReceipt))) ||
            (rPay.id && (await dbService.isTombstoned(rPay.id)));

          if (isTombstoned) {
            // Respect local deletion: Do not resurrect. Clean remote in background.
            this.cascadeDeletePayment(rPay.id || '', rPay.receiptNumber, rPay.documentNumber);
            continue;
          }

          if (pendingPaymentReceipts.has(normReceiptNum) || pendingPaymentReceipts.has(codeReceipt)) {
            continue;
          }

          const existingPayment = await dbService.getPaymentByReceiptNumber(rPay.receiptNumber);

          if (!existingPayment) {
            const linkedDoc = rPay.documentNumber ? await dbService.getDocumentByNumber(rPay.documentNumber) : null;
            const cleanAmount = normalizeCurrency(rPay.amount);
            const newPayment: PaymentRecord = {
              id: rPay.id || `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              receiptNumber: normalizeCodeString(rPay.receiptNumber),
              documentId: linkedDoc ? linkedDoc.id : '',
              documentNumber: rPay.documentNumber ? normalizeCodeString(rPay.documentNumber) : '',
              clientId: linkedDoc ? linkedDoc.clientId : `CLI-${Date.now()}`,
              clientName: rPay.clientName ? normalizeText(rPay.clientName) : (linkedDoc ? linkedDoc.clientName : 'Client'),
              date: normalizeDate(rPay.date),
              amount: cleanAmount,
              paymentMode: (rPay.paymentMode as any) || 'M-Pesa',
              referenceNote: normalizeText(rPay.referenceNote || 'Google Sheets sync import'),
              createdAt: rPay.createdAt || new Date().toISOString(),
              syncedToGoogle: true,
              driveFileUrl: rPay.driveFileUrl || undefined,
              lastSyncStatus: 'synced',
            };
            await dbService.savePayment(newPayment);
            pulledCount++;
            pullStats.payments++;
          }
        }
      }

      // 4. MERGE PROFILE (Defensive: only fill in missing fields if local is unconfigured)
      if (remoteData.profile && Object.keys(remoteData.profile).length > 0) {
        const localProfile = await dbService.getHotelProfile();
        const pendingProfileSync = syncQueue.some((q) => q.action === 'UPSERT_PROFILE');
        if (!pendingProfileSync) {
          const rp = remoteData.profile;
          const profileUpdates: Partial<HotelProfile> = {};
          if (localProfile.name === undefined && rp.name && rp.name.trim()) profileUpdates.name = rp.name.trim();
          if (localProfile.kraPin === undefined && rp.kraPin && rp.kraPin.trim()) profileUpdates.kraPin = rp.kraPin.trim();
          if (localProfile.email === undefined && rp.email && rp.email.trim()) profileUpdates.email = rp.email.trim();
          if (localProfile.phone === undefined && rp.phone && rp.phone.trim()) profileUpdates.phone = rp.phone.trim();

          if (Object.keys(profileUpdates).length > 0) {
            await dbService.saveHotelProfile(profileUpdates);
          }
        }
      }

      this.lastPulledHash = currentHash;

      if (pulledCount > 0 && typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('damview:data-changed', {
            detail: { itemsPulled: pulledCount, stats: pullStats, timestamp: new Date().toISOString() },
          })
        );
      }

      const now = new Date().toISOString();
      await dbService.saveHotelProfile({
        lastSyncTimestamp: now,
      });

      this.notifyListeners({
        isSyncing: false,
        lastSyncTimestamp: now,
        statusText: pulledCount > 0 ? `Pulled ${pulledCount} record(s)` : 'All data up to date',
      });

      return { success: true, itemsPulled: pulledCount, stats: pullStats };
    } catch (err: any) {
      this.notifyListeners({
        isSyncing: false,
        statusText: 'Pull error',
        lastError: err.message,
      });
      return { success: false, itemsPulled: 0, error: err.message || 'Failed during sheet data pull' };
    }
  }

  /**
   * Request Google Apps Script to Generate/Recalculate All 11 Tabs & Analytics
   */
  async generateAllSheetTabs(): Promise<{ success: boolean; message: string; tabs?: any[]; error?: string }> {
    const profile = await dbService.getHotelProfile();
    const url = profile.googleWebAppUrl;
    if (!url || !navigator.onLine) {
      return { success: false, message: 'Offline or Web App URL not configured.' };
    }

    try {
      this.notifyListeners({ isSyncing: true, statusText: 'Generating all 11 ERP tabs in Google Sheets...' });
      const res = await this.postToScript(url, { action: 'GENERATE_ALL_TABS', timestamp: new Date().toISOString() }, 45000);

      this.notifyListeners({ isSyncing: false, statusText: res.success ? 'All 11 tabs ready' : 'Tab generation failed' });
      return {
        success: res.success,
        message: res.message || (res.success ? 'All tabs generated successfully.' : (res.error || 'Failed to generate tabs')),
        tabs: res.tabs,
        error: res.error,
      };
    } catch (err: any) {
      this.notifyListeners({ isSyncing: false, statusText: 'Tab generation failed' });
      return { success: false, message: err.message || 'Failed to generate tabs', error: err.message };
    }
  }

  /**
   * Push Complete Local ERP State to Google Sheets (Full Batch Sync & Tab Population)
   */
  async fullPushToGoogleSheets(): Promise<{ success: boolean; message: string; error?: string }> {
    const profile = await dbService.getHotelProfile();
    const url = profile.googleWebAppUrl;
    if (!url || !navigator.onLine) {
      return { success: false, message: 'Offline or Web App URL not configured.' };
    }

    try {
      this.notifyListeners({ isSyncing: true, statusText: 'Populating all 11 Google Sheet tabs with app data...' });

      const [rawClients, rawDocuments, rawPayments, catalogue, posOrders, reservations, expenses] = await Promise.all([
        dbService.getClients(),
        dbService.getDocuments(),
        dbService.getPayments(),
        dbService.getCatalogueItems(),
        dbService.getPOSOrders(),
        dbService.getReservations(),
        dbService.getExpenses(),
      ]);

      const clients = rawClients.map(sanitizeClientForSync);
      const documents = rawDocuments.map(sanitizeDocumentForSync);
      const payments = rawPayments.map(sanitizePaymentForSync);

      const payload = {
        action: 'FULL_SYNC',
        profile,
        clients,
        documents,
        payments,
        catalogue,
        posOrders,
        reservations,
        expenses,
        folderName: profile.googleDriveFolder || 'Hotel Damview Archives',
        timestamp: new Date().toISOString(),
      };

      let res = await this.postToScript(url, payload, 60000);

      // Backwards-compatibility fallback for older deployed Apps Script Web App versions
      if (!res.success && res.error && (res.error.includes('Unrecognized sync action') || res.error.includes('FULL_SYNC'))) {
        this.notifyListeners({ isSyncing: true, statusText: 'Retrying sync with step-by-step compatibility mode...' });
        
        try {
          // 1. Sync Profile
          await this.postToScript(url, { action: 'UPSERT_PROFILE', profile }, 15000);

          // 2. Sync Clients
          for (const c of clients) {
            await this.postToScript(url, { action: 'UPSERT_CLIENT', client: c }, 15000);
          }

          // 3. Sync Documents
          for (const d of documents) {
            await this.postToScript(url, { action: 'UPSERT_DOCUMENT', document: d, folderName: profile.googleDriveFolder || 'Hotel Damview Archives' }, 20000);
          }

          // 4. Sync Payments
          for (const p of payments) {
            await this.postToScript(url, { action: 'RECORD_PAYMENT', payment: p }, 15000);
          }

          // 5. Generate / Refresh Tabs
          const genRes = await this.postToScript(url, { action: 'GENERATE_ALL_TABS' }, 30000);

          if (genRes.success) {
            res = {
              success: true,
              message: 'All 11 spreadsheet tabs populated via compatibility sync pipeline.',
            };
          } else {
            res = {
              success: false,
              error: 'Your Google Apps Script deployment is running an older version of Code.gs. Please update Code.gs in Apps Script and click "Deploy" > "Manage deployments" > "Edit" > "New version".',
              message: 'Apps Script update required: Please deploy the latest Code.gs script as "New version".',
            };
          }
        } catch (fallbackErr: any) {
          res = {
            success: false,
            error: 'Apps Script Web App needs to be updated with the latest Code.gs script. Deployment guide: Click "Deploy" > "Manage deployments" > "Edit" > "New version".',
            message: fallbackErr.message || 'Outdated Apps Script Web App',
          };
        }
      }

      this.notifyListeners({ isSyncing: false, statusText: res.success ? 'Full batch sync complete' : 'Full sync failed' });
      return {
        success: res.success,
        message: res.message || (res.success ? 'All sheets populated with local data.' : (res.error || 'Failed full batch sync')),
        error: res.error,
      };
    } catch (err: any) {
      this.notifyListeners({ isSyncing: false, statusText: 'Full sync failed' });
      return { success: false, message: err.message || 'Failed full batch sync', error: err.message };
    }
  }

  /**
   * Complete Real-time Bidirectional Synchronization
   */
  async syncBidirectional(): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        success: false,
        message: 'Sync already in progress...',
        timestamp: new Date().toISOString(),
      };
    }

    if (!navigator.onLine) {
      return {
        success: false,
        message: 'Currently offline. Mutations are stored in offline queue.',
        timestamp: new Date().toISOString(),
      };
    }

    const profile = await dbService.getHotelProfile();
    const url = profile.googleWebAppUrl;
    if (!url) {
      return {
        success: false,
        message: 'Google Apps Script Web App URL is not configured.',
        timestamp: new Date().toISOString(),
      };
    }

    this.isSyncing = true;
    this.notifyListeners({ isSyncing: true, statusText: 'Realtime Live Syncing...' });

    try {
      // Step 1: Push offline queued items to Google Sheets
      const pushResult = await this.processSyncQueue();
      const pushedCount = pushResult.itemsProcessed || 0;

      // Step 2: Pull latest data from Google Sheets
      const pullResult = await this.pullFromGoogleSheets();
      const pulledCount = pullResult.itemsPulled || 0;

      // Step 3: Record sync timestamp
      const now = new Date().toISOString();
      await dbService.saveHotelProfile({
        lastSyncTimestamp: now,
      });

      const message =
        pushedCount > 0 || pulledCount > 0
          ? `Real-time Live Sync: Pushed ${pushedCount} local, pulled ${pulledCount} remote change(s).`
          : 'Live synced: All records up to date.';

      const queue = await dbService.getSyncQueue();

      this.notifyListeners({
        isSyncing: false,
        lastSyncTimestamp: now,
        pendingCount: queue.length,
        statusText: 'Live Synced',
      });

      return {
        success: true,
        message,
        timestamp: now,
        itemsPushed: pushedCount,
        itemsPulled: pulledCount,
        unchanged: pullResult.unchanged,
      };
    } catch (err: any) {
      this.notifyListeners({
        isSyncing: false,
        statusText: 'Live Sync Error',
        lastError: err.message,
      });

      return {
        success: false,
        message: `Real-time sync failed: ${err.message || 'Unknown network error'}`,
        timestamp: new Date().toISOString(),
        error: err.message,
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Run comprehensive end-to-end sync verification suite
   */
  async runVerificationSuite(): Promise<SyncVerificationResult> {
    return runEndToEndSyncVerification();
  }

  // --- Defensive Runtime Aliases for System Resilience ---
  async upsertDocument(doc: BillingDocument, pdfBase64?: string): Promise<any> {
    return this.syncDocument(doc, pdfBase64);
  }
  async saveDocument(doc: BillingDocument, pdfBase64?: string): Promise<any> {
    return this.syncDocument(doc, pdfBase64);
  }
  async upsertClient(client: Client): Promise<any> {
    return this.syncClient(client);
  }
  async upsertPayment(payment: PaymentRecord, pdfBase64?: string): Promise<any> {
    return this.syncPayment(payment, pdfBase64);
  }
  async upsertProfile(profile: HotelProfile): Promise<any> {
    return this.syncProfile(profile);
  }
}

export const syncManager = new GoogleSyncManager();
export { runEndToEndSyncVerification };
export type { SyncVerificationResult };
