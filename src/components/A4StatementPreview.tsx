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
    // Auto-fit calculations for similar monetary columns: Debit, Credit & Balance (equally distributed to identical width)
    const maxStatementCurrencyChars = Math.max(
      7, // "Balance"
      ...(entries.length > 0
        ? entries.map((e) =>
            Math.max(
              formatKsh(e.debit || 0).replace('Ksh ', '').length,
              formatKsh(e.credit || 0).replace('Ksh ', '').length,
              formatKsh(e.cumulativeBalance || 0).replace('Ksh ', '').length
            )
          )
        : [8])
    );
    const similarCurrencyWidth = `${Math.max(88, maxStatementCurrencyChars * 8.5 + 16)}px`;

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

                {/* Sub-details: Physical Location, Postal Address, Phone | Email, and KRA PIN */}
                <div className="text-[11pt] text-stone-800 leading-snug space-y-0.5">
                  <div>{profile.physicalLocation || 'Off Machakos-Wote Road, Adjacent to Maruba Dam, Machakos'}</div>
                  <div>{profile.postalAddress || 'P.O. Box 1420 - 90100, Machakos, Kenya'}</div>
                  <div>
                    {(profile.phone || '+254 722 890 123')} | {(profile.email || 'reservations@damviewhotel.co.ke')}
                  </div>
                  <div className="font-semibold tracking-wider">KRA PIN: {profile.kraPin || 'P051982741Z'}</div>
                </div>
              </div>
            </div>

            {/* 2. DOCUMENT TITLE */}
            <div className="text-center mb-3 py-1.5 bg-stone-100 border-y border-stone-400">
              <h2 className="text-[13pt] font-bold tracking-widest text-stone-900 uppercase m-0">
                STATEMENT OF ACCOUNT
              </h2>
            </div>

            {/* 3. PARALLEL TWO-COLUMN METADATA GRID (Side-by-Side Tables) */}
            <div className="grid grid-cols-2 gap-3 mb-4 text-[11pt]">
              {/* Left: Client Account Details */}
              <div className="document-card p-2.5 bg-white flex flex-col justify-between shadow-none">
                <div className="font-bold uppercase text-[11pt] tracking-wider text-stone-800 border-b border-[#cbd5e1] pb-1 mb-1.5">
                  STATEMENT TO
                </div>
                <div className="grid grid-rows-3 divide-y divide-[#e2e8f0]">
                  <div className="flex items-center justify-between py-1 min-h-[26px]">
                    <span className="font-semibold text-stone-700 text-left shrink-0 pr-2">Client Name:</span>
                    <span className="font-bold text-stone-900 text-right">{client?.name || 'Selected Client'}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 min-h-[26px]">
                    <span className="font-semibold text-stone-700 text-left shrink-0 pr-2">KRA PIN:</span>
                    <span className="text-stone-800 text-right tracking-wider">{client?.kraPin || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 min-h-[26px]">
                    <span className="font-semibold text-stone-700 text-left shrink-0 pr-2">Physical Address:</span>
                    <span className="text-stone-800 text-right truncate max-w-[200px]">{client?.address || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Right: Statement Specifications */}
              <div className="document-card p-2.5 bg-white flex flex-col justify-between shadow-none">
                <div className="font-bold uppercase text-[11pt] tracking-wider text-stone-800 border-b border-[#cbd5e1] pb-1 mb-1.5">
                  DOCUMENT PARTICULARS
                </div>
                <div className="grid grid-rows-3 divide-y divide-[#e2e8f0]">
                  <div className="flex items-center justify-between py-1 min-h-[26px]">
                    <span className="font-semibold text-stone-700 text-left shrink-0 pr-2">Statement No:</span>
                    <span className="font-bold text-stone-900 text-right">{statementNumber}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 min-h-[26px]">
                    <span className="font-semibold text-stone-700 text-left shrink-0 pr-2">Issue Date:</span>
                    <span className="text-stone-800 text-right">{issueDate ? formatDate(issueDate) : formatDate()}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 min-h-[26px]">
                    <span className="font-semibold text-stone-700 text-left shrink-0 pr-2">Period Covered:</span>
                    <span className="text-stone-800 text-right font-medium">
                      {formatDate(startDate)} to {formatDate(endDate)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. LEDGER TABLE: Dynamic Table Layout Engine */}
            <div className="mb-4 w-full">
              <table className="document-table text-[11pt]" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr>
                    <th
                      className="text-center whitespace-nowrap"
                      style={{ width: '36px', minWidth: '36px' }}
                    >
                      #
                    </th>
                    <th
                      className="text-center whitespace-nowrap"
                      style={{ width: '85px', minWidth: '85px' }}
                    >
                      Date
                    </th>
                    <th
                      className="text-center whitespace-nowrap"
                      style={{ width: '80px', minWidth: '80px' }}
                    >
                      Ref No.
                    </th>
                    <th
                      className="text-left"
                      style={{ width: 'auto' }}
                    >
                      Particulars
                    </th>
                    <th
                      className="text-center whitespace-nowrap"
                      style={{ width: similarCurrencyWidth, minWidth: similarCurrencyWidth, maxWidth: similarCurrencyWidth }}
                    >
                      Debit
                    </th>
                    <th
                      className="text-center whitespace-nowrap"
                      style={{ width: similarCurrencyWidth, minWidth: similarCurrencyWidth, maxWidth: similarCurrencyWidth }}
                    >
                      Credit
                    </th>
                    <th
                      className="text-center whitespace-nowrap"
                      style={{ width: similarCurrencyWidth, minWidth: similarCurrencyWidth, maxWidth: similarCurrencyWidth }}
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
                          style={{ width: similarCurrencyWidth, minWidth: similarCurrencyWidth, maxWidth: similarCurrencyWidth }}
                        >
                          {entry.debit > 0 ? formatKsh(entry.debit).replace('Ksh ', '') : '-'}
                        </td>
                        <td
                          className="text-right tabular-decimal text-emerald-800 font-medium whitespace-nowrap"
                          style={{ width: similarCurrencyWidth, minWidth: similarCurrencyWidth, maxWidth: similarCurrencyWidth }}
                        >
                          {entry.credit > 0 ? formatKsh(entry.credit).replace('Ksh ', '') : '-'}
                        </td>
                        <td
                          className="text-right tabular-decimal font-semibold text-stone-950 whitespace-nowrap"
                          style={{ width: similarCurrencyWidth, minWidth: similarCurrencyWidth, maxWidth: similarCurrencyWidth }}
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

            {/* 5. FINANCIALS: Compact Summary */}
            <div className="flex justify-end mb-4">
              <div className="w-80">
                <table className="document-table text-[11pt]" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                  <tbody>
                    <tr className="bg-stone-50/50">
                      <td className="px-2.5 py-1 text-stone-600 font-normal">Total Invoiced (Debit):</td>
                      <td className="px-2.5 py-1 text-right tabular-decimal font-semibold text-stone-900">
                        {formatKsh(totalDebit)}
                      </td>
                    </tr>
                    <tr className="bg-emerald-50/20">
                      <td className="px-2.5 py-1 text-emerald-800 font-normal">Total Settled (Credit):</td>
                      <td className="px-2.5 py-1 text-right tabular-decimal font-medium text-emerald-700">
                        {formatKsh(totalCredit)}
                      </td>
                    </tr>
                    <tr className="bg-[#f1f5f9] text-[12.5pt]">
                      <td className="px-2.5 py-1.5 text-stone-950 font-bold uppercase tracking-tight">Closing Balance Due:</td>
                      <td className="px-2.5 py-1.5 text-right tabular-decimal font-extrabold text-rose-950">
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
              <div className="font-bold text-stone-800">Thank you for choosing HOTEL DAMVIEW</div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

A4StatementPreview.displayName = 'A4StatementPreview';
