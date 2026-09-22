import React, { useState, useMemo, useRef } from 'react';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Share2,
  Calendar,
  User,
  CreditCard,
  Plus,
  RefreshCw,
  Search,
  Edit,
  FileText,
  ExternalLink,
  Eye,
  X,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Filter,
} from 'lucide-react';
import { Client, BillingDocument, PaymentRecord, HotelProfile, LedgerEntry } from '../types';
import { formatKsh, formatDate } from '../utils/formatters';
import { generatePdfFromElement, shareDocumentPdf } from '../utils/pdfGenerator';
import { A4StatementPreview } from './A4StatementPreview';
import { AutoScalingA4Container } from './AutoScalingA4Container';

interface StatementOfAccountProps {
  clients: Client[];
  documents: BillingDocument[];
  payments: PaymentRecord[];
  profile: HotelProfile;
  initialClientId?: string;
  onRecordPayment?: (clientId: string, doc?: BillingDocument) => void;
  onEditDocument?: (doc: BillingDocument) => void;
  onNewDocumentForClient?: (clientId: string) => void;
}

export const StatementOfAccount: React.FC<StatementOfAccountProps> = ({
  clients,
  documents,
  payments,
  profile,
  initialClientId,
  onRecordPayment,
  onEditDocument,
  onNewDocumentForClient,
}) => {
  const [selectedClientId, setSelectedClientId] = useState<string>(
    initialClientId || (clients[0]?.id ?? '')
  );

  // Default date range: first day of current month to today (or last 90 days)
  const defaultStartDate = useMemo(() => {
    const d = new Date();
    d.setDate(1); // 1st of month
    return d.toISOString().split('T')[0];
  }, []);

  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(formatDate());
  // Editable statement issue date
  const [issueDate, setIssueDate] = useState(formatDate());
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNSETTLED' | 'SETTLED'>('ALL');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isPdfPreviewModalOpen, setIsPdfPreviewModalOpen] = useState(false);

  const statementPreviewRef = useRef<HTMLDivElement>(null);
  const modalPreviewRef = useRef<HTMLDivElement>(null);

  const selectedClient = useMemo(() => {
    return clients.find((c) => c.id === selectedClientId) || clients[0];
  }, [clients, selectedClientId]);

  // Generate Ledger Entries sorted chronologically with settled/unsettled recognition
  const {
    ledgerEntries,
    totalDebit,
    totalCredit,
    closingBalance,
    settledInvoicesCount,
    settledInvoicesTotal,
    unsettledInvoicesCount,
    unsettledInvoicesTotal,
    partialInvoicesCount,
  } = useMemo(() => {
    if (!selectedClient) {
      return {
        ledgerEntries: [],
        totalDebit: 0,
        totalCredit: 0,
        closingBalance: 0,
        settledInvoicesCount: 0,
        settledInvoicesTotal: 0,
        unsettledInvoicesCount: 0,
        unsettledInvoicesTotal: 0,
        partialInvoicesCount: 0,
      };
    }

    // Pull client invoices
    const clientInvoices = documents.filter(
      (d) =>
        d.clientId === selectedClient.id &&
        d.documentType === 'INVOICE' &&
        d.issueDate >= startDate &&
        d.issueDate <= endDate
    );

    // Pull client payments
    const clientPayments = payments.filter(
      (p) =>
        p.clientId === selectedClient.id &&
        p.date >= startDate &&
        p.date <= endDate
    );

    let settledCount = 0;
    let settledTotal = 0;
    let unsettledCount = 0;
    let unsettledTotal = 0;
    let partialCount = 0;

    type RawTx = {
      date: string;
      reference: string;
      description: string;
      debit: number;
      credit: number;
      status: 'Settled' | 'Partially Settled' | 'Unsettled' | 'Payment';
      doc?: BillingDocument;
    };

    const rawTxs: RawTx[] = [];

    clientInvoices.forEach((inv) => {
      let txStatus: 'Settled' | 'Partially Settled' | 'Unsettled' = 'Unsettled';
      const balance = inv.balanceDue !== undefined ? inv.balanceDue : inv.grandTotal;
      const paid = inv.amountPaid || 0;

      if (balance <= 0 || inv.status === 'Paid') {
        txStatus = 'Settled';
        settledCount++;
        settledTotal += inv.grandTotal;
      } else if (paid > 0 && balance > 0) {
        txStatus = 'Partially Settled';
        partialCount++;
        unsettledCount++;
        unsettledTotal += balance;
      } else {
        txStatus = 'Unsettled';
        unsettledCount++;
        unsettledTotal += balance;
      }

      rawTxs.push({
        date: inv.issueDate,
        reference: inv.documentNumber,
        description: `Invoice: ${inv.lineItems?.map((li) => li.particulars).join(', ') || 'Hospitality Services'}`,
        debit: inv.grandTotal,
        credit: 0,
        status: txStatus,
        doc: inv,
      });
    });

    clientPayments.forEach((pay) => {
      rawTxs.push({
        date: pay.date,
        reference: pay.receiptNumber,
        description: `Settlement Received (${pay.paymentMode})${pay.referenceNote ? ' - ' + pay.referenceNote : ''}`,
        debit: 0,
        credit: pay.amount,
        status: 'Payment',
      });
    });

    // Sort chronologically ascending
    rawTxs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    let sumDebit = 0;
    let sumCredit = 0;

    const entries: LedgerEntry[] = rawTxs.map((tx, idx) => {
      sumDebit += tx.debit;
      sumCredit += tx.credit;
      runningBalance = runningBalance + tx.debit - tx.credit;
      return {
        rowNumber: idx + 1,
        date: tx.date,
        reference: tx.reference,
        description: tx.description,
        debit: tx.debit,
        credit: tx.credit,
        cumulativeBalance: Math.round(runningBalance * 100) / 100,
        status: tx.status,
      };
    });

    return {
      ledgerEntries: entries,
      totalDebit: Math.round(sumDebit * 100) / 100,
      totalCredit: Math.round(sumCredit * 100) / 100,
      closingBalance: Math.round(runningBalance * 100) / 100,
      settledInvoicesCount: settledCount,
      settledInvoicesTotal: settledTotal,
      unsettledInvoicesCount: unsettledCount,
      unsettledInvoicesTotal: unsettledTotal,
      partialInvoicesCount: partialCount,
    };
  }, [selectedClient, documents, payments, startDate, endDate]);

  const statementNumber = useMemo(() => {
    const clientCode = (selectedClient?.name || 'SOA').substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
    return `SOA-${clientCode}-${endDate.replace(/-/g, '')}`;
  }, [selectedClient, endDate]);

  // Filtered ledger entries for interactive table view
  const displayLedgerEntries = useMemo(() => {
    if (statusFilter === 'ALL') return ledgerEntries;
    if (statusFilter === 'UNSETTLED') {
      return ledgerEntries.filter((e) => e.status === 'Unsettled' || e.status === 'Partially Settled');
    }
    if (statusFilter === 'SETTLED') {
      return ledgerEntries.filter((e) => e.status === 'Settled' || e.status === 'Payment');
    }
    return ledgerEntries;
  }, [ledgerEntries, statusFilter]);

  // Export PDF
  const handleDownloadPdf = async () => {
    const targetElement = modalPreviewRef.current || statementPreviewRef.current;
    if (!targetElement || !selectedClient) return;
    setIsGeneratingPdf(true);
    try {
      await generatePdfFromElement(
        targetElement,
        statementNumber,
        selectedClient.name,
        issueDate || endDate,
        { download: true }
      );
    } catch (err: any) {
      alert('Failed to export Statement PDF: ' + err.message);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Direct Print
  const handlePrint = () => {
    window.print();
  };

  // Share
  const handleShare = async () => {
    const targetElement = modalPreviewRef.current || statementPreviewRef.current;
    if (!targetElement || !selectedClient) return;
    setIsGeneratingPdf(true);
    try {
      const { blob, fileName } = await generatePdfFromElement(
        targetElement,
        statementNumber,
        selectedClient.name,
        issueDate || endDate,
        { download: false }
      );
      const shared = await shareDocumentPdf(
        blob,
        fileName,
        `Statement of Account: ${selectedClient.name} - Hotel Damview`,
        `Attached is the Statement of Account for ${selectedClient.name} covering ${startDate} to ${endDate}. Balance due: ${formatKsh(closingBalance)}.`
      );
      if (!shared) {
        handleDownloadPdf();
      }
    } catch (err) {
      console.warn('Share error:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] overflow-hidden bg-stone-100">
      {/* ACTION & FILTER TOOLBAR */}
      <div className="no-print bg-white border-b border-stone-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-sm font-bold text-stone-900 tracking-tight flex items-center gap-1.5">
            <FileSpreadsheet className="w-4 h-4 text-amber-700" />
            Statement of Accounts
          </h1>

          {/* Client selector */}
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-stone-400" />
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="text-xs border border-stone-300 rounded px-2.5 py-1 bg-stone-50 text-stone-900 font-semibold focus:outline-none focus:ring-1 focus:ring-stone-500"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.kraPin ? `(${c.kraPin})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Date range pickers */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-stone-500 font-medium">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-stone-300 rounded px-2 py-1 text-xs bg-white text-stone-800"
            />
            <span className="text-stone-500 font-medium">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-stone-300 rounded px-2 py-1 text-xs bg-white text-stone-800"
            />
          </div>

          {/* Editable Issue Date Picker */}
          <div className="flex items-center gap-1 text-xs bg-amber-50/80 border border-amber-300/80 px-2 py-0.5 rounded">
            <Calendar className="w-3.5 h-3.5 text-amber-800" />
            <span className="text-amber-900 font-bold">Issue Date:</span>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="border border-amber-300 rounded px-1.5 py-0.5 text-xs bg-white text-stone-900 font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Toolbar Actions */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Document Editor Trigger: New Invoice for Client */}
          {onNewDocumentForClient && selectedClient && (
            <button
              type="button"
              onClick={() => onNewDocumentForClient(selectedClient.id)}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded font-bold transition-colors shadow-2xs cursor-pointer"
              title="Open Document Editor to create a new Invoice for this client"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <FileText className="w-3.5 h-3.5" />
              <span>Create Invoice in Editor</span>
            </button>
          )}

          {onRecordPayment && (
            <button
              type="button"
              onClick={() => onRecordPayment(selectedClientId)}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 rounded font-semibold transition-colors cursor-pointer"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Record Payment</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsPdfPreviewModalOpen(true)}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 border border-stone-300 text-stone-800 rounded bg-stone-100 hover:bg-stone-200 font-semibold transition-colors shadow-2xs cursor-pointer"
            title="Open PDF Preview Modal with download, print, and share triggers"
          >
            <Eye className="w-3.5 h-3.5 text-amber-700" />
            <span>Preview Statement</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 border border-stone-300 text-stone-700 rounded bg-white hover:bg-stone-50 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-stone-600" />
            <span>Print</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-stone-900 text-amber-400 hover:bg-stone-800 rounded font-bold transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isGeneratingPdf ? 'Generating...' : 'Download Statement PDF'}</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 border border-stone-300 text-stone-700 rounded bg-white hover:bg-stone-50 transition-colors cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5 text-stone-600" />
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* Unified Continuous-Scroll Statement Workspace */}
      <div className="flex-1 overflow-y-auto bg-stone-100/60 p-4 md:p-6 space-y-6">
        {/* Top Section: Client Overview & Financial Summary & Ledger Table */}
        <div className="max-w-6xl mx-auto space-y-4">
          {/* Client Quick Overview Card with Document Editor Trigger */}
          <div className="bg-white border border-stone-200 rounded-lg p-4 shadow-xs text-xs space-y-3">
            <div className="flex flex-wrap justify-between items-start gap-2 border-b border-stone-200 pb-3">
              <div>
                <span className="font-bold text-stone-900 text-base">{selectedClient?.name}</span>
                {selectedClient?.kraPin && (
                  <div className="text-stone-600 font-medium">KRA PIN: {selectedClient.kraPin}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-1 rounded text-xs font-bold uppercase ${
                    closingBalance <= 0
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}
                >
                  {closingBalance <= 0 ? 'Settled (Ksh 0.00)' : `Owing: ${formatKsh(closingBalance)}`}
                </span>
                <span className="text-[11px] text-stone-500 font-medium">
                  Issue Date: <strong className="text-stone-800">{formatDate(issueDate)}</strong>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-stone-700 text-xs">
              <div>
                <span className="text-stone-500 block font-medium">Contact Person:</span>
                <span className="font-semibold text-stone-900">{selectedClient?.contactPerson || '-'}</span>
              </div>
              <div>
                <span className="text-stone-500 block font-medium">Phone:</span>
                <span className="font-semibold text-stone-900">{selectedClient?.phone || '-'}</span>
              </div>
              <div>
                <span className="text-stone-500 block font-medium">Email:</span>
                <span className="font-semibold text-stone-900">{selectedClient?.email || '-'}</span>
              </div>
              <div>
                <span className="text-stone-500 block font-medium">Address:</span>
                <span className="font-semibold text-stone-900">{selectedClient?.address || '-'}</span>
              </div>
            </div>
          </div>

          {/* Settlement Recognition Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white border border-stone-200 rounded-lg p-3.5 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-stone-500 block">Total Invoiced (Debits)</span>
              <span className="text-base font-bold text-stone-900 block mt-1">
                {formatKsh(totalDebit)}
              </span>
              <span className="text-[10px] text-stone-500 mt-0.5 block">
                {settledInvoicesCount + unsettledInvoicesCount} Total Invoices
              </span>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3.5 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-emerald-800 block">Settled Transactions</span>
              <span className="text-base font-bold text-emerald-900 block mt-1">
                {formatKsh(totalCredit)}
              </span>
              <span className="text-[10px] text-emerald-700 mt-0.5 block">
                {settledInvoicesCount} Fully Settled Invoices
              </span>
            </div>

            <div className="bg-rose-50/70 border border-rose-200 rounded-lg p-3.5 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-rose-800 block">Unsettled / Outstanding</span>
              <span className="text-base font-bold text-rose-950 block mt-1">
                {formatKsh(unsettledInvoicesTotal)}
              </span>
              <span className="text-[10px] text-rose-700 mt-0.5 block">
                {unsettledInvoicesCount} Unsettled {partialInvoicesCount > 0 ? `(${partialInvoicesCount} partial)` : ''}
              </span>
            </div>

            <div className="bg-stone-900 border border-stone-800 text-white rounded-lg p-3.5 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-amber-400 block">Net Statement Balance</span>
              <span className="text-base font-bold text-white block mt-1">
                {formatKsh(closingBalance)}
              </span>
              <span className="text-[10px] text-stone-300 mt-0.5 block">
                {closingBalance <= 0 ? 'Account is in good standing' : 'Payment settlement required'}
              </span>
            </div>
          </div>

          {/* Interactive Ledger Entries Table with Settlement Status Filters */}
          <div className="bg-white border border-stone-200 rounded-lg shadow-xs overflow-hidden">
            <div className="p-3.5 border-b border-stone-200 bg-stone-50/80 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold uppercase tracking-wider text-stone-800">
                  Ledger Transactions ({ledgerEntries.length})
                </span>
                <span className="text-stone-500 font-normal">
                  ({startDate} to {endDate})
                </span>
              </div>

              {/* Settlement Status Filter Pills */}
              <div className="inline-flex rounded-lg p-0.5 bg-stone-200/80 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    statusFilter === 'ALL'
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  All ({ledgerEntries.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('UNSETTLED')}
                  className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1 ${
                    statusFilter === 'UNSETTLED'
                      ? 'bg-rose-100 text-rose-900 shadow-xs font-bold'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                  <span>Unsettled ({unsettledInvoicesCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('SETTLED')}
                  className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1 ${
                    statusFilter === 'SETTLED'
                      ? 'bg-emerald-100 text-emerald-900 shadow-xs font-bold'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Settled</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              {displayLedgerEntries.length > 0 ? (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-stone-100 text-stone-700 font-semibold border-b border-stone-200">
                    <tr>
                      <th className="px-4 py-2.5">Date</th>
                      <th className="px-4 py-2.5">Reference #</th>
                      <th className="px-4 py-2.5">Particulars / Description</th>
                      <th className="px-4 py-2.5 text-center">Settlement Status</th>
                      <th className="px-4 py-2.5 text-right">Debit (Invoiced)</th>
                      <th className="px-4 py-2.5 text-right">Credit (Paid)</th>
                      <th className="px-4 py-2.5 text-right">Running Balance</th>
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {displayLedgerEntries.map((entry) => {
                      const invoiceDoc = documents.find(
                        (d) => d.documentNumber === entry.reference || d.id === entry.reference
                      );

                      return (
                        <tr key={entry.rowNumber} className="hover:bg-stone-50/80 transition-colors">
                          <td className="px-4 py-3 text-stone-600 whitespace-nowrap font-medium">{entry.date}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-mono font-bold text-stone-900 bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200">
                              {entry.reference}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-stone-800">{entry.description}</td>
                          
                          {/* Settlement Status column */}
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            {entry.status === 'Settled' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                Settled
                              </span>
                            )}
                            {entry.status === 'Partially Settled' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                <Clock className="w-3 h-3 text-amber-700" />
                                Partial ({formatKsh(invoiceDoc?.balanceDue || 0)})
                              </span>
                            )}
                            {entry.status === 'Unsettled' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
                                <AlertTriangle className="w-3 h-3 text-rose-700" />
                                Unsettled
                              </span>
                            )}
                            {entry.status === 'Payment' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-teal-50 text-teal-800 border border-teal-200">
                                Payment Credit
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right font-semibold text-stone-900 tabular-decimal whitespace-nowrap">
                            {entry.debit > 0 ? formatKsh(entry.debit) : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-700 tabular-decimal whitespace-nowrap">
                            {entry.credit > 0 ? formatKsh(entry.credit) : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-stone-950 tabular-decimal whitespace-nowrap">
                            {formatKsh(entry.cumulativeBalance)}
                          </td>
                          
                          {/* Row Actions: Settle / Edit */}
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1 justify-end">
                              {invoiceDoc && (entry.status === 'Unsettled' || entry.status === 'Partially Settled') && onRecordPayment && (
                                <button
                                  type="button"
                                  onClick={() => onRecordPayment(selectedClientId, invoiceDoc)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer shadow-2xs"
                                  title={`Record Payment Receipt for Invoice ${entry.reference}`}
                                >
                                  <CreditCard className="w-3 h-3" />
                                  <span>Settle / Pay</span>
                                </button>
                              )}
                              {invoiceDoc && onEditDocument && (
                                <button
                                  type="button"
                                  onClick={() => onEditDocument(invoiceDoc)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 transition-colors cursor-pointer"
                                  title={`Edit Invoice ${entry.reference} in Document Editor`}
                                >
                                  <Edit className="w-3 h-3" />
                                  <span>Edit</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-12 text-stone-400 text-xs italic">
                  No matching transactions found for the current filter criteria.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Section: Live Static Auto-Scaling A4 Statement of Account Preview */}
        {selectedClient && (
          <div className="max-w-6xl mx-auto">
            <AutoScalingA4Container
              title={`Live Static A4 Statement of Account: ${selectedClient.name}`}
              subtitle={`Official Hotel Damview Statement of Account • Issue Date: ${formatDate(issueDate)}`}
              documentNumber={statementNumber}
              actions={
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={isGeneratingPdf}
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded transition-colors shadow-2xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-stone-900 hover:bg-stone-800 text-amber-400 rounded transition-colors shadow-2xs cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleShare}
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 rounded transition-colors shadow-2xs cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share</span>
                  </button>
                </div>
              }
            >
              <A4StatementPreview
                ref={statementPreviewRef}
                client={selectedClient}
                profile={profile}
                startDate={startDate}
                endDate={endDate}
                statementNumber={statementNumber}
                issueDate={issueDate}
                entries={ledgerEntries}
                totalDebit={totalDebit}
                totalCredit={totalCredit}
                closingBalance={closingBalance}
                scale={1}
              />
            </AutoScalingA4Container>
          </div>
        )}
      </div>

      {/* FULL-SCREEN PDF PREVIEW MODAL */}
      {isPdfPreviewModalOpen && selectedClient && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex flex-col p-2 sm:p-4 animate-fade-in no-print">
          {/* Modal Header */}
          <div className="bg-white rounded-t-lg border border-stone-300 px-4 py-3 flex items-center justify-between shadow-md max-w-5xl mx-auto w-full shrink-0">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-amber-700" />
              <span className="font-bold text-stone-900 text-sm">
                Statement of Account: {statementNumber}
              </span>
              <span className="text-xs text-stone-500 hidden sm:inline">
                ({selectedClient.name} &bull; Issue Date: {formatDate(issueDate)} &bull; Balance: {formatKsh(closingBalance)})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-stone-950 rounded flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isGeneratingPdf ? 'Generating...' : 'Download Statement PDF'}</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="px-3 py-1.5 text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-800 rounded flex items-center gap-1 border border-stone-200 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
              <button
                type="button"
                onClick={handleShare}
                disabled={isGeneratingPdf}
                className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-stone-50 text-stone-700 border border-stone-300 rounded flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPdfPreviewModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded hover:bg-stone-100 transition-colors ml-1 cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal A4 Preview Body */}
          <div className="flex-1 overflow-auto bg-stone-800/90 rounded-b-lg p-6 flex justify-center items-start max-w-5xl mx-auto w-full">
            <div
              ref={modalPreviewRef}
              className="bg-white shadow-2xl origin-top"
              style={{
                transform: 'scale(0.85)',
                transformOrigin: 'top center',
              }}
            >
              <A4StatementPreview
                client={selectedClient}
                profile={profile}
                startDate={startDate}
                endDate={endDate}
                statementNumber={statementNumber}
                issueDate={issueDate}
                entries={ledgerEntries}
                totalDebit={totalDebit}
                totalCredit={totalCredit}
                closingBalance={closingBalance}
              />
            </div>
          </div>
        </div>
      )}

      {/* HIDDEN PRINT-ONLY CONTAINER */}
      {selectedClient && (
        <div className="print-only-container hidden print:block">
          <A4StatementPreview
            client={selectedClient}
            profile={profile}
            startDate={startDate}
            endDate={endDate}
            statementNumber={statementNumber}
            issueDate={issueDate}
            entries={ledgerEntries}
            totalDebit={totalDebit}
            totalCredit={totalCredit}
            closingBalance={closingBalance}
            isPrintVersion={true}
          />
        </div>
      )}
    </div>
  );
};
