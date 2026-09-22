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

/**
 * Line item calculation: Amount = Quantity * Days * Rate
 */
export function calculateLineItemAmount(item: Partial<LineItem>): number {
  const qty = Number(item.quantity) || 0;
  const days = Number(item.days) || 1;
  const rate = Number(item.rate) || 0;
  const raw = qty * days * rate;
  return Math.max(0, Math.round(raw * 100) / 100);
}

/**
 * Financial calculation engine for full document with discount row
 */
export function calculateTotals(items: LineItem[], discount: number = 0, vatRatePercent: number = 16) {
  const grossSubtotal = items.reduce((sum, item) => {
    return sum + (Number(item.amount) || 0);
  }, 0);

  const roundedGrossSubtotal = Math.round(grossSubtotal * 100) / 100;
  const discountAmount = Math.min(roundedGrossSubtotal, Math.max(0, Number(discount) || 0));
  const taxableSubtotal = Math.max(0, roundedGrossSubtotal - discountAmount);
  const vatAmount = Math.round(taxableSubtotal * (vatRatePercent / 100) * 100) / 100;
  const grandTotal = Math.round((taxableSubtotal + vatAmount) * 100) / 100;

  return {
    grossSubtotal: roundedGrossSubtotal,
    discount: discountAmount,
    subtotal: taxableSubtotal,
    vatAmount,
    grandTotal,
  };
}

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
 * Clean and standardize Kenyan phone inputs into consistent formats:
 * Supports 07XX..., 01XX..., +254 7XX..., 254 7XX...
 */
export function normalizeKenyanPhone(phone: string | undefined | null): string {
  if (!phone) return '';
  const raw = String(phone).trim();
  // Strip non-digit characters except leading +
  const hasPlus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');

  if (!digits) return raw;

  // Format 1: starts with 254 and has 12 digits total (e.g., 254712345678 or 254112345678)
  if (digits.startsWith('254') && digits.length === 12) {
    const pfx = digits.slice(3, 5);
    const mid = digits.slice(5, 8);
    const end = digits.slice(8);
    return `+254 ${pfx} ${mid} ${end}`;
  }

  // Format 2: local 10-digit number starting with 07 or 01 (e.g., 0712345678 or 0112345678)
  if ((digits.startsWith('07') || digits.startsWith('01')) && digits.length === 10) {
    const pfx = digits.slice(0, 4);
    const mid = digits.slice(4, 7);
    const end = digits.slice(7);
    return `${pfx} ${mid} ${end}`;
  }

  // Format 3: 9 digits without leading 0 (e.g., 712345678)
  if ((digits.startsWith('7') || digits.startsWith('1')) && digits.length === 9) {
    const pfx = '0' + digits.slice(0, 3);
    const mid = digits.slice(3, 6);
    const end = digits.slice(6);
    return `${pfx} ${mid} ${end}`;
  }

  return raw;
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

