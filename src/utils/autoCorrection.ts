import { roundToTwoDecimals } from './financial';

/**
 * Autonomous Context-Aware Data Auto-Correction & Repair Engine
 * Designed for Hotel Damview Management Suite (Kenya)
 * 
 * Intercepts dirty, malformed, or ambiguous operator inputs and coerces
 * them in real-time into strict compliant schemas.
 */

export interface PhoneCorrectionResult {
  raw: string;
  cleaned: string;
  international: string;
  local: string;
  isValid: boolean;
  carrier?: 'Safaricom' | 'Airtel' | 'Telkom' | 'Equitel' | 'Landline' | 'Other';
}

/**
 * 1. KENYAN PHONE NUMBERS AUTO-CORRECTION
 * Cleans, sanitizes, and coerces domestic inputs into canonical Kenyan telephone formats:
 * - International: +254 7XX XXXXXX or +254 1XX XXXXXX
 * - Local: 07XX XXXXXX or 01XX XXXXXX
 */
export function autoCorrectKenyanPhone(
  input: string | undefined | null,
  preference: 'international' | 'local' = 'international'
): PhoneCorrectionResult {
  const raw = String(input || '').trim();
  if (!raw) {
    return {
      raw: '',
      cleaned: '',
      international: '',
      local: '',
      isValid: false,
    };
  }

  // Extract all digit characters
  let digits = raw.replace(/\D/g, '');

  // Coerce variations:
  // - Starts with 00254 -> 254
  if (digits.startsWith('00254')) {
    digits = digits.slice(2);
  }
  // - Starts with 254 and has 12 digits: e.g. 254712345678 or 254112345678
  // - Starts with 0 and has 10 digits: e.g. 0712345678 or 0112345678
  // - Starts with 7 or 1 and has 9 digits: e.g. 712345678 -> 254712345678
  let nineDigitCore = '';
  if (digits.startsWith('254') && digits.length === 12) {
    nineDigitCore = digits.slice(3);
  } else if (digits.startsWith('0') && digits.length === 10) {
    nineDigitCore = digits.slice(1);
  } else if ((digits.startsWith('7') || digits.startsWith('1')) && digits.length === 9) {
    nineDigitCore = digits;
  } else if (digits.length > 9) {
    // Attempt to salvage trailing 9 digits if valid prefix
    const tail9 = digits.slice(-9);
    if (tail9.startsWith('7') || tail9.startsWith('1')) {
      nineDigitCore = tail9;
    }
  }

  let international = '';
  let local = '';
  let isValid = false;
  let carrier: PhoneCorrectionResult['carrier'] = 'Other';

  if (nineDigitCore.length === 9) {
    isValid = true;
    const prefix2 = nineDigitCore.slice(0, 2);
    const prefix3 = nineDigitCore.slice(0, 3);
    const mid3 = nineDigitCore.slice(2, 5);
    const tail4 = nineDigitCore.slice(5);

    // Identify carrier
    if (['70', '71', '72', '74', '79', '11'].some((p) => nineDigitCore.startsWith(p))) {
      carrier = 'Safaricom';
    } else if (['73', '75', '78', '10'].some((p) => nineDigitCore.startsWith(p))) {
      carrier = 'Airtel';
    } else if (['77'].some((p) => nineDigitCore.startsWith(p))) {
      carrier = 'Telkom';
    } else if (['76'].some((p) => nineDigitCore.startsWith(p))) {
      carrier = 'Equitel';
    }

    international = `+254 ${nineDigitCore.slice(0, 3)} ${nineDigitCore.slice(3, 6)} ${nineDigitCore.slice(6)}`;
    local = `0${nineDigitCore.slice(0, 3)} ${nineDigitCore.slice(3, 6)} ${nineDigitCore.slice(6)}`;
  } else {
    // Check if it's a fixed landline (e.g. 020 for Nairobi, 044 for Machakos)
    if (digits.startsWith('0') && digits.length >= 8 && digits.length <= 10) {
      isValid = true;
      carrier = 'Landline';
      const area = digits.slice(0, 3);
      const rest = digits.slice(3);
      international = `+254 ${digits.slice(1, 3)} ${rest}`;
      local = `${area} ${rest}`;
    } else {
      // Clean fallback: preserve as much valid digits as possible
      international = raw;
      local = raw;
    }
  }

  const cleaned = preference === 'international' ? (international || raw) : (local || raw);

  return {
    raw,
    cleaned,
    international,
    local,
    isValid,
    carrier,
  };
}

/**
 * 2. KRA PIN AUTO-CORRECTION
 * Standard statutory format: ^[A-Z][0-9]{9}[A-Z]$
 * Auto-strips illegal characters, removes whitespaces/dashes, coerces case to uppercase.
 */
