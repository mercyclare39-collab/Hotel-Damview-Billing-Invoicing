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
  ArrowRightLeft,
  BookOpen,
  Receipt,
  FileCheck,
  ChevronRight,
  TrendingUp,
  MessageSquare,
} from 'lucide-react';
import {
  Client,
  BillingDocument,
  PaymentRecord,
  HotelProfile,
  LedgerEntry,
  StatementRecord,
  DocumentType,
} from '../types';
import { formatKsh, formatDate } from '../utils/formatters';
import { generatePdfFromElement, shareDocumentPdf, getStatementWhatsAppShareUrl, getWhatsAppShareUrl, getReceiptWhatsAppShareUrl } from '../utils/pdfGenerator';
import { dbService } from '../services/db';
import { localBackupService } from '../services/localBackupService';
import { syncManager } from '../services/sync';
import { exportTableToXlsx } from '../utils/excelExporter';
import { A4StatementPreview } from './A4StatementPreview';
import { AutoScalingA4Container } from './AutoScalingA4Container';
import { A4DocumentPreview } from './A4DocumentPreview';
import { A4ReceiptPreview } from './A4ReceiptPreview';

interface StatementOfAccountProps {
  clients: Client[];
  documents: BillingDocument[];
  payments: PaymentRecord[];
  profile: HotelProfile;
  initialClientId?: string;
  onRecordPayment?: (clientId: string, doc?: BillingDocument) => void;
  onEditDocument?: (doc: BillingDocument) => void;
  onConvertDocument?: (doc: BillingDocument, targetType: DocumentType) => void;
  onNewDocumentForClient?: (clientId: string) => void;
}

type JournalFilterType = 'ALL' | 'QUOTATION' | 'PROFORMA' | 'INVOICE' | 'RECEIPT';

interface JournalRecordItem {
  id: string;
  date: string;
  type: 'QUOTATION' | 'PROFORMA' | 'INVOICE' | 'RECEIPT';
  documentNumber: string;
  clientId: string;
  clientName: string;
  particularsSummary: string;
  amount: number;
  amountPaid?: number;
  balanceDue?: number;
  status: string;
  notes?: string;
  rawDoc?: BillingDocument;
  rawPayment?: PaymentRecord;
}

