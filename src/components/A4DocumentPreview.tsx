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

    // Formatted phone & email line
    const phoneEmail = `${profile.phone || '+25472524262'} | ${profile.email || 'hoteldamview@gmail.com'}`;

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
                {docTitle}
              </h2>
            </div>

            {/* 3. PARALLEL TWO-COLUMN METADATA GRID (Side-by-Side Tables) */}
            <div className="grid grid-cols-2 gap-3 mb-4 text-[11pt]">
              {/* LEFT TABLE: Dynamic Title Based on Document Type */}
              <div className="document-card p-2.5 bg-white flex flex-col justify-between shadow-none">
                <div className="font-bold uppercase text-[11pt] tracking-wider text-stone-800 border-b border-[#cbd5e1] pb-1 mb-1.5">
                  {clientBoxTitle}
                </div>
                <div className="grid grid-rows-3 divide-y divide-[#e2e8f0]">
                  {/* Row 1: Client Name */}
                  <div className="flex items-center justify-between py-1 min-h-[26px]">
                    <span className="font-semibold text-stone-700 text-left shrink-0 pr-2">Client Name:</span>
                    <span className="font-bold text-stone-900 text-right">{doc.clientName || 'Cash / Walk-In Customer'}</span>
                  </div>
                  {/* Row 2: KRA PIN */}
                  <div className="flex items-center justify-between py-1 min-h-[26px]">
                    <span className="font-semibold text-stone-700 text-left shrink-0 pr-2">KRA PIN:</span>
                    <span className="text-stone-800 text-right tracking-wider">{doc.clientKraPin || 'N/A'}</span>
                  </div>
                  {/* Row 3: Physical Address */}
                  <div className="flex items-center justify-between py-1 min-h-[26px]">
                    <span className="font-semibold text-stone-700 text-left shrink-0 pr-2">Physical Address:</span>
                    <span className="text-stone-800 text-right truncate max-w-[200px]">{doc.clientAddress || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* RIGHT TABLE: DOCUMENT PARTICULARS */}
              <div className="document-card p-2.5 bg-white flex flex-col justify-between shadow-none">
                <div className="font-bold uppercase text-[11pt] tracking-wider text-stone-800 border-b border-[#cbd5e1] pb-1 mb-1.5">
                  DOCUMENT PARTICULARS
                </div>
                <div className="grid grid-rows-3 divide-y divide-[#e2e8f0]">
                  {/* Row 1: Document Number */}
                  <div className="flex items-center justify-between py-1 min-h-[26px]">
                    <span className="font-semibold text-stone-700 text-left shrink-0 pr-2">
                      {isQuotation ? 'Quote No:' : isProforma ? 'Proforma No:' : 'Invoice No:'}
                    </span>
                    <span className="font-bold text-stone-950 text-right">{doc.documentNumber || 'DRAFT'}</span>
                  </div>
                  {/* Row 2: Date */}
                  <div className="flex items-center justify-between py-1 min-h-[26px]">
                    <span className="font-semibold text-stone-700 text-left shrink-0 pr-2">Date:</span>
                    <span className="text-stone-800 text-right">{formatDate(doc.issueDate)}</span>
                  </div>
                  {/* Row 3: Due Date */}
                  <div className="flex items-center justify-between py-1 min-h-[26px]">
                    <span className="font-semibold text-stone-700 text-left shrink-0 pr-2">Due Date:</span>
                    <span className="text-stone-800 text-right font-medium">{formatDate(doc.dueDate)}</span>
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
                        style={{ height: '26px' }}
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

            {/* 5. FINANCIAL SUMMARY BLOCK */}
            <div className="flex justify-end mb-4">
              <div className="w-80">
                <table className="document-table text-[11pt]" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                  <tbody>
                    {/* Dedicated Discount row with distinct italic typography */}
                    {docDiscount > 0 && (
                      <tr className="bg-emerald-50/30">
                        <td className="px-2.5 py-1 font-semibold text-emerald-800 italic">Discount:</td>
                        <td className="px-2.5 py-1 text-right text-emerald-700 font-semibold">
                          {renderAlignedCurrency(-docDiscount)}
                        </td>
                      </tr>
                    )}

                    <tr>
                      <td className="px-2.5 py-1 text-stone-600 font-medium">Subtotal:</td>
                      <td className="px-2.5 py-1 text-right text-stone-700 font-medium">
                        {renderAlignedCurrency(doc.subtotal)}
                      </td>
                    </tr>

                    <tr>
                      <td className="px-2.5 py-1 text-stone-600 font-medium uppercase tracking-wide">
                        VAT (16%):
                      </td>
                      <td className="px-2.5 py-1 text-right text-stone-600 font-normal">
                        {renderAlignedCurrency(doc.vatAmount)}
                      </td>
                    </tr>
                    <tr className="bg-[#f1f5f9] text-[12.5pt] font-extrabold" style={{ borderTop: '1px solid #cbd5e1' }}>
                      <td className="px-2.5 py-1.5 text-stone-950 font-bold uppercase tracking-tight">Grand Total:</td>
                      <td className="px-2.5 py-1.5 text-right text-stone-950 font-black">
                        {renderAlignedCurrency(doc.grandTotal, true)}
                      </td>
                    </tr>

                    {(isInvoice || isProforma) && (
                      <>
                        <tr className="bg-stone-50/40">
                          <td className="px-2.5 py-1 text-emerald-800 font-medium">Amount Settled:</td>
                          <td className="px-2.5 py-1 text-right text-emerald-700 font-semibold">
                            {renderAlignedCurrency(doc.amountPaid || 0)}
                          </td>
                        </tr>
                        <tr className="bg-rose-50/70 text-[12pt]">
                          <td className="px-2.5 py-1.5 text-rose-950 font-bold uppercase tracking-tight">Balance Due:</td>
                          <td className="px-2.5 py-1.5 text-right text-rose-900 font-black">
                            {renderAlignedCurrency(doc.balanceDue !== undefined ? doc.balanceDue : doc.grandTotal, true)}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
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
                  <div className="font-bold uppercase text-[10.5pt] tracking-wider text-stone-900 border-b border-[#cbd5e1] pb-1 mb-1.5">
                    Terms & Conditions
                  </div>
                  <ol className="list-decimal list-inside space-y-0.5 text-[10pt] text-stone-700">
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
                        <li>All settlements must be backed by an official Hotel Damview payment receipt upon clearance.</li>
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
              <div className="font-bold text-stone-800">Thank you for choosing HOTEL DAMVIEW</div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

A4DocumentPreview.displayName = 'A4DocumentPreview';

