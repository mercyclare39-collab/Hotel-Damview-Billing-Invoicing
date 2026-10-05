import React, { forwardRef } from 'react';
import { PaymentRecord, HotelProfile } from '../types';
import { formatKsh, formatDate } from '../utils/formatters';
import { HotelLogo } from './HotelLogo';

interface A4ReceiptPreviewProps {
  payment: PaymentRecord;
  profile: HotelProfile;
  scale?: number;
  className?: string;
  isPrintVersion?: boolean;
}

export const A4ReceiptPreview = forwardRef<HTMLDivElement, A4ReceiptPreviewProps>(
  ({ payment, profile, scale = 1, className = '', isPrintVersion = false }, ref) => {
    // Formatted phone & email line with explicit Phone and Email labels
    const displayName = profile.name?.trim() || profile.hotelName?.trim() || 'HOTEL DAMVIEW';
    const physicalLocation = profile.physicalLocation?.trim() || (profile as any).location?.trim() || '';
    const postalAddress = profile.postalAddress?.trim() || (profile as any).address?.trim() || '';
    const phonePart = profile.phone?.trim() ? `Phone: ${profile.phone.trim()}` : '';
    const emailPart = profile.email?.trim() ? `Email: ${profile.email.trim()}` : '';
    const phoneEmail = [phonePart, emailPart].filter(Boolean).join(' | ');
    const rawPin = profile.kraPin?.trim() || (profile as any).pin?.trim() || '';
    const cleanKraPin = rawPin
      ? rawPin.toUpperCase().startsWith('KRA PIN')
        ? rawPin
        : rawPin.toUpperCase().startsWith('PIN')
        ? `KRA ${rawPin}`
        : `KRA PIN: ${rawPin}`
      : '';

    // Adaptive column width allocation
    const paymentModeLen = (payment.paymentMode || 'Bank Transfer').length;
    const paymentMethodWidth = `${Math.max(120, paymentModeLen * 8 + 20)}px`;
    const amountLen = formatKsh(payment.amount || 0).replace('Ksh ', '').length;
    const amountColWidth = `${Math.max(95, amountLen * 8 + 20)}px`;

    return (
      <div
        className={`a4-document-wrapper flex justify-center ${className}`}
        style={{
          transformOrigin: 'top center',
          transform: !isPrintVersion && scale !== 1 ? `scale(${scale})` : undefined,
          marginBottom: !isPrintVersion && scale !== 1 ? `${(scale - 1) * 1123}px` : undefined,
        }}
      >
        <div
          ref={ref}
          id={`a4-receipt-${payment.receiptNumber || 'preview'}`}
          className="a4-page-container relative flex flex-col justify-between border border-stone-300 shadow-md print:shadow-none print:border-none"
          style={{
            width: '210mm',
            minHeight: '297mm',
            padding: '12.7mm', // Exact 0.5 inch (36pt) margins
            boxSizing: 'border-box',
            backgroundColor: '#ffffff',
            color: '#111827',
            fontFamily: "'Times New Roman', Times, 'Nimbus Roman No9 L', serif",
            fontSize: '11pt',
            lineHeight: 1.35,
          }}
        >
          {/* MAIN RECEIPT BODY */}
          <div className="flex-1 flex flex-col">
            {/* 1. HEADER & BRANDING IDENTITY */}
            <div className="relative flex items-center justify-center pb-3 mb-3 border-b-2 border-stone-800">
              {/* Hotel Logo Top Left: Auto-sized proportionally to match total height of adjacent company details block */}
              <div className="absolute left-0 top-0 bottom-3 flex items-center justify-start max-w-[140px]">
                <HotelLogo
                  logoBase64={profile.logoBase64}
                  hotelName={displayName}
                  height="100%"
                  style={{ maxHeight: '100%', height: '100%', width: 'auto', objectFit: 'contain' }}
                />
              </div>

              {/* Centered Identity Block: Exact 5-Row Sequence */}
              <div className="text-center px-28 w-full">
                {/* Row 1: Company Name */}
                <h1
                  style={{ fontSize: '26pt', lineHeight: 1.15 }}
                  className="font-bold uppercase tracking-tight text-stone-950 m-0 pb-1"
                >
                  {displayName}
                </h1>

                {/* Rows 2 to 5: Physical Location, Address, Phone and Email, Kra Pin */}
                <div className="text-[11pt] text-stone-800 leading-snug space-y-0.5">
                  {physicalLocation && <div>{physicalLocation}</div>}
                  {postalAddress && <div>{postalAddress}</div>}
                  {phoneEmail && <div>{phoneEmail}</div>}
                  {cleanKraPin && <div className="font-semibold tracking-wider">{cleanKraPin}</div>}
                </div>
              </div>
            </div>

            {/* 2. DOCUMENT TITLE BAR */}
            <div className="text-center mb-3 py-1.5 bg-stone-100 border-y border-stone-400">
              <h2 className="text-[13pt] font-bold tracking-widest text-stone-900 uppercase m-0">
                OFFICIAL PAYMENT RECEIPT
              </h2>
            </div>

            {/* 3. PARALLEL TWO-COLUMN DETAILS ARCHITECTURE */}
            <div className="mb-3.5 w-full">
              <div className="grid grid-cols-2 gap-3 text-[11pt]">
                {/* Left Column: RECEIVED FROM */}
                <div className="border border-stone-300 rounded bg-white overflow-hidden">
                  <div className="px-2.5 py-1 uppercase font-bold text-[11pt] tracking-wider text-stone-900 bg-stone-100/80 border-b border-stone-300">
                    RECEIVED FROM
                  </div>
                  <div className="p-2 space-y-1">
                    <div className="flex justify-between items-center gap-2 leading-tight">
                      <span className="font-semibold text-stone-600 whitespace-nowrap text-[11pt] shrink-0">Client Name:</span>
                      <span className="font-bold text-stone-950 text-right break-words text-[11pt] pl-2 max-w-[70%]">{payment.clientName || 'Walk-In Guest'}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2 leading-tight border-t border-stone-200/80 pt-1">
                      <span className="font-semibold text-stone-600 whitespace-nowrap text-[11pt] shrink-0">Client ID / Ref:</span>
                      <span className="font-mono text-stone-800 text-right text-[11pt] tracking-wider pl-2 max-w-[70%]">{payment.clientId || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2 leading-tight border-t border-stone-200/80 pt-1">
                      <span className="font-semibold text-stone-600 whitespace-nowrap text-[11pt] shrink-0">Invoice Settled:</span>
                      <span className="font-bold text-stone-900 font-mono text-right break-words text-[11pt] pl-2 max-w-[70%]">{payment.documentNumber || 'Direct Payment'}</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: DOCUMENT DETAILS */}
                <div className="border border-stone-300 rounded bg-white overflow-hidden">
                  <div className="px-2.5 py-1 uppercase font-bold text-[11pt] tracking-wider text-stone-900 bg-stone-100/80 border-b border-stone-300">
                    DOCUMENT DETAILS
                  </div>
                  <div className="p-2 space-y-1">
                    <div className="flex justify-between items-center gap-2 leading-tight">
                      <span className="font-semibold text-stone-600 whitespace-nowrap text-[11pt] shrink-0">Receipt No:</span>
                      <span className="font-bold font-mono text-stone-950 text-right text-[11pt] pl-2 max-w-[70%]">{payment.receiptNumber || 'REC-DRAFT'}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2 leading-tight border-t border-stone-200/80 pt-1">
                      <span className="font-semibold text-stone-600 whitespace-nowrap text-[11pt] shrink-0">Date:</span>
                      <span className="text-stone-800 text-right text-[11pt] pl-2 max-w-[70%]">{formatDate(payment.date)}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2 leading-tight border-t border-stone-200/80 pt-1">
                      <span className="font-semibold text-stone-600 whitespace-nowrap text-[11pt] shrink-0">Payment Method:</span>
                      <span className="font-semibold text-stone-900 text-right text-[11pt] pl-2 max-w-[70%]">{payment.paymentMode}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. DYNAMIC SETTLEMENT TABLE: Blended seamless visible borders */}
            <div className="mb-4 w-full">
              <table className="document-table text-[11pt]" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr>
                    <th
                      className="text-center col-center whitespace-nowrap"
                      style={{ width: '36px', minWidth: '36px' }}
                    >
                      #
                    </th>
                    <th
                      className="text-left col-particulars"
                      data-col="particulars"
                      style={{ width: 'auto' }}
                    >
                      Particulars
                    </th>
                    <th
                      className="text-center col-center whitespace-nowrap"
                      style={{ width: paymentMethodWidth, minWidth: paymentMethodWidth }}
                    >
                      Payment Method
                    </th>
                    <th
                      className="text-center col-center whitespace-nowrap"
                      style={{ width: amountColWidth, minWidth: amountColWidth }}
                    >
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-white" style={{ height: '28px' }}>
                    <td
                      className="text-center text-stone-600 whitespace-nowrap font-normal"
                      style={{ width: '36px' }}
                    >
                      1
                    </td>
                    <td className="text-left text-stone-900 font-normal leading-snug">
                      Payment Settlement
                      {payment.documentNumber ? ` against ${payment.documentNumber}` : ''}
                      {payment.referenceNote ? ` — ${payment.referenceNote}` : ''}
                    </td>
                    <td
                      className="text-center text-stone-800 font-medium whitespace-nowrap"
                      style={{ width: paymentMethodWidth, minWidth: paymentMethodWidth }}
                    >
                      {payment.paymentMode}
                    </td>
                    <td
                      className="text-right font-bold text-stone-950 tabular-decimal whitespace-nowrap text-[11pt]"
                      style={{ width: amountColWidth, minWidth: amountColWidth }}
                    >
                      {formatKsh(payment.amount).replace('Ksh ', '')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 5. HEADERLESS FINANCIAL SUMMARY BLOCK */}
            <div className="flex justify-end mb-4 w-full">
              <div className="w-[50%] min-w-[280px] max-w-[340px] ml-auto">
                <table
                  className="financial-summary-table border border-stone-300 rounded text-[11pt]"
                  style={{
                    borderCollapse: 'collapse',
                    width: '100%',
                    tableLayout: 'fixed',
                    boxSizing: 'border-box',
                  }}
                >
                  <tbody>
                    <tr className="financial-summary-row-intermediate">
                      <td className="px-3 py-1 label-cell text-stone-600 font-normal text-left" style={{ width: '58%' }}>
                        Settlement Channel:
                      </td>
                      <td className="px-3 py-1 value-cell text-stone-800 font-normal text-right truncate" style={{ width: '42%' }}>
                        {payment.paymentMode}
                      </td>
                    </tr>
                    <tr className="financial-summary-row-intermediate">
                      <td className="px-3 py-1 label-cell text-stone-600 font-normal text-left" style={{ width: '58%' }}>
                        Payment Status:
                      </td>
                      <td className="px-3 py-1 value-cell text-emerald-800 font-semibold text-right" style={{ width: '42%' }}>
                        CONFIRMED & CLEARED
                      </td>
                    </tr>
                    <tr className="financial-summary-row-balance">
                      <td className="px-3 py-1.5 label-cell text-stone-950 font-bold text-left" style={{ width: '58%' }}>
                        Total Amount Received:
                      </td>
                      <td className="px-3 py-1.5 value-cell tabular-nums font-bold text-stone-950 text-right" style={{ width: '42%' }}>
                        {formatKsh(payment.amount)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 6. FIXED PAGE BOTTOM FOOTER: TRANSACTION REFERENCE OR RECEIPT TERMS & CONDITIONS */}
          <div className="mt-auto pt-2 w-full text-[11pt]">
            {/* Notes / Reference Note Block */}
            {payment.referenceNote && payment.referenceNote.trim().length > 0 && (
              <div className="document-card bg-white mb-2 p-2.5 text-[11pt]">
                <div className="text-stone-800 leading-snug flex items-start gap-1">
                  <span className="font-bold text-stone-900 uppercase text-[11pt] mr-1 shrink-0">Transaction Reference:</span>
                  <span className="text-stone-900">{payment.referenceNote}</span>
                </div>
              </div>
            )}

            {/* Terms & Conditions Block at fixed position */}
            <div className="document-card bg-slate-50/50 p-2.5 text-[11pt] mb-2.5">
              <div className="text-stone-800 leading-snug">
                <div className="font-bold uppercase text-[11pt] tracking-wider text-stone-900 border-b border-[#cbd5e1] pb-1 mb-1.5">
                  Terms & Conditions
                </div>
                <ol className="list-decimal list-inside space-y-0.5 text-[11pt] text-stone-700">
                  <li>All payments received are subject to bank/channel clearance and are non-refundable unless authorized by management.</li>
                  <li>This official receipt serves as valid proof of payment for the specified invoice and folio account.</li>
                  <li>Please retain this official receipt for financial auditing, tax records, and client account reconciliation.</li>
                </ol>
              </div>
            </div>

            {/* 7. TERMINAL LEGAL FOOTER */}
            <div className="pt-2 border-t border-stone-800 flex items-center justify-between text-[11pt] text-stone-600">
              <div>Official computer generated payment receipt</div>
              <div className="font-bold text-stone-800">Thank you for choosing {displayName.toUpperCase()}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

A4ReceiptPreview.displayName = 'A4ReceiptPreview';
