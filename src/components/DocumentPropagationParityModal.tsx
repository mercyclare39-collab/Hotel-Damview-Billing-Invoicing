import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  BillingDocument,
  LineItem,
} from '../types';
import {
  validatePropagatedDocumentParity,
  DocumentPropagationParityValidation,
} from '../services/schemaDiagnostics';
import { syncManager } from '../services/sync';
import { dbService } from '../services/db';
import { appNotificationService } from '../services/appNotificationService';
import { propagationVarianceService } from '../services/propagationVarianceService';
import { formatKsh, formatDate } from '../utils/formatters';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  X,
  Layers,
  ArrowRight,
  UploadCloud,
  FileSpreadsheet,
  Check,
  Clock,
  Sparkles,
  Search,
  Filter,
  ChevronRight,
  ChevronLeft,
  Eye,
  FileText,
  TrendingUp,
  LayoutGrid,
  ListFilter,
  CheckSquare,
} from 'lucide-react';

export interface DocumentParityAuditItem {
  localDoc: BillingDocument;
  remoteDoc: BillingDocument | null;
  validation: DocumentPropagationParityValidation | null;
  status: 'MATCH' | 'VARIANCE' | 'NOT_IN_SHEET';
  summary: string;
  differencesCount: number;
}

export interface DocumentPropagationParityModalProps {
  document?: BillingDocument | null;
  targetDocumentNumber?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onRefreshDocument?: (updatedDoc: BillingDocument) => void;
  onRefreshAllDocuments?: (updatedDocs: BillingDocument[]) => void;
}

