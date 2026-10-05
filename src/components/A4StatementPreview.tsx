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

    // Dynamically set the Period Covered header to reflect the date range from the oldest included invoice issue date to the most recent invoice issue date
    const dynamicPeriodCovered = React.useMemo(() => {
      const invoiceDates = entries
        .filter((e) => e.debit > 0 && e.date)
        .map((e) => e.date)
        .sort();
      if (invoiceDates.length > 0) {
        const oldest = invoiceDates[0];
        const newest = invoiceDates[invoiceDates.length - 1];
        return `${formatDate(oldest)} to ${formatDate(newest)}`;
      }
      return `${formatDate(startDate)} to ${formatDate(endDate)}`;
    }, [entries, startDate, endDate]);

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
            {/* Logo dynamically sized to match proportional height of all company details rows */}
            <div className="relative flex items-center justify-center pb-3 mb-3 border-b-2 border-stone-800">
              {/* Hotel Logo: Positioned top-0 bottom-3; auto-sized proportionally to match total height of adjacent company details block */}
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

            {/* 2. DOCUMENT TITLE */}
            <div className="text-center mb-3 py-1.5 bg-stone-100 border-y border-stone-400">
              <h2 className="text-[13pt] font-bold tracking-widest text-stone-900 uppercase m-0">
                STATEMENT OF ACCOUNT
              </h2>
            </div>

            {/* 3. PARALLEL TWO-COLUMN DETAILS ARCHITECTURE */}
            <div className="mb-3.5 w-full">
              <div className="grid grid-cols-2 gap-3 text-[11pt]">
                {/* Left Column: STATEMENT TO */}
                <div className="border border-stone-300 rounded bg-white overflow-hidden">
                  <div className="px-2.5 py-1 uppercase font-bold text-[11pt] tracking-wider text-stone-900 bg-stone-100/80 border-b border-stone-300">
                    STATEMENT TO
                  </div>
                  <div className="p-2 space-y-1">
                    <div className="flex justify-between items-center gap-2 leading-tight">
                      <span className="font-semibold text-stone-600 whitespace-nowrap text-[11pt] shrink-0">Client Name:</span>
                      <span className="font-bold text-stone-950 text-right break-words text-[11pt] pl-2 max-w-[70%]">{client?.name || 'Selected Client'}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2 leading-tight border-t border-stone-200/80 pt-1">
                      <span className="font-semibold text-stone-600 whitespace-nowrap text-[11pt] shrink-0">KRA PIN:</span>
                      <span className="font-mono text-stone-900 text-right text-[11pt] tracking-wider pl-2 max-w-[70%]">{client?.kraPin || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2 leading-tight border-t border-stone-200/80 pt-1">
                      <span className="font-semibold text-stone-600 whitespace-nowrap text-[11pt] shrink-0">Physical Address:</span>
                      <span className="text-stone-800 text-right break-words text-[11pt] pl-2 max-w-[75%]">{client?.address || 'N/A'}</span>
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
                      <span className="font-semibold text-stone-600 whitespace-nowrap text-[11pt] shrink-0">Statement No:</span>
                      <span className="font-bold font-mono text-stone-950 text-right text-[11pt] pl-2 max-w-[70%]">{statementNumber}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2 leading-tight border-t border-stone-200/80 pt-1">
                      <span className="font-semibold text-stone-600 whitespace-nowrap text-[11pt] shrink-0">Issue Date:</span>
                      <span className="text-stone-900 text-right text-[11pt] pl-2 max-w-[70%]">{issueDate ? formatDate(issueDate) : formatDate()}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2 leading-tight border-t border-stone-200/80 pt-1">
                      <span className="font-semibold text-stone-600 whitespace-nowrap text-[11pt] shrink-0">Period Covered:</span>
                      <span className="font-medium text-stone-900 text-right text-[11pt] pl-2 max-w-[70%]">{dynamicPeriodCovered}</span>
                    </div>
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
              <div className="w-full max-w-[350px] ml-auto">
                <table className="financial-summary-table border border-stone-200/90 rounded text-[11pt]" style={{ borderCollapse: 'collapse', width: '100%', boxSizing: 'border-box' }}>
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
                <div className="font-bold uppercase text-[11pt] tracking-wider text-stone-900 border-b border-[#cbd5e1] pb-1 mb-1.5">
                  Terms & Conditions
                </div>
                <ol className="list-decimal list-inside space-y-0.5 text-[11pt] text-stone-700">
                  <li>Please examine this statement immediately and notify the accounts department of any discrepancies within 7 days.</li>
                  <li>Outstanding balances remaining unpaid past the credit period are subject to overdue credit terms.</li>
                  <li>All remittance payments should reference the assigned Client ID or respective invoice numbers.</li>
                </ol>
              </div>
            </div>

            {/* 7. FIXED PAGE FOOTER */}
            <div className="pt-2 border-t border-stone-800 flex items-center justify-between text-[11pt] text-stone-600">
              <div>Official computer generated document</div>
              <div className="font-bold text-stone-800">Thank you for choosing {displayName.toUpperCase()}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

A4StatementPreview.displayName = 'A4StatementPreview';
