import React, { forwardRef } from 'react';
import { BillingDocument, HotelProfile } from '../types';
import { formatKsh, formatDate } from '../utils/formatters';
import { HotelLogo } from './HotelLogo';

interface A4DocumentPreviewProps {
  document?: BillingDocument;
  doc?: BillingDocument;
  profile: HotelProfile;
  scale?: number;
  className?: string;
  isPrintVersion?: boolean;
}

export const A4DocumentPreview = forwardRef<HTMLDivElement, A4DocumentPreviewProps>(
  ({ document, doc: docProp, profile, scale = 1, className = '', isPrintVersion = false }, ref) => {
    const doc = document || docProp!;

    // Title mapping based on document type
    const docTitle =
      doc.documentType === 'QUOTATION'
        ? 'QUOTATION'
        : doc.documentType === 'PROFORMA'
        ? 'PROFORMA INVOICE'
        : 'INVOICE';

    const isQuotation = doc.documentType === 'QUOTATION';
    const isInvoice = doc.documentType === 'INVOICE';
    const isProforma = doc.documentType === 'PROFORMA';

    // Dynamic relevant title for client particulars box based on document type
    const clientBoxTitle = isQuotation
      ? 'QUOTATION TO'
      : isProforma
      ? 'PROFORMA TO'
      : 'INVOICE TO';

    // PDF Filtering Rule: Rows where Particulars is empty or whitespace-only must be dynamically excluded
    const activeLineItems = (doc.lineItems || []).filter(
      (item) => item.particulars && item.particulars.trim().length > 0
    );

    // Calculate aggregated discount and gross subtotal for the Financial Summary Block
    const docDiscount = doc.discount !== undefined && doc.discount > 0
      ? Number(doc.discount) || 0
      : activeLineItems.reduce((sum, item) => sum + (Number(item.discount) || 0), 0);
    const grossSubtotal = activeLineItems.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.days) || 1) * (Number(item.rate) || 0),
      0
    );

    // Right-aligned tabular decimal split
    const renderAlignedCurrency = (amount: number | undefined | null, bold = false) => {
      const val = amount || 0;
      return (
        <span className={`tabular-decimal inline-block w-full text-right ${bold ? 'font-bold' : 'font-normal'}`}>
          {formatKsh(val)}
        </span>
      );
    };

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

    // Credentials presence checks (Zero-placeholder discipline)
    const hasBankName = Boolean(profile.bankName && profile.bankName.trim());
    const hasAccountNo = Boolean(profile.accountNumber && profile.accountNumber.trim());
    const hasBankBranch = Boolean(profile.bankBranch && profile.bankBranch.trim());
    const hasAccountHolder = Boolean(profile.accountHolder && profile.accountHolder.trim());
    const hasBankRemittance = hasBankName || hasAccountNo || hasBankBranch || hasAccountHolder;
    const hasMpesa = Boolean(profile.mpesaTillNumber && profile.mpesaTillNumber.trim());
    const hasPaymentSettlement = hasBankRemittance || hasMpesa;

    // Adaptive, content-based column width calculation:
    // 1. Item #: compact fixed width
    const itemNumberWidth = '34px';

    // 2. Qty: auto-fitted to maximum quantity digit length
    const maxQtyChars = Math.max(
      3, // 'Qty' length
      ...(activeLineItems.length > 0 ? activeLineItems.map((item) => String(item.quantity || 1).length) : [1])
    );
    const dynamicQtyWidth = `${Math.max(44, maxQtyChars * 8 + 16)}px`;

    // 3. Days: auto-fitted to maximum days digit length
    const maxDaysChars = Math.max(
      4, // 'Days' length
      ...(activeLineItems.length > 0 ? activeLineItems.map((item) => String(item.days || 1).length) : [1])
    );
    const dynamicDaysWidth = `${Math.max(48, maxDaysChars * 8 + 16)}px`;

    // 4. Rate: auto-fitted to maximum rate currency length
    const maxRateChars = Math.max(
      4, // 'Rate' length
      ...(activeLineItems.length > 0
        ? activeLineItems.map((item) => formatKsh(item.rate || 0).replace('Ksh ', '').length)
        : [5])
    );
    const dynamicRateWidth = `${Math.max(82, maxRateChars * 8 + 18)}px`;

    // 5. Amount: auto-fitted to maximum amount currency length
    const maxAmountChars = Math.max(
      6, // 'Amount' length
      ...(activeLineItems.length > 0
        ? activeLineItems.map((item) => formatKsh(item.amount || 0).replace('Ksh ', '').length)
        : [7])
    );
    const dynamicAmountWidth = `${Math.max(90, maxAmountChars * 8 + 18)}px`;

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
          id={`a4-doc-${doc.documentNumber || 'preview'}`}
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
          {/* MAIN DOCUMENT BODY */}
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

            {/* 2. DOCUMENT TITLE BAR */}
            <div className="text-center mb-3 py-1.5 bg-stone-100 border-y border-stone-400">
              <h2 className="text-[13pt] font-bold tracking-widest text-stone-900 uppercase m-0">
                {docTitle}
              </h2>
            </div>

            {/* 3. PARALLEL TWO-COLUMN DETAILS ARCHITECTURE */}
            <div className="mb-3.5 w-full">
              <div className="grid grid-cols-2 gap-3 text-[11pt]">
                {/* Left Column: CLIENT DETAILS */}
                <div className="border border-stone-300 rounded bg-white overflow-hidden">
                  <div className="px-2.5 py-1 uppercase font-bold text-[11pt] tracking-wider text-stone-900 bg-stone-100/80 border-b border-stone-300">
                    {clientBoxTitle}
                  </div>
                  <div className="p-2 space-y-1">
                    <div className="flex justify-between items-center gap-2 leading-tight">
                      <span className="font-semibold text-stone-600 whitespace-nowrap text-[11pt] shrink-0">Client Name:</span>
                      <span className="font-bold text-stone-950 text-right break-words text-[11pt] pl-2 max-w-[70%]">{doc.clientName || 'Cash / Walk-In Customer'}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2 leading-tight border-t border-stone-200/80 pt-1">
                      <span className="font-semibold text-stone-600 whitespace-nowrap text-[11pt] shrink-0">KRA PIN:</span>
                      <span className="font-mono text-stone-900 text-right text-[11pt] tracking-wider pl-2 max-w-[70%]">{doc.clientKraPin || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2 leading-tight border-t border-stone-200/80 pt-1">
                      <span className="font-semibold text-stone-600 whitespace-nowrap text-[11pt] shrink-0">Physical Address:</span>
                      <span className="text-stone-800 text-right break-words text-[11pt] pl-2 max-w-[75%]">{doc.clientAddress || 'N/A'}</span>
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
                      <span className="font-semibold text-stone-600 whitespace-nowrap text-[11pt] shrink-0">{isQuotation ? 'Quote No:' : isProforma ? 'Proforma No:' : 'Invoice No:'}</span>
                      <span className="font-bold font-mono text-stone-950 text-right text-[11pt] pl-2 max-w-[70%]">{doc.documentNumber || 'DRAFT'}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2 leading-tight border-t border-stone-200/80 pt-1">
                      <span className="font-semibold text-stone-600 whitespace-nowrap text-[11pt] shrink-0">Issue Date:</span>
                      <span className="text-stone-900 text-right text-[11pt] pl-2 max-w-[70%]">{formatDate(doc.issueDate)}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2 leading-tight border-t border-stone-200/80 pt-1">
                      <span className="font-semibold text-stone-600 whitespace-nowrap text-[11pt] shrink-0">{isQuotation ? 'Valid Until:' : 'Due Date:'}</span>
                      <span className="font-medium text-stone-900 text-right text-[11pt] pl-2 max-w-[70%]">{doc.dueDate ? formatDate(doc.dueDate) : '-'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. TRANSACTION LINE-ITEM GRID: Adaptive Dynamic Column Widths */}
            <div className="mb-4 w-full">
              <table className="document-table text-[11pt]" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr>
                    <th
                      className="text-center col-center whitespace-nowrap"
                      style={{ width: itemNumberWidth, minWidth: itemNumberWidth }}
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
                      style={{ width: dynamicQtyWidth, minWidth: dynamicQtyWidth }}
                    >
                      Qty
                    </th>
                    <th
                      className="text-center col-center whitespace-nowrap"
                      style={{ width: dynamicDaysWidth, minWidth: dynamicDaysWidth }}
                    >
                      Days
                    </th>
                    <th
                      className="text-center col-center whitespace-nowrap"
                      style={{ width: dynamicRateWidth, minWidth: dynamicRateWidth }}
                    >
                      Rate
                    </th>
                    <th
                      className="text-center col-center whitespace-nowrap"
                      style={{ width: dynamicAmountWidth, minWidth: dynamicAmountWidth }}
                    >
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activeLineItems && activeLineItems.length > 0 ? (
                    activeLineItems.map((item, index) => (
                      <tr
                        key={item.id || index}
                        className={index % 2 === 1 ? 'bg-[#f8fafc]/60' : 'bg-white'}
                      >
                        {/* Item #: Center-aligned */}
                        <td
                          className="text-center text-stone-600 whitespace-nowrap font-normal"
                          style={{ width: itemNumberWidth }}
                        >
                          {index + 1}
                        </td>
                        {/* Particulars: Elastic expanding column */}
                        <td className="text-left text-stone-900 font-normal leading-snug">
                          {item.particulars}
                        </td>
                        {/* Qty: Center-aligned, tight auto-fit width */}
                        <td
                          className="text-center text-stone-800 whitespace-nowrap font-normal"
                          style={{ width: dynamicQtyWidth, minWidth: dynamicQtyWidth }}
                        >
                          {item.quantity}
                        </td>
                        {/* Days: Center-aligned, tight auto-fit width */}
                        <td
                          className="text-center text-stone-800 whitespace-nowrap font-normal"
                          style={{ width: dynamicDaysWidth, minWidth: dynamicDaysWidth }}
                        >
                          {item.days || 1}
                        </td>
                        {/* Rate: Right-aligned, auto-fit width */}
                        <td
                          className="text-right text-stone-800 tabular-decimal whitespace-nowrap font-normal"
                          style={{ width: dynamicRateWidth, minWidth: dynamicRateWidth }}
                        >
                          {formatKsh(item.rate).replace('Ksh ', '')}
                        </td>
                        {/* Amount: Right-aligned, auto-fit width */}
                        <td
                          className="text-right font-semibold text-stone-900 tabular-decimal whitespace-nowrap"
                          style={{ width: dynamicAmountWidth, minWidth: dynamicAmountWidth }}
                        >
                          {formatKsh(item.amount).replace('Ksh ', '')}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-6 text-center text-stone-400 italic"
                      >
                        No active line items recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 5. HEADERLESS FINANCIAL SUMMARY & OPTIONAL SETTLEMENT BLOCK */}
            <div className="mb-4 w-full">
              {hasPaymentSettlement ? (
                <div className="flex items-stretch justify-between gap-4 w-full">
                  {/* Left: Clean, headerless Settlement Instructions card */}
                  <div className="flex-1 border border-stone-300 rounded p-2.5 bg-stone-50/60 text-[11pt] leading-tight space-y-1">
                    {hasBankRemittance && (
                      <>
                        <div className="font-bold text-stone-900 border-b border-stone-200 pb-0.5 uppercase tracking-wider text-[11pt]">
                          Bank Remittance Instructions
                        </div>
                        {hasBankName && (
                          <div className="grid grid-cols-2 gap-x-1">
                            <span className="font-semibold text-stone-600">Bank:</span>
                            <span className="font-medium text-stone-900 truncate">{profile.bankName.trim()}</span>
                          </div>
                        )}
                        {hasBankBranch && (
                          <div className="grid grid-cols-2 gap-x-1">
                            <span className="font-semibold text-stone-600">Branch:</span>
                            <span className="text-stone-800 truncate">{profile.bankBranch.trim()}</span>
                          </div>
                        )}
                        {hasAccountHolder && (
                          <div className="grid grid-cols-2 gap-x-1">
                            <span className="font-semibold text-stone-600">Account Name:</span>
                            <span className="font-medium text-stone-900 truncate">{profile.accountHolder.trim()}</span>
                          </div>
                        )}
                        {hasAccountNo && (
                          <div className="grid grid-cols-2 gap-x-1">
                            <span className="font-semibold text-stone-600">Account No:</span>
                            <span className="font-mono font-bold text-stone-900">{profile.accountNumber.trim()}</span>
                          </div>
                        )}
                      </>
                    )}
                    {hasMpesa && (
                      <div className={`grid grid-cols-2 gap-x-1 ${hasBankRemittance ? 'pt-1 border-t border-stone-200' : ''}`}>
                        <span className="font-semibold text-emerald-800">M-Pesa Buy Goods Till:</span>
                        <span className="font-mono font-bold text-emerald-900">{profile.mpesaTillNumber.trim()}</span>
                      </div>
                    )}
                  </div>

                  {/* Right: Headerless Financial Summary */}
                  <div className="w-[48%] max-w-[350px]">
                    <table className="financial-summary-table border border-stone-300 rounded text-[11pt]" style={{ borderCollapse: 'collapse', width: '100%', boxSizing: 'border-box' }}>
                      <tbody>
                        {docDiscount > 0 && (
                          <>
                            <tr className="financial-summary-row-intermediate">
                              <td className="px-3 py-1 label-cell text-stone-600 font-normal">Gross Subtotal:</td>
                              <td className="px-3 py-1 value-cell tabular-nums font-normal text-stone-800">
                                {formatKsh(doc.grossSubtotal || (doc.grandTotal + docDiscount))}
                              </td>
                            </tr>
                            <tr className="financial-summary-row-intermediate">
                              <td className="px-3 py-1 label-cell text-stone-600 font-normal">Discount:</td>
                              <td className="px-3 py-1 value-cell tabular-nums font-normal text-stone-700">
                                {formatKsh(-docDiscount)}
                              </td>
                            </tr>
                          </>
                        )}

                        <tr className="financial-summary-row-intermediate">
                          <td className="px-3 py-1 label-cell text-stone-600 font-normal">Subtotal:</td>
                          <td className="px-3 py-1 value-cell tabular-nums font-normal text-stone-800">
                            {formatKsh(doc.subtotal)}
                          </td>
                        </tr>

                        <tr className="financial-summary-row-intermediate">
                          <td className="px-3 py-1 label-cell text-stone-600 font-normal">
                            VAT ({profile.vatRate || 16}%):
                          </td>
                          <td className="px-3 py-1 value-cell tabular-nums font-normal text-stone-800">
                            {formatKsh(doc.vatAmount)}
                          </td>
                        </tr>

                        <tr className={isQuotation ? "financial-summary-row-balance" : "financial-summary-row-total"}>
                          <td className="px-3 py-1.5 label-cell text-stone-950 font-bold">Grand Total:</td>
                          <td className="px-3 py-1.5 value-cell tabular-nums font-bold text-stone-950">
                            {formatKsh(doc.grandTotal)}
                          </td>
                        </tr>

                        {(isInvoice || isProforma) && (
                          <>
                            <tr className="financial-summary-row-intermediate">
                              <td className="px-3 py-1 label-cell text-stone-600 font-normal">Paid / Credited:</td>
                              <td className="px-3 py-1 value-cell tabular-nums font-normal text-emerald-800">
                                {formatKsh(doc.amountPaid || 0)}
                              </td>
                            </tr>
                            <tr className="financial-summary-row-balance">
                              <td className="px-3 py-1.5 label-cell text-stone-950 font-bold">Balance Due:</td>
                              <td className="px-3 py-1.5 value-cell tabular-nums font-bold text-rose-950">
                                {formatKsh(doc.balanceDue !== undefined ? doc.balanceDue : doc.grandTotal)}
                              </td>
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end w-full">
                  <div className="w-[50%] min-w-[320px] max-w-[380px]">
                    <table className="financial-summary-table border border-stone-300 rounded text-[11pt]" style={{ borderCollapse: 'collapse', width: '100%' }}>
                      <tbody>
                        {docDiscount > 0 && (
                          <>
                            <tr className="financial-summary-row-intermediate">
                              <td className="px-3 py-1 label-cell text-stone-600 font-normal">Gross Subtotal:</td>
                              <td className="px-3 py-1 value-cell tabular-nums font-normal text-stone-800">
                                {formatKsh(doc.grossSubtotal || (doc.grandTotal + docDiscount))}
                              </td>
                            </tr>
                            <tr className="financial-summary-row-intermediate">
                              <td className="px-3 py-1 label-cell text-stone-600 font-normal">Discount:</td>
                              <td className="px-3 py-1 value-cell tabular-nums font-normal text-stone-700">
                                {formatKsh(-docDiscount)}
                              </td>
                            </tr>
                          </>
                        )}

                        <tr className="financial-summary-row-intermediate">
                          <td className="px-3 py-1 label-cell text-stone-600 font-normal">Subtotal:</td>
                          <td className="px-3 py-1 value-cell tabular-nums font-normal text-stone-800">
                            {formatKsh(doc.subtotal)}
                          </td>
                        </tr>

                        <tr className="financial-summary-row-intermediate">
                          <td className="px-3 py-1 label-cell text-stone-600 font-normal">
                            VAT ({profile.vatRate || 16}%):
                          </td>
                          <td className="px-3 py-1 value-cell tabular-nums font-normal text-stone-800">
                            {formatKsh(doc.vatAmount)}
                          </td>
                        </tr>

                        <tr className={isQuotation ? "financial-summary-row-balance" : "financial-summary-row-total"}>
                          <td className="px-3 py-1.5 label-cell text-stone-950 font-bold">Grand Total:</td>
                          <td className="px-3 py-1.5 value-cell tabular-nums font-bold text-stone-950">
                            {formatKsh(doc.grandTotal)}
                          </td>
                        </tr>

                        {(isInvoice || isProforma) && (
                          <>
                            <tr className="financial-summary-row-intermediate">
                              <td className="px-3 py-1 label-cell text-stone-600 font-normal">Paid / Credited:</td>
                              <td className="px-3 py-1 value-cell tabular-nums font-normal text-emerald-800">
                                {formatKsh(doc.amountPaid || 0)}
                              </td>
                            </tr>
                            <tr className="financial-summary-row-balance">
                              <td className="px-3 py-1.5 label-cell text-stone-950 font-bold">Balance Due:</td>
                              <td className="px-3 py-1.5 value-cell tabular-nums font-bold text-rose-950">
                                {formatKsh(doc.balanceDue !== undefined ? doc.balanceDue : doc.grandTotal)}
                              </td>
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 6. FIXED PAGE BOTTOM FOOTER: CUSTOM NOTES/TERMS OR DOCUMENT-SPECIFIC TERMS & CONDITIONS */}
          <div className="mt-auto pt-2 w-full text-[11pt]">
            <div className="document-card bg-slate-50/50 mb-2.5 p-2.5 text-[11pt] w-full">
              {doc.notes && doc.notes.trim().length > 0 ? (
                <div className="text-stone-800 leading-snug">
                  <div className="flex items-start gap-1">
                    <span className="font-bold text-stone-900 uppercase text-[11pt] mr-1 shrink-0">Notes / Instructions:</span>
                    <span className="whitespace-pre-wrap">{doc.notes}</span>
                  </div>
                  {doc.terms && doc.terms.trim().length > 0 && (
                    <div className="mt-1.5 pt-1.5 border-t border-[#e2e8f0] text-stone-700 flex items-start gap-1">
                      <span className="font-bold text-stone-900 uppercase text-[11pt] mr-1 shrink-0">Payment Terms:</span>
                      <span className="whitespace-pre-wrap">{doc.terms}</span>
                    </div>
                  )}
                </div>
              ) : doc.terms && doc.terms.trim().length > 0 ? (
                <div className="text-stone-800 leading-snug flex items-start gap-1">
                  <span className="font-bold text-stone-900 uppercase text-[11pt] mr-1 shrink-0">Payment Terms:</span>
                  <span className="whitespace-pre-wrap">{doc.terms}</span>
                </div>
              ) : (
                <div className="text-stone-800 leading-snug">
                  <div className="font-bold uppercase text-[11pt] tracking-wider text-stone-900 border-b border-[#cbd5e1] pb-1 mb-1.5">
                    Terms & Conditions
                  </div>
                  <ol className="list-decimal list-inside space-y-0.5 text-[11pt] text-stone-700">
                    {isQuotation ? (
                      <>
                        <li>This quotation is valid for 30 days from the date of issue and is subject to space and facility availability.</li>
                        <li>A 50% commitment deposit is required upon reservation confirmation; the balance is payable upon check-in / event date.</li>
                        <li>Cancellations made less than 48 hours prior to the scheduled booking date may attract applicable cancellation charges.</li>
                      </>
                    ) : isProforma ? (
                      <>
                        <li>This proforma invoice is an advance billing estimate and serves as an official reservation quotation.</li>
                        <li>Bookings, accommodation, and event facilities are confirmed upon receipt of the advance commitment payment.</li>
                        <li>A final tax invoice will be issued upon delivery of services and complete financial reconciliation.</li>
                      </>
                    ) : (
                      <>
                        <li>Payment is strictly due according to the agreed credit terms from the date of invoice issuance.</li>
                        <li>All settlements must be backed by an official {displayName} payment receipt upon clearance.</li>
                        <li>Any queries regarding billed services or tariff rates must be reported in writing within 7 days of invoice receipt.</li>
                      </>
                    )}
                  </ol>
                </div>
              )}
            </div>

            {/* 7. TERMINAL LEGAL FOOTER: Fixed single line at the base */}
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

A4DocumentPreview.displayName = 'A4DocumentPreview';

