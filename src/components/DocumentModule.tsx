import React, { useState, useMemo, useEffect } from 'react';
import {
  FileText,
  FileClock,
  Receipt,
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  Download,
  Printer,
  Share2,
  X,
  CreditCard,
  ArrowRightLeft,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Archive,
  ArrowUpRight,
  TrendingUp,
  DollarSign,
  Filter,
} from 'lucide-react';
import { BillingDocument, DocumentType, DocumentStatus, Client, HotelProfile } from '../types';
import { formatKsh, formatDate, calculateDueDate } from '../utils/formatters';
import { generatePdfFromElement, shareDocumentPdf } from '../utils/pdfGenerator';
import { DocumentEditor } from './DocumentEditor';
import { A4DocumentPreview } from './A4DocumentPreview';

interface DocumentModuleProps {
  moduleType: DocumentType;
  documents: BillingDocument[];
  clients: Client[];
  profile: HotelProfile;
  editingDocument: BillingDocument | null;
  onSaveDocument: (doc: BillingDocument) => void;
  onDeleteDocument: (docId: string) => void;
  onRecordPayment: (doc: BillingDocument) => void;
  onConvertDocument: (sourceDoc: BillingDocument, targetType: DocumentType) => void;
  onStartNewDocument: (type: DocumentType) => void;
  onStartEditDocument: (doc: BillingDocument) => void;
  onCancelEditor: () => void;
  onAddNewClient?: () => void;
}

