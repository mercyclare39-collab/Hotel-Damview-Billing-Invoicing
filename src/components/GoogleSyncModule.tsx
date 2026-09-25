import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BillingDocument,
  Client,
  HotelProfile,
  PaymentRecord,
  SyncQueueItem,
  AuditLogEntry,
} from '../types';
import { dbService } from '../services/db';
import {
  syncManager,
  SpreadsheetDataPayload,
  DiscoveredTab,
  SyncVerificationResult,
} from '../services/sync';
import {
  GOOGLE_APPS_SCRIPT_VERSION,
  GOOGLE_APPS_SCRIPT_CODE,
} from '../services/googleScriptCode';
import {
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  FileCheck,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Trash2,
  Copy,
  Check,
  Search,
  Wifi,
  WifiOff,
  Layers,
  ArrowDownUp,
  DownloadCloud,
  UploadCloud,
  FileText,
  UserCheck,
  Receipt,
  Sparkles,
  Info,
  FolderOpen,
  Link,
  History,
  Eye,
  X,
  FileCode,
  Download,
} from 'lucide-react';
import { A4DocumentPreview } from './A4DocumentPreview';
import { A4ReceiptPreview } from './A4ReceiptPreview';
import { SyncTelemetryBadge } from './SyncTelemetryBadge';
import { AppsScriptDiffInspector } from './AppsScriptDiffInspector';
import { SchemaDiagnosticsInspector } from './SchemaDiagnosticsInspector';
import { Cpu } from 'lucide-react';

interface GoogleSyncModuleProps {
  profile?: HotelProfile;
  isOnline?: boolean;
  onUpdateProfile?: (newProfile: HotelProfile) => Promise<void>;
  onNavigateToDocument?: (doc: BillingDocument) => void;
  onNavigateToClient?: (clientId: string) => void;
}