export const DocumentPropagationParityModal: React.FC<DocumentPropagationParityModalProps> = ({
  document: initialDoc,
  targetDocumentNumber,
  isOpen,
  onClose,
  onRefreshDocument,
  onRefreshAllDocuments,
}) => {
  const [auditItems, setAuditItems] = useState<DocumentParityAuditItem[]>([]);
  const [selectedDocNumber, setSelectedDocNumber] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ALL' | 'DETAIL'>('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Filters & Search for All Documents View
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'VARIANCE' | 'MATCH' | 'NOT_IN_SHEET'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INVOICE' | 'QUOTATION' | 'PROFORMA'>('ALL');

  // Auto-close countdown state (when 100% parity is verified)
  const [autoCloseCountdown, setAutoCloseCountdown] = useState<number | null>(null);
  const [isAutoClosePaused, setIsAutoClosePaused] = useState(false);
  const [autoCloseCancelled, setAutoCloseCancelled] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleCloseWithResolution = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    // Resolve all active document propagation notifications if all match
    const varianceItems = auditItems.filter((i) => i.status === 'VARIANCE');
    if (varianceItems.length === 0) {
      auditItems.forEach((i) => {
        if (i.localDoc.documentNumber) {
          appNotificationService.resolvePropagation(i.localDoc.documentNumber);
        }
      });
    } else if (selectedDocNumber) {
      const selectedItem = auditItems.find((i) => i.localDoc.documentNumber === selectedDocNumber);
      if (selectedItem && selectedItem.status === 'MATCH') {
        appNotificationService.resolvePropagation(selectedDocNumber);
      }
    }
    onClose();
  };

  // Run full validation across ALL documents in the local database against Google Sheets
  const runAllDocumentsValidation = async (targetDocNum?: string | null) => {
    setIsLoading(true);
    setErrorMsg(null);
    setActionFeedback(null);

    try {
      // 1. Fetch all local documents
      const allLocalDocs = await dbService.getDocuments();

      if (!allLocalDocs || allLocalDocs.length === 0) {
        if (initialDoc) {
          allLocalDocs.push(initialDoc);
        } else {
          setAuditItems([]);
          setIsLoading(false);
          return;
        }
      }

      // 2. Fetch remote Google Sheets data
      const fetchRes = await syncManager.fetchSheetData();
      if (!fetchRes.success || !fetchRes.data) {
        throw new Error(fetchRes.error || 'Could not retrieve data from Google Sheets.');
      }

      const remoteData = fetchRes.data;
      const remoteInvoices = Array.isArray(remoteData.invoices) ? remoteData.invoices : [];
      const remoteQuotations = Array.isArray(remoteData.quotations) ? remoteData.quotations : [];
      const remoteProformas = Array.isArray(remoteData.proformas) ? remoteData.proformas : [];
      const remoteLineItemsRaw = Array.isArray(remoteData.lineItems) ? remoteData.lineItems : [];

      // 3. Build lookup maps for fast matching
      const sheetInvoicesMap = new Map<string, any>();
      remoteInvoices.forEach((inv) => {
        const num = (inv.documentNumber || '').trim().toLowerCase();
        if (num) sheetInvoicesMap.set(num, inv);
      });

      const sheetQuotationsMap = new Map<string, any>();
      remoteQuotations.forEach((quot) => {
        const num = (quot.documentNumber || '').trim().toLowerCase();
        if (num) sheetQuotationsMap.set(num, quot);
      });

      const sheetProformasMap = new Map<string, any>();
      remoteProformas.forEach((prof) => {
        const num = (prof.documentNumber || '').trim().toLowerCase();
        if (num) sheetProformasMap.set(num, prof);
      });

      // Group remote line items by document number
      const sheetLineItemsMap = new Map<string, LineItem[]>();
      remoteLineItemsRaw.forEach((li) => {
        const docNum = (li.documentNumber || '').trim().toLowerCase();
        if (!docNum) return;

        const currentList = sheetLineItemsMap.get(docNum) || [];
        currentList.push({
          id: li.id || `LI-${currentList.length + 1}`,
          particulars: li.particulars || 'Hospitality Service',
          quantity: Number(li.quantity) || 1,
          days: Number(li.days) || 1,
          rate: Number(li.rate) || 0,
          discount: Number(li.discount) || 0,
          amount: Number(li.totalAmount !== undefined ? li.totalAmount : li.amount) || 0,
        });
        sheetLineItemsMap.set(docNum, currentList);
      });

      // 4. Audit every local document
      const auditedResults: DocumentParityAuditItem[] = [];

      for (const localDoc of allLocalDocs) {
        const docNumKey = (localDoc.documentNumber || '').trim().toLowerCase();
        let foundRemote: any = null;

        if (localDoc.documentType === 'INVOICE') {
          foundRemote = sheetInvoicesMap.get(docNumKey);
        } else if (localDoc.documentType === 'QUOTATION') {
          foundRemote = sheetQuotationsMap.get(docNumKey);
        } else {
          foundRemote = sheetProformasMap.get(docNumKey);
        }

        if (!foundRemote) {
          auditedResults.push({
            localDoc,
            remoteDoc: null,
            validation: null,
            status: 'NOT_IN_SHEET',
            summary: 'Document not found in Google Sheets. It may be queued for offline synchronization.',
            differencesCount: 1,
          });
          continue;
        }

        // Reconstruct remote line items
        const remoteItems = sheetLineItemsMap.get(docNumKey) || foundRemote.lineItems || [];
        const reconstructedRemoteDoc: BillingDocument = {
          ...localDoc,
          ...foundRemote,
          lineItems: remoteItems.length > 0 ? remoteItems : foundRemote.lineItems || [],
        };

        // Deep parity validation
        const validation = validatePropagatedDocumentParity(localDoc, reconstructedRemoteDoc, true);

        auditedResults.push({
          localDoc,
          remoteDoc: reconstructedRemoteDoc,
          validation,
          status: validation.isIdentical ? 'MATCH' : 'VARIANCE',
          summary: validation.summary,
          differencesCount: validation.differencesCount,
        });
      }

      setAuditItems(auditedResults);

      // Determine selected document
      const requestedNum = targetDocNum || initialDoc?.documentNumber || targetDocumentNumber;
      if (requestedNum) {
        const found = auditedResults.find(
          (i) => i.localDoc.documentNumber.trim().toLowerCase() === requestedNum.trim().toLowerCase()
        );
        if (found) {
          setSelectedDocNumber(found.localDoc.documentNumber);
          setActiveTab('DETAIL');
        } else if (auditedResults.length > 0) {
          setSelectedDocNumber(auditedResults[0].localDoc.documentNumber);
        }
      } else {
        // If there are variances, default selection to first variance document; otherwise first doc
        const firstVariance = auditedResults.find((i) => i.status === 'VARIANCE');
        if (firstVariance) {
          setSelectedDocNumber(firstVariance.localDoc.documentNumber);
        } else if (auditedResults.length > 0) {
          setSelectedDocNumber(auditedResults[0].localDoc.documentNumber);
        }
        setActiveTab('ALL');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to compare all documents with Google Sheets.');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial trigger
  useEffect(() => {
    if (isOpen) {
      setAutoCloseCancelled(false);
      setIsAutoClosePaused(false);
      const initialTarget = initialDoc?.documentNumber || targetDocumentNumber || null;
      runAllDocumentsValidation(initialTarget);
    } else {
      setAuditItems([]);
      setSelectedDocNumber(null);
      setErrorMsg(null);
      setActionFeedback(null);
      setAutoCloseCountdown(null);
      setBatchProgress(null);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isOpen, initialDoc, targetDocumentNumber]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseWithResolution();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, auditItems, selectedDocNumber]);

  // Active selected audit item
  const selectedAuditItem = useMemo(() => {
    if (!selectedDocNumber) return auditItems[0] || null;
    return auditItems.find((i) => i.localDoc.documentNumber === selectedDocNumber) || auditItems[0] || null;
  }, [auditItems, selectedDocNumber]);

  // Aggregate Metrics
  const stats = useMemo(() => {
    const total = auditItems.length;
    const matched = auditItems.filter((i) => i.status === 'MATCH').length;
    const variances = auditItems.filter((i) => i.status === 'VARIANCE').length;
    const notInSheet = auditItems.filter((i) => i.status === 'NOT_IN_SHEET').length;
    const parityPercentage = total > 0 ? Math.round((matched / total) * 100) : 0;
    const totalLineItems = auditItems.reduce((acc, i) => acc + (i.localDoc.lineItems?.length || 0), 0);

    return {
      total,
      matched,
      variances,
      notInSheet,
      parityPercentage,
      totalLineItems,
      allIdentical: total > 0 && variances === 0 && notInSheet === 0,
    };
  }, [auditItems]);

  // Auto-close management
  useEffect(() => {
    if (stats.allIdentical && !autoCloseCancelled) {
      setAutoCloseCountdown(4);
    } else if (activeTab === 'DETAIL' && selectedAuditItem?.status === 'MATCH' && !autoCloseCancelled) {
      setAutoCloseCountdown(4);
    } else {
      setAutoCloseCountdown(null);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [stats.allIdentical, selectedAuditItem?.status, activeTab, autoCloseCancelled]);

  useEffect(() => {
    if (autoCloseCountdown === null || isAutoClosePaused || autoCloseCancelled) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setAutoCloseCountdown((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          handleCloseWithResolution();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [autoCloseCountdown, isAutoClosePaused, autoCloseCancelled]);

  // Filtered documents for All-Documents Table
  const filteredAuditItems = useMemo(() => {
    return auditItems.filter((item) => {
      // Status filter
      if (statusFilter !== 'ALL' && item.status !== statusFilter) {
        return false;
      }
      // Type filter
      if (typeFilter !== 'ALL' && item.localDoc.documentType !== typeFilter) {
        return false;
      }
      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const docNum = (item.localDoc.documentNumber || '').toLowerCase();
        const client = (item.localDoc.clientName || '').toLowerCase();
        const kra = (item.localDoc.clientKraPin || '').toLowerCase();
        return docNum.includes(query) || client.includes(query) || kra.includes(query);
      }
      return true;
    });
  }, [auditItems, statusFilter, typeFilter, searchTerm]);

  // Single document auto-resolve
  const handleAutoResolveSingle = async (doc: BillingDocument, remoteDoc: BillingDocument | null) => {
    setIsSyncing(true);
    setErrorMsg(null);
    setActionFeedback(null);
    try {
      const res = await propagationVarianceService.executeAutoResolve(doc, remoteDoc);
      if (res.success) {
        setActionFeedback(
          `Document ${doc.documentNumber} auto-changed and resolved to accurate data with all line items and tax calculations synchronized.`
        );
        if (onRefreshDocument) {
          onRefreshDocument(res.document);
        }
        // Re-run validation across all documents to verify 100% parity
        await runAllDocumentsValidation(doc.documentNumber);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to auto-resolve document to accurate data.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Batch auto-resolve for ALL documents with variances
  const handleAutoResolveAllVariances = async () => {
    const varianceItems = auditItems.filter((i) => i.status === 'VARIANCE');
    if (varianceItems.length === 0) return;

    setIsSyncing(true);
    setErrorMsg(null);
    setActionFeedback(null);
    setBatchProgress({ current: 0, total: varianceItems.length });

    const healedDocs: BillingDocument[] = [];

    try {
      for (let idx = 0; idx < varianceItems.length; idx++) {
        const item = varianceItems[idx];
        setBatchProgress({ current: idx + 1, total: varianceItems.length });
        const res = await propagationVarianceService.executeAutoResolve(item.localDoc, item.remoteDoc);
        if (res.success) {
          healedDocs.push(res.document);
          if (onRefreshDocument && item.localDoc.documentNumber === selectedDocNumber) {
            onRefreshDocument(res.document);
          }
        }
      }

      if (onRefreshAllDocuments && healedDocs.length > 0) {
        onRefreshAllDocuments(healedDocs);
      }

      setActionFeedback(
        `Successfully auto-resolved ${healedDocs.length} of ${varianceItems.length} document(s) with accurate line items and 100% Google Sheets parity.`
      );

      // Re-run validation across all documents
      await runAllDocumentsValidation(selectedDocNumber);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred during batch auto-resolution.');
    } finally {
      setIsSyncing(false);
      setBatchProgress(null);
    }
  };

  // Batch push all local documents out-of-sync to Google Sheets
  const handlePushAllToSheets = async () => {
    const outOfSyncItems = auditItems.filter((i) => i.status !== 'MATCH');
    if (outOfSyncItems.length === 0) return;

    setIsSyncing(true);
    setErrorMsg(null);
    setActionFeedback(null);
    setBatchProgress({ current: 0, total: outOfSyncItems.length });

    try {
      let successCount = 0;
      for (let idx = 0; idx < outOfSyncItems.length; idx++) {
        const item = outOfSyncItems[idx];
        setBatchProgress({ current: idx + 1, total: outOfSyncItems.length });
        const res = await syncManager.syncDocument(item.localDoc);
        if (res.success) successCount++;
      }

      setActionFeedback(`Successfully pushed ${successCount} document(s) to Google Sheets.`);
      // Re-run validation across all documents
      await runAllDocumentsValidation(selectedDocNumber);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred while pushing documents to Google Sheets.');
    } finally {
      setIsSyncing(false);
      setBatchProgress(null);
    }
  };

  // Single document push to Sheets
  const handlePushLocalSingle = async (doc: BillingDocument) => {
    setIsSyncing(true);
    setActionFeedback(null);
    setErrorMsg(null);
    try {
      const res = await syncManager.syncDocument(doc);
      if (res.success) {
        setActionFeedback(`Document ${doc.documentNumber} successfully pushed to Google Sheets.`);
        appNotificationService.notifySync(
          'Document Propagated to Sheets',
          `Document ${doc.documentNumber} was successfully pushed to Google Sheets with all ${doc.lineItems.length} line items.`,
          'SUCCESS'
        );
        await runAllDocumentsValidation(doc.documentNumber);
      } else {
        setErrorMsg(res.error || 'Failed to push document to Google Sheets.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error pushing document.');
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-950/85 backdrop-blur-xs no-print animate-fade-in"
      onClick={handleCloseWithResolution}
    >
      <div
        className="bg-stone-900 border border-stone-700 rounded-xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col text-stone-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-800 flex items-center justify-between bg-stone-950/90 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm sm:text-base text-white">
                  Document Propagation Parity Validator
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-800 text-amber-400 border border-stone-700">
                  {stats.total} Documents Audited
                </span>
                {stats.allIdentical ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-900/90 text-emerald-300 border border-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>100% Fleet Parity</span>
                  </span>
                ) : stats.variances > 0 ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-900/90 text-amber-300 border border-amber-700 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    <span>{stats.variances} Variance(s)</span>
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-stone-400 mt-0.5 truncate">
                Real-time bidirectional verification across all Invoices, Quotations, Proformas, line items, and formulas.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => runAllDocumentsValidation(selectedDocNumber)}
              disabled={isLoading || isSyncing}
              className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-amber-400 border border-stone-700 transition-colors cursor-pointer disabled:opacity-50"
              title="Re-run parity validation across all documents"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={handleCloseWithResolution}
              className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
              title="Close Parity Validator"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* View Switcher Tabs & Quick Summary Strip */}
        <div className="px-5 py-2.5 bg-stone-950/60 border-b border-stone-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 bg-stone-900 p-1 rounded-lg border border-stone-800 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1 rounded font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'ALL'
                  ? 'bg-amber-500 text-stone-950 shadow-xs'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>All Documents ({stats.total})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('DETAIL')}
              disabled={!selectedAuditItem}
              className={`px-3 py-1 rounded font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                activeTab === 'DETAIL'
                  ? 'bg-amber-500 text-stone-950 shadow-xs'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>
                Deep Inspector {selectedAuditItem ? `(${selectedAuditItem.localDoc.documentNumber})` : ''}
              </span>
            </button>
          </div>

          {/* Aggregate Stats Badges */}
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <div className="px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{stats.matched} In Parity</span>
            </div>
            {stats.variances > 0 && (
              <div className="px-2.5 py-1 rounded-lg bg-amber-950/60 border border-amber-800/80 text-amber-300 flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>{stats.variances} Variance(s)</span>
              </div>
            )}
            {stats.notInSheet > 0 && (
              <div className="px-2.5 py-1 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-300 flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5 text-rose-400" />
                <span>{stats.notInSheet} Missing in Sheets</span>
              </div>
            )}
            <div className="px-2.5 py-1 rounded-lg bg-stone-800/80 border border-stone-700 text-stone-300 font-mono text-[11px]">
              Parity: <strong className="text-amber-400 font-bold">{stats.parityPercentage}%</strong>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div
          className="p-5 overflow-y-auto space-y-5 flex-1"
          onMouseEnter={() => {
            if (autoCloseCountdown !== null && !autoCloseCancelled) {
              setIsAutoClosePaused(true);
            }
          }}
          onMouseLeave={() => {
            if (autoCloseCountdown !== null && !autoCloseCancelled) {
              setIsAutoClosePaused(false);
            }
          }}
        >
          {/* Loading State */}
          {isLoading && (
            <div className="py-16 text-center text-stone-400 space-y-3">
              <RefreshCw className="w-9 h-9 animate-spin mx-auto text-amber-400" />
              <p className="text-sm font-semibold text-stone-200">
                Auditing All ERP Documents & Line Items in Google Sheets...
              </p>
              <p className="text-xs text-stone-500 max-w-md mx-auto">
                Comparing particulars, quantities, unit rates, Kenya VAT formulas, and totals across the entire fleet.
              </p>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && !isLoading && (
            <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-lg text-rose-200 text-xs flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-rose-300">Google Sheets Parity Warning</p>
                <p>{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Action Feedback */}
          {actionFeedback && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-lg text-emerald-200 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{actionFeedback}</span>
            </div>
          )}

          {/* Batch Progress Bar */}
          {isSyncing && batchProgress && (
            <div className="p-3 bg-stone-950/80 border border-amber-800/60 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-amber-200">
                <span className="flex items-center gap-1.5 font-bold">
                  <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
                  <span>
                    Auto-Resolving Document Parity ({batchProgress.current} of {batchProgress.total})...
                  </span>
                </span>
                <span className="font-mono text-[11px] text-amber-400 font-bold">
                  {Math.round((batchProgress.current / batchProgress.total) * 100)}%
                </span>
              </div>
              <div className="w-full bg-stone-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-amber-500 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {!isLoading && auditItems.length === 0 && (
            <div className="py-12 text-center text-stone-500 space-y-2">
              <FileText className="w-8 h-8 mx-auto opacity-40" />
              <p className="text-sm font-medium">No billing documents recorded in local database to validate.</p>
            </div>
          )}

          {/* TAB 1: ALL DOCUMENTS PARITY OVERVIEW */}
          {!isLoading && activeTab === 'ALL' && auditItems.length > 0 && (
            <div className="space-y-4">
              {/* Batch Action Bar */}
              <div className="p-4 bg-stone-950/80 border border-stone-800 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-stone-200 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                    <span>Fleet Parity Overview ({stats.total} Documents Audited)</span>
                  </h4>
                  <p className="text-xs text-stone-400">
                    {stats.variances > 0
                      ? `${stats.variances} document(s) require auto-resolution to synchronize with Google Sheets.`
                      : 'All documents in local database are in complete parity with Google Sheets.'}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap self-end sm:self-center">
                  {stats.variances > 0 && (
                    <button
                      type="button"
                      onClick={handleAutoResolveAllVariances}
                      disabled={isSyncing}
                      className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-stone-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                      title="Automatically heal line items, tax formulas, and sync all documents with variances"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>Auto-Resolve All ({stats.variances})</span>
                    </button>
                  )}

                  {stats.notInSheet > 0 && (
                    <button
                      type="button"
                      onClick={handlePushAllToSheets}
                      disabled={isSyncing}
                      className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-amber-300 border border-stone-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <UploadCloud className={`w-3.5 h-3.5 ${isSyncing ? 'animate-bounce' : ''}`} />
                      <span>Push Missing to Sheets ({stats.notInSheet})</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Filters & Search Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by doc #, client, or KRA PIN..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-stone-950 border border-stone-800 rounded-lg text-xs text-stone-200 placeholder-stone-500 focus:outline-hidden focus:border-amber-500"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
                  {/* Status Pills */}
                  <div className="flex items-center bg-stone-950 p-1 rounded-lg border border-stone-800">
                    <button
                      type="button"
                      onClick={() => setStatusFilter('ALL')}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                        statusFilter === 'ALL' ? 'bg-amber-500 text-stone-950 font-bold' : 'text-stone-400 hover:text-white'
                      }`}
                    >
                      All ({stats.total})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('VARIANCE')}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                        statusFilter === 'VARIANCE' ? 'bg-amber-500 text-stone-950 font-bold' : 'text-amber-400 hover:text-amber-300'
                      }`}
                    >
                      Variances ({stats.variances})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('MATCH')}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                        statusFilter === 'MATCH' ? 'bg-emerald-600 text-white font-bold' : 'text-emerald-400 hover:text-emerald-300'
                      }`}
                    >
                      Matched ({stats.matched})
                    </button>
                    {stats.notInSheet > 0 && (
                      <button
                        type="button"
                        onClick={() => setStatusFilter('NOT_IN_SHEET')}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                          statusFilter === 'NOT_IN_SHEET' ? 'bg-rose-600 text-white font-bold' : 'text-rose-400 hover:text-rose-300'
                        }`}
                      >
                        Missing ({stats.notInSheet})
                      </button>
                    )}
                  </div>

                  {/* Type Filter */}
                  <select
                    value={typeFilter}
                    onChange={(e: any) => setTypeFilter(e.target.value)}
                    className="bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1 text-[11px] text-stone-300 focus:outline-hidden focus:border-amber-500 cursor-pointer"
                  >
                    <option value="ALL">All Document Types</option>
                    <option value="INVOICE">Invoices</option>
                    <option value="QUOTATION">Quotations</option>
                    <option value="PROFORMA">Proformas</option>
                  </select>
                </div>
              </div>

              {/* All Documents Parity Table */}
              <div className="border border-stone-800 rounded-lg overflow-x-auto bg-stone-950/60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-900/90 text-stone-400 text-[11px] font-semibold border-b border-stone-800">
                    <tr>
                      <th className="py-2.5 px-3">Document #</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Client</th>
                      <th className="py-2.5 px-3 text-center">Line Items</th>
                      <th className="py-2.5 px-3 text-right">Local Total</th>
                      <th className="py-2.5 px-3 text-right">Propagated Total</th>
                      <th className="py-2.5 px-3 text-center">Parity Status</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/80">
                    {filteredAuditItems.map((item) => {
                      const doc = item.localDoc;
                      const isMatch = item.status === 'MATCH';
                      const isVariance = item.status === 'VARIANCE';
                      const isMissing = item.status === 'NOT_IN_SHEET';

                      return (
                        <tr
                          key={doc.documentNumber}
                          className={`hover:bg-stone-800/40 transition-colors ${
                            isVariance ? 'bg-amber-950/20' : isMissing ? 'bg-rose-950/15' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDocNumber(doc.documentNumber);
                                setActiveTab('DETAIL');
                              }}
                              className="font-bold text-amber-400 hover:underline flex items-center gap-1 cursor-pointer font-mono"
                            >
                              <span>{doc.documentNumber}</span>
                              <ChevronRight className="w-3 h-3 text-stone-500" />
                            </button>
                            <span className="text-[10px] text-stone-500">{formatDate(doc.issueDate)}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-stone-800 text-stone-300">
                              {doc.documentType}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-stone-200">
                            <div>{doc.clientName}</div>
                            {doc.clientKraPin && (
                              <div className="text-[10px] text-stone-500 font-mono">PIN: {doc.clientKraPin}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-[11px]">
                            <span className="text-white">{doc.lineItems.length}</span>
                            {item.remoteDoc && item.remoteDoc.lineItems.length !== doc.lineItems.length && (
                              <span className="text-amber-400 ml-1 font-bold">
                                (Sheets: {item.remoteDoc.lineItems.length})
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-white tabular-nums">
                            {formatKsh(doc.grandTotal)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-stone-300 tabular-nums">
                            {item.remoteDoc ? (
                              <span
                                className={
                                  Math.abs((item.remoteDoc.grandTotal || 0) - doc.grandTotal) > 0.05
                                    ? 'text-amber-400 font-bold'
                                    : 'text-stone-300'
                                }
                              >
                                {formatKsh(item.remoteDoc.grandTotal || 0)}
                              </span>
                            ) : (
                              <span className="text-stone-500 italic">Not Propagated</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {isMatch && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                <span>100% Parity</span>
                              </span>
                            )}
                            {isVariance && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                                <AlertTriangle className="w-3 h-3 text-amber-400" />
                                <span>Variance ({item.differencesCount})</span>
                              </span>
                            )}
                            {isMissing && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                                <XCircle className="w-3 h-3 text-rose-400" />
                                <span>Not in Sheet</span>
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isVariance && (
                                <button
                                  type="button"
                                  onClick={() => handleAutoResolveSingle(doc, item.remoteDoc)}
                                  disabled={isSyncing}
                                  className="px-2 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-stone-950 font-bold rounded text-[10px] inline-flex items-center gap-1 cursor-pointer transition-all shadow-xs disabled:opacity-50"
                                  title="Auto change and resolve this document to accurate data"
                                >
                                  <Sparkles className="w-3 h-3" />
                                  <span>Resolve</span>
                                </button>
                              )}
                              {isMissing && (
                                <button
                                  type="button"
                                  onClick={() => handlePushLocalSingle(doc)}
                                  disabled={isSyncing}
                                  className="px-2 py-1 bg-stone-800 hover:bg-stone-700 text-amber-300 border border-stone-700 rounded text-[10px] inline-flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                                >
                                  <UploadCloud className="w-3 h-3" />
                                  <span>Push</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDocNumber(doc.documentNumber);
                                  setActiveTab('DETAIL');
                                }}
                                className="px-2 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white rounded text-[10px] font-semibold border border-stone-700 inline-flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <Eye className="w-3 h-3 text-stone-400" />
                                <span>Inspect</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: DEEP LINE ITEM INSPECTOR DRILLDOWN */}
          {!isLoading && activeTab === 'DETAIL' && selectedAuditItem && (
            <div className="space-y-4">
              {/* Document Selector & Navigation Bar */}
              <div className="p-3 bg-stone-950/80 border border-stone-800 rounded-xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setActiveTab('ALL')}
                    className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors border border-stone-700"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>All Documents</span>
                  </button>

                  <div className="h-4 w-px bg-stone-700 mx-1 hidden sm:block" />

                  <label className="text-xs text-stone-400">Inspecting Document:</label>
                  <select
                    value={selectedDocNumber || ''}
                    onChange={(e) => setSelectedDocNumber(e.target.value)}
                    className="bg-stone-900 border border-stone-700 rounded-lg px-2.5 py-1 text-xs text-amber-400 font-bold focus:outline-hidden focus:border-amber-500 cursor-pointer font-mono"
                  >
                    {auditItems.map((item) => (
                      <option key={item.localDoc.documentNumber} value={item.localDoc.documentNumber}>
                        {item.localDoc.documentNumber} - {item.localDoc.clientName} ({item.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                      selectedAuditItem.status === 'MATCH'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : selectedAuditItem.status === 'VARIANCE'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-rose-950 text-rose-300 border border-rose-800'
                    }`}
                  >
                    {selectedAuditItem.status === 'MATCH' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    {selectedAuditItem.status === 'VARIANCE' && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                    {selectedAuditItem.status === 'NOT_IN_SHEET' && <XCircle className="w-3.5 h-3.5 text-rose-400" />}
                    <span>{selectedAuditItem.status === 'MATCH' ? '100% Parity Verified' : selectedAuditItem.status}</span>
                  </span>
                </div>
              </div>

              {/* Status & Auto-Resolve Banner for Selected Document */}
              <div
                className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start justify-between gap-3.5 transition-all ${
                  selectedAuditItem.status === 'MATCH'
                    ? 'bg-emerald-950/40 border-emerald-700/80 text-emerald-200'
                    : 'bg-amber-950/40 border-amber-700/80 text-amber-200'
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  {selectedAuditItem.status === 'MATCH' ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">
                        {selectedAuditItem.status === 'MATCH'
                          ? '100% Parity Verified - Zero Variances Detected'
                          : `${selectedAuditItem.differencesCount} Variance(s) Detected in ${selectedAuditItem.localDoc.documentNumber}`}
                      </span>
                    </div>
                    <p className="text-xs text-stone-300 leading-relaxed">
                      {selectedAuditItem.summary}
                    </p>
                  </div>
                </div>

                {selectedAuditItem.status !== 'MATCH' && (
                  <button
                    type="button"
                    onClick={() =>
                      handleAutoResolveSingle(selectedAuditItem.localDoc, selectedAuditItem.remoteDoc)
                    }
                    disabled={isSyncing}
                    className="px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-stone-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer shrink-0 disabled:opacity-50 self-end sm:self-center"
                    title="Automatically heal all calculations, line items, and sync accurate data to Google Sheets"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Auto-Resolving...' : 'Auto-Resolve to Accurate Data'}</span>
                  </button>
                )}
              </div>

              {/* SECTION 1: Line Items Comparison Table */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-400" />
                    <h4 className="font-bold text-xs uppercase tracking-wider text-stone-200">
                      Line Items Deep Parity Breakdown
                    </h4>
                  </div>
                  <span className="text-[11px] text-stone-400 font-mono">
                    Local: {selectedAuditItem.localDoc.lineItems.length} items | Propagated:{' '}
                    {selectedAuditItem.remoteDoc?.lineItems.length || 0} items
                  </span>
                </div>

                {selectedAuditItem.validation?.lineItemsParity ? (
                  <div className="border border-stone-800 rounded-lg overflow-x-auto bg-stone-950/60">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-stone-900/90 text-stone-400 text-[11px] font-semibold border-b border-stone-800">
                        <tr>
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Particulars / Service</th>
                          <th className="py-2.5 px-3 text-center">Qty</th>
                          <th className="py-2.5 px-3 text-center">Days/Units</th>
                          <th className="py-2.5 px-3 text-right">Unit Rate</th>
                          <th className="py-2.5 px-3 text-right">Discount</th>
                          <th className="py-2.5 px-3 text-right">Line Total</th>
                          <th className="py-2.5 px-3 text-center">Parity Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-800/80">
                        {selectedAuditItem.validation.lineItemsParity.lineItemComparisons.map((item) => {
                          const isItemMatch =
                            item.particularsMatch &&
                            item.quantityMatch &&
                            item.daysMatch &&
                            item.rateMatch &&
                            item.discountMatch &&
                            item.amountMatch;

                          const originalLi = selectedAuditItem.localDoc.lineItems[item.index - 1];
                          const remoteLi = selectedAuditItem.remoteDoc?.lineItems[item.index - 1];

                          return (
                            <tr
                              key={item.index}
                              className={`hover:bg-stone-800/30 transition-colors ${
                                !isItemMatch ? 'bg-amber-950/20' : ''
                              }`}
                            >
                              <td className="py-2.5 px-3 font-mono text-stone-400">{item.index}</td>
                              <td className="py-2.5 px-3">
                                <div className="font-medium text-white">{item.originalParticulars}</div>
                                {!item.particularsMatch && (
                                  <div className="text-[10.5px] text-amber-400 flex items-center gap-1 mt-0.5">
                                    <span>Propagated:</span>
                                    <span className="font-semibold">{item.propagatedParticulars}</span>
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {originalLi?.quantity || 1}
                                {!item.quantityMatch && (
                                  <div className="text-[10px] text-amber-400 font-bold">
                                    Sheets: {remoteLi?.quantity || 1}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {originalLi?.days || 1}
                                {!item.daysMatch && (
                                  <div className="text-[10px] text-amber-400 font-bold">
                                    Sheets: {remoteLi?.days || 1}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right tabular-nums">
                                {formatKsh(originalLi?.rate || 0)}
                                {!item.rateMatch && (
                                  <div className="text-[10px] text-amber-400 font-bold">
                                    Sheets: {formatKsh(remoteLi?.rate || 0)}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right tabular-nums">
                                {formatKsh(originalLi?.discount || 0)}
                                {!item.discountMatch && (
                                  <div className="text-[10px] text-amber-400 font-bold">
                                    Sheets: {formatKsh(remoteLi?.discount || 0)}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-white tabular-nums">
                                {formatKsh(item.originalAmount)}
                                {!item.amountMatch && (
                                  <div className="text-[10px] text-amber-400 font-bold">
                                    Sheets: {formatKsh(item.propagatedAmount)}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {isItemMatch ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                    <Check className="w-2.5 h-2.5" />
                                    <span>Identical</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                                    <AlertTriangle className="w-2.5 h-2.5" />
                                    <span>Variance</span>
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 bg-stone-950/60 border border-stone-800 rounded-lg text-xs text-stone-400">
                    No remote line item parity comparison data available for this document.
                  </div>
                )}
              </div>

              {/* SECTION 2: Financial Totals & Client Metadata Grids */}
              {selectedAuditItem.validation?.detailsParity && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Financial Totals Parity */}
                  <div className="p-3.5 bg-stone-950/70 border border-stone-800 rounded-lg space-y-2.5">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-stone-300 flex items-center justify-between">
                      <span>Financial Totals Parity</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          selectedAuditItem.validation.detailsParity.grandTotalMatch &&
                          selectedAuditItem.validation.detailsParity.balanceDueMatch
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}
                      >
                        {selectedAuditItem.validation.detailsParity.grandTotalMatch ? 'TOTALS MATCH' : 'DISCREPANCY'}
                      </span>
                    </h4>

                    <div className="space-y-1.5 text-xs divide-y divide-stone-800/60">
                      <div className="flex justify-between py-1">
                        <span className="text-stone-400">Gross Subtotal:</span>
                        <div className="text-right">
                          <span className="font-semibold text-white">
                            {formatKsh(selectedAuditItem.localDoc.grossSubtotal)}
                          </span>
                          {!selectedAuditItem.validation.detailsParity.grossSubtotalMatch && (
                            <span className="text-amber-400 text-[11px] block">
                              Sheets: {formatKsh(selectedAuditItem.remoteDoc?.grossSubtotal || 0)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-between py-1">
                        <span className="text-stone-400">Discount:</span>
                        <div className="text-right">
                          <span className="font-semibold text-white">
                            {formatKsh(selectedAuditItem.localDoc.discount)}
                          </span>
                          {!selectedAuditItem.validation.detailsParity.discountMatch && (
                            <span className="text-amber-400 text-[11px] block">
                              Sheets: {formatKsh(selectedAuditItem.remoteDoc?.discount || 0)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-between py-1">
                        <span className="text-stone-400">VAT 16%:</span>
                        <div className="text-right">
                          <span className="font-semibold text-white">
                            {formatKsh(selectedAuditItem.localDoc.vatAmount)}
                          </span>
                          {!selectedAuditItem.validation.detailsParity.vatAmountMatch && (
                            <span className="text-amber-400 text-[11px] block">
                              Sheets: {formatKsh(selectedAuditItem.remoteDoc?.vatAmount || 0)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-between py-1 font-bold">
                        <span className="text-stone-200">Grand Total:</span>
                        <div className="text-right">
                          <span className="text-amber-400 text-sm">
                            {formatKsh(selectedAuditItem.localDoc.grandTotal)}
                          </span>
                          {!selectedAuditItem.validation.detailsParity.grandTotalMatch && (
                            <span className="text-rose-400 text-[11px] block">
                              Sheets: {formatKsh(selectedAuditItem.remoteDoc?.grandTotal || 0)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-between py-1">
                        <span className="text-stone-400">Amount Paid:</span>
                        <div className="text-right">
                          <span className="text-emerald-400 font-semibold">
                            {formatKsh(selectedAuditItem.localDoc.amountPaid || 0)}
                          </span>
                          {!selectedAuditItem.validation.detailsParity.amountPaidMatch && (
                            <span className="text-amber-400 text-[11px] block">
                              Sheets: {formatKsh(selectedAuditItem.remoteDoc?.amountPaid || 0)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-between py-1 font-bold">
                        <span className="text-stone-200">Balance Due:</span>
                        <div className="text-right">
                          <span className="text-rose-300">
                            {formatKsh(selectedAuditItem.localDoc.balanceDue || 0)}
                          </span>
                          {!selectedAuditItem.validation.detailsParity.balanceDueMatch && (
                            <span className="text-amber-400 text-[11px] block">
                              Sheets: {formatKsh(selectedAuditItem.remoteDoc?.balanceDue || 0)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Client & Metadata Parity */}
                  <div className="p-3.5 bg-stone-950/70 border border-stone-800 rounded-lg space-y-2.5">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-stone-300 flex items-center justify-between">
                      <span>Client & Metadata Parity</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          selectedAuditItem.validation.detailsParity.clientNameMatch &&
                          selectedAuditItem.validation.detailsParity.clientKraPinMatch
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}
                      >
                        {selectedAuditItem.validation.detailsParity.clientNameMatch ? 'CLIENT MATCH' : 'VARIANCE'}
                      </span>
                    </h4>

                    <div className="space-y-1.5 text-xs divide-y divide-stone-800/60">
                      <div className="flex justify-between py-1">
                        <span className="text-stone-400">Client Name:</span>
                        <div className="text-right">
                          <span className="font-semibold text-white">
                            {selectedAuditItem.localDoc.clientName}
                          </span>
                          {!selectedAuditItem.validation.detailsParity.clientNameMatch && (
                            <span className="text-amber-400 text-[11px] block">
                              Sheets: {selectedAuditItem.remoteDoc?.clientName}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-between py-1">
                        <span className="text-stone-400">KRA PIN:</span>
                        <div className="text-right">
                          <span className="font-mono text-stone-300">
                            {selectedAuditItem.localDoc.clientKraPin || 'N/A'}
                          </span>
                          {!selectedAuditItem.validation.detailsParity.clientKraPinMatch && (
                            <span className="text-amber-400 text-[11px] block font-mono">
                              Sheets: {selectedAuditItem.remoteDoc?.clientKraPin || 'N/A'}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-between py-1">
                        <span className="text-stone-400">Phone:</span>
                        <div className="text-right">
                          <span className="font-mono text-stone-300">
                            {selectedAuditItem.localDoc.clientPhone || 'N/A'}
                          </span>
                          {!selectedAuditItem.validation.detailsParity.clientPhoneMatch && (
                            <span className="text-amber-400 text-[11px] block font-mono">
                              Sheets: {selectedAuditItem.remoteDoc?.clientPhone || 'N/A'}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-between py-1">
                        <span className="text-stone-400">Issue Date:</span>
                        <div className="text-right">
                          <span className="text-white">
                            {formatDate(selectedAuditItem.localDoc.issueDate)}
                          </span>
                          {!selectedAuditItem.validation.detailsParity.issueDateMatch && (
                            <span className="text-amber-400 text-[11px] block">
                              Sheets: {formatDate(selectedAuditItem.remoteDoc?.issueDate || '')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-between py-1">
                        <span className="text-stone-400">Status:</span>
                        <div className="text-right">
                          <span className="font-semibold text-amber-400">
                            {selectedAuditItem.localDoc.status}
                          </span>
                          {!selectedAuditItem.validation.detailsParity.statusMatch && (
                            <span className="text-amber-300 text-[11px] block">
                              Sheets: {selectedAuditItem.remoteDoc?.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-stone-800 bg-stone-950 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-stone-400">
            {stats.allIdentical ? (
              <span className="text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>All {stats.total} ERP documents are in 100% synchronized harmony with Google Sheets.</span>
              </span>
            ) : (
              <span className="text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>
                  {stats.variances > 0
                    ? `${stats.variances} document variance(s) detected. Click Auto-Resolve to synchronize.`
                    : `${stats.notInSheet} document(s) pending sync.`}
                </span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {activeTab === 'DETAIL' && selectedAuditItem && selectedAuditItem.status !== 'MATCH' && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    handleAutoResolveSingle(selectedAuditItem.localDoc, selectedAuditItem.remoteDoc)
                  }
                  disabled={isSyncing}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-stone-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                  title="Auto change and resolve this document to accurate data"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Resolving...' : 'Auto-Resolve to Accurate Data'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePushLocalSingle(selectedAuditItem.localDoc)}
                  disabled={isSyncing}
                  className="px-3.5 py-1.5 bg-stone-800 hover:bg-stone-700 text-amber-300 border border-stone-600 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <UploadCloud className={`w-3.5 h-3.5 ${isSyncing ? 'animate-bounce' : ''}`} />
                  <span>{isSyncing ? 'Pushing...' : 'Push Local to Sheets'}</span>
                </button>
              </>
            )}

            {activeTab === 'ALL' && stats.variances > 0 && (
              <button
                type="button"
                onClick={handleAutoResolveAllVariances}
                disabled={isSyncing}
                className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-stone-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm disabled:opacity-50"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Auto-Resolve All Variances ({stats.variances})</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCloseWithResolution}
              className="px-3.5 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer border border-stone-700 flex items-center gap-1.5"
            >
              <span>Close</span>
              {autoCloseCountdown !== null && !isAutoClosePaused && !autoCloseCancelled && (
                <span className="px-1.5 py-0.2 bg-emerald-950 text-emerald-300 rounded font-mono text-[10px] border border-emerald-700">
                  {autoCloseCountdown}s
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
