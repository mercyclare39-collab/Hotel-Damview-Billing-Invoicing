import React, { forwardRef } from 'react';
import { Client, HotelProfile, LedgerEntry } from '../types';
import { formatKsh, formatDate } from '../utils/formatters';
import { HotelLogo } from './HotelLogo';

interface A4StatementPreviewProps {
  client: Client;
  profile: HotelProfile;
  startDate: string;
  endDate: string;
  statementNumber: string;
  entries: LedgerEntry[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  issueDate?: string;
  scale?: number;
  className?: string;
  isPrintVersion?: boolean;
}

export const A4StatementPreview = forwardRef<HTMLDivElement, A4StatementPreviewProps>(
  (
    {
      client,
      profile,
      startDate,
      endDate,
      statementNumber,
      entries,
      totalDebit,
      totalCredit,
      closingBalance,
      issueDate,
      scale = 1,
      className = '',
      isPrintVersion = false,
    },
    ref
  ) => {
    // Adaptive column width allocation
    const maxDebitChars = Math.max(
      5, // "Debit"
      ...(entries.length > 0 ? entries.map((e) => formatKsh(e.debit || 0).replace('Ksh ', '').length) : [6])
    );
    const dynamicDebitWidth = `${Math.max(82, maxDebitChars * 8 + 16)}px`;

    const maxCreditChars = Math.max(
      6, // "Credit"
      ...(entries.length > 0 ? entries.map((e) => formatKsh(e.credit || 0).replace('Ksh ', '').length) : [6])
    );
    const dynamicCreditWidth = `${Math.max(82, maxCreditChars * 8 + 16)}px`;

    const maxBalChars = Math.max(
      7, // "Balance"
      ...(entries.length > 0 ? entries.map((e) => formatKsh(e.cumulativeBalance || 0).replace('Ksh ', '').length) : [7])
    );
    const dynamicBalanceWidth = `${Math.max(88, maxBalChars * 8 + 18)}px`;

    const contactParts = [profile.phone?.trim(), profile.email?.trim()].filter(Boolean);
    const phoneEmail = contactParts.join(' | ');

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
          id="a4-statement-preview"
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
          {/* TOP SECTION */}
          <div className="flex-1 flex flex-col">
            {/* 1. DOCUMENT HEADER & BRANDING */}
            {/* Logo dynamically sized to match height of the centered hotel details block */}
            <div className="relative flex items-center justify-center pb-3 mb-3 border-b-2 border-stone-800">
              {/* Hotel Logo: Positioned top-left; auto-sized to match total height of adjacent centered identity block */}
              <div className="absolute left-0 top-0 bottom-3 flex items-center justify-start">
                <HotelLogo
                  logoBase64={profile.logoBase64}
                  style={{ maxHeight: '100%', height: '100%', width: 'auto', objectFit: 'contain' }}
                />
              </div>

              {/* Centered Identity Block */}
              <div className="text-center px-24">
                {/* Hotel Name: Bold, 28pt uppercase, center-aligned */}
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

                {/* Sub-details: Physical Location, Postal Address, Phone | Email, and KRA PIN */}
                <div className="text-[11pt] text-stone-800 leading-snug space-y-0.5">
                  {profile.physicalLocation?.trim() && <div>{profile.physicalLocation.trim()}</div>}
                  {profile.postalAddress?.trim() && <div>{profile.postalAddress.trim()}</div>}
                  {phoneEmail && <div>{phoneEmail}</div>}
                  {profile.kraPin?.trim() && <div className="font-semibold tracking-wider">KRA PIN: {profile.kraPin.trim()}</div>}
                </div>
              </div>
            </div>

            {/* 2. DOCUMENT TITLE */}
            <div className="text-center mb-3 py-1.5 bg-stone-100 border-y border-stone-400">
              <h2 className="text-[13pt] font-bold tracking-widest text-stone-900 uppercase m-0">
                STATEMENT OF ACCOUNT
              </h2>
            </div>

            {/* 3. PARALLEL TWO-COLUMN DETAILS TABLES (Separated by Gutter, Borderless Key-Value Pairs) */}
            <div className="details-grid-container grid grid-cols-2 gap-4 mb-4 text-[11pt] w-full items-stretch">
              {/* Left Table: Statement To */}
              <div className="border border-stone-400 rounded overflow-hidden bg-white flex flex-col">
                <table className="w-full text-[11pt]" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr className="bg-stone-100 border-b border-stone-400 text-stone-900">
                      <th colSpan={2} className="text-left uppercase font-bold text-[11pt] tracking-wider py-1.5 px-3">
                        STATEMENT TO
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    <tr>
                      <td className="py-1.5 px-3 text-left font-semibold text-stone-700 whitespace-nowrap align-middle">
                        Client Name:
                      </td>
                      <td className="py-1.5 px-3 text-right font-bold text-stone-900 break-words align-middle">
                        {client?.name || 'Selected Client'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-3 text-left font-semibold text-stone-700 whitespace-nowrap align-middle">
                        KRA PIN:
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-stone-800 tracking-wider align-middle">
                        {client?.kraPin || 'N/A'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-3 text-left font-semibold text-stone-700 whitespace-nowrap align-middle">
                        Physical Address:
                      </td>
                      <td className="py-1.5 px-3 text-right text-stone-800 break-words align-middle">
                        {client?.address || 'N/A'}
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
                        Statement No:
                      </td>
                      <td className="py-1.5 px-3 text-right font-bold font-mono text-stone-950 align-middle">
                        {statementNumber}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-3 text-left font-semibold text-stone-700 whitespace-nowrap align-middle">
                        Issue Date:
                      </td>
                      <td className="py-1.5 px-3 text-right text-stone-800 align-middle">
                        {issueDate ? formatDate(issueDate) : formatDate()}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-3 text-left font-semibold text-stone-700 whitespace-nowrap align-middle">
                        Period Covered:
                      </td>
                      <td className="py-1.5 px-3 text-right font-medium text-stone-800 align-middle">
                        {formatDate(startDate)} to {formatDate(endDate)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. LEDGER TABLE: Dynamic Table Layout Engine */}
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
                      className="text-center col-center whitespace-nowrap"
                      style={{ width: '85px', minWidth: '85px' }}
                    >
                      Date
                    </th>
                    <th
                      className="text-center col-center whitespace-nowrap"
                      style={{ width: '80px', minWidth: '80px' }}
                    >
                      Ref No.
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
                      style={{ width: dynamicDebitWidth, minWidth: dynamicDebitWidth }}
                    >
                      Debit
                    </th>
                    <th
                      className="text-center col-center whitespace-nowrap"
                      style={{ width: dynamicCreditWidth, minWidth: dynamicCreditWidth }}
                    >
                      Credit
                    </th>
                    <th
                      className="text-center col-center whitespace-nowrap"
                      style={{ width: dynamicBalanceWidth, minWidth: dynamicBalanceWidth }}
                    >
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.length > 0 ? (
                    entries.map((entry, idx) => (
                      <tr
                        key={idx}
                        className={idx % 2 === 1 ? 'bg-[#f8fafc]/60' : 'bg-white'}
                        style={{ height: '26px' }}
                      >
                        <td
                          className="text-center text-stone-600 whitespace-nowrap font-normal"
                          style={{ width: '36px' }}
                        >
                          {entry.rowNumber}
                        </td>
                        <td
                          className="text-center text-stone-800 whitespace-nowrap font-normal"
                          style={{ width: '85px' }}
                        >
                          {entry.date}
                        </td>
                        <td
                          className="text-center font-semibold text-stone-900 whitespace-nowrap"
                          style={{ width: '80px' }}
                        >
                          {entry.reference}
                        </td>
                        <td className="text-left text-stone-800 font-normal leading-snug">
                          {entry.description}
                        </td>
                        <td
                          className="text-right tabular-decimal text-stone-900 whitespace-nowrap font-normal"
                          style={{ width: dynamicDebitWidth, minWidth: dynamicDebitWidth }}
                        >
                          {entry.debit > 0 ? formatKsh(entry.debit).replace('Ksh ', '') : '-'}
                        </td>
                        <td
                          className="text-right tabular-decimal text-emerald-800 font-medium whitespace-nowrap"
                          style={{ width: dynamicCreditWidth, minWidth: dynamicCreditWidth }}
                        >
                          {entry.credit > 0 ? formatKsh(entry.credit).replace('Ksh ', '') : '-'}
                        </td>
                        <td
                          className="text-right tabular-decimal font-semibold text-stone-950 whitespace-nowrap"
                          style={{ width: dynamicBalanceWidth, minWidth: dynamicBalanceWidth }}
                        >
                          {formatKsh(entry.cumulativeBalance).replace('Ksh ', '')}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-stone-400 italic">
                        No transactions found for the selected client and date range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 5. HEADERLESS FINANCIAL SUMMARY BLOCK */}
            <div className="flex justify-end mb-4 w-full">
              <div className="w-[50%] min-w-[320px] max-w-[380px]">
                <table className="financial-summary-table border border-stone-300 rounded text-[11pt]" style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <tbody>
                    <tr className="financial-summary-row-intermediate">
                      <td className="px-3 py-1 label-cell text-stone-600 font-normal">Total Invoiced (Debit):</td>
                      <td className="px-3 py-1 value-cell tabular-nums font-normal text-stone-800">
                        {formatKsh(totalDebit)}
                      </td>
                    </tr>
                    <tr className="financial-summary-row-intermediate">
                      <td className="px-3 py-1 label-cell text-stone-600 font-normal">Total Settled (Credit):</td>
                      <td className="px-3 py-1 value-cell tabular-nums font-normal text-stone-800">
                        {formatKsh(totalCredit)}
                      </td>
                    </tr>
                    <tr className="financial-summary-row-balance">
                      <td className="px-3 py-1.5 label-cell text-stone-950 font-bold">Closing Balance Due:</td>
                      <td className="px-3 py-1.5 value-cell tabular-nums font-bold text-rose-950">
                        {formatKsh(closingBalance)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 6. FIXED PAGE BOTTOM FOOTER: STATEMENT TERMS & CONDITIONS */}
          <div className="mt-auto pt-2 w-full text-[11pt]">
            <div className="border border-stone-300 bg-stone-50/60 mb-2.5 p-2.5 text-[11pt] w-full">
              <div className="text-stone-800 leading-snug">
                <div className="font-bold uppercase text-[10.5pt] tracking-wider text-stone-900 border-b border-[#cbd5e1] pb-1 mb-1.5">
                  Terms & Conditions
                </div>
                <ol className="list-decimal list-inside space-y-0.5 text-[10pt] text-stone-700">
                  <li>Please examine this statement immediately and notify the accounts department of any discrepancies within 7 days.</li>
                  <li>Outstanding balances remaining unpaid past the credit period are subject to overdue credit terms.</li>
                  <li>All remittance payments should reference the assigned Client ID or respective invoice numbers.</li>
                </ol>
              </div>
            </div>

            {/* 7. FIXED PAGE FOOTER */}
            <div className="pt-2 border-t border-stone-800 flex items-center justify-between text-[11pt] text-stone-600">
              <div>Official computer generated document</div>
              <div className="font-bold text-stone-800">Thank you for choosing {profile.name || 'HOTEL DAMVIEW'}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

A4StatementPreview.displayName = 'A4StatementPreview';