export const DocumentModule: React.FC<DocumentModuleProps> = ({
  moduleType,
  documents,
  clients,
  profile,
  editingDocument,
  onSaveDocument,
  onDeleteDocument,
  onRecordPayment,
  onConvertDocument,
  onStartNewDocument,
  onStartEditDocument,
  onCancelEditor,
  onAddNewClient,
}) => {
  // Sub-tabs: 'new' (Editor), 'journal' (List), 'special' (Expired for Quotes, Converted for Proformas, Unpaid for Invoices)
  const [activeSubTab, setActiveSubTab] = useState<'new' | 'journal' | 'special'>(
    editingDocument ? 'new' : 'journal'
  );

  // Direct deep-action routing: Immediately switch to 'new' editor tab when editingDocument changes
  useEffect(() => {
    if (editingDocument) {
      setActiveSubTab('new');
    }
  }, [editingDocument]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | DocumentStatus>('ALL');
  const [selectedDocForPreview, setSelectedDocForPreview] = useState<BillingDocument | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Filter documents by module type
  const moduleDocs = useMemo(() => {
    return documents.filter((d) => d.documentType === moduleType);
  }, [documents, moduleType]);

  // Today string for expiry comparisons
  const todayStr = useMemo(() => formatDate(), []);

  // Filter for special sub-tab:
  // Quotations: Expired or Archived
  // Proformas: Converted (has relatedDocId or is marked converted)
  // Invoices: Unpaid or Overdue (balanceDue > 0)
  const specialDocs = useMemo(() => {
    if (moduleType === 'QUOTATION') {
      return moduleDocs.filter((d) => {
        const isExpired = d.dueDate && d.dueDate < todayStr && d.status !== 'Paid';
        return isExpired || d.isArchived;
      });
    } else if (moduleType === 'PROFORMA') {
      return moduleDocs.filter((d) => {
        // Converted proformas or ones with related invoices
        const hasConverted = documents.some(
          (inv) => inv.documentType === 'INVOICE' && (inv.relatedDocId === d.id || inv.relatedDocNumber === d.documentNumber)
        );
        return hasConverted || d.status === 'Paid';
      });
    } else {
      // INVOICE: Unpaid or Overdue
      return moduleDocs.filter((d) => (d.balanceDue || 0) > 0 || d.status === 'Overdue');
    }
  }, [moduleDocs, moduleType, todayStr, documents]);

  // General filtered list for journal
  const filteredJournalDocs = useMemo(() => {
    const list = activeSubTab === 'special' ? specialDocs : moduleDocs;
    return list.filter((doc) => {
      if (statusFilter !== 'ALL' && doc.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNum = doc.documentNumber.toLowerCase().includes(q);
        const matchClient = doc.clientName.toLowerCase().includes(q);
        const matchPin = (doc.clientKraPin || '').toLowerCase().includes(q);
        return matchNum || matchClient || matchPin;
      }
      return true;
    });
  }, [activeSubTab, specialDocs, moduleDocs, statusFilter, searchQuery]);

  // Summary Metrics calculations
  const metrics = useMemo(() => {
    const totalCount = moduleDocs.length;
    const totalValue = moduleDocs.reduce((acc, d) => acc + d.grandTotal, 0);

    if (moduleType === 'QUOTATION') {
      const activeQuotes = moduleDocs.filter(
        (d) => (!d.dueDate || d.dueDate >= todayStr) && d.status !== 'Paid' && !d.isArchived
      );
      const activeValue = activeQuotes.reduce((acc, d) => acc + d.grandTotal, 0);
      const expiredCount = moduleDocs.filter(
        (d) => (d.dueDate && d.dueDate < todayStr && d.status !== 'Paid') || d.isArchived
      ).length;
      return {
        card1Title: 'Total Quotations',
        card1Val: totalCount,
        card1Sub: 'All historical proposals',
        card2Title: 'Active Pipeline',
        card2Val: formatKsh(activeValue),
        card2Sub: `${activeQuotes.length} valid quotations`,
        card3Title: 'Expired / Archived',
        card3Val: expiredCount,
        card3Sub: 'Requires renewal or review',
      };
    } else if (moduleType === 'PROFORMA') {
      const convertedCount = specialDocs.length;
      const pendingProformas = moduleDocs.filter(
        (d) => !specialDocs.some((sd) => sd.id === d.id)
      );
      const pendingValue = pendingProformas.reduce((acc, d) => acc + d.grandTotal, 0);
      return {
        card1Title: 'Total Proformas',
        card1Val: totalCount,
        card1Sub: 'Advance billing requests',
        card2Title: 'Pending Commitment',
        card2Val: formatKsh(pendingValue),
        card2Sub: `${pendingProformas.length} awaiting finalization`,
        card3Title: 'Converted to Invoice',
        card3Val: convertedCount,
        card3Sub: totalCount > 0 ? `${Math.round((convertedCount / totalCount) * 100)}% conversion rate` : '0%',
      };
    } else {
      // INVOICE
      const totalPaid = moduleDocs.reduce((acc, d) => acc + (d.amountPaid || 0), 0);
      const totalAR = moduleDocs.reduce((acc, d) => acc + (d.balanceDue || 0), 0);
      const overdueCount = moduleDocs.filter((d) => d.status === 'Overdue').length;
      return {
        card1Title: 'Total Invoiced',
        card1Val: formatKsh(totalValue),
        card1Sub: `${totalCount} invoices`,
        card2Title: 'Settled Payments',
        card2Val: formatKsh(totalPaid),
        card2Sub: totalValue > 0 ? `${Math.round((totalPaid / totalValue) * 100)}% collected` : '0%',
        card3Title: 'Outstanding Receivables',
        card3Val: formatKsh(totalAR),
        card3Sub: overdueCount > 0 ? `${overdueCount} overdue invoices!` : 'All current',
      };
    }
  }, [moduleDocs, moduleType, todayStr, specialDocs]);

  // Titles and Sub-Tab Labels
  const config = useMemo(() => {
    switch (moduleType) {
      case 'QUOTATION':
        return {
          title: 'Quotations Management',
          description: 'Create, track, and convert hospitality & conference price quotations for Hotel Damview guests.',
          icon: FileText,
          newTabLabel: editingDocument ? `Editing Quote: ${editingDocument.documentNumber}` : 'New Quotation',
          journalTabLabel: 'Quotations Journal',
          specialTabLabel: 'Expired / Archived',
          specialCount: specialDocs.length,
          specialBadgeColor: 'bg-amber-100 text-amber-900 border border-amber-300',
        };
      case 'PROFORMA':
        return {
          title: 'Proforma Invoices',
          description: 'Issue official commitment & advance proforma invoices prior to final service delivery.',
          icon: FileClock,
          newTabLabel: editingDocument ? `Editing Proforma: ${editingDocument.documentNumber}` : 'New Proforma',
          journalTabLabel: 'Proforma Journal',
          specialTabLabel: 'Converted History',
          specialCount: specialDocs.length,
          specialBadgeColor: 'bg-sky-100 text-sky-900 border border-sky-300',
        };
      case 'INVOICE':
        return {
          title: 'Invoices & Receivables',
          description: 'Official invoices compliant with Kenya Revenue Authority (16% VAT), payments & ledgers.',
          icon: Receipt,
          newTabLabel: editingDocument ? `Editing Invoice: ${editingDocument.documentNumber}` : 'New Invoice',
          journalTabLabel: 'Sales Journal',
          specialTabLabel: 'Unpaid / Overdue',
          specialCount: specialDocs.length,
          specialBadgeColor: 'bg-rose-100 text-rose-900 border border-rose-300',
        };
    }
  }, [moduleType, editingDocument, specialDocs.length]);

  const Icon = config.icon;

  // Quick download helper
  const handleQuickDownload = async (doc: BillingDocument) => {
    setSelectedDocForPreview(doc);
    setIsGeneratingPdf(true);
    setTimeout(async () => {
      const previewEl = document.getElementById(`doc-module-preview-a4`);
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

  // Quick print helper
  const handleQuickPrint = (doc: BillingDocument) => {
    setSelectedDocForPreview(doc);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  // Quick share helper
  const handleQuickShare = async (doc: BillingDocument) => {
    setSelectedDocForPreview(doc);
    setIsGeneratingPdf(true);
    setTimeout(async () => {
      const previewEl = document.getElementById(`doc-module-preview-a4`);
      if (previewEl) {
        try {
          const res = await generatePdfFromElement(
            previewEl,
            doc.documentNumber,
            doc.clientName,
            doc.issueDate,
            { download: false }
          );
          const shared = await shareDocumentPdf(
            res.blob,
            res.fileName,
            `${doc.documentType} ${doc.documentNumber} - ${profile.name}`,
            `Please find attached ${doc.documentType} ${doc.documentNumber} for ${doc.clientName} amounting to ${formatKsh(doc.grandTotal)}.`
          );
          if (!shared) {
            handleQuickDownload(doc);
          }
        } catch (err: any) {
          console.error('Share error:', err);
        }
      }
      setIsGeneratingPdf(false);
    }, 300);
  };

  const getStatusBadge = (status: DocumentStatus) => {
    switch (status) {
      case 'Paid':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3" />
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

  return (
    <div className="flex flex-col h-full">
      {/* MODULE HEADER BAR */}
      <div className="no-print bg-white border-b border-stone-200 px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
              <Icon className="w-5 h-5 text-amber-700" />
              {config.title}
            </h1>
            <p className="text-xs text-stone-600 mt-0.5">{config.description}</p>
          </div>

          {/* Sub-Module Navigation Tabs */}
          <div className="inline-flex rounded-lg p-1 bg-stone-100 border border-stone-200 text-xs font-semibold self-start md:self-auto">
            <button
              type="button"
              onClick={() => {
                onStartNewDocument(moduleType);
                setActiveSubTab('new');
              }}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
                activeSubTab === 'new'
                  ? 'bg-stone-900 text-amber-400 shadow-xs'
                  : 'text-stone-700 hover:text-stone-900 hover:bg-stone-200/60'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{config.newTabLabel}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('journal')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
                activeSubTab === 'journal'
                  ? 'bg-stone-900 text-amber-400 shadow-xs'
                  : 'text-stone-700 hover:text-stone-900 hover:bg-stone-200/60'
              }`}
            >
              <span>{config.journalTabLabel}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-stone-200 text-stone-800">
                {moduleDocs.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('special')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
                activeSubTab === 'special'
                  ? 'bg-stone-900 text-amber-400 shadow-xs'
                  : 'text-stone-700 hover:text-stone-900 hover:bg-stone-200/60'
              }`}
            >
              <span>{config.specialTabLabel}</span>
              {config.specialCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${config.specialBadgeColor}`}>
                  {config.specialCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* SUB-TAB CONTENT */}
      {activeSubTab === 'new' ? (
        /* 1. DOCUMENT EDITOR: 60% Form & 40% Live A4 Preview */
        <div className="flex-1 overflow-hidden">
          <DocumentEditor
            initialDocument={editingDocument}
            defaultType={moduleType}
            clients={clients}
            profile={profile}
            existingDocuments={documents}
            onSave={(savedDoc) => {
              onSaveDocument(savedDoc);
              setActiveSubTab('journal');
            }}
            onCancel={() => {
              onCancelEditor();
              setActiveSubTab('journal');
            }}
            onConvert={onConvertDocument}
            onAddNewClient={onAddNewClient}
          />
        </div>
      ) : (
        /* 2 & 3. JOURNAL OR SPECIAL FILTER TAB */
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-stone-100">
          {/* Top 3 Metric Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-stone-200 rounded-lg p-4 shadow-xs">
              <div className="text-xs text-stone-500 font-medium">{metrics.card1Title}</div>
              <div className="text-xl font-bold text-stone-900 mt-1">{metrics.card1Val}</div>
              <div className="text-[11px] text-stone-500 mt-0.5">{metrics.card1Sub}</div>
            </div>

            <div className="bg-white border border-stone-200 rounded-lg p-4 shadow-xs">
              <div className="text-xs text-stone-500 font-medium">{metrics.card2Title}</div>
              <div className="text-xl font-bold text-amber-800 mt-1 tabular-decimals">{metrics.card2Val}</div>
              <div className="text-[11px] text-stone-500 mt-0.5">{metrics.card2Sub}</div>
            </div>

            <div className="bg-white border border-stone-200 rounded-lg p-4 shadow-xs">
              <div className="text-xs text-stone-500 font-medium">{metrics.card3Title}</div>
              <div className="text-xl font-bold text-stone-900 mt-1 tabular-decimals">{metrics.card3Val}</div>
              <div className="text-[11px] text-stone-500 mt-0.5">{metrics.card3Sub}</div>
            </div>
          </div>

          {/* Search & Status Filters */}
          <div className="bg-white border border-stone-200 rounded-lg p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${config.title} by Number, Client, KRA PIN...`}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-stone-500 text-stone-900 bg-stone-50/50"
              />
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-stone-500 font-medium flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Status:
              </span>
              {(['ALL', 'Draft', 'Sent', 'Paid', 'Overdue'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    statusFilter === s
                      ? 'bg-stone-900 text-amber-400'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Documents Table */}
          <div className="bg-white border border-stone-200 rounded-lg shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-100 border-b border-stone-200 text-stone-700 font-bold">
                    <th className="py-2.5 px-3">Doc No</th>
                    <th className="py-2.5 px-3">Client / Guest</th>
                    <th className="py-2.5 px-3">Issue Date</th>
                    <th className="py-2.5 px-3">{moduleType === 'QUOTATION' ? 'Valid Until' : 'Due Date'}</th>
                    <th className="py-2.5 px-3 text-right">Grand Total</th>
                    {moduleType === 'INVOICE' && (
                      <th className="py-2.5 px-3 text-right">Balance Due</th>
                    )}
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {filteredJournalDocs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-stone-500">
                        <Icon className="w-8 h-8 mx-auto mb-2 text-stone-400 opacity-60" />
                        <p className="font-semibold text-sm">No {config.title} found</p>
                        <p className="text-xs text-stone-400 mt-1">
                          {searchQuery
                            ? 'Try clearing your search query'
                            : `Click "${config.newTabLabel}" above to create the first one.`}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredJournalDocs.map((doc) => (
                      <tr key={doc.id} className="hover:bg-amber-50/40 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-stone-900">
                          {doc.documentNumber}
                          {doc.relatedDocNumber && (
                            <div className="text-[10px] font-sans text-stone-500 font-normal">
                              Ref: {doc.relatedDocNumber}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-stone-900">{doc.clientName}</div>
                          {doc.clientKraPin && (
                            <div className="text-[10px] text-stone-500 font-mono">
                              PIN: {doc.clientKraPin}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-stone-600">{doc.issueDate}</td>
                        <td className="py-2.5 px-3 text-stone-600">{doc.dueDate || '-'}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-stone-900 tabular-decimal">
                          {formatKsh(doc.grandTotal)}
                        </td>
                        {moduleType === 'INVOICE' && (
                          <td
                            className={`py-2.5 px-3 text-right font-bold tabular-decimal ${
                              (doc.balanceDue || 0) > 0 ? 'text-rose-700' : 'text-emerald-700'
                            }`}
                          >
                            {formatKsh(doc.balanceDue || 0)}
                          </td>
                        )}
                        <td className="py-2.5 px-3 text-center">{getStatusBadge(doc.status)}</td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Fast PDF Preview */}
                            <button
                              type="button"
                              onClick={() => setSelectedDocForPreview(doc)}
                              className="p-1 rounded text-stone-600 hover:text-stone-900 hover:bg-stone-100"
                              title="Live A4 Preview"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Download PDF */}
                            <button
                              type="button"
                              onClick={() => handleQuickDownload(doc)}
                              disabled={isGeneratingPdf}
                              className="p-1 rounded text-stone-600 hover:text-stone-900 hover:bg-stone-100 disabled:opacity-40"
                              title="Download PDF"
                            >
                              <Download className="w-4 h-4" />
                            </button>

                            {/* Edit */}
                            <button
                              type="button"
                              onClick={() => {
                                onStartEditDocument(doc);
                                setActiveSubTab('new');
                              }}
                              className="p-1 rounded text-stone-600 hover:text-amber-800 hover:bg-stone-100"
                              title="Edit Document"
                            >
                              <Edit className="w-4 h-4" />
                            </button>

                            {/* Quotation Lifecycle Conversions */}
                            {moduleType === 'QUOTATION' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onConvertDocument(doc, 'PROFORMA')}
                                  className="p-1 rounded text-sky-700 hover:bg-sky-100"
                                  title="Convert to Proforma Invoice"
                                >
                                  <ArrowRightLeft className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onConvertDocument(doc, 'INVOICE')}
                                  className="p-1 rounded text-emerald-700 hover:bg-emerald-100"
                                  title="Convert to Invoice"
                                >
                                  <ArrowUpRight className="w-4 h-4" />
                                </button>
                              </>
                            )}

                            {/* Proforma Lifecycle Conversion */}
                            {moduleType === 'PROFORMA' && (
                              <button
                                type="button"
                                onClick={() => onConvertDocument(doc, 'INVOICE')}
                                className="p-1 rounded text-emerald-700 hover:bg-emerald-100"
                                title="Convert to Invoice"
                              >
                                <ArrowRightLeft className="w-4 h-4" />
                              </button>
                            )}

                            {/* Invoice Settlement Trigger */}
                            {moduleType === 'INVOICE' && (doc.balanceDue || 0) > 0 && (
                              <button
                                type="button"
                                onClick={() => onRecordPayment(doc)}
                                className="px-2 py-0.5 rounded bg-emerald-800 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center gap-1 shadow-2xs"
                                title="Record Settlement"
                              >
                                <CreditCard className="w-3 h-3" />
                                Settle
                              </button>
                            )}

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Delete ${doc.documentType} ${doc.documentNumber}?`)) {
                                  onDeleteDocument(doc.id);
                                }
                              }}
                              className="p-1 rounded text-stone-400 hover:text-rose-600 hover:bg-stone-100"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* QUICK PREVIEW MODAL */}
      {selectedDocForPreview && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-xs flex flex-col justify-between p-4 overflow-y-auto">
          <div className="flex items-center justify-between bg-stone-900 text-white px-4 py-3 rounded-t border-b border-stone-800 max-w-4xl mx-auto w-full">
            <h3 className="font-bold text-sm tracking-wide flex items-center gap-2">
              <Icon className="w-4 h-4 text-amber-400" />
              {selectedDocForPreview.documentType}: {selectedDocForPreview.documentNumber} - {selectedDocForPreview.clientName}
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleQuickDownload(selectedDocForPreview)}
                disabled={isGeneratingPdf}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded text-xs flex items-center gap-1 shadow-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isGeneratingPdf ? 'Generating...' : 'Download PDF'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickPrint(selectedDocForPreview)}
                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-white font-medium rounded text-xs flex items-center gap-1 border border-stone-700 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickShare(selectedDocForPreview)}
                disabled={isGeneratingPdf}
                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-amber-300 font-medium rounded text-xs flex items-center gap-1 border border-stone-700 transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDocForPreview(null)}
                className="p-1 text-stone-400 hover:text-white rounded hover:bg-stone-800 transition-colors ml-1"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 flex justify-center py-4 overflow-auto max-w-4xl mx-auto w-full bg-stone-200">
            <div id="doc-module-preview-a4">
              <A4DocumentPreview
                document={selectedDocForPreview}
                profile={profile}
                scale={0.88}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
