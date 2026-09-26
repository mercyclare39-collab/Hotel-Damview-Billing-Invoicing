import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Eye,
  Edit,
  Trash2,
  Download,
  Printer,
  CreditCard,
  ArrowRightLeft,
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileText,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Share2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { BillingDocument, DocumentType, DocumentStatus, HotelProfile } from '../types';
import { formatKsh, formatDate } from '../utils/formatters';
import {
  generatePdfFromElement,
  universalSharePdfDocument,
  getDocumentOperationalSummary,
  printPdfBlob,
} from '../utils/pdfGenerator';
import { A4DocumentPreview } from './A4DocumentPreview';
import { DocumentPropagationParityModal } from './DocumentPropagationParityModal';
import { usePersistentSort, SortableHeader } from '../hooks/usePersistentSort';
import { DocumentStatusDropdown } from './DocumentStatusDropdown';
import { dbService } from '../services/db';
import { usePropagationVariances } from '../hooks/usePropagationVariances';

interface DocumentJournalProps {
  documents: BillingDocument[];
  profile: HotelProfile;
  onNewDocument: (type?: DocumentType) => void;
  onEditDocument: (doc: BillingDocument) => void;
  onDeleteDocument: (docId: string) => void;
  onRecordPayment: (doc: BillingDocument) => void;
  onConvertDocument: (sourceDoc: BillingDocument, targetType: DocumentType) => void;
  onSaveDocument?: (doc: BillingDocument) => void;
}

