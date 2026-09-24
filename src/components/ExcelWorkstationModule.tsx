import React, { useState, useEffect, useRef } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  FolderCheck,
  FolderOpen,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Copy,
  Check,
  Table,
  Zap,
  ShieldCheck,
  Eye,
  Info,
} from 'lucide-react';
import { BillingDocument, Client, HotelProfile, PaymentRecord, StatementRecord } from '../types';
import {
  DEFAULT_ARCHIVE_PATH,
  WORKBOOK_FILENAME,
  VBA_MODULE_FILENAME,
  generateMasterSuiteWorkbook,
  saveWorkbookToLocalArchive,
  getSavedDirectoryHandle,
  saveDirectoryHandle,
  clearDirectoryHandle,
  verifyDirectoryPermission,
  readMasterSuiteWorkbook,
  syncExcelChangesToLedger,
  getVbaModuleCode,
  triggerBrowserDownload,
  ParsedWorkbookResult,
} from '../services/excelEngine';

interface ExcelWorkstationModuleProps {
  profile: HotelProfile;
  clients: Client[];
  documents: BillingDocument[];
  payments: PaymentRecord[];
  statements: StatementRecord[];
  onTriggerSync?: () => void;
}

export const ExcelWorkstationModule: React.FC<ExcelWorkstationModuleProps> = ({
  profile,
  clients,
  documents,
  payments,
  statements,
  onTriggerSync,
}) => {
  const [activeTab, setActiveTab] = useState<'bridge' | 'blueprints' | 'vba' | 'directory'>('bridge');
  const [hasDirectoryHandle, setHasDirectoryHandle] = useState<boolean>(false);
  const [directoryName, setDirectoryName] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
    return localStorage.getItem('damview_excel_last_sync') || null;
  });
  const [copiedVba, setCopiedVba] = useState<boolean>(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(() => {
    return localStorage.getItem('damview_excel_auto_sync') !== 'false';
  });

  // Re-import diff state
  const [parsedData, setParsedData] = useState<ParsedWorkbookResult | null>(null);
  const [reconcileSummary, setReconcileSummary] = useState<{
    clientsCreated: number;
    clientsUpdated: number;
    documentsUpserted: number;
    paymentsUpserted: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Check for existing Directory Handle on mount
  useEffect(() => {
    checkSavedDirectory();
  }, []);

  const checkSavedDirectory = async () => {
    try {
      const handle = await getSavedDirectoryHandle();
      if (handle) {
        setHasDirectoryHandle(true);
        setDirectoryName(handle.name || 'Hotel Damview_Archives');
      } else {
        setHasDirectoryHandle(false);
      }
    } catch {
      setHasDirectoryHandle(false);
    }
  };

  // Connect Local Archive Directory
  const handleConnectDirectory = async () => {
    if (!('showDirectoryPicker' in window)) {
      setStatusMessage({
        type: 'info',
        text: 'File System Access API is not directly supported in this browser. You can still download the .xlsm file directly.',
      });
      return;
    }

    try {
      // @ts-ignore - showDirectoryPicker
      const handle = await window.showDirectoryPicker({
        id: 'damview_archive_dir',
        mode: 'readwrite',
      });

      if (handle) {
        await saveDirectoryHandle(handle);
        setHasDirectoryHandle(true);
        setDirectoryName(handle.name || 'Hotel Damview_Archives');
        setStatusMessage({
          type: 'success',
          text: `Connected directory: "${handle.name}". Direct filesystem updates are now active.`,
        });

        // Auto trigger first compile & save
        await handleGenerateAndSave();
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setStatusMessage({
          type: 'error',
          text: `Failed to link directory: ${err.message}`,
        });
      }
    }
  };

  const handleDisconnectDirectory = async () => {
    await clearDirectoryHandle();
    setHasDirectoryHandle(false);
    setDirectoryName('');
    setStatusMessage({
      type: 'info',
      text: 'Local directory disconnected. Future exports will stream via direct browser download.',
    });
  };

  // Compile and Save .xlsm
  const handleGenerateAndSave = async () => {
    setIsGenerating(true);
    setStatusMessage(null);
    try {
      const buffer = await generateMasterSuiteWorkbook({
        profile,
        clients,
        documents,
        payments,
        statements,
      });

      const res = await saveWorkbookToLocalArchive(buffer, WORKBOOK_FILENAME);
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSyncTime(timeStr);
      localStorage.setItem('damview_excel_last_sync', timeStr);

      setStatusMessage({
        type: 'success',
        text: res.message,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Error generating .xlsm: ${err.message || 'Unknown error'}`,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle Manual File Upload for Bi-Directional Import
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setStatusMessage(null);
    setReconcileSummary(null);

    try {
      const buffer = await file.arrayBuffer();
      const parsed = await readMasterSuiteWorkbook(buffer);
      setParsedData(parsed);

      setStatusMessage({
        type: 'info',
        text: `Successfully inspected ${file.name}. Found ${parsed.clients.length} clients, ${parsed.invoices.length} invoices, ${parsed.quotations.length} quotations, ${parsed.payments.length} payments${parsed.editorDoc ? ', and 1 active draft in Doc_Editor' : ''}.`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Failed to read Excel workbook: ${err.message}`,
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Commit Parsed Changes into Database
  const handleCommitReconciliation = async () => {
    if (!parsedData) return;
    setIsImporting(true);
    try {
      const summary = await syncExcelChangesToLedger(parsedData);
      setReconcileSummary(summary);
      setParsedData(null);
      setStatusMessage({
        type: 'success',
        text: `Bi-directional sync complete: ${summary.clientsCreated} created, ${summary.clientsUpdated} updated, ${summary.documentsUpserted} documents, ${summary.paymentsUpserted} payments queued for Google Sheets.`,
      });
      if (onTriggerSync) onTriggerSync();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Reconciliation error: ${err.message}`,
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Download VBA Module
  const handleDownloadVba = () => {
    const code = getVbaModuleCode();
    triggerBrowserDownload(code, VBA_MODULE_FILENAME, 'text/plain;charset=utf-8');
    setStatusMessage({
      type: 'success',
      text: `Downloaded ${VBA_MODULE_FILENAME}. In Excel, press Alt + F11 and use File -> Import File to load it.`,
    });
  };

  // Copy VBA Code
  const handleCopyVba = () => {
    const code = getVbaModuleCode();
    navigator.clipboard.writeText(code);
    setCopiedVba(true);
    setTimeout(() => setCopiedVba(false), 2500);
  };

  const toggleAutoSync = () => {
    const next = !autoSyncEnabled;
    setAutoSyncEnabled(next);
    localStorage.setItem('damview_excel_auto_sync', String(next));
  };

  const invoiceCount = documents.filter((d) => d.documentType === 'INVOICE').length;
  const quoteCount = documents.filter((d) => d.documentType === 'QUOTATION').length;
  const proformaCount = documents.filter((d) => d.documentType === 'PROFORMA').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 rounded-2xl p-6 text-white shadow-xl border border-stone-700 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                <FileSpreadsheet className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  Hotel Damview Executive Master Suite
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono font-semibold">
                    .XLSM ENGINE
                  </span>
                </h1>
                <p className="text-xs text-stone-300">
                  Bi-Directional Macro-Enabled Workstation, A4 Print Templates & Local Filesystem Bridge
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-stone-300 mt-3">
              <div className="flex items-center gap-1.5 bg-stone-800/80 px-3 py-1.5 rounded-lg border border-stone-700 font-mono text-[11px]">
                <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-stone-400">Target Archive:</span>
                <span className="text-amber-200 truncate max-w-xs sm:max-w-md">{DEFAULT_ARCHIVE_PATH}</span>
              </div>
              {lastSyncTime && (
                <div className="flex items-center gap-1.5 bg-stone-800/80 px-3 py-1.5 rounded-lg border border-stone-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Last Synced: {lastSyncTime}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleGenerateAndSave}
              disabled={isGenerating}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
              {isGenerating ? 'Compiling .xlsm...' : 'Compile & Sync Master Suite'}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="px-4 py-2.5 bg-stone-700 hover:bg-stone-600 text-stone-100 rounded-xl font-medium text-sm transition-all flex items-center gap-2 border border-stone-600 disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              Import Excel Changes
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".xlsm,.xlsx"
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Status Alert Notification */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl flex items-start gap-3 text-sm border shadow-sm transition-all ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : statusMessage.type === 'error'
              ? 'bg-rose-50 text-rose-900 border-rose-200'
              : 'bg-blue-50 text-blue-900 border-blue-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : statusMessage.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">{statusMessage.text}</div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs font-semibold underline hover:opacity-75"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-stone-200 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('bridge')}
          className={`px-4 py-2.5 font-medium text-sm border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'bridge'
              ? 'border-amber-600 text-amber-700 font-semibold'
              : 'border-transparent text-stone-600 hover:text-stone-900'
          }`}
        >
          <HardDrive className="w-4 h-4" />
          Local Filesystem Bridge & Sync
        </button>
        <button
          onClick={() => setActiveTab('blueprints')}
          className={`px-4 py-2.5 font-medium text-sm border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'blueprints'
              ? 'border-amber-600 text-amber-700 font-semibold'
              : 'border-transparent text-stone-600 hover:text-stone-900'
          }`}
        >
          <Table className="w-4 h-4" />
          Cell Coordinate Blueprints
        </button>
        <button
          onClick={() => setActiveTab('vba')}
          className={`px-4 py-2.5 font-medium text-sm border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'vba'
              ? 'border-amber-600 text-amber-700 font-semibold'
              : 'border-transparent text-stone-600 hover:text-stone-900'
          }`}
        >
          <FileCode className="w-4 h-4" />
          VBA Macro Automation Module
        </button>
        <button
          onClick={() => setActiveTab('directory')}
          className={`px-4 py-2.5 font-medium text-sm border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'directory'
              ? 'border-amber-600 text-amber-700 font-semibold'
              : 'border-transparent text-stone-600 hover:text-stone-900'
          }`}
        >
          <Table className="w-4 h-4" />
          Worksheet Architecture (13 Tabs)
        </button>
      </div>

      {/* TAB 1: LOCAL FILESYSTEM BRIDGE */}
      {activeTab === 'bridge' && (
        <div className="space-y-6">
          {/* Filesystem Access Card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-stone-100">
              <div>
                <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                  <FolderCheck className="w-5 h-5 text-amber-600" />
                  Local Archive Directory Connection
                </h2>
                <p className="text-sm text-stone-500 mt-1">
                  Connect your designated OneDrive/Local folder once. The app will write directly to{' '}
                  <span className="font-mono text-stone-700 font-semibold">{WORKBOOK_FILENAME}</span> without
                  browser download dialogs.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {hasDirectoryHandle ? (
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-emerald-200">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Connected: {directoryName}
                    </span>
                    <button
                      onClick={handleDisconnectDirectory}
                      className="px-3 py-1.5 text-xs text-stone-600 hover:text-rose-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleConnectDirectory}
                    className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-sm font-semibold shadow-sm transition-all flex items-center gap-2"
                  >
                    <FolderOpen className="w-4 h-4 text-amber-400" />
                    Select Local Archive Folder
                  </button>
                )}
              </div>
            </div>

            {/* Path and Automation Switches */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                <div className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
                  Designated Local Path
                </div>
                <div className="font-mono text-xs text-stone-800 break-all select-all font-semibold">
                  {DEFAULT_ARCHIVE_PATH}
                </div>
                <div className="text-xs text-stone-500 mt-2">
                  When selected in Chrome/Edge, the File System Access API permits zero-click streaming updates.
                </div>
              </div>

              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-stone-900">Automatic Background Sync</div>
                  <div className="text-xs text-stone-500">
                    Auto-recompile and save .xlsm when invoices are issued or Google Sheets is synchronized
                  </div>
                </div>
                <button
                  onClick={toggleAutoSync}
                  className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                    autoSyncEnabled ? 'bg-amber-600' : 'bg-stone-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      autoSyncEnabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Quick Metrics of Packaged Data */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
              <div className="text-xs text-stone-500">Clients Seeded</div>
              <div className="text-xl font-bold text-stone-900 mt-1">{clients.length}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
              <div className="text-xs text-stone-500">Tax Invoices</div>
              <div className="text-xl font-bold text-blue-600 mt-1">{invoiceCount}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
              <div className="text-xs text-stone-500">Quotations</div>
              <div className="text-xl font-bold text-purple-600 mt-1">{quoteCount}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
              <div className="text-xs text-stone-500">Proformas</div>
              <div className="text-xl font-bold text-indigo-600 mt-1">{proformaCount}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
              <div className="text-xs text-stone-500">Receipts</div>
              <div className="text-xl font-bold text-emerald-600 mt-1">{payments.length}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
              <div className="text-xs text-stone-500">Statements</div>
              <div className="text-xl font-bold text-amber-600 mt-1">{statements.length}</div>
            </div>
          </div>

          {/* Bi-Directional Diff Inspection Modal / Banner */}
          {parsedData && (
            <div className="bg-amber-50 rounded-2xl p-6 border border-amber-200 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-amber-900 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-600" />
                    Pending Bi-Directional Reconciliation
                  </h3>
                  <p className="text-xs text-amber-800 mt-1">
                    Inspected workbook data ready for merge into local IndexedDB and cloud sync queue:
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCommitReconciliation}
                    disabled={isImporting}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg shadow-sm"
                  >
                    {isImporting ? 'Reconciling...' : 'Confirm & Reconcile to Database'}
                  </button>
                  <button
                    onClick={() => setParsedData(null)}
                    className="px-3 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-medium rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                <div className="bg-white/80 p-3 rounded-lg border border-amber-200">
                  <div className="text-xs text-amber-700">Clients Detected</div>
                  <div className="text-lg font-bold text-amber-950">{parsedData.clients.length}</div>
                </div>
                <div className="bg-white/80 p-3 rounded-lg border border-amber-200">
                  <div className="text-xs text-amber-700">Invoices Detected</div>
                  <div className="text-lg font-bold text-amber-950">{parsedData.invoices.length}</div>
                </div>
                <div className="bg-white/80 p-3 rounded-lg border border-amber-200">
                  <div className="text-xs text-amber-700">Receipts Detected</div>
                  <div className="text-lg font-bold text-amber-950">{parsedData.payments.length}</div>
                </div>
                <div className="bg-white/80 p-3 rounded-lg border border-amber-200">
                  <div className="text-xs text-amber-700">Active Form Draft</div>
                  <div className="text-lg font-bold text-amber-950">
                    {parsedData.editorDoc ? parsedData.editorDoc.documentNumber : 'None'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {reconcileSummary && (
            <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-200 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Database Updated & Changes Queued
                </div>
                <div className="text-xs text-emerald-700 mt-1">
                  Created {reconcileSummary.clientsCreated} clients, updated {reconcileSummary.clientsUpdated} clients,
                  upserted {reconcileSummary.documentsUpserted} documents, and recorded {reconcileSummary.paymentsUpserted} payments.
                </div>
              </div>
              <button
                onClick={() => setReconcileSummary(null)}
                className="text-xs text-emerald-800 underline font-semibold"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CELL COORDINATE BLUEPRINTS */}
      {activeTab === 'blueprints' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                <Table className="w-5 h-5 text-amber-600" />
                Sheet Blueprint 1: Universal Document Editor (`Doc_Editor`)
              </h2>
              <p className="text-sm text-stone-500 mt-1">
                The interactive Excel control sheet allowing operators to draft invoices, quotations, proformas, or receipts
                with dynamic client lookups and VBA automation triggers.
              </p>
            </div>

            <div className="overflow-x-auto border border-stone-200 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-stone-900 text-white font-semibold">
                  <tr>
                    <th className="p-3 w-28">Cell / Range</th>
                    <th className="p-3 w-48">Field Label / Purpose</th>
                    <th className="p-3 w-64">Excel Formula / Data Validation</th>
                    <th className="p-3">Behavior & Linked Macro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 font-mono">
                  <tr className="bg-stone-50/50">
                    <td className="p-3 font-bold text-amber-700">A1:F1</td>
                    <td className="p-3 font-sans text-stone-900">Workstation Title Banner</td>
                    <td className="p-3 text-stone-500">HOTEL DAMVIEW LTD</td>
                    <td className="p-3 font-sans text-stone-600">Dark stone fill (#1C1917), 14pt Times New Roman Bold</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-amber-700">C4</td>
                    <td className="p-3 font-sans text-stone-900">Document Type Dropdown</td>
                    <td className="p-3 text-blue-700">List: TAX INVOICE, QUOTATION, PROFORMA, RECEIPT, SOA</td>
                    <td className="p-3 font-sans text-stone-600">Triggers SwitchDocumentMode(docType) in VBA</td>
                  </tr>
                  <tr className="bg-stone-50/50">
                    <td className="p-3 font-bold text-amber-700">F4</td>
                    <td className="p-3 font-sans text-stone-900">Document Number</td>
                    <td className="p-3 text-stone-600">e.g. INV-2025-001 / QT-2025-001</td>
                    <td className="p-3 font-sans text-stone-600">Auto-incremented from respective Data_* worksheet</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-amber-700">C9</td>
                    <td className="p-3 font-sans text-stone-900">Client Name Selector</td>
                    <td className="p-3 text-blue-700">List: Data_Clients!$B$2:$B$100</td>
                    <td className="p-3 font-sans text-stone-600">Selects client to auto-fill PIN, Phone, and Address</td>
                  </tr>
                  <tr className="bg-stone-50/50">
                    <td className="p-3 font-bold text-amber-700">F9</td>
                    <td className="p-3 font-sans text-stone-900">Client KRA PIN</td>
                    <td className="p-3 text-emerald-700">=IFERROR(VLOOKUP(C9, Data_Clients!$B$2:$E$100, 4, FALSE), "")</td>
                    <td className="p-3 font-sans text-stone-600">Auto-filled Kenyan KRA Tax Identification PIN</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-amber-700">C10</td>
                    <td className="p-3 font-sans text-stone-900">Client Telephone</td>
                    <td className="p-3 text-emerald-700">=IFERROR(VLOOKUP(C9, Data_Clients!$B$2:$C$100, 2, FALSE), "")</td>
                    <td className="p-3 font-sans text-stone-600">Auto-filled phone contact</td>
                  </tr>
                  <tr className="bg-stone-50/50">
                    <td className="p-3 font-bold text-amber-700">F10</td>
                    <td className="p-3 font-sans text-stone-900">Client Physical Address</td>
                    <td className="p-3 text-emerald-700">=IFERROR(VLOOKUP(C9, Data_Clients!$B$2:$F$100, 5, FALSE), "")</td>
                    <td className="p-3 font-sans text-stone-600">Auto-filled billing address</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-amber-700">B13:F13</td>
                    <td className="p-3 font-sans text-stone-900">Macro Control Bar</td>
                    <td className="p-3 text-stone-500">1. Switch  | 2. Populate  | 3. PDF  | 4. Append</td>
                    <td className="p-3 font-sans text-stone-600">Amber banner mapped to VBA macros</td>
                  </tr>
                  <tr className="bg-stone-50/50">
                    <td className="p-3 font-bold text-amber-700">F16:F27</td>
                    <td className="p-3 font-sans text-stone-900">Line Items Amounts (1–12)</td>
                    <td className="p-3 text-emerald-700">=IF(C16&gt;0, C16*MAX(1,D16)*E16, 0)</td>
                    <td className="p-3 font-sans text-stone-600">Quantity × Days × Rate with #,##0.00 currency format</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-amber-700">F28</td>
                    <td className="p-3 font-sans text-stone-900">Subtotal (Excl. VAT 16%)</td>
                    <td className="p-3 text-emerald-700">=F30/1.16</td>
                    <td className="p-3 font-sans text-stone-600">Kenya KRA compliant inclusive VAT reverse formula</td>
                  </tr>
                  <tr className="bg-stone-50/50">
                    <td className="p-3 font-bold text-amber-700">F29</td>
                    <td className="p-3 font-sans text-stone-900">VAT (16% Included)</td>
                    <td className="p-3 text-emerald-700">=F30-F28</td>
                    <td className="p-3 font-sans text-stone-600">Exact 16% VAT value-added tax component</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-amber-700">F30</td>
                    <td className="p-3 font-sans text-stone-900">Grand Total (Ksh)</td>
                    <td className="p-3 text-emerald-700">=SUM(F16:F27)</td>
                    <td className="p-3 font-sans text-stone-600">Bold 12pt with double bottom accounting underline</td>
                  </tr>
                  <tr className="bg-stone-50/50">
                    <td className="p-3 font-bold text-amber-700">F32</td>
                    <td className="p-3 font-sans text-stone-900">Net Balance Due (Ksh)</td>
                    <td className="p-3 text-emerald-700">=F30-F31</td>
                    <td className="p-3 font-sans text-stone-600">Total minus amount paid; highlighted in crimson</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                <Table className="w-5 h-5 text-amber-600" />
                Sheet Blueprint 2: Standard Tax Invoice Template (`Template_Invoice`)
              </h2>
              <p className="text-sm text-stone-500 mt-1">
                Pixel-accurate A4 portrait printable sheet mirroring the app’s PDF export with borderless key-value grids
                and executive typography.
              </p>
            </div>

            <div className="overflow-x-auto border border-stone-200 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-stone-900 text-white font-semibold">
                  <tr>
                    <th className="p-3 w-28">Cell / Range</th>
                    <th className="p-3 w-48">Layout Section</th>
                    <th className="p-3 w-64">Field & Formatting Spec</th>
                    <th className="p-3">Print & A4 Rule</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 font-mono">
                  <tr className="bg-stone-50/50">
                    <td className="p-3 font-bold text-amber-700">A1:F1</td>
                    <td className="p-3 font-sans text-stone-900">Executive Hotel Header</td>
                    <td className="p-3 text-stone-600">HOTEL DAMVIEW LTD (16pt Times New Roman, Stone 900 Fill)</td>
                    <td className="p-3 font-sans text-stone-600">Row Height 26, White bold text, centered</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-amber-700">A2:F2</td>
                    <td className="p-3 font-sans text-stone-900">Contact & PIN Strip</td>
                    <td className="p-3 text-stone-600">Off Kangundo Rd | Tel: +254 722 000 000 | PIN: P051982741Z</td>
                    <td className="p-3 font-sans text-stone-600">Row Height 16, 9pt italic, centered</td>
                  </tr>
                  <tr className="bg-stone-50/50">
                    <td className="p-3 font-bold text-amber-700">A4:F4</td>
                    <td className="p-3 font-sans text-stone-900">Document Type Title</td>
                    <td className="p-3 text-stone-600">TAX INVOICE (14pt Bold, subtle gray background)</td>
                    <td className="p-3 font-sans text-stone-600">Hairline borders top & bottom</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-amber-700">A6:C10</td>
                    <td className="p-3 font-sans text-stone-900">CLIENT DETAILS Panel</td>
                    <td className="p-3 text-stone-600">Name (B7), PIN (B8), Phone (B9), Address (B10)</td>
                    <td className="p-3 font-sans text-stone-600">Borderless key-values: labels left, values right</td>
                  </tr>
                  <tr className="bg-stone-50/50">
                    <td className="p-3 font-bold text-amber-700">D6:F10</td>
                    <td className="p-3 font-sans text-stone-900">DOCUMENT DETAILS Panel</td>
                    <td className="p-3 text-stone-600">Doc Number (E7), Date (E8), Due Date (E9), Status (E10)</td>
                    <td className="p-3 font-sans text-stone-600">Borderless key-values: labels left, values right</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-amber-700">A12:F12</td>
                    <td className="p-3 font-sans text-stone-900">Particulars Table Header</td>
                    <td className="p-3 text-stone-600">Item # | Particulars | Qty | Days | Rate (Ksh) | Amount</td>
                    <td className="p-3 font-sans text-stone-600">Dark fill (#1C1917), 11pt Bold, white text</td>
                  </tr>
                  <tr className="bg-stone-50/50">
                    <td className="p-3 font-bold text-amber-700">A13:F24</td>
                    <td className="p-3 font-sans text-stone-900">12 Line Items Grid</td>
                    <td className="p-3 text-emerald-700">F13 = IF(C13&gt;0, C13*MAX(1,D13)*E13, 0)</td>
                    <td className="p-3 font-sans text-stone-600">0.5pt hairline cell borders, Times New Roman 11pt</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-amber-700">A26:C30</td>
                    <td className="p-3 font-sans text-stone-900">Remittance Block (Left)</td>
                    <td className="p-3 text-stone-600">
                      {profile.bankName?.trim() && profile.accountNumber?.trim()
                        ? `${profile.bankName} Acc: ${profile.accountNumber}`
                        : profile.mpesaTillNumber?.trim()
                          ? `M-Pesa Till: ${profile.mpesaTillNumber} (Bank: Blank)`
                          : 'Settlement details: Blank by default'}
                    </td>
                    <td className="p-3 font-sans text-stone-600">Subtle gray panel with official remittance info</td>
                  </tr>
                  <tr className="bg-stone-50/50">
                    <td className="p-3 font-bold text-amber-700">D26:F30</td>
                    <td className="p-3 font-sans text-stone-900">Financial Summary (Right)</td>
                    <td className="p-3 text-emerald-700">Subtotal (=F28/1.16) | VAT (=F28-F26) | Total (=SUM(F13:F24))</td>
                    <td className="p-3 font-sans text-stone-600">Double-underline on Grand Total and Balance Due</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-amber-700">A32:F35</td>
                    <td className="p-3 font-sans text-stone-900">Terms & Conditions</td>
                    <td className="p-3 text-stone-600">Fixed-height 3-statement fallback block (9pt italic)</td>
                    <td className="p-3 font-sans text-stone-600">Standard Kenyan commercial payment terms</td>
                  </tr>
                  <tr className="bg-stone-50/50">
                    <td className="p-3 font-bold text-amber-700">A37:F37</td>
                    <td className="p-3 font-sans text-stone-900">Authorized Signature</td>
                    <td className="p-3 text-stone-600">Prepared By (A37) | Authorized Signature & Stamp (D37:F37)</td>
                    <td className="p-3 font-sans text-stone-600">Right-aligned underline placeholder</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: VBA MACRO CODE MODULE */}
      {activeTab === 'vba' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-stone-100">
              <div>
                <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                  <FileCode className="w-5 h-5 text-amber-600" />
                  VBA Macro Automation Engine (`modHotelDamviewEngine.bas`)
                </h2>
                <p className="text-sm text-stone-500 mt-1">
                  Ready-to-use VBA module containing all 4 core routines for mode switching, template population,
                  one-click vector PDF generation, and collision-guarded ledger appending.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyVba}
                  className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-stone-300"
                >
                  {copiedVba ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  {copiedVba ? 'Copied Code!' : 'Copy VBA Code'}
                </button>
                <button
                  onClick={handleDownloadVba}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download modHotelDamviewEngine.bas
                </button>
              </div>
            </div>

            {/* Quick Setup Instructions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                <div className="text-xs font-bold text-amber-600 mb-1">STEP 1: OPEN VBA EDITOR</div>
                <p className="text-xs text-stone-600">
                  Open <span className="font-semibold">{WORKBOOK_FILENAME}</span> in Excel and press{' '}
                  <kbd className="px-1.5 py-0.5 bg-white border border-stone-300 rounded font-mono text-[11px]">
                    Alt + F11
                  </kbd>
                  .
                </p>
              </div>
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                <div className="text-xs font-bold text-amber-600 mb-1">STEP 2: IMPORT MODULE</div>
                <p className="text-xs text-stone-600">
                  In the VBA menu, click <span className="font-semibold">File</span> &gt;{' '}
                  <span className="font-semibold">Import File...</span> and pick{' '}
                  <span className="font-mono text-stone-800">{VBA_MODULE_FILENAME}</span>.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                <div className="text-xs font-bold text-amber-600 mb-1">STEP 3: EXECUTE & PRINT</div>
                <p className="text-xs text-stone-600">
                  Save the workbook. Operators can now click buttons or press{' '}
                  <kbd className="px-1.5 py-0.5 bg-white border border-stone-300 rounded font-mono text-[11px]">
                    Alt + F8
                  </kbd>{' '}
                  to run macros anytime offline!
                </p>
              </div>
            </div>

            {/* Syntax View */}
            <div className="relative rounded-xl overflow-hidden border border-stone-800 bg-stone-950">
              <div className="flex items-center justify-between px-4 py-2 bg-stone-900 border-b border-stone-800 text-stone-400 text-xs font-mono">
                <span>modHotelDamviewEngine.bas</span>
                <span>Visual Basic for Applications</span>
              </div>
              <pre className="p-4 text-xs font-mono text-stone-300 overflow-x-auto max-h-96 leading-relaxed">
                {getVbaModuleCode()}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: WORKSHEET DIRECTORY (13 TABS) */}
      {activeTab === 'directory' && (
        <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
              <Table className="w-5 h-5 text-amber-600" />
              Workbook Architecture: Complete 13-Tab Layout
            </h2>
            <p className="text-sm text-stone-500 mt-1">
              The generated <span className="font-mono font-semibold">{WORKBOOK_FILENAME}</span> workbook contains 13
              interconnected worksheets organized into 3 functional domains:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Group 1: Universal Editor */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                Domain 1: Executive Workstation
              </div>
              <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 hover:bg-stone-50 transition-colors">
                <div className="font-bold text-stone-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Doc_Editor
                </div>
                <div className="text-xs text-stone-500 mt-1">
                  Universal form editor with document switchers, dynamic client lookup, 12 line items grid, and macro action buttons.
                </div>
              </div>
            </div>

            {/* Group 2: Printable Templates */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                Domain 2: A4 Print Templates
              </div>
              {[
                { name: 'Template_Invoice', desc: 'A4 Portrait Tax Invoice with 16% VAT formulas and remittance details' },
                { name: 'Template_Quotation', desc: 'A4 Portrait Price Quotation with 30-day validity terms' },
                { name: 'Template_Proforma', desc: 'A4 Portrait Proforma Invoice with 100% advance payment terms' },
                { name: 'Template_Receipt', desc: 'A4 Portrait Official Payment Receipt for settlements' },
                { name: 'Template_Statement', desc: 'A4 Portrait Statement of Account for client ledger summaries' },
              ].map((t) => (
                <div key={t.name} className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/50 hover:bg-stone-50 transition-colors">
                  <div className="font-bold text-stone-900 text-xs flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    {t.name}
                  </div>
                  <div className="text-[11px] text-stone-500 mt-0.5">{t.desc}</div>
                </div>
              ))}
            </div>

            {/* Group 3: Google Sheets Data Mirrors */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                Domain 3: Operational Data Ledgers
              </div>
              {[
                { name: 'Data_Clients', count: `${clients.length} rows`, desc: 'Client directory with KRA PINs and phone contacts' },
                { name: 'Data_Invoices', count: `${invoiceCount} rows`, desc: 'Full Tax Invoices ledger with subtotal, VAT, and balance' },
                { name: 'Data_Quotations', count: `${quoteCount} rows`, desc: 'Official Quotations ledger' },
                { name: 'Data_Proformas', count: `${proformaCount} rows`, desc: 'Proforma Invoices ledger' },
                { name: 'Data_Receipts', count: `${payments.length} rows`, desc: 'Settlements ledger with M-Pesa till references' },
                { name: 'Data_Statements', count: `${statements.length} rows`, desc: 'Generated Statements of Account ledger' },
                { name: 'Data_Hotel_Settings', count: '13 keys', desc: 'Hotel Damview PIN P051982741Z, Till 5432100, Bank details' },
              ].map((d) => (
                <div key={d.name} className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/50 hover:bg-stone-50 transition-colors">
                  <div className="font-bold text-stone-900 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      {d.name}
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-stone-200 text-stone-700 rounded-full font-medium">
                      {d.count}
                    </span>
                  </div>
                  <div className="text-[11px] text-stone-500 mt-0.5">{d.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
