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
    const phoneEmail = `${profile.phone || '+25472524262'} | ${profile.email || 'hoteldamview@gmail.com'}`;

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
                <div className="text-[11pt] text-stone-800 leading-snug space-y-0.5">
                  <div>{profile.physicalLocation || 'MARIAKANI'}</div>
                  <div>{profile.postalAddress || 'P.O. BOX 42491-80100, Mombasa, Kenya'}</div>
                  <div>{phoneEmail}</div>
                  <div className="font-semibold tracking-wider">KRA PIN: {profile.kraPin || 'P051453023Q'}</div>
                </div>
              </div>
            </div>

            {/* 2. DOCUMENT TITLE BAR */}
            <div className="text-center mb-3 py-1.5 bg-stone-100 border-y border-stone-400">
              <h2 className="text-[13pt] font-bold tracking-widest text-stone-900 uppercase m-0">
                OFFICIAL PAYMENT RECEIPT
              </h2>
            </div>

            {/* 3. PARALLEL TWO-COLUMN METADATA GRID (Unified Structural Table Architecture) */}
            <table className="document-table sync-meta-table mb-4 text-[11pt] w-full" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr className="bg-stone-100 border-b border-stone-800 text-stone-900">
                  <th colSpan={2} className="w-1/2 text-left uppercase font-bold text-[11pt] tracking-wider py-1.5 px-2.5 border-r border-stone-800">
                    RECEIVED FROM
                  </th>
                  <th colSpan={2} className="w-1/2 text-left uppercase font-bold text-[11pt] tracking-wider py-1.5 px-2.5">
                    RECEIPT PARTICULARS
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {/* Row 1: Client Name vs Receipt Number */}
                <tr className="sync-row">
                  <td className="w-[18%] font-semibold text-stone-700 py-1.5 px-2.5 border-r border-[#e2e8f0] align-top bg-stone-50/40 shrink-0">
                    Client Name:
                  </td>
                  <td className="w-[32%] font-bold text-stone-900 py-1.5 px-2.5 border-r-2 border-stone-800 align-top break-words">
                    {payment.clientName || 'Walk-In Guest'}
                  </td>
                  <td className="w-[18%] font-semibold text-stone-700 py-1.5 px-2.5 border-r border-[#e2e8f0] align-top bg-stone-50/40 shrink-0">
                    Receipt No:
                  </td>
                  <td className="w-[32%] font-bold text-stone-950 py-1.5 px-2.5 align-top font-mono">
                    {payment.receiptNumber || 'REC-DRAFT'}
                  </td>
                </tr>
                {/* Row 2: Client ID vs Date */}
                <tr className="sync-row">
                  <td className="font-semibold text-stone-700 py-1.5 px-2.5 border-r border-[#e2e8f0] align-top bg-stone-50/40">
                    Client ID / Ref:
                  </td>
                  <td className="text-stone-800 py-1.5 px-2.5 border-r-2 border-stone-800 align-top tracking-wider font-mono">
                    {payment.clientId || 'N/A'}
                  </td>
                  <td className="font-semibold text-stone-700 py-1.5 px-2.5 border-r border-[#e2e8f0] align-top bg-stone-50/40">
                    Date:
                  </td>
                  <td className="text-stone-800 py-1.5 px-2.5 align-top">
                    {formatDate(payment.date)}
                  </td>
                </tr>
                {/* Row 3: Invoice Settled vs Payment Method */}
                <tr className="sync-row">
                  <td className="font-semibold text-stone-700 py-1.5 px-2.5 border-r border-[#e2e8f0] align-top bg-stone-50/40">
                    Invoice Settled:
                  </td>
                  <td className="font-bold text-stone-900 py-1.5 px-2.5 border-r-2 border-stone-800 align-top font-mono break-words">
                    {payment.documentNumber || 'Direct Payment'}
                  </td>
                  <td className="font-semibold text-stone-700 py-1.5 px-2.5 border-r border-[#e2e8f0] align-top bg-stone-50/40">
                    Payment Method:
                  </td>
                  <td className="font-semibold text-stone-900 py-1.5 px-2.5 align-top">
                    {payment.paymentMode}
                  </td>
                </tr>
              </tbody>
            </table>

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

            {/* 5. FINANCIAL SUMMARY BLOCK */}
            <div className="flex justify-end mb-4">
              <div className="w-80">
                <table className="document-table text-[11pt]" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                  <tbody>
                    <tr className="bg-[#f1f5f9] text-[12.5pt]">
                      <td className="px-2.5 py-1.5 text-stone-950 font-bold uppercase tracking-tight">Total Amount Received:</td>
                      <td className="px-2.5 py-1.5 text-right text-stone-950 font-black tabular-decimal">
                        {formatKsh(payment.amount)}
                      </td>
                    </tr>
                    <tr className="bg-stone-50/50 text-[11pt]">
                      <td className="px-2.5 py-1 text-stone-600 font-normal">Settlement Channel:</td>
                      <td className="px-2.5 py-1 text-right text-stone-800 font-medium">
                        {payment.paymentMode}
                      </td>
                    </tr>
                    <tr className="bg-emerald-50/80 text-[11pt]">
                      <td className="px-2.5 py-1 text-emerald-800 font-medium uppercase tracking-wider">Payment Status:</td>
                      <td className="px-2.5 py-1 text-right">
                        <span className="font-bold text-emerald-900 bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 rounded text-[11pt]">
                          CONFIRMED & CLEARED
                        </span>
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
              <div className="font-bold text-stone-800">Thank you for choosing HOTEL DAMVIEW</div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

A4ReceiptPreview.displayName = 'A4ReceiptPreview';