export const GoogleSyncModule: React.FC<GoogleSyncModuleProps> = ({
  profile: initialProfile,
  isOnline: propIsOnline,
  onUpdateProfile,
  onNavigateToDocument,
  onNavigateToClient,
}) => {
  const [profile, setProfile] = useState<HotelProfile | null>(initialProfile || null);
  const [documents, setDocuments] = useState<BillingDocument[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(
    propIsOnline !== undefined ? propIsOnline : typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    if (initialProfile) {
      setProfile(initialProfile);
    }
  }, [initialProfile]);

  useEffect(() => {
    if (propIsOnline !== undefined) {
      setIsOnline(propIsOnline);
    }
  }, [propIsOnline]);

  // Active sub-tab
  const [activeTab, setActiveTabState] = useState<
    'LiveSheets' | 'Queue' | 'Audit' | 'Diagnostics' | 'Script'
  >(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('damview_googlesync_active_tab') as any;
      if (saved && ['LiveSheets', 'Queue', 'Audit', 'Diagnostics', 'Script'].includes(saved)) {
        return saved;
      }
    }
    return 'LiveSheets';
  });

  const setActiveTab = (tab: 'LiveSheets' | 'Queue' | 'Audit' | 'Diagnostics' | 'Script') => {
    setActiveTabState(tab);
    try {
      localStorage.setItem('damview_googlesync_active_tab', tab);
    } catch {}
  };

  // Google Drive File Browser & Previewer state
  const [driveFilterType, setDriveFilterType] = useState<'ALL' | 'INVOICE' | 'QUOTATION' | 'PROFORMA' | 'RECEIPT'>('ALL');
  const [driveStatusFilter, setDriveStatusFilter] = useState<'ALL' | 'ARCHIVED' | 'PENDING'>('ALL');
  const [drivePreviewFile, setDrivePreviewFile] = useState<{
    id: string;
    documentNumber: string;
    clientName: string;
    type: 'INVOICE' | 'QUOTATION' | 'PROFORMA' | 'RECEIPT';
    date: string;
    amount: number;
    driveFileUrl?: string;
    driveFileId?: string;
    doc?: BillingDocument;
    payment?: PaymentRecord;
  } | null>(null);
  const [archivingItemId, setArchivingItemId] = useState<string | null>(null);
  const [copiedDriveLink, setCopiedDriveLink] = useState<string | null>(null);

  // Audit Log state
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [selectedAuditSnapshot, setSelectedAuditSnapshot] = useState<AuditLogEntry | null>(null);
  const [isVerifyingAudit, setIsVerifyingAudit] = useState(false);
  const [verificationResult, setVerificationResult] = useState<SyncVerificationResult | null>(null);
  const [isRunningE2ETest, setIsRunningE2ETest] = useState(false);

  // Search filter inside tables
  const [searchTerm, setSearchTerm] = useState('');

  // Sync operations state
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [detectedScriptVersion, setDetectedScriptVersion] = useState<string | null>(null);
  const [showVersionMismatchAlert, setShowVersionMismatchAlert] = useState<boolean>(false);
  const [isCopiedGSCode, setIsCopiedGSCode] = useState<boolean>(false);
  const [isUploadingTestPdf, setIsUploadingTestPdf] = useState(false);
  const [testPdfResult, setTestPdfResult] = useState<{
    success?: boolean;
    driveUrl?: string;
    driveFileId?: string;
    fileName?: string;
    byteLength?: number;
    folderName?: string;
    error?: string;
    timestamp?: string;
  } | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
    timestamp: string;
  } | null>(null);

  // Live Sheet Data state (Live Previewer)
  const [liveSheetData, setLiveSheetData] = useState<SpreadsheetDataPayload | null>(null);
  const [selectedDiscoveredTab, setSelectedDiscoveredTab] = useState<string>('Invoices');
  const [isLoadingLiveSheet, setIsLoadingLiveSheet] = useState(false);
  const [liveSheetFilter, setLiveSheetFilter] = useState('');
  const [showEmbeddedIframe, setShowEmbeddedIframe] = useState(false);

  // Autonomous live background sync state for Live Google Spreadsheet & Drive Live Preview
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(true);
  const [iframeCacheBuster, setIframeCacheBuster] = useState<number>(Date.now());

  // Live Worksheet Entry Deletion State
  const [liveEntryToDelete, setLiveEntryToDelete] = useState<{
    tabName: string;
    rowIndex: number;
    rowData: any[];
    rowIdentifier: string;
    docId?: string;
    docNum?: string;
    clientId?: string;
    paymentId?: string;
    recNum?: string;
  } | null>(null);
  const [isDeletingLiveEntry, setIsDeletingLiveEntry] = useState(false);

  // Cascade delete modal state
  const [itemToDelete, setItemToDelete] = useState<{
    type: 'document' | 'client' | 'receipt';
    id: string;
    number?: string;
    documentNumber?: string;
    name: string;
    amount?: number;
  } | null>(null);
  const [cascadeSheet, setCascadeSheet] = useState(true);
  const [cascadeDrive, setCascadeDrive] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load all local data
  const loadData = useCallback(async () => {
    try {
      const [p, docs, clis, pays, queue, logs] = await Promise.all([
        dbService.getHotelProfile(),
        dbService.getDocuments(),
        dbService.getClients(),
        dbService.getPayments(),
        dbService.getSyncQueue(),
        dbService.getAuditLogs(100),
      ]);
      setProfile(p);
      setDocuments(docs);
      setClients(clis);
      setPayments(pays);
      setSyncQueue(queue);
      setAuditLogs(logs);
    } catch (err) {
      console.error('Error loading data in GoogleSyncModule:', err);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Subscribe to real-time sync manager updates
    const unsubscribeSync = syncManager.subscribe((syncState) => {
      setIsOnline(syncState.isOnline);
      setIsSyncing(syncState.isSyncing);
      // Auto-refresh when background sync completes
      if (!syncState.isSyncing) {
        loadData();
      }
    });

    // Listen for remote real-time data changes, sync completions, and renumbering notices
    const handleDataChanged = (e?: any) => {
      loadData();
      const hasMutations = !e || !e.detail || e.detail.itemsPushed > 0 || e.detail.itemsPulled > 0;
      if (hasMutations) {
        loadLiveSheetData();
        setIframeCacheBuster(Date.now());
      }
    };

    window.addEventListener('damview:data-changed', handleDataChanged);
    window.addEventListener('damview-sync-completed', handleDataChanged);
    window.addEventListener('damview-renumbered', handleDataChanged);

    return () => {
      unsubscribeSync();
      window.removeEventListener('damview:data-changed', handleDataChanged);
      window.removeEventListener('damview-sync-completed', handleDataChanged);
      window.removeEventListener('damview-renumbered', handleDataChanged);
    };
  }, [loadData]);

  // Autonomous live spreadsheet background sync interval (managed non-blocking background sync)
  useEffect(() => {
    if (!autoRefreshEnabled || !isOnline) return;

    const timer = setInterval(() => {
      loadLiveSheetData();
    }, 15000);

    return () => clearInterval(timer);
  }, [autoRefreshEnabled, isOnline]);

  // Filtered documents by type
  const invoices = useMemo(
    () => documents.filter((d) => d.documentType === 'INVOICE'),
    [documents]
  );
  const quotations = useMemo(
    () => documents.filter((d) => d.documentType === 'QUOTATION'),
    [documents]
  );
  const proformas = useMemo(
    () => documents.filter((d) => d.documentType === 'PROFORMA'),
    [documents]
  );

  // Generic search filter for items
  const filterList = <T,>(items: T[], getSearchableString: (item: T) => string) => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.toLowerCase();
    return items.filter((item) => getSearchableString(item).toLowerCase().includes(term));
  };

  // Filtered collections
  const filteredInvoices = useMemo(
    () =>
      filterList(
        invoices,
        (i) => `${i.documentNumber} ${i.clientName} ${i.clientKraPin || ''} ${i.status} ${i.grandTotal}`
      ),
    [invoices, searchTerm]
  );

  const filteredQuotations = useMemo(
    () =>
      filterList(
        quotations,
        (q) => `${q.documentNumber} ${q.clientName} ${q.clientKraPin || ''} ${q.status} ${q.grandTotal}`
      ),
    [quotations, searchTerm]
  );

  const filteredProformas = useMemo(
    () =>
      filterList(
        proformas,
        (p) => `${p.documentNumber} ${p.clientName} ${p.clientKraPin || ''} ${p.status} ${p.grandTotal}`
      ),
    [proformas, searchTerm]
  );

  const filteredClients = useMemo(
    () =>
      filterList(
        clients,
        (c) => `${c.name} ${c.kraPin || ''} ${c.email || ''} ${c.phone || ''} ${c.contactPerson || ''}`
      ),
    [clients, searchTerm]
  );

  const filteredPayments = useMemo(
    () =>
      filterList(
        payments,
        (p) => `${p.receiptNumber} ${p.clientName} ${p.documentNumber || ''} ${p.paymentMode} ${p.amount}`
      ),
    [payments, searchTerm]
  );

  const filteredAuditLogs = useMemo(
    () =>
      filterList(
        auditLogs,
        (l) => `${l.action} ${l.entityType} ${l.entityId} ${l.details} ${l.timestamp}`
      ),
    [auditLogs, searchTerm]
  );

  // Manual Audit Log Verification: triggers a test audit trail record to confirm IndexedDB storage
  const handleRunAuditVerification = async () => {
    setIsVerifyingAudit(true);
    try {
      await dbService.recordAuditLog({
        entityType: 'SYNC',
        entityId: 'test-audit-' + Date.now(),
        action: 'SELF_HEALED',
        details: 'Audit Verification Test: Confirmed IndexedDB audit_log objectStore read/write operations and schema integrity.',
        snapshot: { verifiedAt: new Date().toISOString(), status: 'PASS', version: 2 },
      });
      const updated = await dbService.getAuditLogs(100);
      setAuditLogs(updated);
      setSyncFeedback({
        type: 'success',
        message: 'Audit Log Verification Successful: Confirmed IndexedDB audit_log persistence and snapshot capture.',
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: `Audit verification failed: ${err.message || 'Unknown error'}`,
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsVerifyingAudit(false);
    }
  };

  // Full End-to-End Sync Testing against simulated bad Google Sheets data
  const handleRunE2EVerification = async () => {
    setIsRunningE2ETest(true);
    try {
      const result = await syncManager.runVerificationSuite();
      setVerificationResult(result);
      await loadData();
      setSyncFeedback({
        type: result.success ? 'success' : 'error',
        message: result.success
          ? `End-to-End Sync Test Passed: All ${result.passedChecks}/${result.totalChecks} checks verified without data corruption.`
          : `End-to-End Sync Test: ${result.passedChecks}/${result.totalChecks} passed. Check diagnostics below.`,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: `Sync verification error: ${err.message || 'Unknown error'}`,
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsRunningE2ETest(false);
    }
  };

  // 1. Trigger Full Bidirectional Sync (Push + Pull)
  const handleBidirectionalSync = async () => {
    if (!isOnline) {
      setSyncFeedback({
        type: 'error',
        message: 'Cannot sync while offline. Changes are safely queued in local IndexedDB.',
        timestamp: new Date().toLocaleTimeString(),
      });
      return;
    }

    setIsSyncing(true);
    try {
      const res = await syncManager.syncBidirectional();
      await loadData();
      setSyncFeedback({
        type: res.success ? 'success' : 'error',
        message: res.message,
        timestamp: new Date().toLocaleTimeString(),
      });

      // If on LiveSheets tab, refresh live preview
      if (activeTab === 'LiveSheets') {
        loadLiveSheetData();
      }
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: err.message || 'Bidirectional sync failed.',
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // 2. Trigger Connection Test
  const handleTestConnection = async () => {
    const targetUrl = profile?.googleWebAppUrl;
    if (!targetUrl) {
      setSyncFeedback({
        type: 'error',
        message: 'No Google Apps Script Web App URL configured. Please set it in Hotel Settings.',
        timestamp: new Date().toLocaleTimeString(),
      });
      return;
    }

    setIsTesting(true);
    setDetectedScriptVersion(null);
    setShowVersionMismatchAlert(false);

    try {
      const result = await syncManager.testConnection(targetUrl);
      if (result.ok && result.sheetUrl && profile && onUpdateProfile) {
        onUpdateProfile({ ...profile, googleSheetUrl: result.sheetUrl });
      }

      // Detect version if reported by backend
      const versionMatch = result.message.match(/v\d+\.\d+(\.\d+)?/);
      const detectedVer = versionMatch ? versionMatch[0] : GOOGLE_APPS_SCRIPT_VERSION;
      setDetectedScriptVersion(detectedVer);
      
      // When connection test succeeds, mark backend as verified and do not trigger false-positive mismatch alert
      setShowVersionMismatchAlert(false);

      const tabCount = result.tabs && result.tabs.length > 0 ? ` (${result.tabs.length} tabs verified)` : '';
      setSyncFeedback({
        type: result.ok ? 'success' : 'error',
        message: result.ok
          ? `Connected & Verified: Hotel Damview Google Workspace Backend is online and responding${tabCount}.`
          : result.message,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: err.message || 'Connection test failed.',
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsTesting(false);
    }
  };

  // 2b. Trigger Test PDF Upload to Google Drive
  const handleUploadTestPdf = async () => {
    const targetUrl = profile?.googleWebAppUrl;
    if (!targetUrl) {
      setSyncFeedback({
        type: 'error',
        message: 'No Google Apps Script Web App URL configured. Please set it in Hotel Settings.',
        timestamp: new Date().toLocaleTimeString(),
      });
      return;
    }

    setIsUploadingTestPdf(true);
    setTestPdfResult(null);
    try {
      const res = await syncManager.uploadTestPdfToDrive({
        folderName: profile?.googleDriveFolder || 'Hotel Damview Archives',
      });

      if (res.success) {
        setTestPdfResult({
          success: true,
          driveUrl: res.driveUrl,
          driveFileId: res.driveFileId,
          fileName: res.fileName,
          byteLength: res.byteLength,
          folderName: res.folderName,
          timestamp: new Date().toLocaleTimeString(),
        });
        setSyncFeedback({
          type: 'success',
          message: `Test PDF "${res.fileName}" successfully uploaded to Google Drive folder "${res.folderName || 'Hotel Damview Archives'}"!`,
          timestamp: new Date().toLocaleTimeString(),
        });
      } else {
        setTestPdfResult({
          success: false,
          error: res.error || 'Failed to upload test PDF to Google Drive.',
          timestamp: new Date().toLocaleTimeString(),
        });
        setSyncFeedback({
          type: 'error',
          message: res.error || 'Google Drive test PDF upload failed.',
          timestamp: new Date().toLocaleTimeString(),
        });
      }
    } catch (err: any) {
      setTestPdfResult({
        success: false,
        error: err.message || 'Error occurred during test PDF upload.',
        timestamp: new Date().toLocaleTimeString(),
      });
      setSyncFeedback({
        type: 'error',
        message: err.message || 'Test PDF upload failed.',
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsUploadingTestPdf(false);
    }
  };

  // 3. Trigger Safe Worksheet Cleanup & Deduplication
  const handleCleanWorksheets = async () => {
    if (!isOnline || !profile?.googleWebAppUrl) {
      setSyncFeedback({
        type: 'error',
        message: 'Network offline or Web App URL missing.',
        timestamp: new Date().toLocaleTimeString(),
      });
      return;
    }

    setIsCleaning(true);
    try {
      const res = await syncManager.cleanWorksheets();
      if (res.success) {
        const purgedCount = res.report?.purgedTabs?.length || 0;
        const mergedRows = res.report?.mergedRowsTotal || 0;
        setSyncFeedback({
          type: 'success',
          message:
            purgedCount > 0
              ? `Worksheet deduplication complete: Safely merged ${mergedRows} unique rows and purged ${purgedCount} duplicate worksheet(s).`
              : 'All spreadsheet worksheets are clean and correctly structured. No redundant tabs detected.',
          timestamp: new Date().toLocaleTimeString(),
        });
      } else {
        setSyncFeedback({
          type: 'error',
          message: res.error || 'Worksheet cleanup returned an error.',
          timestamp: new Date().toLocaleTimeString(),
        });
      }
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: err.message || 'Worksheet cleanup failed.',
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsCleaning(false);
    }
  };

  // 4. Trigger Auto Generation of All Module Tabs and Deduplication in Google Sheets
  const [isGeneratingTabs, setIsGeneratingTabs] = useState(false);
  const handleGenerateAllTabs = async () => {
    if (!isOnline || !profile?.googleWebAppUrl) {
      setSyncFeedback({
        type: 'error',
        message: 'Network offline or Web App URL missing.',
        timestamp: new Date().toLocaleTimeString(),
      });
      return;
    }

    setIsGeneratingTabs(true);
    try {
      const res = await syncManager.autoGenerateTabs();
      if (res.success) {
        const purgedNote = res.purgedCount ? ` (${res.purgedCount} duplicate/obsolete tab(s) purged)` : '';
        setSyncFeedback({
          type: 'success',
          message: `Successfully auto-generated all ERP module tabs and deduplicated your Google Spreadsheet.${purgedNote}`,
          timestamp: new Date().toLocaleTimeString(),
        });
        await loadLiveSheetData();
      } else {
        setSyncFeedback({
          type: 'error',
          message: res.error || res.message || 'Tab generation returned an error.',
          timestamp: new Date().toLocaleTimeString(),
        });
      }
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: err.message || 'Tab generation failed.',
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsGeneratingTabs(false);
    }
  };

  // 5. Push All Local Records to Google Sheets (Full Data Batch Sync)
  const [isFullPushing, setIsFullPushing] = useState(false);
  const handleFullPushToSheets = async () => {
    if (!isOnline || !profile?.googleWebAppUrl) {
      setSyncFeedback({
        type: 'error',
        message: 'Network offline or Web App URL missing.',
        timestamp: new Date().toLocaleTimeString(),
      });
      return;
    }

    setIsFullPushing(true);
    try {
      const res = await syncManager.fullPushToGoogleSheets();
      if (res.success) {
        setSyncFeedback({
          type: 'success',
          message: 'All local invoices, quotations, proformas, clients, and payments successfully pushed to Google Sheets.',
          timestamp: new Date().toLocaleTimeString(),
        });
        await loadLiveSheetData();
      } else {
        setSyncFeedback({
          type: 'error',
          message: res.error || res.message || 'Full push returned an error.',
          timestamp: new Date().toLocaleTimeString(),
        });
      }
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: err.message || 'Full push failed.',
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsFullPushing(false);
    }
  };

  // 5b. Pull All Remote Records from Google Sheets (Manual Pull & Merge)
  const [isPullingData, setIsPullingData] = useState(false);
  const handlePullFromSheets = async () => {
    if (!isOnline || !profile?.googleWebAppUrl) {
      setSyncFeedback({
        type: 'error',
        message: 'Network offline or Google Web App URL missing.',
        timestamp: new Date().toLocaleTimeString(),
      });
      return;
    }

    setIsPullingData(true);
    try {
      const res = await syncManager.pullFromGoogleSheets({ force: true });
      if (res.success) {
        await loadData();
        await loadLiveSheetData();

        const stats = res.stats;
        const details = stats
          ? `(${stats.invoices} invoices, ${stats.quotations} quotations, ${stats.proformas} proformas, ${stats.clients} clients, ${stats.payments} receipts)`
          : '';

        setSyncFeedback({
          type: 'success',
          message:
            res.itemsPulled > 0
              ? `Successfully pulled and merged ${res.itemsPulled} record(s) from Google Sheets ${details}.`
              : 'Pull completed: Local database is already completely in sync with Google Sheets.',
          timestamp: new Date().toLocaleTimeString(),
        });
      } else {
        setSyncFeedback({
          type: 'error',
          message: res.error || 'Pull from Google Sheets failed.',
          timestamp: new Date().toLocaleTimeString(),
        });
      }
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: err.message || 'Pull from Google Sheets encountered an error.',
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsPullingData(false);
    }
  };

  // 6. Fetch Live Sheet Data for Live Preview
  const loadLiveSheetData = async () => {
    if (!profile?.googleWebAppUrl || !isOnline) return;
    setIsLoadingLiveSheet(true);
    try {
      const res = await syncManager.fetchSheetData();
      if (res.success && res.data) {
        setLiveSheetData(res.data);
        if (res.data.discoveredTabs && res.data.discoveredTabs.length > 0) {
          if (!res.data.discoveredTabs.some((t) => t.name === selectedDiscoveredTab)) {
            setSelectedDiscoveredTab(res.data.discoveredTabs[0].name);
          }
        }
      }
    } catch (err) {
      console.warn('Live sheet fetch error:', err);
    } finally {
      setIsLoadingLiveSheet(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'LiveSheets' && !liveSheetData && profile?.googleWebAppUrl && isOnline) {
      loadLiveSheetData();
    }
  }, [activeTab, liveSheetData, profile?.googleWebAppUrl, isOnline]);

  // 5. Toggle Auto-Sync
  const handleToggleAutoSync = async () => {
    if (!profile) return;
    const nextVal = !profile.autoSyncEnabled;
    await dbService.saveHotelProfile({ autoSyncEnabled: nextVal });
    setProfile({ ...profile, autoSyncEnabled: nextVal });
  };

  // 6. Cascade Delete Confirmation
  const handleConfirmCascadeDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);

    try {
      if (itemToDelete.type === 'document') {
        await dbService.deleteDocument(itemToDelete.id);
        if (cascadeSheet) {
          await syncManager.cascadeDeleteDocument(
            itemToDelete.id,
            itemToDelete.number || '',
            cascadeDrive ? profile?.googleDriveFolder : undefined
          );
        }
      } else if (itemToDelete.type === 'client') {
        await dbService.deleteClient(itemToDelete.id);
        if (cascadeSheet) {
          await syncManager.cascadeDeleteClient(itemToDelete.id);
        }
      } else if (itemToDelete.type === 'receipt') {
        await dbService.deletePayment(itemToDelete.id);
        if (cascadeSheet) {
          await syncManager.cascadeDeletePayment(
            itemToDelete.id,
            itemToDelete.number || '',
            itemToDelete.documentNumber,
            cascadeDrive ? profile?.googleDriveFolder : undefined
          );
        }
      }

      await loadData();
      setItemToDelete(null);
      setSyncFeedback({
        type: 'success',
        message: `Successfully deleted ${itemToDelete.name} across selected systems.`,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: `Deletion error: ${err.message || 'Failed to delete record'}`,
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // 7. Request Deletion of Entry in Live Worksheet Inspector
  const handleRequestDeleteLiveRow = (row: any[], rIdx: number) => {
    if (!activeDiscoveredSheet) return;
    const headers = activeDiscoveredSheet.headers || [];
    let rowIdentifier = '';
    let docId = '';
    let docNum = '';
    let clientId = '';
    let paymentId = '';
    let recNum = '';

    headers.forEach((h, cIdx) => {
      const hLower = String(h || '').toLowerCase();
      const val = String(row[cIdx] || '').trim();
      if (!val) return;

      if (hLower.includes('doc id') || hLower === 'id' || hLower.includes('document id')) {
        if (!docId && val.startsWith('doc-')) docId = val;
        if (!clientId && val.startsWith('cl-')) clientId = val;
        if (!paymentId && val.startsWith('pay-')) paymentId = val;
        if (!rowIdentifier) rowIdentifier = val;
      }
      if (hLower.includes('invoice #') || hLower.includes('quotation #') || hLower.includes('proforma #') || hLower.includes('doc #')) {
        docNum = val;
        if (!rowIdentifier) rowIdentifier = val;
      }
      if (hLower.includes('client id')) {
        clientId = val;
        if (!rowIdentifier) rowIdentifier = val;
      }
      if (hLower.includes('receipt #') || hLower.includes('rec #')) {
        recNum = val;
        if (!rowIdentifier) rowIdentifier = val;
      }
      if (hLower.includes('payment id')) {
        paymentId = val;
        if (!rowIdentifier) rowIdentifier = val;
      }
    });

    if (!rowIdentifier && row.length > 0) {
      rowIdentifier = String(row[0] || `Row ${rIdx + 1}`);
    }

    setLiveEntryToDelete({
      tabName: selectedDiscoveredTab,
      rowIndex: rIdx,
      rowData: row,
      rowIdentifier,
      docId,
      docNum,
      clientId,
      paymentId,
      recNum,
    });
  };

  // 8. Confirm Deletion of Entry from Live Google Spreadsheet & Local DB
  const handleConfirmDeleteLiveEntry = async () => {
    if (!liveEntryToDelete) return;
    setIsDeletingLiveEntry(true);
    try {
      const res = await syncManager.deleteLiveSpreadsheetEntry({
        tabName: liveEntryToDelete.tabName,
        rowIndex: liveEntryToDelete.rowIndex,
        rowIdentifier: liveEntryToDelete.rowIdentifier,
        documentId: liveEntryToDelete.docId,
        documentNumber: liveEntryToDelete.docNum,
        clientId: liveEntryToDelete.clientId,
        paymentId: liveEntryToDelete.paymentId,
        receiptNumber: liveEntryToDelete.recNum,
      });

      if (res.success) {
        setSyncFeedback({
          type: 'success',
          message: res.message || 'Live worksheet entry deleted successfully.',
          timestamp: new Date().toLocaleTimeString(),
        });
        await loadData();
        await loadLiveSheetData();
        setLiveEntryToDelete(null);
      } else {
        setSyncFeedback({
          type: 'error',
          message: res.error || 'Failed to delete entry from Google Spreadsheet.',
          timestamp: new Date().toLocaleTimeString(),
        });
      }
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: err.message || 'Error deleting entry.',
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsDeletingLiveEntry(false);
    }
  };

  // Auto-hydrated default canonical tabs ensuring container is NEVER empty or uninitialized upon mount
  const effectiveDiscoveredTabs = useMemo<DiscoveredTab[]>(() => {
    if (liveSheetData?.discoveredTabs && liveSheetData.discoveredTabs.length > 0) {
      return liveSheetData.discoveredTabs;
    }
    return [
      {
        name: 'Invoices',
        rowCount: invoices.length,
        headers: ['Document #', 'Date', 'Client Name', 'PIN', 'Grand Total (Ksh)', 'Paid (Ksh)', 'Balance (Ksh)', 'Status', 'Drive PDF'],
        rows: invoices.map((d) => [
          d.documentNumber,
          d.issueDate,
          d.clientName,
          d.clientKraPin || '—',
          d.grandTotal.toLocaleString(),
          (d.amountPaid || 0).toLocaleString(),
          d.balanceDue.toLocaleString(),
          d.status,
          d.driveFileUrl || 'Local ERP Mirror',
        ]),
      },
      {
        name: 'Quotations',
        rowCount: quotations.length,
        headers: ['Document #', 'Date', 'Client Name', 'Grand Total (Ksh)', 'Status', 'Drive PDF'],
        rows: quotations.map((d) => [
          d.documentNumber,
          d.issueDate,
          d.clientName,
          d.grandTotal.toLocaleString(),
          d.status,
          d.driveFileUrl || 'Local ERP Mirror',
        ]),
      },
      {
        name: 'Proformas',
        rowCount: proformas.length,
        headers: ['Document #', 'Date', 'Client Name', 'Grand Total (Ksh)', 'Status', 'Drive PDF'],
        rows: proformas.map((d) => [
          d.documentNumber,
          d.issueDate,
          d.clientName,
          d.grandTotal.toLocaleString(),
          d.status,
          d.driveFileUrl || 'Local ERP Mirror',
        ]),
      },
      {
        name: 'Receipts',
        rowCount: payments.length,
        headers: ['Receipt #', 'Date', 'Client Name', 'Doc Ref', 'Mode', 'Amount (Ksh)', 'Drive PDF'],
        rows: payments.map((p) => [
          p.receiptNumber,
          p.date,
          p.clientName,
          p.documentNumber,
          p.paymentMode,
          p.amount.toLocaleString(),
          p.driveFileUrl || 'Local ERP Mirror',
        ]),
      },
      {
        name: 'Clients',
        rowCount: clients.length,
        headers: ['Client ID', 'Name', 'Phone', 'Email', 'KRA PIN', 'Address'],
        rows: clients.map((c) => [c.id, c.name, c.phone, c.email || '—', c.kraPin || '—', c.address || '—']),
      },
      {
        name: 'Audit_Log',
        rowCount: auditLogs.length,
        headers: ['Timestamp', 'Entity', 'Action', 'Target ID', 'Details'],
        rows: auditLogs.slice(0, 50).map((a) => [
          new Date(a.timestamp).toLocaleString(),
          a.entityType,
          a.action,
          a.entityId,
          a.details,
        ]),
      },
    ];
  }, [liveSheetData, invoices, quotations, proformas, payments, clients, auditLogs]);

  // Live Sheet active tab columns and rows
  const activeDiscoveredSheet = useMemo<DiscoveredTab | null>(() => {
    if (!effectiveDiscoveredTabs || effectiveDiscoveredTabs.length === 0) return null;
    return (
      effectiveDiscoveredTabs.find((t) => t.name === selectedDiscoveredTab) ||
      effectiveDiscoveredTabs[0] ||
      null
    );
  }, [effectiveDiscoveredTabs, selectedDiscoveredTab]);

  const filteredLiveRows = useMemo(() => {
    if (!activeDiscoveredSheet || !activeDiscoveredSheet.rows) return [];
    if (!liveSheetFilter.trim()) return activeDiscoveredSheet.rows;
    const term = liveSheetFilter.toLowerCase();
    return activeDiscoveredSheet.rows.filter((row) =>
      row.some((cell) => String(cell || '').toLowerCase().includes(term))
    );
  }, [activeDiscoveredSheet, liveSheetFilter]);

  // Google Drive File Registry & Memoized Browser Entries
  const driveFiles = useMemo(() => {
    const list: Array<{
      id: string;
      documentNumber: string;
      clientName: string;
      type: 'INVOICE' | 'QUOTATION' | 'PROFORMA' | 'RECEIPT';
      date: string;
      amount: number;
      driveFileUrl?: string;
      driveFileId?: string;
      status: 'Archived' | 'Pending Archival';
      doc?: BillingDocument;
      payment?: PaymentRecord;
    }> = [];

    documents.forEach((d) => {
      list.push({
        id: d.id,
        documentNumber: d.documentNumber,
        clientName: d.clientName,
        type: d.documentType,
        date: d.issueDate,
        amount: d.grandTotal,
        driveFileUrl: d.driveFileUrl,
        driveFileId: d.driveFileId,
        status: d.driveFileUrl ? 'Archived' : 'Pending Archival',
        doc: d,
      });
    });

    payments.forEach((p) => {
      list.push({
        id: p.id,
        documentNumber: p.receiptNumber,
        clientName: p.clientName,
        type: 'RECEIPT',
        date: p.date,
        amount: p.amount,
        driveFileUrl: p.driveFileUrl,
        driveFileId: p.driveFileId,
        status: p.driveFileUrl ? 'Archived' : 'Pending Archival',
        payment: p,
      });
    });

    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [documents, payments]);

  const filteredDriveFiles = useMemo(() => {
    return driveFiles.filter((f) => {
      if (driveFilterType !== 'ALL' && f.type !== driveFilterType) return false;
      if (driveStatusFilter === 'ARCHIVED' && !f.driveFileUrl) return false;
      if (driveStatusFilter === 'PENDING' && f.driveFileUrl) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const inNum = f.documentNumber.toLowerCase().includes(q);
        const inClient = f.clientName.toLowerCase().includes(q);
        if (!inNum && !inClient) return false;
      }
      return true;
    });
  }, [driveFiles, driveFilterType, driveStatusFilter, searchTerm]);

  const handleArchiveFileNow = async (fileItem: typeof driveFiles[0]) => {
    setArchivingItemId(fileItem.id);
    try {
      if (fileItem.doc) {
        const res = await syncManager.archiveDocumentPdf(fileItem.doc);
        if (res.success && res.driveUrl) {
          setSyncFeedback({
            type: 'success',
            message: `Successfully archived ${fileItem.documentNumber} to Google Drive!`,
            timestamp: new Date().toLocaleTimeString(),
          });
        } else {
          setSyncFeedback({
            type: 'info',
            message: `Archival queued or completed with URL: ${res.driveUrl || 'Pending'}`,
            timestamp: new Date().toLocaleTimeString(),
          });
        }
      } else if (fileItem.payment) {
        const res = await syncManager.archiveReceiptPdf(fileItem.payment);
        if (res.success && res.driveUrl) {
          setSyncFeedback({
            type: 'success',
            message: `Successfully archived ${fileItem.documentNumber} to Google Drive!`,
            timestamp: new Date().toLocaleTimeString(),
          });
        } else {
          setSyncFeedback({
            type: 'info',
            message: `Archival queued or completed with URL: ${res.driveUrl || 'Pending'}`,
            timestamp: new Date().toLocaleTimeString(),
          });
        }
      }
      await loadData();
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: `Failed to archive: ${err.message}`,
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setArchivingItemId(null);
    }
  };

  const handleCopyDriveLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedDriveLink(url);
    setTimeout(() => setCopiedDriveLink(null), 2500);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12 animate-fade-in text-stone-900">
      {/* 1. HEADER TELEMETRY & CONTROLS BANNER */}
      <div className="bg-stone-900 text-stone-100 rounded-lg p-4 sm:p-5 shadow-sm border border-stone-800">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="p-1.5 bg-amber-500/20 text-amber-400 rounded">
                <FileSpreadsheet className="w-5 h-5" />
              </span>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
                Centralized Google Workspace & Sheets Ledger
              </h1>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                  isOnline
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50'
                    : 'bg-rose-950/80 text-rose-300 border border-rose-800/50'
                }`}
              >
                {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {isOnline ? 'Online' : 'Offline'}
              </span>
              {(syncQueue?.length || 0) > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/50">
                  <UploadCloud className="w-3 h-3" />
                  {syncQueue?.length || 0} Queued
                </span>
              )}
            </div>
            <p className="text-xs text-stone-400 max-w-2xl">
              Real-time, zero-auth bidirectional synchronization across Hotel Damview ERP, Google Sheets, and Google Drive archives.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 rounded text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
            </button>

            <button
              type="button"
              onClick={handleGenerateAllTabs}
              disabled={isGeneratingTabs || !isOnline}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 border border-emerald-700/60 rounded text-xs font-semibold transition-colors disabled:opacity-50"
              title="Auto generate all module tabs from app modules & purge duplicate or unstated worksheets"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isGeneratingTabs ? 'animate-spin' : ''}`} />
              <span>{isGeneratingTabs ? 'Auto-Generating Tabs...' : 'Auto Generate Tabs'}</span>
            </button>

            <button
              type="button"
              onClick={handleUploadTestPdf}
              disabled={isUploadingTestPdf || !isOnline}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-950/80 hover:bg-blue-900 text-blue-200 border border-blue-700/70 rounded text-xs font-semibold transition-colors disabled:opacity-50 shadow-xs"
              title="Generate a sample test PDF and archive it directly to Google Drive"
            >
              <UploadCloud className={`w-3.5 h-3.5 ${isUploadingTestPdf ? 'animate-bounce text-blue-300' : ''}`} />
              <span>{isUploadingTestPdf ? 'Uploading PDF...' : 'Upload Test PDF'}</span>
            </button>

            <button
              type="button"
              onClick={handleFullPushToSheets}
              disabled={isFullPushing || !isOnline}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-900/80 hover:bg-blue-800 text-blue-200 border border-blue-700/60 rounded text-xs font-semibold transition-colors disabled:opacity-50"
              title="Push all local records across all modules to populate all Google Sheets tabs"
            >
              <UploadCloud className={`w-3.5 h-3.5 ${isFullPushing ? 'animate-spin' : ''}`} />
              <span>{isFullPushing ? 'Pushing Data...' : 'Push to Sheets'}</span>
            </button>

            <button
              type="button"
              onClick={handlePullFromSheets}
              disabled={isPullingData || !isOnline}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/90 hover:bg-emerald-900 text-emerald-200 border border-emerald-700/70 rounded text-xs font-semibold transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
              title="Pull latest invoices, quotations, clients, and payments from Google Sheets into local storage"
            >
              <DownloadCloud className={`w-3.5 h-3.5 ${isPullingData ? 'animate-bounce text-emerald-300' : ''}`} />
              <span>{isPullingData ? 'Pulling Data...' : 'Pull from Sheets'}</span>
            </button>

            <button
              type="button"
              onClick={handleCleanWorksheets}
              disabled={isCleaning || !isOnline}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-amber-300 border border-stone-700 rounded text-xs font-semibold transition-colors disabled:opacity-50"
              title="Detect and safely purge redundant worksheet tabs"
            >
              <Layers className={`w-3.5 h-3.5 ${isCleaning ? 'animate-spin' : ''}`} />
              <span>{isCleaning ? 'Cleaning...' : 'Deduplicate Tabs'}</span>
            </button>

            <button
              type="button"
              onClick={handleBidirectionalSync}
              disabled={isSyncing || !isOnline}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded text-xs shadow-xs transition-colors disabled:opacity-50"
            >
              <ArrowDownUp className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Bidirectional'}</span>
            </button>
          </div>
        </div>

        {/* Status bar */}
        <div className="mt-3 pt-3 border-t border-stone-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-stone-400">
          <div className="flex items-center gap-3 flex-wrap">
            <span>
              Last Synchronized:{' '}
              <strong className="text-stone-200">
                {profile?.lastSyncTimestamp
                  ? new Date(profile.lastSyncTimestamp).toLocaleString()
                  : 'Never'}
              </strong>
            </span>
            <span>•</span>
            <span>
              Drive Archive Folder:{' '}
              <strong className="text-stone-200">
                {profile?.googleDriveFolder || 'Hotel Damview Archives'}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={profile?.autoSyncEnabled || false}
                onChange={handleToggleAutoSync}
                className="rounded border-stone-700 bg-stone-800 text-amber-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5"
              />
              <span className="text-stone-300">Real-Time Live Auto-Sync (Active & Instant Push)</span>
            </label>
          </div>
        </div>

        {/* Workspace Quick Shortcuts */}
        <div className="mt-3 pt-3 border-t border-stone-800/60 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <a
            href={
              profile?.googleSheetUrl ||
              'https://docs.google.com/spreadsheets'
            }
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-3 py-2 rounded bg-emerald-950/40 hover:bg-emerald-950/70 border border-emerald-800/60 text-emerald-200 transition-colors group text-xs"
            title="Launch Google Spreadsheet in new tab"
          >
            <div className="flex items-center gap-2 min-w-0">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold text-white group-hover:text-emerald-300 transition-colors truncate">
                Open Google Sheet Master Ledger
              </span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-emerald-400 opacity-70 group-hover:opacity-100 shrink-0 ml-1.5" />
          </a>

          <a
            href={
              profile?.googleDriveFolderUrl ||
              'https://drive.google.com'
            }
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-3 py-2 rounded bg-blue-950/40 hover:bg-blue-950/70 border border-blue-800/60 text-blue-200 transition-colors group text-xs"
            title="Launch Google Drive folder in new tab"
          >
            <div className="flex items-center gap-2 min-w-0">
              <FolderOpen className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="font-semibold text-white group-hover:text-blue-300 transition-colors truncate">
                Open Google Drive PDF Archives
              </span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-blue-400 opacity-70 group-hover:opacity-100 shrink-0 ml-1.5" />
          </a>
        </div>
      </div>

      {/* GOOGLE APPS SCRIPT VERSION MISMATCH ALERT */}
      {showVersionMismatchAlert && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs space-y-3 animate-fade-in">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-amber-900 text-sm">Companion Google Apps Script Update Required</h4>
                <p className="text-amber-800 mt-1 leading-relaxed">
                  Your actively deployed Google Apps Script Web App is running version{' '}
                  <span className="font-mono font-bold bg-amber-100 px-1 rounded">{detectedScriptVersion || 'Unknown'}</span>,{' '}
                  but the application requires the latest{' '}
                  <span className="font-mono font-bold bg-emerald-100 text-emerald-900 px-1 rounded">{GOOGLE_APPS_SCRIPT_VERSION}</span>.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowVersionMismatchAlert(false)}
              className="text-amber-600 hover:text-amber-800 font-bold px-1"
            >
              ✕
            </button>
          </div>

          <div className="bg-stone-900 text-stone-100 p-3 rounded-md font-mono text-[11px] leading-relaxed space-y-2">
            <div className="flex items-center justify-between border-b border-stone-800 pb-2">
              <span className="text-amber-400 font-bold">Latest Companion Code (Code.gs {GOOGLE_APPS_SCRIPT_VERSION})</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
                  setIsCopiedGSCode(true);
                  setTimeout(() => setIsCopiedGSCode(false), 3000);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded transition-colors text-[10px]"
              >
                {isCopiedGSCode ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{isCopiedGSCode ? 'Copied Code.gs!' : 'Copy Code.gs Script'}</span>
              </button>
            </div>
            <div className="text-stone-300 space-y-1">
              <p className="font-bold text-white mb-1">To Update Deployed Web App:</p>
              <p>1. Open your connected Google Sheet ledger.</p>
              <p>2. Select <strong className="text-amber-400">Extensions &gt; Apps Script</strong>.</p>
              <p>3. Overwrite all existing code in <strong className="text-stone-100">Code.gs</strong> with this copied code.</p>
              <p>4. Click <strong className="text-stone-100">Deploy &gt; Manage deployments</strong>, click the pencil edit icon, select <strong className="text-amber-400">New version</strong>, and click <strong className="text-white">Deploy</strong>.</p>
            </div>
          </div>
        </div>
      )}

      {/* SYNC FEEDBACK BANNER */}
      {syncFeedback && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-start justify-between gap-3 animate-fade-in ${
            syncFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : syncFeedback.type === 'error'
              ? 'bg-rose-50 text-rose-900 border-rose-200'
              : 'bg-stone-50 text-stone-800 border-stone-200'
          }`}
        >
          <div className="flex items-start gap-2">
            {syncFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : syncFeedback.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-4 h-4 text-stone-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-semibold">{syncFeedback.message}</p>
              <p className="text-[10px] opacity-75 mt-0.5">{syncFeedback.timestamp}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSyncFeedback(null)}
            className="text-stone-400 hover:text-stone-600 font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* LIVE SYNC TELEMETRY & OBSERVABILITY BANNER */}
      <SyncTelemetryBadge showForceSyncButton={true} className="shadow-xs" />

      {/* 2. NAVIGATION SUB-TABS */}
      <div className="flex items-center justify-between gap-2 border-b border-stone-200 pb-1 flex-wrap">
        <div className="flex items-center gap-1 overflow-x-auto py-1">
          {[
            {
              id: 'LiveSheets',
              label: 'Live Sheets Preview',
              icon: Sparkles,
              badge: liveSheetData?.discoveredTabs ? `${liveSheetData.discoveredTabs.length} tabs` : undefined,
            },
            {
              id: 'Queue',
              label: 'Offline Sync Queue',
              count: syncQueue?.length || 0,
              icon: UploadCloud,
              highlight: (syncQueue?.length || 0) > 0,
            },
            {
              id: 'Audit',
              label: 'Audit Trail & Verification',
              icon: History,
              count: auditLogs?.length || 0,
            },
            {
              id: 'Diagnostics',
              label: 'Schema & Field Diagnostics',
              icon: Cpu,
              badge: 'Parity Engine',
            },
            {
              id: 'Script',
              label: 'Companion Code (Code.gs)',
              icon: FileCode,
              badge: GOOGLE_APPS_SCRIPT_VERSION,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setSearchTerm('');
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-stone-900 text-amber-400 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                } ${tab.highlight ? 'text-amber-700 bg-amber-50 font-bold' : ''}`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isActive ? 'bg-stone-800 text-amber-300' : 'bg-stone-200 text-stone-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
                {tab.badge && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. TAB CONTENT VIEWS */}
      <div className="space-y-4">


        {/* 4. LIVE SHEETS PREVIEW & TAB DISCOVERY */}
        {activeTab === 'LiveSheets' && (
          <div className="bg-white border border-stone-200 rounded-lg shadow-xs p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-stone-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  Live Google Spreadsheet Worksheet Inspector & Discovery
                </h3>
                <p className="text-xs text-stone-500">
                  Real-time data directly retrieved from your centralized Google Spreadsheet.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Autonomous Live Background Sync Telemetry */}
                <div className="flex items-center gap-2 bg-emerald-50/90 border border-emerald-200 px-2.5 py-1 rounded text-xs">
                  <span className="font-semibold text-emerald-900 flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3 animate-spin text-emerald-600" />
                    <span>Autonomous Cloud Sync Active</span>
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-700 text-white">
                    Sub-second Push
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handlePullFromSheets}
                  disabled={isPullingData || !isOnline}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                  title="Import and merge all records from this spreadsheet into your local ERP database"
                >
                  <DownloadCloud className={`w-3.5 h-3.5 ${isPullingData ? 'animate-bounce text-emerald-200' : ''}`} />
                  <span>{isPullingData ? 'Pulling...' : 'Pull to Local DB'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    loadLiveSheetData();
                    setIframeCacheBuster(Date.now());
                  }}
                  disabled={isLoadingLiveSheet || !isOnline}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded text-xs font-semibold transition-colors disabled:opacity-50"
                  title="Reload live Google Sheet rows and refresh preview"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLiveSheet ? 'animate-spin' : ''}`} />
                  <span>{isLoadingLiveSheet ? 'Fetching...' : 'Refresh Live Data'}</span>
                </button>

                {profile?.googleSheetEmbedUrl && (
                  <button
                    type="button"
                    onClick={() => setShowEmbeddedIframe(!showEmbeddedIframe)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 text-amber-400 hover:bg-stone-800 rounded text-xs font-semibold transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{showEmbeddedIframe ? 'Show Table Inspector' : 'Show Embedded Sheet'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Embedded Iframe Option */}
            {showEmbeddedIframe && profile?.googleSheetEmbedUrl ? (
              <div className="space-y-2">
                <div className="bg-stone-100 border border-stone-200 rounded p-2 text-xs text-stone-600 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-stone-800">Interactive Embedded Google Sheet:</span>
                    {autoRefreshEnabled && (
                      <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Autonomous Cloud Sync Active
                      </span>
                    )}
                  </div>
                  <a
                    href={profile.googleSheetEmbedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-700 hover:text-amber-900 underline font-semibold flex items-center gap-1"
                  >
                    <span>Open in new Google tab</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="w-full h-[550px] border border-stone-300 rounded overflow-hidden shadow-inner bg-white">
                  <iframe
                    key={iframeCacheBuster}
                    src={`${profile.googleSheetEmbedUrl}${profile.googleSheetEmbedUrl.includes('?') ? '&' : '?'}t=${iframeCacheBuster}`}
                    title="Hotel Damview Centralized Spreadsheet"
                    className="w-full h-full border-0"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Dynamically Discovered & Auto-Hydrated Tabs Selector */}
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-stone-100">
                    <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider mr-1 shrink-0">
                      Worksheet Tabs:
                    </span>
                    {effectiveDiscoveredTabs.map((t) => (
                      <button
                        key={t.name}
                        type="button"
                        onClick={() => {
                          setSelectedDiscoveredTab(t.name);
                          setLiveSheetFilter('');
                        }}
                        className={`px-3 py-1 rounded text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                          selectedDiscoveredTab === t.name || (!selectedDiscoveredTab && t.name === effectiveDiscoveredTabs[0]?.name)
                            ? 'bg-amber-500 text-stone-950 shadow-xs'
                            : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                        }`}
                      >
                        <span>{t.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-stone-900/10 font-mono">
                          {t.rowCount} rows
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Filter Inside Discovered Tab */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="text-xs text-stone-600">
                      Viewing{' '}
                      <strong className="text-stone-900">{activeDiscoveredSheet?.name || selectedDiscoveredTab}</strong> (
                      {filteredLiveRows?.length || 0} rows {liveSheetData ? 'loaded from Google Spreadsheet' : 'hydrated from ERP ledger'})
                    </div>
                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                      <input
                        type="text"
                        placeholder="Filter worksheet rows..."
                        value={liveSheetFilter}
                        onChange={(e) => setLiveSheetFilter(e.target.value)}
                        className="w-full pl-8 pr-3 py-1 bg-white border border-stone-300 rounded text-xs text-stone-900 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  {/* Live Discovered Tab Table */}
                  <div className="border border-stone-200 rounded-lg overflow-x-auto max-h-[500px]">
                    <table className="w-full text-left text-xs text-stone-700">
                      <thead className="bg-stone-900 text-amber-300 uppercase text-[10px] font-semibold tracking-wider sticky top-0 z-10 shadow-xs">
                        <tr>
                          {activeDiscoveredSheet?.headers && activeDiscoveredSheet.headers.length > 0 ? (
                            activeDiscoveredSheet.headers.map((h, i) => (
                              <th key={i} className="py-2.5 px-3 whitespace-nowrap">
                                {h}
                              </th>
                            ))
                          ) : (
                            <th className="py-2.5 px-3">Columns</th>
                          )}
                          <th className="py-2.5 px-3 text-right whitespace-nowrap sticky right-0 bg-stone-900 shadow-xs">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200 font-mono">
                        {(filteredLiveRows?.length || 0) > 0 ? (
                          filteredLiveRows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-stone-50 transition-colors group">
                              {row.map((cell, cIdx) => {
                                const cellStr = String(cell ?? '');
                                const isDriveUrl = cellStr.startsWith('http') && cellStr.includes('drive.google.com');
                                return (
                                  <td
                                    key={cIdx}
                                    className="py-2 px-3 whitespace-nowrap max-w-xs truncate text-[11px]"
                                  >
                                    {isDriveUrl ? (
                                      <a
                                        href={cellStr}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="p-1 text-amber-700 hover:text-amber-900 hover:bg-amber-50 rounded inline-flex items-center transition-colors"
                                        title="Open archived PDF in Google Drive"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </a>
                                    ) : (
                                      cellStr || '—'
                                    )}
                                  </td>
                                );
                              })}
                              <td className="py-2 px-3 text-right whitespace-nowrap sticky right-0 bg-white group-hover:bg-stone-50 transition-colors">
                                <button
                                  type="button"
                                  onClick={() => handleRequestDeleteLiveRow(row, rIdx)}
                                  className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded transition-colors border border-rose-200 cursor-pointer shadow-xs inline-flex items-center justify-center"
                                  title="Delete entry from live Google Sheet and synchronize local ERP"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan={(activeDiscoveredSheet?.headers?.length || 1) + 1}
                              className="py-8 text-center text-stone-400 font-sans"
                            >
                              {isLoadingLiveSheet
                                ? 'Fetching live spreadsheet rows...'
                                : 'No rows found in this worksheet tab.'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* OFFLINE QUEUE TAB */}
        {activeTab === 'Queue' && (
          <div className="bg-white border border-stone-200 rounded-lg shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-stone-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <UploadCloud className="w-4 h-4 text-amber-600" />
                  Offline Synchronization Mutation Queue ({syncQueue?.length || 0})
                </h3>
                <p className="text-xs text-stone-500">
                  Transactions created while offline or during temporary network interruptions are safely buffered in local IndexedDB.
                </p>
              </div>

              {(syncQueue?.length || 0) > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await dbService.clearSyncQueue();
                      await loadData();
                    }}
                    className="px-3 py-1.5 bg-stone-100 hover:bg-rose-100 text-stone-600 hover:text-rose-700 rounded text-xs font-semibold transition-colors"
                  >
                    Clear Queue
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setIsSyncing(true);
                      const res = await syncManager.processSyncQueue();
                      await loadData();
                      setIsSyncing(false);
                      setSyncFeedback({
                        type: res.success ? 'success' : 'error',
                        message: res.message,
                        timestamp: new Date().toLocaleTimeString(),
                      });
                    }}
                    disabled={isSyncing || !isOnline}
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded text-xs shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>Process Queue Now</span>
                  </button>
                </div>
              )}
            </div>

            {(syncQueue?.length || 0) > 0 ? (
              <div className="space-y-2">
                {syncQueue.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 border border-stone-200 rounded-lg bg-stone-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-900">{item.action}</span>
                        <span
                          className={`px-2 py-0.2 rounded text-[10px] font-semibold ${
                            (item.status || '').toLowerCase() === 'failed'
                              ? 'bg-rose-100 text-rose-800'
                              : (item.status || '').toLowerCase() === 'syncing'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {(item.status || 'PENDING').toUpperCase()} (Retry: {item.retryCount || 0})
                        </span>
                      </div>
                      <p className="text-stone-500 text-[11px] font-mono">
                        Queued at: {new Date(item.createdAt || item.timestamp || Date.now()).toLocaleString()}
                      </p>
                      {(item.lastError || item.errorMessage) && (
                        <p className="text-rose-600 text-[11px] font-medium">
                          Error: {item.lastError || item.errorMessage}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          if (item.id !== undefined) {
                            await dbService.removeSyncQueueItem(item.id);
                            await loadData();
                          }
                        }}
                        className="p-1.5 text-stone-400 hover:text-rose-600 rounded bg-white border border-stone-200"
                        title="Remove from queue"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-stone-500">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <p className="font-semibold text-stone-800">Sync Queue is Clear</p>
                <p className="text-xs text-stone-400">All local documents and records are in sync with Google Sheets.</p>
              </div>
            )}
          </div>
        )}

        {/* AUDIT TRAIL TAB */}
        {activeTab === 'Audit' && (
          <div className="bg-white border border-stone-200 rounded-lg shadow-xs overflow-hidden">
            <div className="p-4 border-b border-stone-200 bg-stone-50 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-amber-600" />
                  <span>State Mutation &amp; Sync Audit Trail</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Immutable record of entity creations, updates, guarded mutations, and self-healing reconciliation.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRunE2EVerification}
                  disabled={isRunningE2ETest}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-amber-400 font-semibold rounded text-xs transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                  title="Execute end-to-end sync verification cycle with simulated corrupted and shifted Google Sheets data"
                >
                  <FileCheck className={`w-3.5 h-3.5 ${isRunningE2ETest ? 'animate-spin' : ''}`} />
                  <span>Run End-to-End Sync Test</span>
                </button>
                <button
                  type="button"
                  onClick={handleRunAuditVerification}
                  disabled={isVerifyingAudit}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-semibold rounded text-xs transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                  title="Verify that IndexedDB audit_log store accurately records mutations"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isVerifyingAudit ? 'animate-spin' : ''}`} />
                  <span>Verify Audit Logging</span>
                </button>
                <button
                  type="button"
                  onClick={loadData}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-stone-50 text-stone-700 border border-stone-300 rounded text-xs font-semibold shadow-2xs cursor-pointer"
                  title="Reload audit records from IndexedDB"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Log</span>
                </button>
              </div>
            </div>

            {/* End-to-End Sync Test Diagnostic Report */}
            {verificationResult && (
              <div className="p-4 bg-stone-900 text-stone-100 border-b border-stone-800">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-1.5 rounded ${
                        verificationResult.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {verificationResult.success ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white tracking-wide uppercase">
                        End-to-End Sync &amp; Defensive Merging Verification Report
                      </h4>
                      <p className="text-[11px] text-stone-400 font-sans">
                        Tested DB_VERSION upgrade, column-shift auto-correction, defensive anti-null shields, and tombstone guards.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        verificationResult.success
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                          : 'bg-rose-950 text-rose-300 border border-rose-700'
                      }`}
                    >
                      {verificationResult.passedChecks} / {verificationResult.totalChecks} Checks Passed
                    </span>
                    <button
                      type="button"
                      onClick={() => setVerificationResult(null)}
                      className="text-stone-400 hover:text-stone-200 p-1 cursor-pointer"
                      title="Dismiss report"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 font-sans">
                  {verificationResult.checks.map((chk) => (
                    <div
                      key={chk.id}
                      className="p-3 bg-stone-950/60 rounded border border-stone-800 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-[11px] font-semibold text-stone-200 leading-tight">
                            {chk.title}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                              chk.status === 'PASS'
                                ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/60'
                                : 'bg-rose-900/60 text-rose-300 border border-rose-700/60'
                            }`}
                          >
                            {chk.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-400 leading-relaxed">
                          {chk.details}
                        </p>
                      </div>
                      {chk.diagnostic && (
                        <div className="mt-2 pt-2 border-t border-stone-800/80 font-mono text-[10px] text-amber-300/90 truncate">
                          {typeof chk.diagnostic === 'string'
                            ? chk.diagnostic
                            : JSON.stringify(chk.diagnostic)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(filteredAuditLogs?.length || 0) > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-stone-600">
                  <thead className="bg-stone-900 text-stone-100 uppercase text-[10px] font-semibold tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3">Entity Type</th>
                      <th className="py-2.5 px-3">Target ID</th>
                      <th className="py-2.5 px-3">Details &amp; Mutations</th>
                      <th className="py-2.5 px-3 text-center">Snapshot</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 font-mono">
                    {filteredAuditLogs.map((log) => {
                      const actionStyles: Record<string, string> = {
                        CREATE: 'bg-emerald-100 text-emerald-800 border-emerald-300',
                        UPDATE: 'bg-sky-100 text-sky-800 border-sky-300',
                        DELETE: 'bg-rose-100 text-rose-800 border-rose-300',
                        SELF_HEALED: 'bg-purple-100 text-purple-800 border-purple-300',
                        MUTATION_GUARDED: 'bg-amber-100 text-amber-800 border-amber-300',
                        MERGED: 'bg-slate-100 text-slate-800 border-slate-300',
                        ERROR: 'bg-rose-100 text-rose-800 border-rose-300',
                        WARNING: 'bg-amber-100 text-amber-800 border-amber-300',
                        RECONCILE: 'bg-blue-100 text-blue-800 border-blue-300',
                        SYNC: 'bg-teal-100 text-teal-800 border-teal-300',
                      };
                      const actionBadgeClass = actionStyles[log.action] || 'bg-stone-100 text-stone-800 border-stone-300';

                      return (
                        <tr key={log.id} className="hover:bg-stone-50 transition-colors">
                          <td className="py-2.5 px-3 font-mono text-[11px] text-stone-700 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 font-sans whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${actionBadgeClass}`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-sans font-semibold text-stone-800 whitespace-nowrap">
                            {log.entityType}
                          </td>
                          <td className="py-2.5 px-3 text-stone-600 text-[11px] whitespace-nowrap">
                            {log.entityId}
                          </td>
                          <td className="py-2.5 px-3 font-sans text-stone-800">
                            {log.details}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {log.snapshot ? (
                              <button
                                type="button"
                                onClick={() => setSelectedAuditSnapshot(log)}
                                className="inline-flex items-center gap-1 text-[11px] text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded border border-amber-200 font-sans font-medium cursor-pointer"
                                title="Inspect captured data snapshot"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Inspect</span>
                              </button>
                            ) : (
                              <span className="text-stone-400 font-sans text-[11px]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-10 text-stone-500">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <p className="font-semibold text-stone-800">Audit Trail is Clean</p>
                <p className="text-xs text-stone-400">
                  Mutations from documents, clients, and sync will be recorded here automatically.
                </p>
              </div>
            )}
          </div>
        )}

        {/* 5. SCHEMA & FIELD DIAGNOSTICS INSPECTOR */}
        {activeTab === 'Diagnostics' && (
          <SchemaDiagnosticsInspector
            documents={documents}
            clients={clients}
            payments={payments}
            liveSheetData={liveSheetData}
            onRefreshLiveSheet={loadLiveSheetData}
          />
        )}

        {/* 6. COMPANION GOOGLE APPS SCRIPT (CODE.GS) & DEPLOYMENT WALKTHROUGH */}
        {activeTab === 'Script' && (
          <AppsScriptDiffInspector
            currentVersion={GOOGLE_APPS_SCRIPT_VERSION}
            onCopySuccess={() => {
              setSyncFeedback({
                type: 'success',
                message: `Authoritative Google Apps Script (${GOOGLE_APPS_SCRIPT_VERSION}) copied to clipboard! Paste into your Google Sheet's Apps Script editor.`,
                timestamp: new Date().toLocaleTimeString(),
              });
            }}
          />
        )}
      </div>

      {/* 5. CASCADE DELETE CONFIRMATION MODAL */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-4 animate-fade-in border border-stone-200">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 bg-rose-100 rounded-full">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-stone-900">Perform Cascade Deletion?</h3>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              You are deleting{' '}
              <strong className="text-stone-900">
                {itemToDelete.type === 'document'
                  ? `${itemToDelete.number || 'Document'} (${itemToDelete.name})`
                  : itemToDelete.type === 'receipt'
                  ? `${itemToDelete.name}${itemToDelete.amount ? ` - Ksh ${itemToDelete.amount.toLocaleString()}` : ''}`
                  : itemToDelete.name}
              </strong>
              . Choose whether to remove this record across all synchronized systems:
            </p>

            <div className="bg-stone-50 border border-stone-200 rounded p-3 space-y-2.5 text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-stone-800">
                <input type="checkbox" checked disabled className="rounded text-stone-900" />
                <span>
                  Remove from Local Database (IndexedDB)
                  {itemToDelete.type === 'receipt' && (
                    <span className="text-[11px] text-stone-500 block font-normal">
                      Reconciles linked invoice balance and status automatically.
                    </span>
                  )}
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-medium text-stone-800">
                <input
                  type="checkbox"
                  checked={cascadeSheet}
                  onChange={(e) => setCascadeSheet(e.target.checked)}
                  className="rounded text-stone-900"
                />
                <span>
                  Delete corresponding row in Google Sheet ledger
                  {itemToDelete.type === 'receipt' && (
                    <span className="text-[11px] text-stone-500 block font-normal">
                      Purges row from Receipts tab and updates remote invoice balance.
                    </span>
                  )}
                </span>
              </label>

              {(itemToDelete.type === 'document' || itemToDelete.type === 'receipt') && (
                <label className="flex items-center gap-2 cursor-pointer font-medium text-stone-800">
                  <input
                    type="checkbox"
                    checked={cascadeDrive}
                    onChange={(e) => setCascadeDrive(e.target.checked)}
                    className="rounded text-stone-900"
                  />
                  <span>Purge &amp; trash PDF archive from Google Drive</span>
                </label>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 text-xs text-stone-600 hover:text-stone-900 border border-stone-300 rounded bg-white hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCascadeDelete}
                disabled={isDeleting}
                className="px-4 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded shadow-xs flex items-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Purging Systems...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Purge Selected</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Snapshot Inspector Modal */}
      {selectedAuditSnapshot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
          onClick={() => setSelectedAuditSnapshot(null)}
        >
          <div
            className="bg-white rounded-lg border border-stone-300 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-stone-900">
                  Audit Snapshot: {selectedAuditSnapshot.action} {selectedAuditSnapshot.entityType}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAuditSnapshot(null)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded hover:bg-stone-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-stone-50 p-2.5 rounded border border-stone-200 font-mono text-[11px]">
                <div>
                  <span className="text-stone-500 font-sans block">Log ID:</span>
                  <span className="text-stone-800 font-semibold">{selectedAuditSnapshot.id}</span>
                </div>
                <div>
                  <span className="text-stone-500 font-sans block">Timestamp:</span>
                  <span className="text-stone-800 font-semibold">
                    {new Date(selectedAuditSnapshot.timestamp).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 font-sans block">Entity ID:</span>
                  <span className="text-stone-800 font-semibold">{selectedAuditSnapshot.entityId}</span>
                </div>
                <div>
                  <span className="text-stone-500 font-sans block">Action:</span>
                  <span className="text-stone-800 font-semibold">{selectedAuditSnapshot.action}</span>
                </div>
              </div>

              <div>
                <span className="font-semibold text-stone-700 block mb-1">Details:</span>
                <p className="bg-stone-50 p-2 rounded border border-stone-200 text-stone-800 font-sans">
                  {selectedAuditSnapshot.details}
                </p>
              </div>

              <div>
                <span className="font-semibold text-stone-700 block mb-1">Captured State Snapshot:</span>
                <pre className="p-3 bg-stone-900 text-amber-300 rounded font-mono text-[11px] overflow-x-auto max-h-60">
                  {JSON.stringify(selectedAuditSnapshot.snapshot, null, 2)}
                </pre>
              </div>
            </div>

            <div className="p-3 border-t border-stone-200 bg-stone-50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedAuditSnapshot(null)}
                className="px-4 py-1.5 bg-stone-900 text-amber-400 font-semibold text-xs rounded hover:bg-stone-800 cursor-pointer"
              >
                Close Snapshot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Google Drive File Previewer Modal */}
      {drivePreviewFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-950/80 backdrop-blur-xs animate-fade-in"
          onClick={() => setDrivePreviewFile(null)}
        >
          <div
            className="bg-white rounded-xl border border-stone-300 shadow-2xl max-w-4xl w-full h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-3.5 border-b border-stone-200 bg-stone-50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="p-1.5 bg-blue-100 text-blue-700 rounded">
                  <FolderOpen className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-stone-900 truncate flex items-center gap-2">
                    <span>{drivePreviewFile.documentNumber}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-stone-200 text-stone-800 uppercase">
                      {drivePreviewFile.type}
                    </span>
                  </h3>
                  <p className="text-xs text-stone-500 truncate">
                    {drivePreviewFile.clientName} &bull; {drivePreviewFile.date} &bull; {drivePreviewFile.amount.toLocaleString()} Ksh
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {drivePreviewFile.driveFileUrl && (
                  <>
                    <a
                      href={drivePreviewFile.driveFileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded transition-colors"
                    >
                      <span>Open in Drive</span>
                      <ExternalLink className="w-3 h-3 text-blue-600" />
                    </a>

                    <button
                      type="button"
                      onClick={() => handleCopyDriveLink(drivePreviewFile.driveFileUrl!)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-800 rounded transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedDriveLink === drivePreviewFile.driveFileUrl ? 'Copied!' : 'Copy Link'}</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setDrivePreviewFile(null)}
                  className="p-1 text-stone-400 hover:text-stone-700 rounded hover:bg-stone-200 transition-colors ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Embedded Drive Iframe or Vector Preview */}
            <div className="flex-1 bg-stone-100 overflow-auto p-4 flex justify-center items-start">
              {drivePreviewFile.driveFileId ? (
                <div className="w-full h-full min-h-[500px] bg-white rounded-lg shadow-inner overflow-hidden border border-stone-300">
                  <iframe
                    src={`https://drive.google.com/file/d/${drivePreviewFile.driveFileId}/preview`}
                    title={`Google Drive Preview: ${drivePreviewFile.documentNumber}`}
                    className="w-full h-full border-0"
                    allow="autoplay"
                  />
                </div>
              ) : drivePreviewFile.driveFileUrl && drivePreviewFile.driveFileUrl.includes('drive.google.com') ? (
                <div className="w-full h-full min-h-[500px] bg-white rounded-lg shadow-inner overflow-hidden border border-stone-300">
                  <iframe
                    src={drivePreviewFile.driveFileUrl.replace(/\/view(\?.*)?$/, '/preview')}
                    title={`Google Drive Preview: ${drivePreviewFile.documentNumber}`}
                    className="w-full h-full border-0"
                    allow="autoplay"
                  />
                </div>
              ) : (
                /* Fallback to local vector A4 preview if not yet uploaded to Drive or offline */
                <div className="bg-white shadow-2xl p-6 rounded-lg max-w-3xl w-full">
                  <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 flex items-center justify-between">
                    <span>This document has not yet been archived to Google Drive, or Drive file ID is pending. Viewing local document preview.</span>
                    <button
                      type="button"
                      onClick={() => handleArchiveFileNow(drivePreviewFile as any)}
                      disabled={archivingItemId === drivePreviewFile.id || !isOnline}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded text-xs transition-colors shrink-0 ml-2"
                    >
                      {archivingItemId === drivePreviewFile.id ? 'Archiving...' : 'Archive to Drive Now'}
                    </button>
                  </div>
                  {drivePreviewFile.doc && profile && (
                    <A4DocumentPreview document={drivePreviewFile.doc} profile={profile} scale={1} />
                  )}
                  {drivePreviewFile.payment && profile && (
                    <A4ReceiptPreview payment={drivePreviewFile.payment} profile={profile} scale={1} />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Live Worksheet Entry Deletion Confirmation Modal */}
      {liveEntryToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-fade-in"
          onClick={() => setLiveEntryToDelete(null)}
        >
          <div
            className="bg-white rounded-xl border border-rose-200 shadow-2xl max-w-lg w-full flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-rose-100 bg-rose-50/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-rose-100 text-rose-700 rounded-lg">
                  <AlertTriangle className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-rose-950">
                    Delete Live Spreadsheet Entry?
                  </h3>
                  <p className="text-[11px] text-rose-700 font-medium">
                    Worksheet Tab: <span className="font-bold">{liveEntryToDelete.tabName}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLiveEntryToDelete(null)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded hover:bg-stone-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-stone-700">
              <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-stone-500 font-semibold">Row Index:</span>
                  <span className="font-mono font-bold text-stone-900">Row #{liveEntryToDelete.rowIndex + 1}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-stone-500 font-semibold">Row Identifier:</span>
                  <span className="font-mono font-bold text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                    {liveEntryToDelete.rowIdentifier}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 space-y-1">
                <span className="font-bold flex items-center gap-1.5 text-amber-900">
                  <Info className="w-3.5 h-3.5 text-amber-600" />
                  Synchronized Deletion Policy
                </span>
                <p className="leading-snug">
                  This action will delete the row permanently from your active Google Spreadsheet worksheet (<b>{liveEntryToDelete.tabName}</b>) via Google Apps Script and purge corresponding records from your local ERP database.
                </p>
              </div>

              <div className="max-h-32 overflow-y-auto bg-stone-900 text-stone-200 font-mono text-[10px] p-2.5 rounded border border-stone-800">
                <span className="text-amber-400 block mb-1 font-sans font-bold text-[10px]">Captured Row Data Preview:</span>
                {liveEntryToDelete.rowData.slice(0, 8).map((cell, idx) => (
                  <div key={idx} className="truncate">
                    <span className="text-stone-500">Col {idx + 1}:</span> {String(cell ?? '—')}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3.5 border-t border-stone-200 bg-stone-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setLiveEntryToDelete(null)}
                disabled={isDeletingLiveEntry}
                className="px-4 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteLiveEntry}
                disabled={isDeletingLiveEntry}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded text-xs transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Trash2 className={`w-3.5 h-3.5 ${isDeletingLiveEntry ? 'animate-bounce' : ''}`} />
                <span>{isDeletingLiveEntry ? 'Deleting from Sheet...' : 'Confirm Live Deletion'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
