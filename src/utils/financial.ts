import { LineItem } from '../types';

/**
 * KENYAN STATUTORY TAX & FINANCIAL CALCULATION ENGINE
 * Complies with Kenya Revenue Authority (KRA) VAT Act 2013 and eTIMS specifications.
 *
 * Hospitality standard:
 * - All published rates and line item totals are VAT-inclusive (Gross Total).
 * - Standard VAT Rate for Kenya is 16%.
 *
 * Statutory Formulas:
 *   Taxable Subtotal (Excl. VAT) = Total / 1.16
 *   VAT (16% Statutory)          = Total - Taxable Subtotal
 *   Grand Total                  = Total
 *
 * Precision Rules:
 * - All calculations are strictly rounded to 2 decimal places (cents / KES 0.01).
 * - Enforces zero-penny discrepancy: Taxable Subtotal + VAT === Grand Total.
 */

export const DEFAULT_KENYAN_VAT_RATE = 16;

/**
 * Robust financial rounding to exactly 2 decimal places using Number.EPSILON
 * to avoid floating point representation anomalies (e.g., 0.1 + 0.2).
 */
export function roundToTwoDecimals(value: number): number {
  if (typeof value !== 'number' || isNaN(value)) {
    return 0;
  }
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Computes a single line item amount:
 * Amount = (Quantity * Days * Rate) - Line Discount
 * Result is strictly bounded >= 0 and rounded to 2 decimal places.
 */
export function calculateLineItemAmount(item: Partial<LineItem>): number {
  const qty = typeof item.quantity === 'number' && !isNaN(item.quantity) && item.quantity >= 0
    ? item.quantity
    : Number(item.quantity) || 0;

  const days = typeof item.days === 'number' && !isNaN(item.days) && item.days > 0
    ? item.days
    : (Number(item.days) > 0 ? Number(item.days) : 1);

  const rate = typeof item.rate === 'number' && !isNaN(item.rate) && item.rate >= 0
    ? item.rate
    : Number(item.rate) || 0;

  const lineDiscount = typeof item.discount === 'number' && !isNaN(item.discount) && item.discount >= 0
    ? item.discount
    : Number(item.discount) || 0;

  const rawGross = qty * days * rate;
  const netAmount = Math.max(0, rawGross - lineDiscount);

  return roundToTwoDecimals(netAmount);
}

/**
 * Calculates the statutory Taxable Subtotal (Excl. VAT) from a VAT-inclusive total.
 * Formula: Taxable Subtotal = Total / (1 + vatRate / 100)
 * For standard Kenya 16% VAT: Taxable Subtotal = Total / 1.16
 */
export function calculateTaxableSubtotal(
  totalGross: number,
  vatRatePercent: number = DEFAULT_KENYAN_VAT_RATE
): number {
  const gross = Math.max(0, roundToTwoDecimals(Number(totalGross) || 0));
  const rate = typeof vatRatePercent === 'number' && !isNaN(vatRatePercent) && vatRatePercent >= 0
    ? vatRatePercent
    : DEFAULT_KENYAN_VAT_RATE;

  const divisor = 1 + (rate / 100);
  if (divisor <= 0) return gross;

  return roundToTwoDecimals(gross / divisor);
}

/**
 * Calculates the statutory VAT Amount from a VAT-inclusive total.
 * Formula: VAT = Total - Taxable Subtotal
 *
 * This subtraction method guarantees zero penny discrepancy:
 * Taxable Subtotal + VAT === Total exactly to 2 decimal places.
 */
export function calculateVatAmount(
  totalGross: number,
  vatRatePercent: number = DEFAULT_KENYAN_VAT_RATE
): number {
  const gross = Math.max(0, roundToTwoDecimals(Number(totalGross) || 0));
  const taxable = calculateTaxableSubtotal(gross, vatRatePercent);
  return roundToTwoDecimals(Math.max(0, gross - taxable));
}

/**
 * Comprehensive VAT Breakdown representation
 */
export interface VatBreakdown {
  grossTotal: number;
  taxableSubtotal: number;
  vatAmount: number;
  vatRatePercent: number;
}

/**
 * Computes statutory VAT-inclusive breakdown for any gross monetary amount.
 */
export function calculateVatBreakdown(
  totalGross: number,
  vatRatePercent: number = DEFAULT_KENYAN_VAT_RATE
): VatBreakdown {
  const gross = Math.max(0, roundToTwoDecimals(Number(totalGross) || 0));
  const rate = typeof vatRatePercent === 'number' && !isNaN(vatRatePercent) && vatRatePercent >= 0
    ? vatRatePercent
    : DEFAULT_KENYAN_VAT_RATE;

  const taxableSubtotal = calculateTaxableSubtotal(gross, rate);
  const vatAmount = roundToTwoDecimals(Math.max(0, gross - taxableSubtotal));

  return {
    grossTotal: gross,
    taxableSubtotal,
    vatAmount,
    vatRatePercent: rate,
  };
}

/**
 * Document Financial Totals calculation result
 */
export interface DocumentTotals {
  grossSubtotal: number;    // Sum of line item amounts (VAT-inclusive)
  discount: number;         // Overall document discount applied
  discountedTotal: number;  // Gross subtotal minus discount (VAT-inclusive)
  taxableSubtotal: number;  // Taxable Subtotal (Excl. VAT) = discountedTotal / 1.16
  subtotal: number;         // Alias for taxableSubtotal (for BillingDocument compatibility)
  vatAmount: number;        // VAT (16% included) = discountedTotal - taxableSubtotal
  grandTotal: number;       // Grand Total (VAT-inclusive) = discountedTotal
  vatRate: number;          // Applied VAT rate percentage (defaults to 16)
}

/**
 * Primary financial engine for document calculation:
 * Takes line items, an optional overall discount, and the VAT rate (default 16%).
 * Enforces strict 2-decimal precision and statutory VAT-inclusive reconciliation:
 *   Taxable Subtotal + VAT === Grand Total
 */
export function calculateTotals(
  items: LineItem[],
  discount: number = 0,
  vatRatePercent: number = DEFAULT_KENYAN_VAT_RATE
): DocumentTotals {
  // 1. Calculate Gross Subtotal (Sum of all line items)
  const rawSum = (items || []).reduce((sum, item) => {
    const amt = typeof item.amount === 'number' && !isNaN(item.amount)
      ? item.amount
      : (Number(item.amount) || 0);
    return sum + amt;
  }, 0);
  const grossSubtotal = roundToTwoDecimals(rawSum);

  // 2. Validate and apply overall document discount
  const rawDiscount = Math.max(0, Number(discount) || 0);
  const discountAmount = Math.min(grossSubtotal, roundToTwoDecimals(rawDiscount));
  const discountedTotal = roundToTwoDecimals(Math.max(0, grossSubtotal - discountAmount));

  // 3. Resolve VAT rate
  const rate = typeof vatRatePercent === 'number' && !isNaN(vatRatePercent) && vatRatePercent >= 0
    ? vatRatePercent
    : DEFAULT_KENYAN_VAT_RATE;

  // 4. Statutory formulas (Taxable Subtotal = Total / 1.16, VAT = Total - Taxable Subtotal)
  const taxableSubtotal = calculateTaxableSubtotal(discountedTotal, rate);
  const vatAmount = roundToTwoDecimals(Math.max(0, discountedTotal - taxableSubtotal));
  const grandTotal = discountedTotal;

  return {
    grossSubtotal,
    discount: discountAmount,
    discountedTotal,
    taxableSubtotal,
    subtotal: taxableSubtotal, // Kept for backwards compatibility with BillingDocument.subtotal
    vatAmount,
    grandTotal,
    vatRate: rate,
  };
}

/**
 * Calculates remaining balance due on a document after payment allocations
 */
export function calculateBalanceDue(grandTotal: number, amountPaid: number = 0): number {
  const total = roundToTwoDecimals(Math.max(0, Number(grandTotal) || 0));
  const paid = roundToTwoDecimals(Math.max(0, Number(amountPaid) || 0));
  return roundToTwoDecimals(Math.max(0, total - paid));
}