export const StatementOfAccount: React.FC<StatementOfAccountProps> = ({
  clients,
  documents,
  payments,
  profile,
  initialClientId,
  onRecordPayment,
  onEditDocument,
  onConvertDocument,
  onNewDocumentForClient,
}) => {
  const [selectedClientId, setSelectedClientId] = useState<string>(
    initialClientId || (clients[0]?.id ?? '')
  );

  // Active Main View: 'journal' for Document Journal, 'ledger' for Financial Ledger & Statement
  const [activeView, setActiveView] = useState<'journal' | 'ledger'>('journal');

  // Default date range: first day of current month to today
  const defaultStartDate = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  }, []);

  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(formatDate());
  // Editable statement issue date
  const [issueDate, setIssueDate] = useState(formatDate());
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNSETTLED' | 'SETTLED'>('ALL');
  const [docTypeFilter, setDocTypeFilter] = useState<JournalFilterType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isPdfPreviewModalOpen, setIsPdfPreviewModalOpen] = useState(false);

  // Preview Modal state for individual Journal records
  const [previewItem, setPreviewItem] = useState<{
    type: 'DOCUMENT' | 'RECEIPT';
    doc?: BillingDocument;
    payment?: PaymentRecord;
  } | null>(null);

  const statementPreviewRef = useRef<HTMLDivElement>(null);
  const modalPreviewRef = useRef<HTMLDivElement>(null);
  const itemModalPreviewRef = useRef<HTMLDivElement>(null);

  const selectedClient = useMemo(() => {
    if (!selectedClientId) return null;
    return clients.find((c) => c.id === selectedClientId) || null;
  }, [clients, selectedClientId]);

  // =========================================================================
  // 1. FINANCIAL LEDGER COMPUTATIONS (For selected client)
  // =========================================================================
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

    const clientInvoices = documents.filter(
      (d) =>
        d.clientId === selectedClient.id &&
        d.documentType === 'INVOICE' &&
        d.issueDate >= startDate &&
        d.issueDate <= endDate
    );

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
        description: `Invoice: ${
          inv.lineItems?.map((li) => li.particulars).filter(Boolean).join(', ') ||
          'Hospitality Services'
        }`,
        debit: inv.grandTotal,
        credit: 0,
        status: txStatus,
        doc: inv,
      });
    });

    clientPayments.forEach((p) => {
      rawTxs.push({
        date: p.date,
        reference: p.receiptNumber,
        description: `Payment Settled - ${p.documentNumber || 'Direct'} (${p.paymentMode}${
          p.referenceNote ? `: ${p.referenceNote}` : ''
        })`,
        debit: 0,
        credit: p.amount,
        status: 'Payment',
      });
    });

    // Chronological Sort
    rawTxs.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.debit > 0 && b.credit > 0) return -1;
      return a.reference.localeCompare(b.reference);
    });

    let runningBalance = 0;
    let sumDebit = 0;
    let sumCredit = 0;

    const entries: LedgerEntry[] = rawTxs.map((tx, idx) => {
      runningBalance += tx.debit - tx.credit;
      sumDebit += tx.debit;
      sumCredit += tx.credit;

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
    const clientCode = (selectedClient?.name || 'SOA')
      .substring(0, 3)
      .toUpperCase()
      .replace(/[^A-Z]/g, 'X');
    return `SOA-${clientCode}-${endDate.replace(/-/g, '')}`;
  }, [selectedClient, endDate]);

  const displayLedgerEntries = useMemo(() => {
    if (statusFilter === 'ALL') return ledgerEntries;
    if (statusFilter === 'UNSETTLED') {
      return ledgerEntries.filter(
        (e) => e.status === 'Unsettled' || e.status === 'Partially Settled'
      );
    }
    if (statusFilter === 'SETTLED') {
      return ledgerEntries.filter((e) => e.status === 'Settled' || e.status === 'Payment');
    }
    return ledgerEntries;
  }, [ledgerEntries, statusFilter]);

  // =========================================================================
  // 2. DOCUMENT JOURNAL COMPUTATIONS (All documents & receipts)
  // =========================================================================
  const journalRecords = useMemo<JournalRecordItem[]>(() => {
    const records: JournalRecordItem[] = [];

    // Filter documents by client (if selected) and date range
    const clientDocs = documents.filter((d) => {
      const matchClient = !selectedClientId || d.clientId === selectedClientId;
      const matchDate =
        (!startDate || d.issueDate >= startDate) && (!endDate || d.issueDate <= endDate);
      return matchClient && matchDate;
    });

    clientDocs.forEach((d) => {
      const summary =
        d.lineItems?.map((li) => li.particulars).filter(Boolean).join(', ') || 'No line items';
      records.push({
        id: d.id,
        date: d.issueDate,
        type: d.documentType,
        documentNumber: d.documentNumber,
        clientId: d.clientId,
        clientName: d.clientName,
        particularsSummary: summary,
        amount: d.grandTotal,
        amountPaid: d.amountPaid,
        balanceDue: d.balanceDue,
        status: d.status,
        notes: d.notes,
        rawDoc: d,
      });
    });

    // Filter payments/receipts by client (if selected) and date range
    const clientPayments = payments.filter((p) => {
      const matchClient = !selectedClientId || p.clientId === selectedClientId;
      const matchDate = (!startDate || p.date >= startDate) && (!endDate || p.date <= endDate);
      return matchClient && matchDate;
    });

    clientPayments.forEach((p) => {
      records.push({
        id: p.id,
        date: p.date,
        type: 'RECEIPT',
        documentNumber: p.receiptNumber,
        clientId: p.clientId,
        clientName: p.clientName,
        particularsSummary: `Payment for ${p.documentNumber || 'Settlement'} via ${p.paymentMode}${
          p.referenceNote ? ` (${p.referenceNote})` : ''
        }`,
        amount: p.amount,
        status: 'Settled',
        notes: p.referenceNote,
        rawPayment: p,
      });
    });

    // Sort chronologically descending (newest first)
    return records.sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return b.documentNumber.localeCompare(a.documentNumber);
    });
  }, [documents, payments, selectedClientId, startDate, endDate]);

  const filteredJournalRecords = useMemo(() => {
    return journalRecords.filter((rec) => {
      if (docTypeFilter !== 'ALL' && rec.type !== docTypeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const inNum = rec.documentNumber.toLowerCase().includes(q);
        const inPart = rec.particularsSummary.toLowerCase().includes(q);
        const inNotes = (rec.notes || '').toLowerCase().includes(q);
        const inClient = rec.clientName.toLowerCase().includes(q);
        if (!inNum && !inPart && !inNotes && !inClient) return false;
      }
      return true;
    });
  }, [journalRecords, docTypeFilter, searchQuery]);

  // Journal metrics
  const journalMetrics = useMemo(() => {
    let quotesCount = 0;
    let quotesTotal = 0;
    let proformasCount = 0;
    let proformasTotal = 0;
    let invoicesCount = 0;
    let invoicesTotal = 0;
    let receiptsCount = 0;
    let receiptsTotal = 0;

    journalRecords.forEach((r) => {
      if (r.type === 'QUOTATION') {
        quotesCount++;
        quotesTotal += r.amount;
      } else if (r.type === 'PROFORMA') {
        proformasCount++;
        proformasTotal += r.amount;
      } else if (r.type === 'INVOICE') {
        invoicesCount++;
        invoicesTotal += r.amount;
      } else if (r.type === 'RECEIPT') {
        receiptsCount++;
        receiptsTotal += r.amount;
      }
    });

    return {
      quotesCount,
      quotesTotal,
      proformasCount,
      proformasTotal,
      invoicesCount,
      invoicesTotal,
      receiptsCount,
      receiptsTotal,
      totalCount: journalRecords.length,
    };
  }, [journalRecords]);

  // =========================================================================
  // 3. ACTIONS & EXPORTS
  // =========================================================================
  const handleDownloadStatementPdf = async () => {
    const targetElement = modalPreviewRef.current || statementPreviewRef.current;
    if (!targetElement || !selectedClient) return;
    setIsGeneratingPdf(true);
    try {
      const pdfRes = await generatePdfFromElement(
        targetElement,
        statementNumber,
        selectedClient.name,
        issueDate || endDate,
        { download: true }
      );

      // Persist StatementRecord to IndexedDB
      const stmtRecord: StatementRecord = {
        id: `soa-${Date.now()}`,
        statementNumber,
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        clientKraPin: selectedClient.kraPin,
        issueDate: issueDate || endDate,
        startDate,
        endDate,
        totalDebit,
        totalCredit,
        closingBalance,
        entriesCount: ledgerEntries.length,
        pdfGenerated: true,
        createdAt: new Date().toISOString(),
      };
      await dbService.saveStatement(stmtRecord);

      // Background Dual-Tier Mirroring (Local Filesystem & Google Drive)
      if (pdfRes.blob) {
        localBackupService
          .mirrorDocumentDualLocalBackup(
            pdfRes.blob,
            pdfRes.fileName,
            stmtRecord,
            statementNumber
          )
          .catch((err) => console.warn('Local statement backup warning:', err));

        syncManager
          .archiveStatementPdf(stmtRecord, pdfRes.base64, pdfRes.fileName)
          .catch((err) => console.warn('Google Drive statement sync warning:', err));
      }
    } catch (err: any) {
      console.error('Failed to export Statement PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    setIsPdfPreviewModalOpen(true);
    setTimeout(() => {
      window.print();
    }, 250);
  };

  const handleShare = async () => {
    const targetElement = modalPreviewRef.current || statementPreviewRef.current;
    if (!targetElement || !selectedClient) return;
    setIsPdfPreviewModalOpen(true);
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
        `Statement of Account: ${selectedClient.name} - ${profile.name}`,
        `Attached is the Statement of Account for ${selectedClient.name} covering ${startDate} to ${endDate}. Balance due: ${formatKsh(
          closingBalance
        )}.`
      );
      if (!shared) {
        handleWhatsAppStatement();
      }
    } catch (err) {
      console.warn('Share error:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleWhatsAppStatement = () => {
    if (!selectedClient) return;
    setIsPdfPreviewModalOpen(true);
    const waUrl = getStatementWhatsAppShareUrl(
      {
        statementNumber,
        clientName: selectedClient.name,
        startDate,
        endDate,
        closingBalance,
        totalDebit,
        totalCredit,
      },
      profile,
      selectedClient.phone
    );
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleWhatsAppItem = () => {
    if (!previewItem) return;
    if (previewItem.type === 'DOCUMENT' && previewItem.doc) {
      const waUrl = getWhatsAppShareUrl(
        previewItem.doc,
        profile,
        previewItem.doc.clientPhone,
        previewItem.doc.driveFileUrl
      );
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    } else if (previewItem.type === 'RECEIPT' && previewItem.payment) {
      const waUrl = getReceiptWhatsAppShareUrl(
        previewItem.payment,
        profile,
        undefined,
        previewItem.payment.driveFileUrl
      );
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDownloadItemPdf = async () => {
    if (!itemModalPreviewRef.current || !previewItem) return;
    setIsGeneratingPdf(true);
    try {
      const number =
        previewItem.type === 'DOCUMENT'
          ? previewItem.doc?.documentNumber || 'DOCUMENT'
          : previewItem.payment?.receiptNumber || 'RECEIPT';
      const client =
        previewItem.type === 'DOCUMENT'
          ? previewItem.doc?.clientName || 'Client'
          : previewItem.payment?.clientName || 'Client';
      const date =
        previewItem.type === 'DOCUMENT'
          ? previewItem.doc?.issueDate || formatDate()
          : previewItem.payment?.date || formatDate();

      await generatePdfFromElement(itemModalPreviewRef.current, number, client, date, {
        download: true,
      });
    } catch (err: any) {
      console.error('Download item PDF failed:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] overflow-hidden bg-stone-100">
      {/* 1. MASTER TOOLBAR: Mode Switcher, Client & Date Range, Quick Triggers */}
      <div className="no-print bg-white border-b border-stone-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          {/* Main View Switcher: Document Journal vs. Financial Ledger */}
          <div className="inline-flex rounded-lg p-0.5 bg-stone-200/90 text-xs font-semibold shadow-inner">
            <button
              type="button"
              onClick={() => setActiveView('journal')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                activeView === 'journal'
                  ? 'bg-stone-900 text-amber-400 shadow-xs'
                  : 'text-stone-700 hover:text-stone-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Document Journal</span>
              <span className="text-[10px] bg-stone-800 text-amber-300 px-1.5 py-0.2 rounded-full">
                {journalRecords.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('ledger')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                activeView === 'ledger'
                  ? 'bg-stone-900 text-amber-400 shadow-xs'
                  : 'text-stone-700 hover:text-stone-900'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Statement & Ledger</span>
            </button>
          </div>

          {/* Client Filter Dropdown */}
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-stone-400" />
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="text-xs border border-stone-300 rounded px-2.5 py-1.5 bg-stone-50 text-stone-900 font-semibold focus:outline-none focus:ring-1 focus:ring-stone-500"
            >
              <option value="">All Clients (Aggregated Journal)</option>
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

          {/* Editable Issue Date Picker for SOA */}
          {activeView === 'ledger' && (
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
          )}
        </div>

        {/* Streamlined Action Triggers (Zero redundancy) */}
        <div className="flex flex-wrap items-center gap-1.5">
          {onNewDocumentForClient && selectedClient && (
            <button
              type="button"
              onClick={() => onNewDocumentForClient(selectedClient.id)}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded font-bold transition-colors shadow-2xs cursor-pointer"
              title="Open Document Editor to create a new Invoice for this client"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <FileText className="w-3.5 h-3.5" />
              <span>Create Invoice</span>
            </button>
          )}

          {onRecordPayment && selectedClient && (
            <button
              type="button"
              onClick={() => onRecordPayment(selectedClient.id)}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 rounded font-semibold transition-colors cursor-pointer"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Record Payment</span>
            </button>
          )}

          {activeView === 'ledger' && selectedClient && (
            <>
              <button
                type="button"
                onClick={async () => {
                  if (ledgerEntries.length === 0) {
                    alert('No ledger transactions to export.');
                    return;
                  }
                  const columns = [
                    { header: 'Date', key: 'date', type: 'date' as const, width: 13 },
                    { header: 'Particulars / Description', key: 'description', type: 'text' as const, width: 35 },
                    { header: 'Ref / Doc #', key: 'reference', type: 'code' as const, width: 16 },
                    { header: 'Debit (Invoiced Ksh)', key: 'debit', type: 'currency' as const, width: 18 },
                    { header: 'Credit (Paid Ksh)', key: 'credit', type: 'currency' as const, width: 18 },
                    { header: 'Running Balance (Ksh)', key: 'balance', type: 'currency' as const, width: 18 },
                  ];

                  const data = ledgerEntries.map((e) => ({
                    date: e.date,
                    description: e.description,
                    reference: e.reference || '-',
                    debit: e.debit,
                    credit: e.credit,
                    balance: e.cumulativeBalance,
                  }));

                  await exportTableToXlsx({
                    title: `Statement of Account — ${selectedClient.name}`,
                    sheetName: 'SOA_Ledger',
                    profile,
                    columns,
                    data,
                    filename: `HotelDamview_SOA_${selectedClient.name.replace(/[^a-zA-Z0-9]/g, '_')}_${formatDate()}.xlsx`,
                  });
                }}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 border border-stone-300 text-stone-800 rounded bg-white hover:bg-stone-50 font-semibold transition-colors cursor-pointer"
                title="Export Statement Ledger to Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export Excel (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPdfPreviewModalOpen(true)}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 border border-stone-300 text-stone-800 rounded bg-stone-100 hover:bg-stone-200 font-semibold transition-colors shadow-2xs cursor-pointer"
                title="Open Statement PDF Preview Modal"
              >
                <Eye className="w-3.5 h-3.5 text-amber-700" />
                <span>Preview Statement</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadStatementPdf}
                disabled={isGeneratingPdf}
                className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-stone-900 text-amber-400 hover:bg-stone-800 rounded font-bold transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isGeneratingPdf ? 'Generating...' : 'Download Statement PDF'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. MAIN WORKSPACE CONTENT */}
      <div className="flex-1 overflow-y-auto bg-stone-100/60 p-4 md:p-6 space-y-6">
        {/* ================================================================= */}
        {/* VIEW 1: COMPREHENSIVE DOCUMENT JOURNAL                           */}
        {/* ================================================================= */}
        {activeView === 'journal' && (
          <div className="max-w-6xl mx-auto space-y-4">
            {/* Journal Metrics Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white border border-stone-200 rounded-lg p-3.5 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-stone-500 block">
                  Quotations Issued
                </span>
                <span className="text-base font-bold text-purple-900 block mt-1">
                  {formatKsh(journalMetrics.quotesTotal)}
                </span>
                <span className="text-[10px] text-stone-500 mt-0.5 block">
                  {journalMetrics.quotesCount} Quote Documents
                </span>
              </div>

              <div className="bg-white border border-stone-200 rounded-lg p-3.5 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-stone-500 block">
                  Proformas Generated
                </span>
                <span className="text-base font-bold text-amber-900 block mt-1">
                  {formatKsh(journalMetrics.proformasTotal)}
                </span>
                <span className="text-[10px] text-stone-500 mt-0.5 block">
                  {journalMetrics.proformasCount} Proforma Invoices
                </span>
              </div>

              <div className="bg-white border border-stone-200 rounded-lg p-3.5 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-stone-500 block">
                  Invoices Billed
                </span>
                <span className="text-base font-bold text-stone-900 block mt-1">
                  {formatKsh(journalMetrics.invoicesTotal)}
                </span>
                <span className="text-[10px] text-stone-500 mt-0.5 block">
                  {journalMetrics.invoicesCount} Total Invoices
                </span>
              </div>

              <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3.5 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                  Receipts Settled
                </span>
                <span className="text-base font-bold text-emerald-900 block mt-1">
                  {formatKsh(journalMetrics.receiptsTotal)}
                </span>
                <span className="text-[10px] text-emerald-700 mt-0.5 block">
                  {journalMetrics.receiptsCount} Paid Receipts
                </span>
              </div>
            </div>

            {/* Filter & Search Bar for Document Journal */}
            <div className="bg-white border border-stone-200 rounded-lg p-3 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
              {/* Type Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-stone-500 font-semibold mr-1 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" />
                  Type:
                </span>
                {[
                  { id: 'ALL', label: `All (${journalMetrics.totalCount})` },
                  { id: 'QUOTATION', label: `Quotations (${journalMetrics.quotesCount})` },
                  { id: 'PROFORMA', label: `Proformas (${journalMetrics.proformasCount})` },
                  { id: 'INVOICE', label: `Invoices (${journalMetrics.invoicesCount})` },
                  { id: 'RECEIPT', label: `Receipts (${journalMetrics.receiptsCount})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setDocTypeFilter(tab.id as JournalFilterType)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                      docTypeFilter === tab.id
                        ? 'bg-stone-900 text-amber-400 shadow-xs'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Journal Search Input */}
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  placeholder="Filter by ref #, client, particulars..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-stone-300 rounded bg-stone-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Chronological Document Journal Grid */}
            <div className="bg-white border border-stone-200 rounded-lg shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                {filteredJournalRecords.length > 0 ? (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-stone-100 text-stone-700 font-semibold border-b border-stone-200">
                      <tr>
                        <th className="px-3.5 py-2.5">Date</th>
                        <th className="px-3 py-2.5 text-center">Type</th>
                        <th className="px-3.5 py-2.5">Document #</th>
                        <th className="px-3.5 py-2.5">Client</th>
                        <th className="px-3.5 py-2.5">Particulars / Summary</th>
                        <th className="px-3.5 py-2.5 text-right">Amount (Ksh)</th>
                        <th className="px-3 py-2.5 text-center">Status</th>
                        <th className="px-3.5 py-2.5 text-right">One-Click Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {filteredJournalRecords.map((rec) => {
                        const isQuoteOrProforma =
                          rec.type === 'QUOTATION' || rec.type === 'PROFORMA';
                        const isInvoice = rec.type === 'INVOICE';
                        const isReceipt = rec.type === 'RECEIPT';
                        const isUnsettledInvoice =
                          isInvoice && (rec.balanceDue === undefined || rec.balanceDue > 0);

                        return (
                          <tr key={rec.id} className="hover:bg-amber-50/20 transition-colors">
                            <td className="px-3.5 py-2.5 text-stone-600 whitespace-nowrap font-medium">
                              {rec.date}
                            </td>

                            {/* Type Badge */}
                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  rec.type === 'QUOTATION'
                                    ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                    : rec.type === 'PROFORMA'
                                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                    : rec.type === 'INVOICE'
                                    ? 'bg-slate-100 text-slate-900 border border-slate-300'
                                    : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                                }`}
                              >
                                {rec.type}
                              </span>
                            </td>

                            {/* Document Reference # */}
                            <td className="px-3.5 py-2.5 whitespace-nowrap">
                              <span className="font-mono font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                                {rec.documentNumber}
                              </span>
                            </td>

                            {/* Client Name */}
                            <td className="px-3.5 py-2.5 font-semibold text-stone-900 whitespace-nowrap">
                              {rec.clientName}
                            </td>

                            {/* Particulars Summary */}
                            <td className="px-3.5 py-2.5 text-stone-700 max-w-xs truncate" title={rec.particularsSummary}>
                              {rec.particularsSummary}
                            </td>

                            {/* Amount */}
                            <td className="px-3.5 py-2.5 text-right font-mono font-bold text-stone-900 whitespace-nowrap">
                              {formatKsh(rec.amount)}
                            </td>

                            {/* Status */}
                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  rec.status === 'Paid' || rec.status === 'Settled'
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : rec.status === 'Partially Settled'
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                    : rec.status === 'Sent'
                                    ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                    : 'bg-stone-100 text-stone-700 border border-stone-200'
                                }`}
                              >
                                {rec.status}
                              </span>
                            </td>

                            {/* Action Buttons */}
                            <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5 justify-end">
                                {/* Preview Trigger */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (rec.rawDoc) {
                                      setPreviewItem({ type: 'DOCUMENT', doc: rec.rawDoc });
                                    } else if (rec.rawPayment) {
                                      setPreviewItem({
                                        type: 'RECEIPT',
                                        payment: rec.rawPayment,
                                      });
                                    }
                                  }}
                                  className="p-1 rounded text-stone-600 hover:text-amber-700 hover:bg-stone-100 transition-colors"
                                  title="Live A4 Preview"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>

                                {/* Edit Trigger (for quotes, proformas, invoices) */}
                                {rec.rawDoc && onEditDocument && (
                                  <button
                                    type="button"
                                    onClick={() => onEditDocument(rec.rawDoc!)}
                                    className="p-1 rounded text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors"
                                    title="Edit in Document Editor"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {/* Convert to Invoice Trigger (for quotes & proformas) */}
                                {isQuoteOrProforma && rec.rawDoc && onConvertDocument && (
                                  <button
                                    type="button"
                                    onClick={() => onConvertDocument(rec.rawDoc!, 'INVOICE')}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 transition-colors"
                                    title="Convert directly to Invoice"
                                  >
                                    <ArrowRightLeft className="w-3 h-3" />
                                    <span>To Invoice</span>
                                  </button>
                                )}

                                {/* Record Payment / Settle Trigger (for unpaid invoices) */}
                                {isUnsettledInvoice && rec.rawDoc && onRecordPayment && (
                                  <button
                                    type="button"
                                    onClick={() => onRecordPayment(rec.clientId, rec.rawDoc)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-2xs cursor-pointer"
                                    title="Record payment receipt"
                                  >
                                    <CreditCard className="w-3 h-3" />
                                    <span>Settle</span>
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
                    No matching journal documents found for the selected criteria.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* VIEW 2: STATEMENT OF ACCOUNT & FINANCIAL LEDGER                   */}
        {/* ================================================================= */}
        {activeView === 'ledger' && selectedClient && (
          <div className="max-w-6xl mx-auto space-y-4">
            {/* Client Quick Overview Card */}
            <div className="bg-white border border-stone-200 rounded-lg p-4 shadow-xs text-xs space-y-3">
              <div className="flex flex-wrap justify-between items-start gap-2 border-b border-stone-200 pb-3">
                <div>
                  <span className="font-bold text-stone-900 text-base">{selectedClient.name}</span>
                  {selectedClient.kraPin && (
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
                  <span className="font-semibold text-stone-900">
                    {selectedClient.contactPerson || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block font-medium">Phone:</span>
                  <span className="font-semibold text-stone-900">{selectedClient.phone || '-'}</span>
                </div>
                <div>
                  <span className="text-stone-500 block font-medium">Email:</span>
                  <span className="font-semibold text-stone-900">{selectedClient.email || '-'}</span>
                </div>
                <div>
                  <span className="text-stone-500 block font-medium">Address:</span>
                  <span className="font-semibold text-stone-900">{selectedClient.address || '-'}</span>
                </div>
              </div>
            </div>

            {/* Settlement Recognition Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white border border-stone-200 rounded-lg p-3.5 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-stone-500 block">
                  Total Invoiced (Debits)
                </span>
                <span className="text-base font-bold text-stone-900 block mt-1">
                  {formatKsh(totalDebit)}
                </span>
                <span className="text-[10px] text-stone-500 mt-0.5 block">
                  {settledInvoicesCount + unsettledInvoicesCount} Total Invoices
                </span>
              </div>

              <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3.5 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                  Settled Transactions
                </span>
                <span className="text-base font-bold text-emerald-900 block mt-1">
                  {formatKsh(totalCredit)}
                </span>
                <span className="text-[10px] text-emerald-700 mt-0.5 block">
                  {settledInvoicesCount} Fully Settled Invoices
                </span>
              </div>

              <div className="bg-rose-50/70 border border-rose-200 rounded-lg p-3.5 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-rose-800 block">
                  Unsettled / Outstanding
                </span>
                <span className="text-base font-bold text-rose-950 block mt-1">
                  {formatKsh(unsettledInvoicesTotal)}
                </span>
                <span className="text-[10px] text-rose-700 mt-0.5 block">
                  {unsettledInvoicesCount} Unsettled{' '}
                  {partialInvoicesCount > 0 ? `(${partialInvoicesCount} partial)` : ''}
                </span>
              </div>

              <div className="bg-stone-900 border border-stone-800 text-white rounded-lg p-3.5 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-amber-400 block">
                  Net Statement Balance
                </span>
                <span className="text-base font-bold text-white block mt-1">
                  {formatKsh(closingBalance)}
                </span>
                <span className="text-[10px] text-stone-300 mt-0.5 block">
                  {closingBalance <= 0
                    ? 'Account is in good standing'
                    : 'Payment settlement required'}
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
                          <tr
                            key={entry.rowNumber}
                            className="hover:bg-stone-50/80 transition-colors"
                          >
                            <td className="px-4 py-3 text-stone-600 whitespace-nowrap font-medium">
                              {entry.date}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="font-mono font-bold text-stone-900 bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200">
                                {entry.reference}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-stone-800">{entry.description}</td>

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

                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1 justify-end">
                                {invoiceDoc &&
                                  (entry.status === 'Unsettled' ||
                                    entry.status === 'Partially Settled') &&
                                  onRecordPayment && (
                                    <button
                                      type="button"
                                      onClick={() => onRecordPayment(selectedClient.id, invoiceDoc)}
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

            {/* Live Auto-Scaling A4 Statement of Account Container */}
            <div className="pt-2">
              <AutoScalingA4Container hideHeaderBar={true}>
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
          </div>
        )}

        {/* Prompt when in ledger view without a selected client */}
        {activeView === 'ledger' && !selectedClient && (
          <div className="max-w-md mx-auto text-center py-16 bg-white border border-stone-200 rounded-lg p-6 shadow-xs space-y-3">
            <User className="w-8 h-8 text-amber-600 mx-auto" />
            <h2 className="text-sm font-bold text-stone-900">Select a Client</h2>
            <p className="text-xs text-stone-600">
              Please choose a client from the dropdown above to view their financial ledger and
              generate their Statement of Account.
            </p>
          </div>
        )}
      </div>

      {/* FULL-SCREEN STATEMENT PDF PREVIEW MODAL */}
      {isPdfPreviewModalOpen && selectedClient && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex flex-col p-2 sm:p-4 animate-fade-in no-print">
          <div className="bg-white rounded-t-lg border border-stone-300 px-4 py-3 flex items-center justify-between shadow-md max-w-5xl mx-auto w-full shrink-0">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-amber-700" />
              <span className="font-bold text-stone-900 text-sm">
                Statement of Account: {statementNumber}
              </span>
              <span className="text-xs text-stone-500 hidden sm:inline">
                ({selectedClient.name} &bull; Issue Date: {formatDate(issueDate)} &bull; Balance:{' '}
                {formatKsh(closingBalance)})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleWhatsAppStatement}
                className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                title="Send Statement of Account via WhatsApp"
              >
                <MessageSquare className="w-3.5 h-3.5 text-white" />
                <span className="hidden sm:inline">WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadStatementPdf}
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

      {/* JOURNAL RECORD PREVIEW MODAL (Document or Receipt) */}
      {previewItem && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex flex-col p-2 sm:p-4 animate-fade-in no-print">
          <div className="bg-white rounded-t-lg border border-stone-300 px-4 py-3 flex items-center justify-between shadow-md max-w-5xl mx-auto w-full shrink-0">
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-amber-700" />
              <span className="font-bold text-stone-900 text-sm">
                Preview:{' '}
                {previewItem.type === 'DOCUMENT'
                  ? previewItem.doc?.documentNumber
                  : previewItem.payment?.receiptNumber}
              </span>
              <span className="text-xs text-stone-500 hidden sm:inline">
                (
                {previewItem.type === 'DOCUMENT'
                  ? previewItem.doc?.clientName
                  : previewItem.payment?.clientName}
                )
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleWhatsAppItem}
                className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                title="Send Document / Receipt via WhatsApp"
              >
                <MessageSquare className="w-3.5 h-3.5 text-white" />
                <span className="hidden sm:inline">WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadItemPdf}
                disabled={isGeneratingPdf}
                className="px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-stone-950 rounded flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isGeneratingPdf ? 'Generating...' : 'Download PDF'}</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-800 rounded flex items-center gap-1 border border-stone-200 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded hover:bg-stone-100 transition-colors ml-1 cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-stone-800/90 rounded-b-lg p-6 flex justify-center items-start max-w-5xl mx-auto w-full">
            <div
              ref={itemModalPreviewRef}
              className="bg-white shadow-2xl origin-top"
              style={{
                transform: 'scale(0.85)',
                transformOrigin: 'top center',
              }}
            >
              {previewItem.type === 'DOCUMENT' && previewItem.doc && (
                <A4DocumentPreview document={previewItem.doc} profile={profile} scale={1} />
              )}
              {previewItem.type === 'RECEIPT' && previewItem.payment && (
                <A4ReceiptPreview payment={previewItem.payment} profile={profile} scale={1} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* HIDDEN PRINT-ONLY CONTAINER FOR STATEMENT */}
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
