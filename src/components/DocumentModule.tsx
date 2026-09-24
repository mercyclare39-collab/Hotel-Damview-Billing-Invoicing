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
  FileSpreadsheet,
  MessageSquare,
  ExternalLink,
} from 'lucide-react';
import { BillingDocument, DocumentType, DocumentStatus, Client, HotelProfile } from '../types';
import { formatKsh, formatDate, calculateDueDate } from '../utils/formatters';
import { generatePdfFromElement, shareDocumentPdf, getWhatsAppShareUrl } from '../utils/pdfGenerator';
import { exportTableToXlsx } from '../utils/excelExporter';
import { DocumentEditor } from './DocumentEditor';
import { A4DocumentPreview } from './A4DocumentPreview';

interface DocumentModuleProps {
  moduleType: DocumentType;
  documents: BillingDocument[];
  clients: Client[];
  profile: HotelProfile;
  editingDocument: BillingDocument | null;
  initialSubTab?: 'new' | 'journal' | 'special';
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
  initialSubTab,
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
    initialSubTab || (editingDocument ? 'new' : 'journal')
  );

  // Direct deep-action routing: Immediately switch tab when initialSubTab or editingDocument changes
  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

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

  // Filter for special sub-tab
  const specialDocs = useMemo(() => {
    if (moduleType === 'QUOTATION') {
      return moduleDocs.filter((d) => {
        const isExpired = d.dueDate && d.dueDate < todayStr && d.status !== 'Paid';
        return isExpired || d.isArchived;
      });
    } else if (moduleType === 'PROFORMA') {
      return moduleDocs.filter((d) => {
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
        const matchItems = doc.lineItems?.some((item) =>
          item.particulars.toLowerCase().includes(q)
        ) || false;
        if (!matchNum && !matchClient && !matchPin && !matchItems) return false;
      }
      return true;
    });
  }, [activeSubTab, specialDocs, moduleDocs, statusFilter, searchQuery]);

  // Export Filtered Journal to Native Formatted Excel (.xlsx)
  const handleExportXlsx = async () => {
    if (filteredJournalDocs.length === 0) {
      alert('No documents to export in the current view.');
      return;
    }

    const columns = [
      { header: 'Doc Number', key: 'documentNumber', type: 'code' as const, width: 14 },
      { header: 'Doc Type', key: 'documentType', type: 'text' as const, width: 12 },
      { header: 'Client / Guest Name', key: 'clientName', type: 'text' as const, width: 26 },
      { header: 'Phone Number', key: 'clientPhone', type: 'code' as const, width: 16 },
      { header: 'KRA PIN', key: 'clientKraPin', type: 'code' as const, width: 14 },
      { header: 'Issue Date', key: 'issueDate', type: 'date' as const, width: 13 },
      { header: moduleType === 'QUOTATION' ? 'Valid Until' : 'Due Date', key: 'dueDate', type: 'date' as const, width: 13 },
      { header: 'Subtotal (Ksh)', key: 'subtotal', type: 'currency' as const, width: 16 },
      { header: 'VAT 16% (Ksh)', key: 'vatAmount', type: 'currency' as const, width: 15 },
      { header: 'Grand Total (Ksh)', key: 'grandTotal', type: 'currency' as const, width: 18 },
      ...(moduleType === 'INVOICE'
        ? [
            { header: 'Paid (Ksh)', key: 'amountPaid', type: 'currency' as const, width: 16 },
            { header: 'Balance Due (Ksh)', key: 'balanceDue', type: 'currency' as const, width: 18 },
          ]
        : []),
      { header: 'Status', key: 'status', type: 'status' as const, width: 12 },
    ];

    const data = filteredJournalDocs.map((doc) => ({
      documentNumber: doc.documentNumber,
      documentType: doc.documentType,
      clientName: doc.clientName,
      clientPhone: doc.clientPhone || '-',
      clientKraPin: doc.clientKraPin || '-',
      issueDate: doc.issueDate,
      dueDate: doc.dueDate || '-',
      subtotal: doc.subtotal,
      vatAmount: doc.vatAmount,
      grandTotal: doc.grandTotal,
      amountPaid: doc.amountPaid || 0,
      balanceDue: doc.balanceDue || 0,
      status: doc.status,
    }));

    await exportTableToXlsx({
      title: `${config.title} Journal Register`,
      sheetName: `${moduleType}_Journal`,
      profile,
      columns,
      data,
      filename: `HotelDamview_${moduleType}_Journal_${formatDate()}.xlsx`,
    });
  };

  // Top metric card values
  const metrics = useMemo(() => {
    const totalCount = moduleDocs.length;
    const totalValue = moduleDocs.reduce((acc, d) => acc + d.grandTotal, 0);

    if (moduleType === 'QUOTATION') {
      const activeCount = moduleDocs.filter((d) => d.status !== 'Paid').length;
      const expiredCount = specialDocs.length;
      return {
        card1Title: 'Total Quotations',
        card1Val: totalCount.toString(),
        card1Sub: 'All historical proposals',
        card2Title: 'Active Estimates',
        card2Val: formatKsh(totalValue),
        card2Sub: `${activeCount} pending acceptance`,
        card3Title: 'Expired / Lapsed',
        card3Val: expiredCount.toString(),
        card3Sub: 'Requires re-negotiation',
      };
    } else if (moduleType === 'PROFORMA') {
      const convertedCount = specialDocs.length;
      const unbilledValue = moduleDocs
        .filter((d) => !specialDocs.includes(d))
        .reduce((acc, d) => acc + d.grandTotal, 0);
      return {
        card1Title: 'Proformas Issued',
        card1Val: totalCount.toString(),
        card1Sub: 'Advance billing vouchers',
        card2Title: 'Pending Invoicing',
        card2Val: formatKsh(unbilledValue),
        card2Sub: 'Awaiting final delivery',
        card3Title: 'Converted to Tax Invoice',
        card3Val: convertedCount.toString(),
        card3Sub: 'Fulfilled & billed',
      };
    } else {
      // INVOICE
      const totalPaid = moduleDocs.reduce((acc, d) => acc + (d.amountPaid || 0), 0);
      const totalReceivables = moduleDocs.reduce((acc, d) => acc + (d.balanceDue || 0), 0);
      return {
        card1Title: 'Billed Revenue',
        card1Val: formatKsh(totalValue),
        card1Sub: `${totalCount} Tax Invoices (16% VAT)`,
        card2Title: 'Collected Revenue',
        card2Val: formatKsh(totalPaid),
        card2Sub: 'Settled bank/cash/M-Pesa',
        card3Title: 'Accounts Receivable',
        card3Val: formatKsh(totalReceivables),
        card3Sub: `${specialDocs.length} outstanding invoices`,
      };
    }
  }, [moduleDocs, moduleType, specialDocs]);

  // Tab configurations
  const config = useMemo(() => {
    switch (moduleType) {
      case 'QUOTATION':
        return {
          title: 'Quotations & Estimates',
          description: 'Create and track pricing proposals and event estimates for corporate clients and guests.',
          icon: FileClock,
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
    }, 250);
  };

  // Quick print helper
  const handleQuickPrint = (doc: BillingDocument) => {
    setSelectedDocForPreview(doc);
    setTimeout(() => {
      window.print();
    }, 250);
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
            handleQuickWhatsApp(doc);
          }
        } catch (err: any) {
          console.error('Share error:', err);
        }
      }
      setIsGeneratingPdf(false);
    }, 250);
  };

  // Quick WhatsApp helper
  const handleQuickWhatsApp = (doc: BillingDocument) => {
    setSelectedDocForPreview(doc);
    const waUrl = getWhatsAppShareUrl(doc, profile, doc.clientPhone, doc.driveFileUrl);
    window.open(waUrl, '_blank', 'noopener,noreferrer');
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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
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
    <div className="flex flex-col h-full bg-stone-100 text-stone-900 overflow-hidden">
      {/* MODULE HEADER & SUB-TABS */}
      <div className="no-print bg-stone-900 text-white border-b border-stone-800 shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Icon className="w-5 h-5 text-amber-400" />
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white font-serif">
                  {config.title}
                </h1>
              </div>
              <p className="text-xs text-stone-400 mt-0.5 hidden sm:block">
                {config.description}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onStartNewDocument(moduleType);
                  setActiveSubTab('new');
                }}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Create {moduleType === 'QUOTATION' ? 'Quote' : moduleType === 'PROFORMA' ? 'Proforma' : 'Invoice'}</span>
              </button>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex items-center space-x-1 border-t border-stone-800 pt-2 text-xs font-semibold overflow-x-auto">
            <button
              type="button"
              onClick={() => {
                if (!editingDocument) {
                  onStartNewDocument(moduleType);
                }
                setActiveSubTab('new');
              }}
              className={`px-3 py-2 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeSubTab === 'new'
                  ? 'border-amber-400 text-amber-400 font-bold bg-stone-800/40'
                  : 'border-transparent text-stone-400 hover:text-white hover:bg-stone-800/20'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{config.newTabLabel}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('journal')}
              className={`px-3 py-2 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeSubTab === 'journal'
                  ? 'border-amber-400 text-amber-400 font-bold bg-stone-800/40'
                  : 'border-transparent text-stone-400 hover:text-white hover:bg-stone-800/20'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{config.journalTabLabel}</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-stone-800 rounded-full text-stone-300 ml-1">
                {moduleDocs.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('special')}
              className={`px-3 py-2 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeSubTab === 'special'
                  ? 'border-amber-400 text-amber-400 font-bold bg-stone-800/40'
                  : 'border-transparent text-stone-400 hover:text-white hover:bg-stone-800/20'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-stone-100">
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

          {/* Search, Status Filters & CSV Export */}
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

            <div className="flex items-center gap-2 text-xs flex-wrap">
              <span className="text-stone-500 font-medium flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Status:
              </span>
              {(['ALL', 'Draft', 'Sent', 'Paid', 'Overdue'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                    statusFilter === s
                      ? 'bg-stone-900 text-amber-400'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {s}
                </button>
              ))}

              <div className="h-4 w-px bg-stone-300 mx-1" />

              {/* Excel Ledger Export Button */}
              <button
                type="button"
                onClick={handleExportXlsx}
                className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium rounded border border-stone-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Export filtered list to formatted Excel (.xlsx) spreadsheet"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export Excel (.xlsx)</span>
              </button>
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
                      <>
                        <th className="py-2.5 px-3 text-right">Paid</th>
                        <th className="py-2.5 px-3 text-right">Balance Due</th>
                      </>
                    )}
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Drive PDF Link</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {filteredJournalDocs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={moduleType === 'INVOICE' ? 10 : 8}
                        className="py-12 text-center text-stone-500"
                      >
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <Icon className="w-8 h-8 text-stone-300 stroke-[1.5]" />
                          <p className="text-sm font-medium text-stone-600">No {config.title.toLowerCase()} found</p>
                          <p className="text-xs text-stone-400">
                            {searchQuery ? 'Try adjusting your search criteria.' : `Click "+ Create" above to issue your first ${moduleType.toLowerCase()}.`}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredJournalDocs.map((doc) => (
                      <tr key={doc.id} className="hover:bg-amber-50/40 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-stone-900 whitespace-nowrap">
                          {doc.documentNumber}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-stone-800">
                          <div className="truncate max-w-[200px]" title={doc.clientName}>
                            {doc.clientName}
                          </div>
                          {doc.clientAddress && (
                            <div className="text-[10px] text-stone-500 truncate max-w-[200px]">
                              {doc.clientAddress}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-stone-600 whitespace-nowrap">
                          {formatDate(doc.issueDate)}
                        </td>
                        <td className="py-2.5 px-3 text-stone-600 whitespace-nowrap">
                          {doc.dueDate ? formatDate(doc.dueDate) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-stone-900 whitespace-nowrap tabular-decimals">
                          {formatKsh(doc.grandTotal)}
                        </td>
                        {moduleType === 'INVOICE' && (
                          <>
                            <td className="py-2.5 px-3 text-right text-emerald-700 font-medium whitespace-nowrap tabular-decimals">
                              {formatKsh(doc.amountPaid || 0)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold whitespace-nowrap tabular-decimals">
                              <span className={(doc.balanceDue || 0) > 0 ? 'text-rose-700' : 'text-stone-400'}>
                                {formatKsh(doc.balanceDue || 0)}
                              </span>
                            </td>
                          </>
                        )}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {getStatusBadge(doc.status)}
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
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            {/* View / Print Preview */}
                            <button
                              type="button"
                              onClick={() => setSelectedDocForPreview(doc)}
                              className="p-1 rounded text-stone-600 hover:text-stone-900 hover:bg-stone-200 cursor-pointer"
                              title="Preview Document"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Edit */}
                            <button
                              type="button"
                              onClick={() => {
                                onStartEditDocument(doc);
                                setActiveSubTab('new');
                              }}
                              className="p-1 rounded text-stone-600 hover:text-amber-800 hover:bg-amber-100 cursor-pointer"
                              title="Edit Document"
                            >
                              <Edit className="w-4 h-4" />
                            </button>

                            {/* WhatsApp Share Link */}
                            <a
                              href={getWhatsAppShareUrl(doc, profile)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 cursor-pointer"
                              title="Share summary via WhatsApp"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </a>

                            {/* Download PDF */}
                            <button
                              type="button"
                              onClick={() => handleQuickDownload(doc)}
                              className="p-1 rounded text-stone-600 hover:text-stone-900 hover:bg-stone-200 cursor-pointer"
                              title="Download PDF"
                            >
                              <Download className="w-4 h-4" />
                            </button>

                            {/* Proforma Lifecycle Conversion */}
                            {moduleType === 'PROFORMA' && (
                              <button
                                type="button"
                                onClick={() => onConvertDocument(doc, 'INVOICE')}
                                className="p-1 rounded text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                                title="Convert to Tax Invoice"
                              >
                                <ArrowRightLeft className="w-4 h-4" />
                              </button>
                            )}

                            {/* Invoice Settlement Trigger */}
                            {moduleType === 'INVOICE' && (doc.balanceDue || 0) > 0 && (
                              <button
                                type="button"
                                onClick={() => onRecordPayment(doc)}
                                className="px-2 py-0.5 rounded bg-emerald-800 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
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
                              className="p-1 rounded text-stone-400 hover:text-rose-600 hover:bg-stone-100 cursor-pointer"
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
              {/* WhatsApp Share Direct Button */}
              <a
                href={getWhatsAppShareUrl(selectedDocForPreview, profile)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                title="Send invoice statement to client WhatsApp"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">WhatsApp</span>
              </a>

              <button
                type="button"
                onClick={() => handleQuickDownload(selectedDocForPreview)}
                disabled={isGeneratingPdf}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded text-xs flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isGeneratingPdf ? 'Generating...' : 'Download PDF'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickPrint(selectedDocForPreview)}
                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-white font-medium rounded text-xs flex items-center gap-1 border border-stone-700 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickShare(selectedDocForPreview)}
                disabled={isGeneratingPdf}
                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-amber-300 font-medium rounded text-xs flex items-center gap-1 border border-stone-700 transition-colors cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDocForPreview(null)}
                className="p-1 text-stone-400 hover:text-white rounded hover:bg-stone-800 transition-colors ml-1 cursor-pointer"
                title="Close Preview"
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
