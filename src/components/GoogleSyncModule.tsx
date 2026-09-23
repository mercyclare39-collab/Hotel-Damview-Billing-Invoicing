import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { GOOGLE_APPS_SCRIPT_CODE } from '../services/googleScriptCode';
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
  Code,
  ShieldCheck,
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
  Settings,
  Link,
  Save,
  History,
  Eye,
  X,
} from 'lucide-react';
import { A4DocumentPreview } from './A4DocumentPreview';
import { A4ReceiptPreview } from './A4ReceiptPreview';

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
  const [activeTab, setActiveTab] = useState<
    'LiveSheets' | 'Queue' | 'Audit' | 'Config' | 'Script'
  >('LiveSheets');

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

  // Config local form state & dirty tracking
  const [configForm, setConfigForm] = useState<{
    googleWebAppUrl: string;
    googleSheetUrl: string;
    googleDriveFolderUrl: string;
    googleDriveFolder: string;
    googleSheetEmbedUrl: string;
    autoSyncEnabled: boolean;
  }>({
    googleWebAppUrl: initialProfile?.googleWebAppUrl || '',
    googleSheetUrl: initialProfile?.googleSheetUrl || '',
    googleDriveFolderUrl: initialProfile?.googleDriveFolderUrl || '',
    googleDriveFolder: initialProfile?.googleDriveFolder || 'Hotel Damview Archives',
    googleSheetEmbedUrl: initialProfile?.googleSheetEmbedUrl || '',
    autoSyncEnabled: initialProfile?.autoSyncEnabled !== false,
  });

  const isFormDirtyRef = useRef(false);
  const [isFormDirty, setIsFormDirty] = useState(false);
  const isInitializedRef = useRef(false);

  // Sync profile to configForm ONLY on initial load or when not dirty
  useEffect(() => {
    if (profile && (!isInitializedRef.current || !isFormDirtyRef.current)) {
      setConfigForm({
        googleWebAppUrl: profile.googleWebAppUrl || '',
        googleSheetUrl: profile.googleSheetUrl || '',
        googleDriveFolderUrl: profile.googleDriveFolderUrl || '',
        googleDriveFolder: profile.googleDriveFolder || 'Hotel Damview Archives',
        googleSheetEmbedUrl: profile.googleSheetEmbedUrl || '',
        autoSyncEnabled: profile.autoSyncEnabled !== false,
      });
      isInitializedRef.current = true;
    }
  }, [profile]);

  const updateConfigField = (field: keyof typeof configForm, value: any) => {
    isFormDirtyRef.current = true;
    setIsFormDirty(true);
    setConfigForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveConfig = async () => {
    try {
      await dbService.saveHotelProfile(configForm);
      const updated = await dbService.getHotelProfile();
      setProfile(updated);
      isFormDirtyRef.current = false;
      setIsFormDirty(false);
      if (onUpdateProfile) {
        await onUpdateProfile(updated);
      }
      setSyncFeedback({
        type: 'success',
        message: 'Headless Webhook credentials & URLs saved successfully.',
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: err.message || 'Failed to save configuration.',
        timestamp: new Date().toLocaleTimeString(),
      });
    }
  };

  // Search filter inside tables
  const [searchTerm, setSearchTerm] = useState('');

  // Sync operations state
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
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

  // Script copy state
  const [copiedScript, setCopiedScript] = useState(false);

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
    });

    // Listen for remote real-time data changes
    const handleDataChanged = () => {
      loadData();
      if (activeTab === 'LiveSheets') {
        loadLiveSheetData();
      }
    };

    window.addEventListener('damview:data-changed', handleDataChanged);

    return () => {
      unsubscribeSync();
      window.removeEventListener('damview:data-changed', handleDataChanged);
    };
  }, [loadData, activeTab]);

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
    const targetUrl = configForm.googleWebAppUrl || profile?.googleWebAppUrl;
    if (!targetUrl) {
      setSyncFeedback({
        type: 'error',
        message: 'No Google Apps Script Web App URL configured. Please set it in Configuration or Hotel Settings.',
        timestamp: new Date().toLocaleTimeString(),
      });
      return;
    }

    setIsTesting(true);
    try {
      const result = await syncManager.testConnection(targetUrl);
      if (result.ok && result.sheetUrl) {
        updateConfigField('googleSheetUrl', result.sheetUrl);
      }
      setSyncFeedback({
        type: result.ok ? 'success' : 'error',
        message: result.message,
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsTesting(false);
    }
  };

  // 2b. Trigger Test PDF Upload to Google Drive
  const handleUploadTestPdf = async () => {
    const targetUrl = configForm.googleWebAppUrl || profile?.googleWebAppUrl;
    if (!targetUrl) {
      setSyncFeedback({
        type: 'error',
        message: 'No Google Apps Script Web App URL configured. Please set it in Configuration or Hotel Settings.',
        timestamp: new Date().toLocaleTimeString(),
      });
      return;
    }

    setIsUploadingTestPdf(true);
    setTestPdfResult(null);
    try {
      const res = await syncManager.uploadTestPdfToDrive({
        folderName: configForm.googleDriveFolder || profile?.googleDriveFolder,
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

  // 4. Trigger Automatic Generation of All 11 ERP Tabs in Google Sheets
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
      const res = await syncManager.generateAllSheetTabs();
      if (res.success) {
        setSyncFeedback({
          type: 'success',
          message: 'Successfully generated and structured all 11 ERP worksheet tabs in your Google Spreadsheet.',
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

  // Live Sheet active tab columns and rows
  const activeDiscoveredSheet = useMemo<DiscoveredTab | null>(() => {
    if (!liveSheetData || !liveSheetData.discoveredTabs) return null;
    return (
      liveSheetData.discoveredTabs.find((t) => t.name === selectedDiscoveredTab) ||
      liveSheetData.discoveredTabs[0] ||
      null
    );
  }, [liveSheetData, selectedDiscoveredTab]);

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
              title="Generate all 11 ERP spreadsheet tabs with headers and formulas"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isGeneratingTabs ? 'animate-spin' : ''}`} />
              <span>{isGeneratingTabs ? 'Structuring...' : 'Generate 11 Tabs'}</span>
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
              title="Push all local documents, clients, receipts, and profile to populate all 11 tabs"
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
              configForm.googleSheetUrl ||
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
              configForm.googleDriveFolderUrl ||
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
            { id: 'Config', label: 'Webhook & Credentials', icon: Settings },
            { id: 'Script', label: 'Code.gs Script', icon: Code },
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

              <div className="flex items-center gap-2">
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
                  onClick={loadLiveSheetData}
                  disabled={isLoadingLiveSheet || !isOnline}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded text-xs font-semibold transition-colors disabled:opacity-50"
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
                  <span>Interactive Embedded Google Sheet:</span>
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
                    src={profile.googleSheetEmbedUrl}
                    title="Hotel Damview Centralized Spreadsheet"
                    className="w-full h-full border-0"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Dynamically Discovered Tabs Selector */}
                {liveSheetData?.discoveredTabs && liveSheetData.discoveredTabs.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-stone-100">
                      <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider mr-1 shrink-0">
                        Discovered Tabs:
                      </span>
                      {liveSheetData.discoveredTabs.map((t) => (
                        <button
                          key={t.name}
                          type="button"
                          onClick={() => {
                            setSelectedDiscoveredTab(t.name);
                            setLiveSheetFilter('');
                          }}
                          className={`px-3 py-1 rounded text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                            selectedDiscoveredTab === t.name
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
                        <strong className="text-stone-900">{selectedDiscoveredTab}</strong> (
                        {filteredLiveRows?.length || 0} rows loaded from Google Spreadsheet)
                      </div>
                      <div className="relative w-full sm:w-64">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                        <input
                          type="text"
                          placeholder="Filter live rows..."
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
                                          className="text-amber-700 hover:text-amber-900 underline font-semibold flex items-center gap-1 font-sans"
                                        >
                                          <span>Drive PDF</span>
                                          <ExternalLink className="w-3 h-3" />
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
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-[11px] font-semibold transition-colors border border-rose-200 cursor-pointer shadow-xs"
                                    title="Delete entry from live Google Sheet and synchronize local ERP"
                                  >
                                    <Trash2 className="w-3 h-3 text-rose-600" />
                                    <span>Delete</span>
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
                ) : (
                  <div className="text-center py-12 border border-dashed border-stone-200 rounded-lg space-y-3">
                    <FileSpreadsheet className="w-8 h-8 text-stone-400 mx-auto" />
                    <p className="text-xs font-semibold text-stone-700">
                      Live Google Sheets data not loaded yet
                    </p>
                    <p className="text-[11px] text-stone-400 max-w-sm mx-auto">
                      Click the button below to query your Google Apps Script endpoint and discover live worksheets.
                    </p>
                    <button
                      type="button"
                      onClick={loadLiveSheetData}
                      disabled={isLoadingLiveSheet || !isOnline}
                      className="px-4 py-1.5 bg-stone-900 text-amber-400 font-semibold rounded text-xs shadow-xs hover:bg-stone-800 disabled:opacity-50"
                    >
                      {isLoadingLiveSheet ? 'Connecting...' : 'Fetch Live Spreadsheet Data'}
                    </button>
                  </div>
                )}
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
                            item.status === 'failed'
                              ? 'bg-rose-100 text-rose-800'
                              : item.status === 'syncing'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.status.toUpperCase()} (Retry: {item.retryCount || 0})
                        </span>
                      </div>
                      <p className="text-stone-500 text-[11px] font-mono">
                        Queued at: {new Date(item.timestamp).toLocaleString()}
                      </p>
                      {item.errorMessage && (
                        <p className="text-rose-600 text-[11px] font-medium">
                          Error: {item.errorMessage}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await dbService.removeSyncQueueItem(item.id);
                          await loadData();
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

        {/* HEADLESS WEBHOOK & CREDENTIALS CONFIG TAB */}
        {activeTab === 'Config' && (
          <div className="bg-white border border-stone-200 rounded-lg shadow-xs p-5 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-4">
              <div>
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  Headless Webhook Configuration (No End-User Login)
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Connect your Google Apps Script Webhook, Google Sheet ledger, and Google Drive archive folder for automated background synchronization.
                </p>
              </div>

              {/* Quick shortcut action buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href={configForm.googleSheetUrl || 'https://docs.google.com/spreadsheets'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 rounded text-xs font-semibold transition-colors"
                  title="Open linked Google Sheet in new tab"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Open Google Sheet</span>
                  <ExternalLink className="w-3 h-3 text-emerald-600" />
                </a>

                <a
                  href={configForm.googleDriveFolderUrl || 'https://drive.google.com'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-300 rounded text-xs font-semibold transition-colors"
                  title="Open linked Google Drive folder in new tab"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-blue-700" />
                  <span>Open Drive Folder</span>
                  <ExternalLink className="w-3 h-3 text-blue-600" />
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Web App URL */}
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-semibold text-stone-800 flex items-center justify-between">
                  <span>Google Apps Script Web App Endpoint URL</span>
                  <span className="text-[11px] font-normal text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Required for sync
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={configForm.googleWebAppUrl}
                    onChange={(e) => updateConfigField('googleWebAppUrl', e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="flex-1 px-3 py-2 text-xs border border-stone-300 rounded-md focus:ring-1 focus:ring-amber-500 focus:border-amber-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting || !configForm.googleWebAppUrl}
                    className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 rounded-md text-xs font-semibold flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                    <span>Test</span>
                  </button>
                  {configForm.googleWebAppUrl && configForm.googleWebAppUrl.startsWith('http') && (
                    <a
                      href={configForm.googleWebAppUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 rounded-md text-xs font-semibold flex items-center gap-1 shrink-0"
                      title="Open Web App in new tab to test doGet healthcheck"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Browser Check</span>
                    </a>
                  )}
                </div>

                {/* Proactive URL Validation Messages */}
                {configForm.googleWebAppUrl.includes('docs.google.com/spreadsheets') && (
                  <div className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>
                      <b>Notice:</b> You entered a Google Spreadsheet link above. For synchronization, enter the Apps Script Web App URL ending in <code>/exec</code> (found in Google Sheets under Extensions &gt; Apps Script &gt; Deploy &gt; Manage deployments).
                    </span>
                  </div>
                )}
                {(configForm?.googleWebAppUrl?.trim()?.length || 0) > 0 &&
                  !configForm.googleWebAppUrl.includes('docs.google.com') &&
                  !configForm.googleWebAppUrl.includes('/exec') && (
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded text-amber-800 text-xs flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>
                        <b>Notice:</b> Published Apps Script Web App URLs usually end with <code>/exec</code>. Make sure you copied the Web App URL from <b>Deploy &gt; Manage deployments</b> (not the Script Editor link).
                      </span>
                    </div>
                  )}

                <p className="text-[11px] text-stone-500">
                  Paste the deployment URL obtained from your Apps Script project (Who has access: <b>Anyone</b>).
                </p>
              </div>

              {/* Troubleshooting Quick Help Card */}
              <div className="md:col-span-2 p-3 bg-amber-50/60 border border-amber-200 rounded-lg text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <ShieldCheck className="w-4 h-4 text-amber-700" />
                  <span>Fixing "Unexpected token '&lt;', &lt;!DOCTYPE... is not valid JSON"</span>
                </div>
                <p className="text-stone-700 leading-relaxed text-[11px]">
                  If sync returns an HTML or login error, Google is blocking the request because the Web App is not publicly accessible. Fix this in 30 seconds:
                </p>
                <ol className="list-decimal list-inside text-stone-600 space-y-0.5 text-[11px]">
                  <li>In Google Sheets, open <b>Extensions &gt; Apps Script</b>.</li>
                  <li>Click <b>Deploy &gt; Manage deployments</b> &gt; click the <b>pencil (Edit)</b> icon.</li>
                  <li>Set <b>"Who has access"</b> to <b>"Anyone"</b> and <b>"Execute as"</b> to <b>"Me"</b>.</li>
                  <li>Under <b>Version</b>, select <b>"New version"</b>, then click <b>Deploy</b>.</li>
                  <li>Click <b>"Browser Check"</b> above: it should display a clean JSON status message.</li>
                </ol>
              </div>

              {/* Google Sheet URL */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-800 flex items-center justify-between">
                  <span>Google Spreadsheet Direct URL</span>
                  <span className="text-[11px] font-normal text-stone-500">Master Ledger</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={configForm.googleSheetUrl}
                    onChange={(e) => updateConfigField('googleSheetUrl', e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                    className="flex-1 px-3 py-2 text-xs border border-stone-300 rounded-md focus:ring-1 focus:ring-amber-500 focus:border-amber-500 font-mono"
                  />
                  {configForm.googleSheetUrl && (
                    <a
                      href={configForm.googleSheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-md shrink-0"
                      title="Open Google Sheet"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
                <p className="text-[11px] text-stone-500">
                  Direct URL to your Google Sheet master spreadsheet.
                </p>
              </div>

              {/* Google Drive Folder URL */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-800 flex items-center justify-between">
                  <span>Google Drive Folder Direct URL</span>
                  <span className="text-[11px] font-normal text-stone-500">PDF Storage</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={configForm.googleDriveFolderUrl}
                    onChange={(e) => updateConfigField('googleDriveFolderUrl', e.target.value)}
                    placeholder="https://drive.google.com/drive/folders/..."
                    className="flex-1 px-3 py-2 text-xs border border-stone-300 rounded-md focus:ring-1 focus:ring-amber-500 focus:border-amber-500 font-mono"
                  />
                  {configForm.googleDriveFolderUrl && (
                    <a
                      href={configForm.googleDriveFolderUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 rounded-md shrink-0"
                      title="Open Drive Folder"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
                <p className="text-[11px] text-stone-500">
                  Direct URL to the Google Drive folder where generated invoice PDFs are stored.
                </p>
              </div>

              {/* Google Drive Folder Name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-800">
                  Google Drive Folder Name
                </label>
                <input
                  type="text"
                  value={configForm.googleDriveFolder}
                  onChange={(e) => updateConfigField('googleDriveFolder', e.target.value)}
                  placeholder="Hotel Damview Archives"
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-md focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                />
                <p className="text-[11px] text-stone-500">
                  Auto-created in your root Google Drive if not specified.
                </p>
              </div>

              {/* Google Sheet Embed URL */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-800">
                  Google Sheet Embed / Published URL (Optional)
                </label>
                <input
                  type="url"
                  value={configForm.googleSheetEmbedUrl}
                  onChange={(e) => updateConfigField('googleSheetEmbedUrl', e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/.../pubhtml"
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-md focus:ring-1 focus:ring-amber-500 focus:border-amber-500 font-mono"
                />
                <p className="text-[11px] text-stone-500">
                  Used if you want an interactive embedded iframe in the Live Sheets tab.
                </p>
              </div>
            </div>

            {/* Google Drive PDF Archiving Live Test Card */}
            <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-lg space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-xs text-blue-950 flex items-center gap-1.5">
                    <UploadCloud className="w-4 h-4 text-blue-700" />
                    Google Drive PDF Cloud Archiving Live Test
                  </h4>
                  <p className="text-[11px] text-blue-800/80">
                    Verify that your Google Apps Script webhook can successfully receive Base64 PDF byte streams and store them in your Google Drive archives.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleUploadTestPdf}
                  disabled={isUploadingTestPdf || !configForm.googleWebAppUrl}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors disabled:opacity-50 shrink-0"
                >
                  <UploadCloud className={`w-3.5 h-3.5 ${isUploadingTestPdf ? 'animate-bounce' : ''}`} />
                  {isUploadingTestPdf ? 'Uploading Test PDF...' : 'Upload Test PDF to Google Drive'}
                </button>
              </div>

              {/* Test PDF Upload Status / Result */}
              {testPdfResult && (
                <div
                  className={`p-3 rounded-md text-xs border ${
                    testPdfResult.success
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                      : 'bg-rose-50 text-rose-900 border-rose-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      {testPdfResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-1">
                        <p className="font-semibold">
                          {testPdfResult.success
                            ? `Test PDF successfully archived to Google Drive folder "${testPdfResult.folderName || 'Hotel Damview Archives'}"!`
                            : testPdfResult.error || 'Failed to upload test PDF to Google Drive.'}
                        </p>
                        {testPdfResult.fileName && (
                          <div className="text-[11px] text-stone-600 font-mono flex flex-wrap gap-x-3">
                            <span>File: {testPdfResult.fileName}</span>
                            {testPdfResult.byteLength && (
                              <span>Size: {(testPdfResult.byteLength / 1024).toFixed(1)} KB</span>
                            )}
                            {testPdfResult.timestamp && (
                              <span>Time: {testPdfResult.timestamp}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {testPdfResult.driveUrl && (
                      <a
                        href={testPdfResult.driveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-[11px] flex items-center gap-1.5 shrink-0 transition-colors shadow-xs"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Open in Google Drive
                        <ExternalLink className="w-3 h-3 opacity-80" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Auto-Sync Toggle */}
            <div className="p-3 bg-stone-50 border border-stone-200 rounded-md flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-stone-800">Background Auto-Sync</p>
                <p className="text-[11px] text-stone-500">
                  Periodically poll Google Sheets and push local queues in the background every 30 seconds when online.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={configForm.autoSyncEnabled}
                  onChange={(e) => updateConfigField('autoSyncEnabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-stone-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            {/* Save Button & Dirty Warning */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-stone-200">
              <div className="flex items-center gap-2 text-xs">
                {isFormDirty ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-300 rounded-full font-semibold text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    Unsaved changes in form
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-full font-semibold text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Credentials saved and synced
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isFormDirty && (
                  <button
                    type="button"
                    onClick={() => {
                      if (profile) {
                        setConfigForm({
                          googleWebAppUrl: profile.googleWebAppUrl || '',
                          googleSheetUrl: profile.googleSheetUrl || '',
                          googleDriveFolderUrl: profile.googleDriveFolderUrl || '',
                          googleDriveFolder: profile.googleDriveFolder || 'Hotel Damview Archives',
                          googleSheetEmbedUrl: profile.googleSheetEmbedUrl || '',
                          autoSyncEnabled: profile.autoSyncEnabled !== false,
                        });
                        isFormDirtyRef.current = false;
                        setIsFormDirty(false);
                      }
                    }}
                    className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded text-xs transition-colors"
                  >
                    Discard Changes
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded text-xs shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Webhook &amp; Credentials</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* APPS SCRIPT CODE TAB */}
        {activeTab === 'Script' && (
          <div className="bg-white border border-stone-200 rounded-lg shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-stone-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <Code className="w-4 h-4 text-amber-600" />
                  Google Apps Script Backend Companion (Code.gs v3.0 ERP Engine)
                </h3>
                <p className="text-xs text-stone-500">
                  Deploy this upgraded script in your Google Spreadsheet to power all 11 ERP tabs, KPI formulas, line items breakdown, statement ledger, and atomic cascade deletions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
                  setCopiedScript(true);
                  setTimeout(() => setCopiedScript(false), 3000);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 text-amber-400 hover:bg-stone-800 rounded text-xs font-semibold transition-colors"
              >
                {copiedScript ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied Code.gs v3.0!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Code.gs</span>
                  </>
                )}
              </button>
            </div>

            {/* Feature Highlights of v3.0 Apps Script */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-lg space-y-1">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-700" />
                  11 Dynamic ERP Sheets
                </span>
                <p className="text-[11px] text-amber-800 leading-snug">
                  Summary Dashboard, Invoices, Quotations, Proformas, Clients, Receipts, Statements Ledger, Monthly Analytics, Line Items Breakdown, Hotel Profile, &amp; Audit Log.
                </p>
              </div>

              <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-lg space-y-1">
                <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                  Live Spreadsheet Formulas
                </span>
                <p className="text-[11px] text-emerald-800 leading-snug">
                  Automated `=SUMIF()`, `=COUNTIF()`, and revenue aggregation KPI cards updated in real-time.
                </p>
              </div>

              <div className="p-3 bg-blue-50/60 border border-blue-200/80 rounded-lg space-y-1">
                <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5 text-blue-700" />
                  Cascade Deletions &amp; Reconcile
                </span>
                <p className="text-[11px] text-blue-800 leading-snug">
                  Deleting an invoice or payment automatically cleans line items, receipts, and trashing linked Google Drive PDFs.
                </p>
              </div>
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-lg p-4 text-xs space-y-2">
              <p className="font-semibold text-stone-800">Deployment / Upgrade Instructions (2 minutes):</p>
              <ol className="list-decimal list-inside space-y-1.5 text-stone-600">
                <li>Open your Google Sheet (e.g. <b>"Hotel Damview ERP"</b>).</li>
                <li>In Google Sheets, click <b>Extensions &gt; Apps Script</b>.</li>
                <li>Select all text in <code>Code.gs</code>, delete it, and paste the copied code below.</li>
                <li>Click the floppy disk <b>Save</b> icon (Ctrl+S or Cmd+S).</li>
                <li>Click <b>Deploy &gt; Manage deployments</b> (or <b>New deployment</b>) &gt; Edit &gt; choose <b>New version</b> &gt; Click <b>Deploy</b>.</li>
                <li>Ensure access is set to: <b>Execute as: Me</b> and <b>Who has access: Anyone</b> (Zero-Auth background sync).</li>
                <li>Click <b>"Generate 11 Tabs"</b> in the top toolbar to automatically structure and populate all 11 sheets!</li>
              </ol>
            </div>

            <pre className="bg-stone-900 text-stone-100 p-4 rounded-md text-[11px] font-mono overflow-x-auto max-h-96">
              {GOOGLE_APPS_SCRIPT_CODE}
            </pre>
          </div>
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