export const DocumentJournal: React.FC<DocumentJournalProps> = ({
  documents,
  profile,
  onNewDocument,
  onEditDocument,
  onDeleteDocument,
  onRecordPayment,
  onConvertDocument,
  onSaveDocument,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | DocumentType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | DocumentStatus | 'VARIANCE'>('ALL');
  const [selectedDocForPreview, setSelectedDocForPreview] = useState<BillingDocument | null>(null);
  const [parityModalDoc, setParityModalDoc] = useState<BillingDocument | null>(null);
  const [isParityModalOpen, setIsParityModalOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isResolvingAll, setIsResolvingAll] = useState(false);
  const [isResolvingDocId, setIsResolvingDocId] = useState<string | null>(null);
  const pageSize = 25;

  const {
    hasVariance,
    getVariance,
    autoResolveDocument,
    autoResolveAll,
    activeVariancesCount,
  } = usePropagationVariances();

  // Persistent multi-column table sorting hook
  const { sortConfig, toggleSort, sortData } = usePersistentSort<BillingDocument>(
    'document_journal',
    'issueDate',
    'desc'
  );

  // Status override handler
  const handleStatusChange = async (doc: BillingDocument, newStatus: DocumentStatus, isManual: boolean) => {
    const updated: BillingDocument = {
      ...doc,
      status: newStatus,
      isManualStatusOverride: isManual,
      updatedAt: new Date().toISOString(),
    };
    if (onSaveDocument) {
      onSaveDocument(updated);
    } else {
      await dbService.saveDocument(updated);
    }
  };

  // Memoized Filtered document list for zero-jank searching and filtering
  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      // Type filter
      if (typeFilter !== 'ALL' && doc.documentType !== typeFilter) return false;
      // Status & Variance filter
      if (statusFilter === 'VARIANCE') {
        if (!hasVariance(doc.documentNumber)) return false;
      } else if (statusFilter !== 'ALL' && doc.status !== statusFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNum = doc.documentNumber.toLowerCase().includes(q);
        const matchClient = doc.clientName.toLowerCase().includes(q);
        const matchPin = (doc.clientKraPin || '').toLowerCase().includes(q);
        return matchNum || matchClient || matchPin;
      }
      return true;
    });
  }, [documents, typeFilter, statusFilter, searchQuery, hasVariance]);

  // Sort filtered documents using persistent multi-column sorting
  const sortedDocs = useMemo(() => {
    return sortData(filteredDocs, {
      grandTotal: (d) => d.grandTotal,
      balanceDue: (d) => d.balanceDue || 0,
      issueDate: (d) => d.issueDate,
      dueDate: (d) => d.dueDate || '',
      status: (d) => d.status,
      documentType: (d) => d.documentType,
      documentNumber: (d) => d.documentNumber,
      clientName: (d) => d.clientName,
    });
  }, [filteredDocs, sortData]);

  // Memoized page items
  const totalPages = Math.max(1, Math.ceil(sortedDocs.length / pageSize));
  const paginatedDocs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedDocs.slice(start, start + pageSize);
  }, [sortedDocs, currentPage, pageSize]);

  // Download PDF directly from journal
  const handleQuickDownload = async (doc: BillingDocument) => {
    setSelectedDocForPreview(doc);
    setIsGeneratingPdf(true);
    // Wait for modal render
    setTimeout(async () => {
      const previewEl = document.getElementById(`journal-modal-a4`);
      if (previewEl) {
        try {
          await generatePdfFromElement(previewEl, doc.documentNumber, doc.clientName, doc.issueDate, {
            download: true,
          });
        } catch (err: any) {
          alert('PDF generation error: ' + err.message);
        }
      }
      setIsGeneratingPdf(false);
    }, 300);
  };

  // Universal share helper with direct vector PDF binary attachment
  const handleQuickShare = async (doc: BillingDocument) => {
    setSelectedDocForPreview(doc);
    setIsGeneratingPdf(true);
    setTimeout(async () => {
      const previewEl = document.getElementById(`journal-modal-a4`);
      if (previewEl) {
        try {
          const res = await generatePdfFromElement(previewEl, doc.documentNumber, doc.clientName, doc.issueDate, {
            download: false,
          });
          const summaryText = getDocumentOperationalSummary(doc, profile);
          await universalSharePdfDocument({
            blob: res.blob,
            fileName: res.fileName,
            title: `${doc.documentType} ${doc.documentNumber} - ${profile.name}`,
            summaryText,
            clientPhone: doc.clientPhone,
            driveUrl: doc.driveFileUrl,
          });
        } catch (err: any) {
          console.error('Universal share error:', err);
        }
      }
      setIsGeneratingPdf(false);
    }, 300);
  };

  // Direct vector PDF printing helper
  const handleQuickPrint = async (doc: BillingDocument) => {
    setSelectedDocForPreview(doc);
    setIsGeneratingPdf(true);
    setTimeout(async () => {
      const previewEl = document.getElementById(`journal-modal-a4`);
      if (previewEl) {
        try {
          const res = await generatePdfFromElement(previewEl, doc.documentNumber, doc.clientName, doc.issueDate, {
            download: false,
          });
          await printPdfBlob(res.blob);
        } catch {
          window.print();
        }
      } else {
        window.print();
      }
      setIsGeneratingPdf(false);
    }, 300);
  };

  const getStatusBadge = (status: DocumentStatus) => {
    switch (status) {
      case 'Paid':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle className="w-3 h-3" />
            Paid
          </span>
        );
      case 'Sent':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
            <Clock className="w-3 h-3" />
            Sent
          </span>
        );
      case 'Overdue':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            <AlertTriangle className="w-3 h-3" />
            Overdue
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-300">
            Draft
          </span>
        );
    }
  };

  const getTypeBadge = (type: DocumentType) => {
    switch (type) {
      case 'QUOTATION':
        return (
          <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
            Quotation
          </span>
        );
      case 'PROFORMA':
        return (
          <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-sky-100 text-sky-900 border border-sky-300">
            Proforma
          </span>
        );
      case 'INVOICE':
        return (
          <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-stone-900 text-amber-400">
            Invoice
          </span>
        );
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header & New Document Shortcuts */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-amber-700" />
            Document Journal & Register
          </h1>
          <p className="text-sm text-stone-600">
            Manage Quotations, Proforma Invoices, and Invoices with real-time balance tracking and conversions.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setParityModalDoc(null);
              setIsParityModalOpen(true);
            }}
            className="px-3 py-2 bg-amber-50 border border-amber-300 hover:bg-amber-100 text-amber-900 text-xs font-semibold rounded flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            title="Run Document Propagation Parity Validator across all ERP documents and Google Sheets"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
            Parity Validator
          </button>
          <button
            type="button"
            onClick={() => onNewDocument('QUOTATION')}
            className="px-3 py-2 bg-white border border-stone-300 hover:bg-stone-50 text-stone-800 text-xs font-semibold rounded flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-amber-600" />
            New Quotation
          </button>
          <button
            type="button"
            onClick={() => onNewDocument('PROFORMA')}
            className="px-3 py-2 bg-white border border-stone-300 hover:bg-stone-50 text-stone-800 text-xs font-semibold rounded flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-sky-600" />
            New Proforma
          </button>
          <button
            type="button"
            onClick={() => onNewDocument('INVOICE')}
            className="px-3 py-2 bg-stone-900 hover:bg-stone-800 text-amber-400 text-xs font-bold rounded flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            New Invoice
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-stone-200 rounded p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Document Number, Client Name, KRA PIN..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-stone-500 text-stone-900 bg-stone-50/50"
          />
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-1 text-xs">
          <span className="text-stone-500 font-medium">Type:</span>
          {(['ALL', 'QUOTATION', 'PROFORMA', 'INVOICE'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                typeFilter === t
                  ? 'bg-stone-900 text-amber-400'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {t === 'ALL' ? 'All Types' : t === 'QUOTATION' ? 'Quotations' : t === 'PROFORMA' ? 'Proformas' : 'Invoices'}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1 text-xs flex-wrap">
          <span className="text-stone-500 font-medium">Status:</span>
          {(['ALL', 'Draft', 'Sent', 'Partial', 'Paid', 'Overdue'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-2 py-1 rounded font-medium transition-colors cursor-pointer ${
                statusFilter === s
                  ? 'bg-stone-800 text-white font-bold'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {s}
            </button>
          ))}

          {activeVariancesCount > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter('VARIANCE')}
              className={`px-2.5 py-1 rounded font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'VARIANCE'
                  ? 'bg-amber-500 text-stone-950 shadow-xs'
                  : 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300'
              }`}
              title="Show only documents with detected propagation variance between ERP and Google Sheets"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
              <span>Variances ({activeVariancesCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Variance Alert & Auto-Resolve Banner */}
      {activeVariancesCount > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 border border-amber-300 text-amber-800 shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="font-bold text-xs sm:text-sm text-amber-950 flex items-center gap-2">
                <span>{activeVariancesCount} Document(s) Highlighted with Variance Detected</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-bold border border-amber-300">
                  ERP vs Google Sheets
                </span>
              </div>
              <p className="text-xs text-amber-800 mt-0.5">
                Missing line items or data discrepancy detected. Highlighted in amber below with direct auto-resolve options.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={async () => {
                setIsResolvingAll(true);
                try {
                  await autoResolveAll(documents);
                } finally {
                  setIsResolvingAll(false);
                }
              }}
              disabled={isResolvingAll}
              className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold text-xs rounded-lg shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isResolvingAll ? 'animate-spin' : ''}`} />
              <span>{isResolvingAll ? 'Auto-Resolving...' : 'Auto-Resolve All to Accurate Data'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Documents Datatable */}
      <div className="bg-white border border-stone-200 rounded shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-stone-100 border-b border-stone-200 text-stone-700 font-bold">
                <SortableHeader column="documentType" label="Type" currentSort={sortConfig} onSort={toggleSort} />
                <SortableHeader column="documentNumber" label="Doc No" currentSort={sortConfig} onSort={toggleSort} />
                <SortableHeader column="clientName" label="Client Name" currentSort={sortConfig} onSort={toggleSort} />
                <SortableHeader column="issueDate" label="Issue Date" currentSort={sortConfig} onSort={toggleSort} defaultDirection="desc" />
                <SortableHeader column="dueDate" label="Due Date" currentSort={sortConfig} onSort={toggleSort} defaultDirection="desc" />
                <SortableHeader column="grandTotal" label="Grand Total (Ksh)" currentSort={sortConfig} onSort={toggleSort} align="right" defaultDirection="desc" />
                <SortableHeader column="balanceDue" label="Balance Due (Ksh)" currentSort={sortConfig} onSort={toggleSort} align="right" defaultDirection="desc" />
                <SortableHeader column="status" label="Status" currentSort={sortConfig} onSort={toggleSort} align="center" />
                <th className="py-2.5 px-3 text-center">Drive PDF Link</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {paginatedDocs.length > 0 ? (
                paginatedDocs.map((doc) => {
                  const isDocWithVariance = hasVariance(doc.documentNumber);
                  const varianceInfo = getVariance(doc.documentNumber);

                  return (
                    <tr
                      key={doc.id}
                      className={
                        isDocWithVariance
                          ? 'bg-amber-50/90 hover:bg-amber-100/90 border-l-4 border-l-amber-500 transition-all font-medium'
                          : 'hover:bg-stone-50/80 transition-colors'
                      }
                    >
                      <td className="py-2.5 px-3">{getTypeBadge(doc.documentType)}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-stone-900">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{doc.documentNumber}</span>
                          {isDocWithVariance && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-950 border border-amber-400 shadow-2xs animate-pulse"
                              title="Variance(s) Detected Between ERP & Google Sheets for missing line items or data"
                            >
                              <AlertTriangle className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                              <span>Variance Detected</span>
                            </span>
                          )}
                        </div>
                        {isDocWithVariance && (
                          <div className="text-[10px] text-amber-700 font-sans font-medium mt-0.5">
                            {varianceInfo?.varianceType === 'MISSING_LINE_ITEMS'
                              ? 'Missing line items in Google Sheets'
                              : 'ERP vs Sheets Data Discrepancy'}
                          </div>
                        )}
                        {doc.relatedDocNumber && (
                          <div className="text-[10px] text-stone-400 font-normal">
                            From: {doc.relatedDocNumber}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-stone-900">{doc.clientName}</div>
                        {doc.clientKraPin && (
                          <div className="text-[10px] text-stone-500">KRA: {doc.clientKraPin}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-stone-600">{formatDate(doc.issueDate)}</td>
                      <td className="py-2.5 px-3 text-stone-600">{formatDate(doc.dueDate)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-stone-900 tabular-decimal">
                        {formatKsh(doc.grandTotal)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-decimal">
                        {doc.documentType === 'QUOTATION' ? (
                          <span className="text-stone-400">-</span>
                        ) : (
                          <span
                            className={`font-semibold ${
                              (doc.balanceDue || 0) <= 0 ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {formatKsh(doc.balanceDue || 0)}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <DocumentStatusDropdown
                          document={doc}
                          onStatusChange={(newStatus, isManual) => handleStatusChange(doc, newStatus, isManual)}
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {doc.driveFileUrl ? (
                          <a
                            href={doc.driveFileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition-colors shadow-2xs group"
                            title="Open official PDF archived in Google Drive"
                          >
                            <ExternalLink className="w-3 h-3 text-emerald-700 group-hover:text-emerald-900" />
                            <span>View in Drive</span>
                          </a>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-stone-500 bg-stone-100 border border-stone-200"
                            title={doc.syncedToGoogle ? 'Synced to Google Sheet; Drive PDF upload pending' : 'Saved in offline local database; pending Google sync'}
                          >
                            <Clock className="w-2.5 h-2.5 text-stone-400" />
                            <span>{doc.syncedToGoogle ? 'Drive Pending' : 'Pending Sync'}</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          {/* Auto-Resolve button if variance detected */}
                          {isDocWithVariance && (
                            <button
                              type="button"
                              onClick={async () => {
                                setIsResolvingDocId(doc.id);
                                try {
                                  await autoResolveDocument(doc);
                                } finally {
                                  setIsResolvingDocId(null);
                                }
                              }}
                              disabled={isResolvingDocId === doc.id}
                              className="px-2 py-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold text-[10px] rounded flex items-center gap-1 shadow-2xs cursor-pointer mr-1"
                              title="Auto change and resolve document to accurate data"
                            >
                              <Sparkles className={`w-3 h-3 ${isResolvingDocId === doc.id ? 'animate-spin' : ''}`} />
                              <span>{isResolvingDocId === doc.id ? 'Resolving...' : 'Auto-Resolve'}</span>
                            </button>
                          )}

                          {/* Parity Validator Trigger */}
                          <button
                            type="button"
                            onClick={() => setParityModalDoc(doc)}
                            className="p-1 text-stone-500 hover:text-emerald-700 hover:bg-emerald-50 rounded"
                            title="Validate Google Sheets Propagation & Line Items Parity"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                          </button>

                          {/* Preview */}
                          <button
                            type="button"
                            onClick={() => setSelectedDocForPreview(doc)}
                            className="p-1 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded"
                            title="Preview Document"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => onEditDocument(doc)}
                            className="p-1 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded"
                            title="Edit Document"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {/* Record Payment on Invoices */}
                          {doc.documentType === 'INVOICE' && doc.status !== 'Paid' && (
                            <button
                              type="button"
                              onClick={() => onRecordPayment(doc)}
                              className="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded"
                              title="Record Payment Settlement"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Quick Conversion Trigger */}
                          {doc.documentType === 'QUOTATION' && (
                            <button
                              type="button"
                              onClick={() => onConvertDocument(doc, 'PROFORMA')}
                              className="p-1 text-amber-700 hover:text-amber-900 hover:bg-amber-50 rounded"
                              title="Convert to Proforma"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {doc.documentType === 'PROFORMA' && (
                            <button
                              type="button"
                              onClick={() => onConvertDocument(doc, 'INVOICE')}
                              className="p-1 text-sky-700 hover:text-sky-900 hover:bg-sky-50 rounded"
                              title="Convert to Invoice"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Universal Share Action */}
                          <button
                            type="button"
                            onClick={() => handleQuickShare(doc)}
                            className="p-1 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded"
                            title="Share Document (Vector PDF & Summary)"
                          >
                            <Share2 className="w-3.5 h-3.5 text-stone-700" />
                          </button>

                          {/* Quick PDF Download */}
                          <button
                            type="button"
                            onClick={() => handleQuickDownload(doc)}
                            className="p-1 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded"
                            title="Download PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => onDeleteDocument(doc.id)}
                            className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                            title="Delete Document"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-stone-400 italic">
                    No documents found matching the search or filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Summary Footer */}
        {filteredDocs.length > 0 && (
          <div className="bg-stone-50 px-4 py-2.5 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-stone-600">
            <div>
              Showing <span className="font-semibold text-stone-900">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-semibold text-stone-900">
                {Math.min(currentPage * pageSize, filteredDocs.length)}
              </span>{' '}
              of <span className="font-semibold text-stone-900">{filteredDocs.length}</span> documents
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-2 py-1 rounded bg-white border border-stone-300 text-stone-700 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 text-xs font-medium"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Previous
                </button>
                <span className="px-2 py-1 text-xs font-semibold text-stone-800">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2 py-1 rounded bg-white border border-stone-300 text-stone-700 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 text-xs font-medium"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* DOCUMENT PREVIEW MODAL */}
      {selectedDocForPreview && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-xs flex flex-col justify-between p-4 overflow-y-auto">
          <div className="flex items-center justify-between bg-stone-900 text-white px-4 py-3 rounded-t border-b border-stone-800 max-w-4xl mx-auto w-full">
            <h3 className="font-bold text-sm tracking-wide">
              Document Preview: {selectedDocForPreview.documentNumber} ({selectedDocForPreview.documentType})
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleQuickPrint(selectedDocForPreview)}
                className="px-3 py-1 bg-stone-800 hover:bg-stone-700 text-white rounded text-xs flex items-center gap-1 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>
              <button
                type="button"
                disabled={isGeneratingPdf}
                onClick={() => handleQuickShare(selectedDocForPreview)}
                className="px-3 py-1 bg-stone-800 hover:bg-stone-700 text-white font-bold rounded text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Share Document with direct PDF attachment & summary"
              >
                <Share2 className="w-3.5 h-3.5 text-amber-400" />
                Share
              </button>
              <button
                type="button"
                disabled={isGeneratingPdf}
                onClick={async () => {
                  const el = document.getElementById('journal-modal-a4');
                  if (el) {
                    setIsGeneratingPdf(true);
                    try {
                      await generatePdfFromElement(
                        el,
                        selectedDocForPreview.documentNumber,
                        selectedDocForPreview.clientName,
                        selectedDocForPreview.issueDate,
                        { download: true }
                      );
                    } finally {
                      setIsGeneratingPdf(false);
                    }
                  }
                }}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded text-xs flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                {isGeneratingPdf ? 'Generating...' : 'Download PDF'}
              </button>
              <button
                type="button"
                onClick={() => setSelectedDocForPreview(null)}
                className="px-3 py-1 bg-stone-700 hover:bg-stone-600 text-white rounded text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
          <div className="flex-1 flex justify-center py-4 overflow-auto max-w-4xl mx-auto w-full bg-stone-200">
            <div id="journal-modal-a4">
              <A4DocumentPreview
                document={selectedDocForPreview}
                profile={profile}
                scale={0.9}
              />
            </div>
          </div>
        </div>
      )}

      {/* PARITY VALIDATOR MODAL */}
      {(isParityModalOpen || !!parityModalDoc) && (
        <DocumentPropagationParityModal
          isOpen={isParityModalOpen || !!parityModalDoc}
          document={parityModalDoc}
          onClose={() => {
            setIsParityModalOpen(false);
            setParityModalDoc(null);
          }}
          onRefreshDocument={(updatedDoc) => {
            if (onSaveDocument) {
              onSaveDocument(updatedDoc);
            }
          }}
          onRefreshAllDocuments={(updatedDocs) => {
            if (onSaveDocument) {
              updatedDocs.forEach((d) => onSaveDocument(d));
            }
          }}
        />
      )}
    </div>
  );
};
