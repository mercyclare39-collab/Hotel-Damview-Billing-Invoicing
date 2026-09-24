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
    const contactParts = [profile.phone?.trim(), profile.email?.trim()].filter(Boolean);
    const phoneEmail = contactParts.join(' | ');

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
              {/* Hotel Logo Top Left */}
              <div className="absolute left-0 top-0 bottom-3 flex items-center justify-start">
                <HotelLogo
                  logoBase64={profile.logoBase64}
                  style={{ maxHeight: '100%', height: '100%', width: 'auto', objectFit: 'contain' }}
                />
              </div>

              {/* Centered Identity Block */}
              <div className="text-center px-24">
                <h1
                  style={{ fontSize: '28pt', lineHeight: 1.1 }}
                  className="font-bold uppercase tracking-tight text-stone-950 m-0 pb-1"
                >
                  {profile.name || 'HOTEL DAMVIEW'}
                </h1>
                {profile.tagline?.trim() && (
                  <div className="text-[10pt] font-medium text-stone-700 italic tracking-wide pb-0.5">
                    {profile.tagline.trim()}
                  </div>
                )}
                <div className="text-[11pt] text-stone-800 leading-snug space-y-0.5">
                  {profile.physicalLocation?.trim() && <div>{profile.physicalLocation.trim()}</div>}
                  {profile.postalAddress?.trim() && <div>{profile.postalAddress.trim()}</div>}
                  {phoneEmail && <div>{phoneEmail}</div>}
                  {profile.kraPin?.trim() && <div className="font-semibold tracking-wider">KRA PIN: {profile.kraPin.trim()}</div>}
                </div>
              </div>
            </div>

            {/* 2. DOCUMENT TITLE BAR */}
            <div className="text-center mb-3 py-1.5 bg-stone-100 border-y border-stone-400">
              <h2 className="text-[13pt] font-bold tracking-widest text-stone-900 uppercase m-0">
                OFFICIAL PAYMENT RECEIPT
              </h2>
            </div>

            {/* 3. PARALLEL TWO-COLUMN DETAILS TABLES (Separated by Gutter, Borderless Key-Value Pairs) */}
            <div className="details-grid-container grid grid-cols-2 gap-4 mb-4 text-[11pt] w-full items-stretch">
              {/* Left Table: Received From */}
              <div className="border border-stone-400 rounded overflow-hidden bg-white flex flex-col">
                <table className="w-full text-[11pt]" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr className="bg-stone-100 border-b border-stone-400 text-stone-900">
                      <th colSpan={2} className="text-left uppercase font-bold text-[11pt] tracking-wider py-1.5 px-3">
                        RECEIVED FROM
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    <tr>
                      <td className="py-1.5 px-3 text-left font-semibold text-stone-700 whitespace-nowrap align-middle">
                        Client Name:
                      </td>
                      <td className="py-1.5 px-3 text-right font-bold text-stone-900 break-words align-middle">
                        {payment.clientName || 'Walk-In Guest'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-3 text-left font-semibold text-stone-700 whitespace-nowrap align-middle">
                        Client ID / Ref:
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-stone-800 tracking-wider align-middle">
                        {payment.clientId || 'N/A'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-3 text-left font-semibold text-stone-700 whitespace-nowrap align-middle">
                        Invoice Settled:
                      </td>
                      <td className="py-1.5 px-3 text-right font-bold text-stone-900 font-mono break-words align-middle">
                        {payment.documentNumber || 'Direct Payment'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Right Table: Document Details */}
              <div className="border border-stone-400 rounded overflow-hidden bg-white flex flex-col">
                <table className="w-full text-[11pt]" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr className="bg-stone-100 border-b border-stone-400 text-stone-900">
                      <th colSpan={2} className="text-left uppercase font-bold text-[11pt] tracking-wider py-1.5 px-3">
                        DOCUMENT DETAILS
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    <tr>
                      <td className="py-1.5 px-3 text-left font-semibold text-stone-700 whitespace-nowrap align-middle">
                        Receipt No:
                      </td>
                      <td className="py-1.5 px-3 text-right font-bold font-mono text-stone-950 align-middle">
                        {payment.receiptNumber || 'REC-DRAFT'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-3 text-left font-semibold text-stone-700 whitespace-nowrap align-middle">
                        Date:
                      </td>
                      <td className="py-1.5 px-3 text-right text-stone-800 align-middle">
                        {formatDate(payment.date)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-3 text-left font-semibold text-stone-700 whitespace-nowrap align-middle">
                        Payment Method:
                      </td>
                      <td className="py-1.5 px-3 text-right font-semibold text-stone-900 align-middle">
                        {payment.paymentMode}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. DYNAMIC SETTLEMENT TABLE: Hairline high-contrast borders */}
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
              <div className="w-[50%] min-w-[320px] max-w-[380px]">
                <table className="financial-summary-table border border-stone-300 rounded text-[11pt]" style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <tbody>
                    <tr className="financial-summary-row-intermediate">
                      <td className="px-3 py-1 label-cell text-stone-600 font-normal">Settlement Channel:</td>
                      <td className="px-3 py-1 value-cell text-stone-800 font-normal">
                        {payment.paymentMode}
                      </td>
                    </tr>
                    <tr className="financial-summary-row-intermediate">
                      <td className="px-3 py-1 label-cell text-stone-600 font-normal">Payment Status:</td>
                      <td className="px-3 py-1 value-cell text-emerald-800 font-normal">
                        CONFIRMED & CLEARED
                      </td>
                    </tr>
                    <tr className="financial-summary-row-balance">
                      <td className="px-3 py-1.5 label-cell text-stone-950 font-bold">Total Amount Received:</td>
                      <td className="px-3 py-1.5 value-cell tabular-nums font-bold text-stone-950">
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
                  <span className="font-bold text-stone-900 uppercase text-[10.5pt] mr-1 shrink-0">Transaction Reference:</span>
                  <span className="text-stone-900">{payment.referenceNote}</span>
                </div>
              </div>
            )}

            {/* Terms & Conditions Block at fixed position */}
            <div className="document-card bg-slate-50/50 p-2.5 text-[11pt] mb-2.5">
              <div className="text-stone-800 leading-snug">
                <div className="font-bold uppercase text-[10.5pt] tracking-wider text-stone-900 border-b border-[#cbd5e1] pb-1 mb-1.5">
                  Terms & Conditions
                </div>
                <ol className="list-decimal list-inside space-y-0.5 text-[10pt] text-stone-700">
                  <li>All payments received are subject to bank/channel clearance and are non-refundable unless authorized by management.</li>
                  <li>This official receipt serves as valid proof of payment for the specified invoice and folio account.</li>
                  <li>Please retain this official receipt for financial auditing, tax records, and client account reconciliation.</li>
                </ol>
              </div>
            </div>

            {/* 7. TERMINAL LEGAL FOOTER */}
            <div className="pt-2 border-t border-stone-800 flex items-center justify-between text-[11pt] text-stone-600">
              <div>Official computer generated payment receipt</div>
              <div className="font-bold text-stone-800">Thank you for choosing {profile.name || 'HOTEL DAMVIEW'}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

A4ReceiptPreview.displayName = 'A4ReceiptPreview';
