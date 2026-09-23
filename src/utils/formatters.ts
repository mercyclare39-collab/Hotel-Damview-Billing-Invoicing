import { LineItem } from '../types';

/**
 * Format currency strictly as Kenyan Shilling: Ksh #,##0.00
 */
export function formatKsh(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return 'Ksh 0.00';
  }
  const parts = Math.abs(amount).toFixed(2).split('.');
  const intPartWithCommas = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const formatted = `Ksh ${intPartWithCommas}.${parts[1]}`;
  return amount < 0 ? `-${formatted}` : formatted;
}

/**
 * Split currency into Symbol/Integer and Decimal for precise right-aligned decimal styling
 */
export function formatKshSplit(amount: number | undefined | null): { prefix: string; integer: string; decimal: string } {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return { prefix: 'Ksh', integer: '0', decimal: '.00' };
  }
  const isNegative = amount < 0;
  const parts = Math.abs(amount).toFixed(2).split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return {
    prefix: isNegative ? '-Ksh' : 'Ksh',
    integer: intPart,
    decimal: `.${parts[1]}`,
  };
}

/**
 * Strictly format date to YYYY-MM-DD
 */
export function formatDate(dateInput?: string | Date | null): string {
  if (!dateInput) {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) {
      return new Date().toISOString().split('T')[0];
    }
    return d.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Calculate due date given issue date and validity in days
 */
export function calculateDueDate(issueDateStr: string, validityDays: number): string {
  try {
    const d = new Date(issueDateStr);
    if (isNaN(d.getTime())) return issueDateStr;
    d.setDate(d.getDate() + (Number(validityDays) || 14));
    return d.toISOString().split('T')[0];
  } catch {
    return issueDateStr;
  }
}

export {
  DEFAULT_KENYAN_VAT_RATE,
  roundToTwoDecimals,
  calculateLineItemAmount,
  calculateTaxableSubtotal,
  calculateVatAmount,
  calculateVatBreakdown,
  calculateTotals,
  calculateBalanceDue,
} from './financial';
export type { VatBreakdown, DocumentTotals } from './financial';

/**
 * Standard PDF file naming convention: [DocumentNumber]_[ClientName]_[IssueDate(YYYY-MM-DD)].pdf
 */
export function getPdfFileName(documentNumber: string, clientName: string, issueDate: string): string {
  const sanitizedDocNo = (documentNumber || 'DOC').replace(/[^a-zA-Z0-9-_]/g, '');
  const sanitizedClient = (clientName || 'Client').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  const sanitizedDate = formatDate(issueDate);
  return `${sanitizedDocNo}_${sanitizedClient}_${sanitizedDate}.pdf`;
}

/**
 * Intelligent Title Case Normalization for Line Item Particulars:
 * - Automatically converts entries to Title Case (capitalizing the first letter of each word).
 * - If the entire entry is fully uppercase (e.g., "VIP LOUNGE", "BBQ BUFFET", "KRA COMPLIANCE"),
 *   preserves the all-uppercase formatting without lowercasing.
 * - If individual tokens are acronyms or codes (e.g., "VIP", "KRA", "BBQ", "A4", "PA", "TV", "USD", "B&B"),
 *   preserves their uppercase representation.
 */
export function normalizeLineItemParticulars(text: string): string {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (trimmed.length === 0) return text;

  // Preserve leading and trailing spaces if any
  const leadingSpaces = text.match(/^\s*/)?.[0] || '';
  const trailingSpaces = text.match(/\s*$/)?.[0] || '';

  // If the entire trimmed text is already all uppercase (e.g., "VIP LOUNGE", "BBQ BUFFET", "KRA AUDIT"), preserve it completely
  if (trimmed === trimmed.toUpperCase() && trimmed.length > 1 && /[A-Z]/.test(trimmed)) {
    return leadingSpaces + trimmed + trailingSpaces;
  }

  // Split into tokens while keeping whitespace delimiters intact
  const tokens = trimmed.split(/(\s+)/);

  const processedTokens = tokens.map((token) => {
    // Skip pure whitespace tokens
    if (/^\s+$/.test(token)) return token;

    // Check if token is an acronym or alphanumeric code (e.g., VIP, KRA, BBQ, A4, B&B, TV, AC, USD, DJ, LPO, PA)
    const isAcronymOrSymbol =
      (token === token.toUpperCase() && token.length >= 2 && /[A-Z]/.test(token)) ||
      /^[A-Z0-9&/-]+$/.test(token);

    if (isAcronymOrSymbol) {
      return token;
    }

    // Capitalize first character of the word (Title Case)
    return token.charAt(0).toUpperCase() + token.slice(1);
  });

  return leadingSpaces + processedTokens.join('') + trailingSpaces;
}

/**
 * Live sanitization for Kenyan phone input as the operator types:
 * - Allows leading '+' and numeric digits
 * - Strips alphabetical letters and invalid symbols
 * - Compresses redundant whitespace
 */
export function sanitizeKenyanPhoneLive(input: string | undefined | null): string {
  if (!input) return '';
  const str = String(input);
  const hasLeadingPlus = str.trimStart().startsWith('+');
  const sanitized = str.replace(/[^\d\s]/g, '').replace(/\s+/g, ' ');
  return hasLeadingPlus ? `+${sanitized.trimStart()}` : sanitized;
}

/**
 * Autonomous Kenyan Phone Normalization & Sanitization (Strict):
 * Standardizes Kenyan mobile and telephone numbers into official formats:
 * - Mobile international format: '+254 7XX XXXXXX' or '+254 1XX XXXXXX'
 * - Local mobile format: '07XX XXXXXX' or '01XX XXXXXX'
 * - Landline format: '+254 20 XXXXXXX' / '020 XXXXXXX'
 * Automatically removes non-numeric noise, misplaced characters, and trailing spaces.
 */
export function normalizeKenyanPhone(
  phone: string | undefined | null,
  formatPreference: 'international' | 'local' = 'international'
): string {
  if (!phone) return '';
  const raw = String(phone).trim();
  if (raw.length === 0) return '';

  // Extract pure digits
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  // Format 1: starts with 254 and has 12 digits total (e.g. 254712345678, 254112345678)
  if (digits.startsWith('254') && digits.length === 12) {
    const operatorCode = digits.slice(3, 5); // 71, 72, 11, etc.
    const mid = digits.slice(5, 8);          // 345
    const end = digits.slice(8);             // 678
    if (formatPreference === 'local') {
      return `0${operatorCode} ${mid} ${end}`;
    }
    return `+254 ${operatorCode} ${mid} ${end}`;
  }

  // Format 2: local 10-digit number starting with 07 or 01 (e.g. 0712345678 or 0112345678)
  if ((digits.startsWith('07') || digits.startsWith('01')) && digits.length === 10) {
    const operatorCode = digits.slice(1, 3);
    const mid = digits.slice(3, 6);
    const end = digits.slice(6);
    if (formatPreference === 'local') {
      return `${digits.slice(0, 4)} ${mid} ${end}`;
    }
    return `+254 ${operatorCode} ${mid} ${end}`;
  }

  // Format 3: 9 digits without leading 0 (e.g. 712345678, 112345678)
  if ((digits.startsWith('7') || digits.startsWith('1')) && digits.length === 9) {
    const operatorCode = digits.slice(0, 2);
    const mid = digits.slice(2, 5);
    const end = digits.slice(5);
    if (formatPreference === 'local') {
      return `0${operatorCode} ${mid} ${end}`;
    }
    return `+254 ${operatorCode} ${mid} ${end}`;
  }

  // Format 4: Kenyan landline / hotline starting with 020 (Nairobi) or 044 (Machakos)
  if (digits.startsWith('0') && digits.length >= 8 && digits.length <= 10) {
    const areaCode = digits.slice(0, 3);
    const rest = digits.slice(3);
    if (formatPreference === 'local') {
      return `${areaCode} ${rest}`;
    }
    return `+254 ${digits.slice(1, 3)} ${rest}`;
  }

  // Fallback: sanitized digits with optional plus
  const cleanFallback = raw.replace(/[^\d+ ]/g, '').replace(/\s+/g, ' ').trim();
  return cleanFallback;
}

/**
 * Validates Kenyan telephone number structure
 */
export function validateKenyanPhone(phone: string | undefined | null): {
  isValid: boolean;
  normalized: string;
  message: string;
} {
  if (!phone) {
    return { isValid: false, normalized: '', message: 'Phone number cannot be empty' };
  }
  const digits = String(phone).replace(/\D/g, '');
  const is12With254 = digits.startsWith('254') && digits.length === 12;
  const is10Local = (digits.startsWith('07') || digits.startsWith('01') || digits.startsWith('02') || digits.startsWith('04')) && digits.length === 10;
  const is9Without0 = (digits.startsWith('7') || digits.startsWith('1')) && digits.length === 9;

  const isValid = is12With254 || is10Local || is9Without0;
  const normalized = normalizeKenyanPhone(phone);

  return {
    isValid,
    normalized,
    message: isValid
      ? 'Valid Kenyan telephone format'
      : 'Use standard Kenyan telephone (+254 7XX XXXXXX, 07XXXXXXXX, or 01XXXXXXXX)',
  };
}

/**
 * Standardize and validate Kenya Revenue Authority (KRA) PIN:
 * Standard structure: 1 letter (A for individual, P for corporate/non-individual) + 9 digits + 1 check letter
 * Example: P051234567Z or A001234567X
 */
export function validateKraPin(pin: string | undefined | null): {
  normalized: string;
  isValid: boolean;
  isPartial: boolean;
  message: string;
} {
  if (!pin) {
    return { normalized: '', isValid: false, isPartial: false, message: 'KRA PIN is required for tax invoices' };
  }

  // Remove spaces and punctuation, convert to uppercase
  const clean = String(pin).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

  if (clean.length === 0) {
    return { normalized: '', isValid: false, isPartial: false, message: 'KRA PIN cannot be empty' };
  }

  const isCompleteLength = clean.length === 11;
  const isIndividual = clean.startsWith('A');
  const isCorporate = clean.startsWith('P');
  const validStart = isIndividual || isCorporate;
  const middleNineDigits = /^\d{9}$/.test(clean.substring(1, 10));
  const endLetter = /^[A-Z]$/.test(clean.substring(10, 11));

  const isValid = isCompleteLength && validStart && middleNineDigits && endLetter;

  let message = 'Valid KRA PIN';
  if (!validStart) {
    message = 'KRA PIN must start with "P" (Company) or "A" (Individual)';
  } else if (!isCompleteLength) {
    message = `Incomplete KRA PIN (${clean.length}/11 chars)`;
  } else if (!middleNineDigits) {
    message = 'Middle 9 characters must be digits (0-9)';
  } else if (!endLetter) {
    message = 'Final character must be an alphabetic check letter';
  }

  return {
    normalized: clean,
    isValid,
    isPartial: clean.length > 0 && clean.length < 11,
    message,
  };
}

/**
 * Clean currency string to decimal number
 */
export function parseCurrencyInput(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : Math.round(value * 100) / 100;
  const clean = String(value).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
}