export function autoCorrectKraPin(input: string | undefined | null): {
  raw: string;
  cleaned: string;
  isValid: boolean;
  type?: 'Corporate/Entity' | 'Individual';
  error?: string;
} {
  const raw = String(input || '').trim();
  if (!raw) {
    return { raw: '', cleaned: '', isValid: false, error: 'KRA PIN is required for statutory invoicing' };
  }

  // Strip all non-alphanumeric characters, convert to uppercase
  const cleaned = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

  const kraRegex = /^[A-Z][0-9]{9}[A-Z]$/;
  const isValid = kraRegex.test(cleaned);

  let type: 'Corporate/Entity' | 'Individual' | undefined;
  if (cleaned.startsWith('P')) {
    type = 'Corporate/Entity';
  } else if (cleaned.startsWith('A')) {
    type = 'Individual';
  }

  let error: string | undefined;
  if (!isValid) {
    if (cleaned.length < 11) {
      error = `Incomplete KRA PIN (${cleaned.length}/11 chars). Must be 1 letter, 9 digits, 1 letter.`;
    } else if (cleaned.length > 11) {
      error = `KRA PIN exceeds 11 characters (${cleaned.length} chars).`;
    } else {
      error = 'Invalid structure. Statutory format: [A/P] followed by 9 digits and ending with a letter.';
    }
  }

  return {
    raw,
    cleaned,
    isValid,
    type,
    error,
  };
}

/**
 * 3. CURRENCY & NUMERIC AMOUNTS AUTO-CORRECTION
 * Force-strips stray alpha characters, commas, currency prefixes (Ksh, KES, USD, etc.),
 * and normalizes decimal separators, resolving entries to clean two-decimal floating numbers.
 */
export function autoCorrectNumericAmount(input: string | number | undefined | null, defaultValue: number = 0): number {
  if (input === undefined || input === null) return defaultValue;
  if (typeof input === 'number') {
    return isNaN(input) ? defaultValue : roundToTwoDecimals(input);
  }

  const str = String(input).trim();
  if (!str) return defaultValue;

  // Remove currency words, spaces, symbols
  // e.g. "Ksh 15,400.50", "KES 15000", "$ 1,200", "12 000.00"
  let cleanStr = str
    .replace(/(?:Ksh|KES|USD|EUR|GBP|shillings?|\$|\€|\£)/gi, '')
    .replace(/\s+/g, '')
    .trim();

  // If negative
  const isNegative = cleanStr.startsWith('-');
  cleanStr = cleanStr.replace(/-/g, '');

  // Handle European comma-as-decimal if applicable (e.g. 1500,50 vs 1,500.50)
  if (cleanStr.includes(',') && !cleanStr.includes('.')) {
    const parts = cleanStr.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      cleanStr = `${parts[0]}.${parts[1]}`;
    } else {
      cleanStr = cleanStr.replace(/,/g, '');
    }
  } else {
    // Normal comma thousands separator
    cleanStr = cleanStr.replace(/,/g, '');
  }

  // Strip anything that is not digit or dot
  cleanStr = cleanStr.replace(/[^\d.]/g, '');

  // Keep only the first decimal point if multiple appear
  const dotIndex = cleanStr.indexOf('.');
  if (dotIndex !== -1) {
    cleanStr = cleanStr.slice(0, dotIndex + 1) + cleanStr.slice(dotIndex + 1).replace(/\./g, '');
  }

  const parsed = parseFloat(cleanStr);
  if (isNaN(parsed)) return defaultValue;

  const result = isNegative ? -parsed : parsed;
  return roundToTwoDecimals(result);
}

/**
 * Format clean numeric amount to standard display string: #,##0.00
 */
export function formatNormalizedAmount(amount: number): string {
  const rounded = roundToTwoDecimals(amount);
  return rounded.toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * 4. DATES AUTO-CORRECTION
 * Coerces ambiguous, domestic, or malformed inputs into strict ISO YYYY-MM-DD.
 * Handles:
 * - DD/MM/YYYY, DD-MM-YYYY (Kenyan/British convention)
 * - YYYY/MM/DD, YYYY.MM.DD
 * - Natural text (e.g., "24 Sep 2026", "September 24, 2026")
 * - Excel/numeric serial timestamps
 */
export function autoCorrectIsoDate(input: string | Date | number | undefined | null): string {
  if (!input) {
    return new Date().toISOString().split('T')[0];
  }

  if (input instanceof Date) {
    if (isNaN(input.getTime())) return new Date().toISOString().split('T')[0];
    return input.toISOString().split('T')[0];
  }

  if (typeof input === 'number') {
    const d = new Date(input);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }

  const str = String(input).trim();
  if (!str) return new Date().toISOString().split('T')[0];

  // If already valid ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    if (y >= 1970 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return str;
    }
  }

  // Handle Kenyan common DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const padM = String(month).padStart(2, '0');
      const padD = String(day).padStart(2, '0');
      return `${year}-${padM}-${padD}`;
    }
  }

  // Handle YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[\/\.](\d{1,2})[\/\.](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const padM = String(month).padStart(2, '0');
      const padD = String(day).padStart(2, '0');
      return `${year}-${padM}-${padD}`;
    }
  }

  // Fallback to Native Date parser
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  // Default to today
  return new Date().toISOString().split('T')[0];
}
