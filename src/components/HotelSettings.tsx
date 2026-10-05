import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Building2,
  CreditCard,
  Percent,
  Cloud,
  CheckCircle2,
  Copy,
  ExternalLink,
  Save,
  Upload,
  RefreshCw,
  AlertTriangle,
  FileCode,
  Smartphone,
  ShieldCheck,
  HardDrive,
  Wifi,
  Download,
  FileSpreadsheet,
  FolderOpen,
  Link,
  FolderCheck,
  FileCheck,
  Database,
  History,
  Lock,
  Unlock,
  KeyRound,
  ShieldAlert,
  UploadCloud,
  DownloadCloud,
  FileText,
  ListPlus,
  Plus,
  Edit2,
  Trash2,
  X,
  Eye,
  EyeOff,
  Sparkles,
  Globe,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { HotelProfile, SyncQueueItem, CatalogueItem } from '../types';
import { getHotelArchiveFolderName } from '../services/localBackupService';
import {
  normalizeKenyanPhone,
  sanitizeKenyanPhoneLive,
  validateKenyanPhone,
} from '../utils/formatters';
import { syncManager } from '../services/sync';
import { dbService, DEFAULT_HOTEL_PROFILE } from '../services/db';
import {
  localBackupService,
  LocalBackupRecord,
  DEFAULT_DESIGNATED_ARCHIVE_PATH,
} from '../services/localBackupService';
import { GOOGLE_APPS_SCRIPT_CODE, GOOGLE_APPS_SCRIPT_VERSION } from '../services/googleScriptCode';
import { HotelLogo } from './HotelLogo';
import { usePWA } from '../hooks/usePWA';
import { CURRENT_APP_VERSION, CURRENT_BUILD_TIME } from '../services/pwaService';
import { appNotificationService } from '../services/appNotificationService';

interface HotelSettingsProps {
  profile: HotelProfile;
  syncQueue: SyncQueueItem[];
  onSaveProfile: (profile: HotelProfile) => void;
  onTriggerSync: () => void;
}

export const HotelSettings: React.FC<HotelSettingsProps> = ({
  profile,
  syncQueue,
  onSaveProfile,
  onTriggerSync,
}) => {
  // Ref to track if user has active unsaved typing/edits to permanently prevent background syncs from clearing inputs
  const isDirtyRef = useRef(false);
  const autoSaveTimerRef = useRef<any>(null);

  const [formData, setFormData] = useState<HotelProfile>(() => {
    let initial = { ...profile };
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const draft = localStorage.getItem('damview_settings_draft');
        if (draft) {
          const parsed = JSON.parse(draft);
          initial = { ...initial, ...parsed };
          isDirtyRef.current = true;
        }
      } catch {}
    }
    return initial;
  });
  const [activeTab, setActiveTabState] = useState<'profile' | 'accounts' | 'google-sync' | 'local-backup' | 'pwa' | 'catalogue'>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('damview_settings_active_tab') as any;
      if (saved && ['profile', 'accounts', 'google-sync', 'local-backup', 'pwa', 'catalogue'].includes(saved)) {
        return saved;
      }
    }
    return 'profile';
  });

  const tabListRef = useRef<HTMLDivElement>(null);
  const activeTabBtnRef = useRef<HTMLButtonElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScrollState = () => {
    if (!tabListRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = tabListRef.current;
    setCanScrollLeft(scrollLeft > 6);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 6);
  };

  useEffect(() => {
    checkScrollState();
    const el = tabListRef.current;
    if (el) {
      el.addEventListener('scroll', checkScrollState, { passive: true });
      window.addEventListener('resize', checkScrollState);
    }
    return () => {
      if (el) el.removeEventListener('scroll', checkScrollState);
      window.removeEventListener('resize', checkScrollState);
    };
  }, []);

  // Auto-scroll active tab into view when activeTab changes
  useEffect(() => {
    if (activeTabBtnRef.current) {
      activeTabBtnRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
    const timer = setTimeout(checkScrollState, 150);
    return () => clearTimeout(timer);
  }, [activeTab]);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (!tabListRef.current) return;
    const offset = direction === 'left' ? -220 : 220;
    tabListRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  const setActiveTab = (tab: 'profile' | 'accounts' | 'google-sync' | 'local-backup' | 'pwa' | 'catalogue') => {
    setActiveTabState(tab);
    try {
      localStorage.setItem('damview_settings_active_tab', tab);
    } catch {}
  };
  const {
    isCheckingUpdate,
    needRefresh,
    offlineReady,
    isInstalled,
    checkForUpdate,
    checkRemoteVersionJson,
    applyUpdate,
    forceClearCacheAndReload,
    lastChecked,
    remoteBuildTime,
  } = usePWA();
  const [isForceReloading, setIsForceReloading] = useState(false);
  const [updateCheckMsg, setUpdateCheckMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleManualUpdateCheck = async () => {
    setUpdateCheckMsg('Checking GitHub deployment & Service Worker...');
    const hasSwUpdate = await checkForUpdate();
    const hasRemoteUpdate = await checkRemoteVersionJson();
    if (hasSwUpdate || hasRemoteUpdate) {
      setUpdateCheckMsg('New version detected! Click Reload to apply latest changes.');
    } else {
      setUpdateCheckMsg('You are running the latest version of Hotel Damview.');
      setTimeout(() => setUpdateCheckMsg(null), 4000);
    }
  };

  // Particulars Catalogue State
  const [catalogueItems, setCatalogueItems] = useState<CatalogueItem[]>([]);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCatItem, setEditingCatItem] = useState<CatalogueItem | null>(null);
  const [catParticulars, setCatParticulars] = useState('');
  const [catCategory, setCatCategory] = useState<'Accommodation' | 'Conference & Banqueting' | 'Food & Beverage' | 'Equipment & Services'>('Conference & Banqueting');
  const [catStandardRate, setCatStandardRate] = useState<number>(2500);
  const [catTaxable, setCatTaxable] = useState(true);

  const loadCatalogue = async () => {
    const items = await dbService.getCatalogueItems();
    setCatalogueItems(items);
  };

  useEffect(() => {
    loadCatalogue();
  }, []);

  // Cleanup auto-save timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Safe Profile Sync Protection:
  // Never overwrite user inputs if user is currently typing, interacting, or has an uncommitted draft!
  useEffect(() => {
    if (isDirtyRef.current) return;
    try {
      if (typeof window !== 'undefined' && localStorage.getItem('damview_settings_draft')) {
        return;
      }
    } catch {}
    setFormData({ ...profile });
  }, [profile]);

  // Real-time listener for profile credentials propagated from Google Sheets
  useEffect(() => {
    const handleRemoteProfileUpdate = (e: any) => {
      const updates = e.detail;
      if (updates && typeof updates === 'object') {
        setFormData((prev) => ({
          ...prev,
          ...updates,
        }));
        isDirtyRef.current = false;
        try {
          localStorage.removeItem('damview_settings_draft');
        } catch {}
      }
    };

    window.addEventListener('damview:profile-updated', handleRemoteProfileUpdate);
    return () => {
      window.removeEventListener('damview:profile-updated', handleRemoteProfileUpdate);
    };
  }, []);

  const handleOpenNewCatItem = () => {
    setEditingCatItem(null);
    setCatParticulars('');
    setCatCategory('Conference & Banqueting');
    setCatStandardRate(2800);
    setCatTaxable(true);
    setIsCatModalOpen(true);
  };

  const handleOpenEditCatItem = (item: CatalogueItem) => {
    setEditingCatItem(item);
    setCatParticulars(item.particulars || '');
    setCatCategory(item.category || 'Conference & Banqueting');
    setCatStandardRate(item.standardRate || 0);
    setCatTaxable(item.taxable !== false);
    setIsCatModalOpen(true);
  };

  const handleSaveCatItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catParticulars.trim() || catStandardRate <= 0) return;

    const newItem: CatalogueItem = {
      id: editingCatItem ? editingCatItem.id : 'cat-' + Date.now(),
      particulars: catParticulars.trim(),
      category: catCategory,
      standardRate: catStandardRate,
      taxable: catTaxable,
      defaultUnit: 'Person/Day',
    };

    await dbService.saveCatalogueItem(newItem);
    await loadCatalogue();
    setIsCatModalOpen(false);
  };

  const handleDeleteCatItem = async (id: string) => {
    if (!window.confirm('Are you sure you want to permanently remove this service preset from the catalog?')) return;
    await dbService.deleteCatalogueItem(id);
    await loadCatalogue();
  };

  const handlePurgeCatalogue = async () => {
    if (!window.confirm('Purge all particulars presets and start with a completely empty catalog?')) return;
    await dbService.purgeAllCatalogueItems();
    await loadCatalogue();
  };

  const handlePurgeAllDemoData = async () => {
    if (!window.confirm('Are you sure you want to purge all demo / mock records across ALL operational modules (Catalogue, POS Menu, Demo Documents, Demo Payments)? Your official hotel profile & credentials will remain preserved.')) return;
    const res = await dbService.purgeAllDemoDataAcrossModules();
    await loadCatalogue();
    alert(`All demo data purged successfully across: ${res.purgedModules.join(', ')}.`);
  };
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
    sheetUrl?: string;
    sheetName?: string;
    tabs?: any[];
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isUploadingTestPdf, setIsUploadingTestPdf] = useState(false);
  const [testPdfResult, setTestPdfResult] = useState<{
    ok?: boolean;
    message?: string;
    driveUrl?: string;
    driveFileId?: string;
    fileName?: string;
    byteLength?: number;
    folderName?: string;
  } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [logoSaveFeedback, setLogoSaveFeedback] = useState<string | null>(null);

  // Local Machine Filesystem Backup States
  const [localTargetPath, setLocalTargetPath] = useState<string>(localBackupService.getTargetDirectoryPath(profile?.name));
  const [savedDirectoryHandle, setSavedDirectoryHandle] = useState<any>(null);
  const [connectedDirName, setConnectedDirName] = useState<string | null>(null);
  const [isPickingDirectory, setIsPickingDirectory] = useState(false);
  const [isTestingLocalWrite, setIsTestingLocalWrite] = useState(false);
  const [localWriteResult, setLocalWriteResult] = useState<{ ok: boolean; message: string; method?: string } | null>(null);
  const [backupHistory, setBackupHistory] = useState<LocalBackupRecord[]>([]);
  const [isExportingJson, setIsExportingJson] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const [pathSaveNotification, setPathSaveNotification] = useState(false);

  const [showSensitiveAccounts, setShowSensitiveAccounts] = useState(false);
  const [showSensitiveKra, setShowSensitiveKra] = useState(false);
  const [showSensitiveWebhookUrls, setShowSensitiveWebhookUrls] = useState(false);

  // Google Sheets credentials sync state
  const [isPushingCredentials, setIsPushingCredentials] = useState(false);
  const [isPullingCredentials, setIsPullingCredentials] = useState(false);
  const [cloudSyncFeedback, setCloudSyncFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  useEffect(() => {
    localBackupService.getStoredDirectoryHandle().then((handle) => {
      if (handle) {
        setSavedDirectoryHandle(handle);
        setConnectedDirName(handle.name || 'Local Archives');
      }
    });
    setBackupHistory(localBackupService.getBackupHistory());
  }, []);

  const handlePickDirectory = async () => {
    setIsPickingDirectory(true);
    setLocalWriteResult(null);
    try {
      const res = await localBackupService.pickArchiveDirectory(formData.name);
      if (res.success && res.directoryName) {
        setConnectedDirName(res.directoryName);
        const handle = await localBackupService.getStoredDirectoryHandle();
        setSavedDirectoryHandle(handle);
        setLocalWriteResult({
          ok: true,
          message: `Direct local directory connected successfully: "${res.directoryName}". New generated PDFs will automatically save here.`,
        });
        setBackupHistory(localBackupService.getBackupHistory());
      } else {
        setLocalWriteResult({
          ok: false,
          message: res.error || 'Failed to connect directory.',
        });
      }
    } catch (err: any) {
      setLocalWriteResult({
        ok: false,
        message: err.message || 'Error opening directory picker.',
      });
    } finally {
      setIsPickingDirectory(false);
    }
  };

  const handleTestLocalWrite = async () => {
    setIsTestingLocalWrite(true);
    setLocalWriteResult(null);
    try {
      const testContent = `Hotel Damview Archive Storage Verification\nDate: ${new Date().toISOString()}\nTarget: ${localTargetPath}\nVerified by system check.`;
      const testBlob = new Blob([testContent], { type: 'text/plain;charset=utf-8' });
      const testFileName = `damview_archive_test_${Date.now()}.txt`;
      const res = await localBackupService.savePdfToLocalArchive(testBlob, testFileName);

      if (res.success) {
        setLocalWriteResult({
          ok: true,
          method: res.method,
          message:
            res.method === 'FILE_SYSTEM_ACCESS_API'
              ? `Write test verified successfully! Test file "${testFileName}" was saved directly to your local archives folder via native File System Access API.`
              : `Write test passed using download fallback. Test file "${testFileName}" was dispatched to your downloads/browser destination.`,
        });
        setBackupHistory(localBackupService.getBackupHistory());
      } else {
        setLocalWriteResult({
          ok: false,
          message: res.error || 'Write test failed.',
        });
      }
    } catch (err: any) {
      setLocalWriteResult({
        ok: false,
        message: err.message || 'Error testing write access.',
      });
    } finally {
      setIsTestingLocalWrite(false);
    }
  };

  const handleClearConnectedDirectory = async () => {
    await localBackupService.clearStoredDirectory();
    setSavedDirectoryHandle(null);
    setConnectedDirName(null);
    setLocalWriteResult({
      ok: true,
      message: 'Local directory disconnected. The system will use the browser download fallback for local archives.',
    });
  };

  const handleCopyTargetDirectoryPath = () => {
    navigator.clipboard.writeText(localTargetPath);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 3000);
  };

  const handleSaveCustomTargetPath = () => {
    localBackupService.setTargetDirectoryPath(localTargetPath);
    setPathSaveNotification(true);
    setTimeout(() => setPathSaveNotification(false), 3000);
  };

  const handleExportFullSystemJson = async () => {
    setIsExportingJson(true);
    try {
      const [docs, clients, payments, hotelProf] = await Promise.all([
        dbService.getDocuments(),
        dbService.getClients(),
        dbService.getPayments(),
        dbService.getHotelProfile(),
      ]);

      const backupPayload = {
        app: 'Hotel Damview ERP & Invoicing',
        version: '2.0.0',
        exportedAt: new Date().toISOString(),
        hotelProfile: hotelProf,
        documents: docs,
        clients: clients,
        payments: payments,
        backupMetadata: {
          totalDocuments: docs.length,
          totalClients: clients.length,
          totalPayments: payments.length,
          designatedPath: localTargetPath,
        },
      };

      const jsonString = JSON.stringify(backupPayload, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const fileName = `HotelDamview_FullDatabase_Backup_${new Date().toISOString().split('T')[0]}.json`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (err: any) {
      alert('Failed to export full system backup: ' + err.message);
    } finally {
      setIsExportingJson(false);
    }
  };

  const handleInputChange = (field: keyof HotelProfile, value: any) => {
    isDirtyRef.current = true;
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      try {
        localStorage.setItem('damview_settings_draft', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // Auto-save changes with a debounce to ensure credentials & settings are permanently retained
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      setFormData((current) => {
        onSaveProfile(current);
        return current;
      });
    }, 1500);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('File is too large. Please select an image under 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        if (base64) {
          // 1. Update form data
          setFormData((prev) => ({ ...prev, logoBase64: base64 }));
          // 2. Persist directly to dedicated localStorage key so it's NEVER lost across any app/refresh
          try {
            localStorage.setItem('damview_company_logo', base64);
            const draft = localStorage.getItem('damview_settings_draft');
            const parsedDraft = draft ? JSON.parse(draft) : {};
            localStorage.setItem('damview_settings_draft', JSON.stringify({ ...parsedDraft, logoBase64: base64 }));
          } catch {}
          // 3. Immediately persist profile across all apps without requiring form submission
          const updatedProfile = { ...formData, logoBase64: base64 };
          onSaveProfile(updatedProfile);
          // 4. Dispatch custom event for real-time multi-tab and app-wide update
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('damview:logo-changed', { detail: { logoBase64: base64 } })
            );
          }
          setLogoSaveFeedback('Company logo updated and persisted across all applications & documents!');
          setTimeout(() => setLogoSaveFeedback(null), 4000);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResetLogo = () => {
    setFormData((prev) => ({ ...prev, logoBase64: '' }));
    try {
      localStorage.removeItem('damview_company_logo');
      const draft = localStorage.getItem('damview_settings_draft');
      if (draft) {
        const parsedDraft = JSON.parse(draft);
        parsedDraft.logoBase64 = '';
        localStorage.setItem('damview_settings_draft', JSON.stringify(parsedDraft));
      }
    } catch {}
    const updatedProfile = { ...formData, logoBase64: '' };
    onSaveProfile(updatedProfile);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('damview:logo-changed', { detail: { logoBase64: '' } })
      );
    }
    setLogoSaveFeedback('Reset to default crest logo throughout all apps.');
    setTimeout(() => setLogoSaveFeedback(null), 3500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    try {
      localStorage.removeItem('damview_settings_draft');
    } catch {}
    isDirtyRef.current = false;

    const normalizedData: HotelProfile = {
      ...formData,
      phone: normalizeKenyanPhone(formData.phone),
    };
    setFormData(normalizedData);
    onSaveProfile(normalizedData);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleRestoreBakedDefaults = () => {
    if (window.confirm('Reset all hotel profile, tax, banking, and Google Cloud credentials to blank defaults? This will clear all fields to protect privacy.')) {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      try {
        localStorage.removeItem('damview_settings_draft');
        localStorage.removeItem('damview_company_logo');
      } catch {}
      isDirtyRef.current = false;
      const restored = { ...DEFAULT_HOTEL_PROFILE };
      setFormData(restored);
      onSaveProfile(restored);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setCopiedCode(true);
    const lineCount = GOOGLE_APPS_SCRIPT_CODE.split('\n').length;
    appNotificationService.notifyAppsScript(
      `Apps Script Code Copied (${lineCount} lines)`,
      `Google Apps Script backend (${GOOGLE_APPS_SCRIPT_VERSION}, ${lineCount} lines, ${(GOOGLE_APPS_SCRIPT_CODE.length / 1024).toFixed(1)} KB) copied to clipboard. Ready to deploy to Google Sheets.`,
      { version: GOOGLE_APPS_SCRIPT_VERSION, lines: lineCount, characters: GOOGLE_APPS_SCRIPT_CODE.length }
    );
    setTimeout(() => setCopiedCode(false), 3000);
  };

  const handleDownloadCodeGs = () => {
    const blob = new Blob([GOOGLE_APPS_SCRIPT_CODE], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HotelDamview_Code_gs_${GOOGLE_APPS_SCRIPT_VERSION}.gs`;
    document.body.appendChild(a);
    a.click();
    const lineCount = GOOGLE_APPS_SCRIPT_CODE.split('\n').length;
    appNotificationService.notifyAppsScript(
      `Apps Script File Downloaded (${GOOGLE_APPS_SCRIPT_VERSION})`,
      `Downloaded canonical file HotelDamview_Code_gs_${GOOGLE_APPS_SCRIPT_VERSION}.gs (${lineCount} lines).`,
      { version: GOOGLE_APPS_SCRIPT_VERSION, lines: lineCount, fileName: `HotelDamview_Code_gs_${GOOGLE_APPS_SCRIPT_VERSION}.gs` }
    );
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  };

  const handlePushCredentialsToSheets = async () => {
    let targetUrl = formData.googleWebAppUrl ? formData.googleWebAppUrl.trim() : '';
    if (!targetUrl) {
      setCloudSyncFeedback({ type: 'error', message: 'Please configure a Google Apps Script Web App URL first.' });
      return;
    }
    setIsPushingCredentials(true);
    setCloudSyncFeedback(null);
    try {
      const normalizedData: HotelProfile = {
        ...formData,
        phone: normalizeKenyanPhone(formData.phone),
      };
      onSaveProfile(normalizedData);
      const res = await syncManager.pushHotelProfile(normalizedData);
      if (res.success) {
        setCloudSyncFeedback({
          type: 'success',
          message: 'Hotel settings & credentials successfully saved and synchronized to Google Sheets master ledger (Hotel_Profile).',
        });
        appNotificationService.notifySync(
          'Settings Saved to Google Sheets',
          'Hotel settings & credentials updated in Google Sheets.',
          'SUCCESS'
        );
        setTimeout(() => setCloudSyncFeedback(null), 6000);
      } else {
        setCloudSyncFeedback({
          type: 'error',
          message: res.error || 'Failed to sync hotel profile to Google Sheets.',
        });
      }
    } catch (err: any) {
      setCloudSyncFeedback({ type: 'error', message: err.message || 'Error pushing settings to Google Sheets.' });
    } finally {
      setIsPushingCredentials(false);
    }
  };

  const handlePullCredentialsFromSheets = async (urlOverride?: string) => {
    let targetUrl = (urlOverride || formData.googleWebAppUrl || '').trim();
    if (!targetUrl) {
      setCloudSyncFeedback({ type: 'error', message: 'Please configure a Google Apps Script Web App URL first.' });
      return;
    }
    setIsPullingCredentials(true);
    setCloudSyncFeedback(null);
    try {
      const res = await syncManager.pullHotelProfile(targetUrl);
      if (res.success && res.profile) {
        const pulled = res.profile;
        setFormData((prev) => ({
          ...prev,
          ...pulled,
        }));
        isDirtyRef.current = false;
        try {
          localStorage.removeItem('damview_settings_draft');
        } catch {}
        setCloudSyncFeedback({
          type: 'success',
          message: `Hotel settings module successfully populated from Google Sheets (${pulled.name || 'Saved Credentials'}).`,
        });
        appNotificationService.notifySync(
          'Settings Populated from Google Sheets',
          `Loaded credentials & identity from Google Sheets.`,
          'SUCCESS'
        );
        setTimeout(() => setCloudSyncFeedback(null), 6000);
      } else {
        setCloudSyncFeedback({
          type: 'error',
          message: res.error || 'No saved profile found in Google Sheets or unable to pull credentials.',
        });
      }
    } catch (err: any) {
      setCloudSyncFeedback({ type: 'error', message: err.message || 'Error pulling settings from Google Sheets.' });
    } finally {
      setIsPullingCredentials(false);
    }
  };

  const handleTestConnection = async () => {
    let targetUrl = formData.googleWebAppUrl ? formData.googleWebAppUrl.trim() : '';
    if (!targetUrl) {
      setTestResult({ ok: false, message: 'Please enter a Google Apps Script Web App URL first.' });
      return;
    }

    // Auto-patch /dev URLs to /exec
    if (targetUrl.includes('/dev')) {
      targetUrl = targetUrl.replace(/\/dev(\/|\?|$)/, '/exec$1');
      handleInputChange('googleWebAppUrl', targetUrl);
    }

    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await syncManager.testConnection(targetUrl);
      setTestResult(res);
      if (res.ok) {
        // If Google Sheets returns profile credentials, populate the Hotel Settings module immediately
        if (res.profile && typeof res.profile === 'object' && Object.keys(res.profile).length > 0) {
          setFormData((prev) => ({
            ...prev,
            ...res.profile,
          }));
          isDirtyRef.current = false;
          try {
            localStorage.removeItem('damview_settings_draft');
          } catch {}
          setCloudSyncFeedback({
            type: 'success',
            message: 'Connected to Google Sheets & populated Hotel Settings credentials automatically!',
          });
        }

        const versionMatch = res.message.match(/v\d+\.\d+(\.\d+)?/);
        const detectedVer = versionMatch ? versionMatch[0] : null;

        if (detectedVer && detectedVer !== GOOGLE_APPS_SCRIPT_VERSION) {
          window.dispatchEvent(
            new CustomEvent('damview:gas-version-mismatch', {
              detail: {
                message: `Google Apps Script update available: Deployed ${detectedVer} → Latest ${GOOGLE_APPS_SCRIPT_VERSION}. Click Copy Code.gs below to update.`,
                deployedVersion: detectedVer,
                latestVersion: GOOGLE_APPS_SCRIPT_VERSION,
              },
            })
          );
        }

        appNotificationService.notifyAppsScript(
          'Google Apps Script Connected',
          `Successfully verified endpoint connection (${detectedVer || GOOGLE_APPS_SCRIPT_VERSION}). Google Spreadsheet: ${res.sheetName || 'Hotel ERP'}.`,
          { version: detectedVer || GOOGLE_APPS_SCRIPT_VERSION, sheetName: res.sheetName, url: targetUrl }
        );
      } else {
        appNotificationService.notify({
          category: 'APPS_SCRIPT',
          severity: 'WARNING',
          title: 'Google Apps Script Connection Failed',
          message: res.message || 'Unable to connect to Google Apps Script endpoint.',
          details: { url: targetUrl, error: res.message },
        });
      }
      if (res.ok && res.sheetUrl && !formData.googleSheetUrl) {
        handleInputChange('googleSheetUrl', res.sheetUrl);
      }
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message || 'Connection test failed.' });
      appNotificationService.notify({
        category: 'APPS_SCRIPT',
        severity: 'ERROR',
        title: 'Connection Test Error',
        message: err.message || 'Error occurred while contacting Google Apps Script.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleUploadTestPdf = async () => {
    if (!formData.googleWebAppUrl) {
      setTestPdfResult({ ok: false, message: 'Please configure and save a Google Apps Script Web App URL first.' });
      return;
    }
    setIsUploadingTestPdf(true);
    setTestPdfResult(null);
    try {
      const res = await syncManager.uploadTestPdfToDrive({
        folderName: formData.googleDriveFolder || (formData.name ? `${formData.name} Archives` : 'Archives'),
      });

      if (res.success) {
        setTestPdfResult({
          ok: true,
          message: `Test PDF successfully generated and uploaded to Google Drive folder "${res.folderName || (formData.name ? `${formData.name} Archives` : 'Archives')}"!`,
          driveUrl: res.driveUrl,
          driveFileId: res.driveFileId,
          fileName: res.fileName,
          byteLength: res.byteLength,
          folderName: res.folderName,
        });
        appNotificationService.notifySync(
          'Test PDF Uploaded to Drive',
          `Archived test PDF to Google Drive (${res.byteLength} bytes). Deduplication and public view link verified.`,
          'SUCCESS',
          { driveUrl: res.driveUrl, fileName: res.fileName }
        );
      } else {
        setTestPdfResult({
          ok: false,
          message: res.error || 'Failed to upload test PDF to Google Drive.',
        });
        appNotificationService.notifySync(
          'Test PDF Upload Failed',
          res.error || 'Failed to upload test PDF to Google Drive.',
          'ERROR'
        );
      }
    } catch (err: any) {
      setTestPdfResult({
        ok: false,
        message: err.message || 'Error occurred while uploading test PDF.',
      });
    } finally {
      setIsUploadingTestPdf(false);
    }
  };

  return (
    <div className="p-3 sm:p-5 md:p-6 w-full max-w-5xl mx-auto space-y-4 sm:space-y-6 min-w-0 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-amber-700 shrink-0" />
            <span>Hotel Profile &amp; Google Sync Configuration</span>
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 mt-0.5">
            Configure {formData.name || 'organization'} business credentials, KRA PIN, settlement accounts, and centralized Google Workspace webhook sync.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {formData.googleWebAppUrl && (
            <>
              <button
                type="button"
                onClick={() => handlePullCredentialsFromSheets()}
                disabled={isPullingCredentials}
                className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-bold text-xs rounded flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                title="Fetch credentials saved in Google Sheets and populate Hotel Settings module"
              >
                <DownloadCloud className={`w-3.5 h-3.5 ${isPullingCredentials ? 'animate-bounce' : 'text-blue-600'}`} />
                <span className="hidden sm:inline">{isPullingCredentials ? 'Populating...' : 'Populate from Google Sheets'}</span>
                <span className="sm:hidden">From Sheets</span>
              </button>

              <button
                type="button"
                onClick={handlePushCredentialsToSheets}
                disabled={isPushingCredentials}
                className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs rounded flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                title="Save & sync hotel profile credentials to Google Sheets master ledger"
              >
                <UploadCloud className={`w-3.5 h-3.5 ${isPushingCredentials ? 'animate-bounce' : 'text-emerald-600'}`} />
                <span className="hidden sm:inline">{isPushingCredentials ? 'Syncing...' : 'Save to Google Sheets'}</span>
                <span className="sm:hidden">To Sheets</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleRestoreBakedDefaults}
            className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Reset all credentials and settings to clean blank defaults"
          >
            <RefreshCw className="w-3.5 h-3.5 text-stone-600" />
            <span className="hidden sm:inline">Clear to Blank</span>
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saveSuccess ? 'Changes Saved & Published!' : 'Save & Publish Settings'}</span>
          </button>
        </div>
      </div>

      {/* Cloud Sync Feedback Banner */}
      {cloudSyncFeedback && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-2 shadow-2xs ${
            cloudSyncFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : cloudSyncFeedback.type === 'error'
              ? 'bg-rose-50 text-rose-900 border-rose-300'
              : 'bg-blue-50 text-blue-900 border-blue-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {cloudSyncFeedback.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {cloudSyncFeedback.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
            {cloudSyncFeedback.type === 'info' && <Cloud className="w-4 h-4 text-blue-600 shrink-0" />}
            <span className="font-medium">{cloudSyncFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setCloudSyncFeedback(null)}
            className="text-stone-400 hover:text-stone-600 text-xs font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Centralized Cloud Persistence Notice */}
      <div className="bg-amber-50/90 border border-amber-300 rounded-lg p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-200/80 rounded-full text-amber-900 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-amber-900" />
          </div>
          <div>
            <span className="font-bold text-sm block">Centralized Organization Configuration Active</span>
            <span className="text-amber-900/90 text-[11px]">
              All inputted credentials, settlement accounts, and branding are automatically saved locally and synchronized to Google Sheets for all connected apps.
            </span>
          </div>
        </div>
      </div>

      {/* Scrollable Tabs Navigation Names Block (Fits Viewport Length & Enables Horizontal Scrolling) */}
      <div className="relative border-b border-stone-200 bg-stone-100/70 p-1.5 rounded-lg shadow-2xs">
        {/* Left Scroll Navigation Button */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollTabs('left')}
            className="absolute left-1.5 top-1/2 -translate-y-1/2 z-20 p-1.5 bg-stone-900 text-amber-400 hover:bg-stone-800 rounded-md shadow-md transition-all cursor-pointer flex items-center justify-center border border-stone-700 shrink-0"
            title="Scroll tabs left"
            aria-label="Scroll tabs left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}

        {/* Horizontal Scrollable Tabs Names Row */}
        <div
          ref={tabListRef}
          className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scroll-smooth min-w-0 max-w-full flex-nowrap py-1 px-1"
          style={{ scrollbarWidth: 'thin' }}
        >
          {/* 1. Hotel Identity & KRA Details */}
          <button
            ref={activeTab === 'profile' ? activeTabBtnRef : undefined}
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`whitespace-nowrap shrink-0 px-3.5 py-2 font-bold rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer select-none border ${
              activeTab === 'profile'
                ? 'bg-white border-stone-300 text-stone-950 shadow-xs ring-1 ring-amber-500/30 border-b-2 border-b-amber-500'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/80 border-transparent'
            }`}
          >
            <Building2 className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'profile' ? 'text-amber-600' : 'text-stone-500'}`} />
            <span className="hidden sm:inline">Hotel Identity &amp; KRA Details</span>
            <span className="sm:hidden">Identity &amp; KRA</span>
          </button>

          {/* 2. Bank & Settlement Accounts */}
          <button
            ref={activeTab === 'accounts' ? activeTabBtnRef : undefined}
            type="button"
            onClick={() => setActiveTab('accounts')}
            className={`whitespace-nowrap shrink-0 px-3.5 py-2 font-bold rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer select-none border ${
              activeTab === 'accounts'
                ? 'bg-white border-stone-300 text-stone-950 shadow-xs ring-1 ring-amber-500/30 border-b-2 border-b-amber-500'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/80 border-transparent'
            }`}
          >
            <CreditCard className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'accounts' ? 'text-amber-600' : 'text-stone-500'}`} />
            <span className="hidden sm:inline">Bank &amp; Settlement Accounts</span>
            <span className="sm:hidden">Settlement Accounts</span>
          </button>

          {/* 3. Google Workspace Sync */}
          <button
            ref={activeTab === 'google-sync' ? activeTabBtnRef : undefined}
            type="button"
            onClick={() => setActiveTab('google-sync')}
            className={`whitespace-nowrap shrink-0 px-3.5 py-2 font-bold rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer select-none border ${
              activeTab === 'google-sync'
                ? 'bg-white border-stone-300 text-stone-950 shadow-xs ring-1 ring-amber-500/30 border-b-2 border-b-amber-500'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/80 border-transparent'
            }`}
          >
            <Cloud className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="hidden sm:inline">Google Workspace Sync (Zero-Auth)</span>
            <span className="sm:hidden">Google Sync</span>
            {syncQueue.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 text-[10px] font-mono font-bold">
                {syncQueue.length}
              </span>
            )}
          </button>

          {/* 4. Local Machine Backup & Archives */}
          <button
            ref={activeTab === 'local-backup' ? activeTabBtnRef : undefined}
            type="button"
            onClick={() => setActiveTab('local-backup')}
            className={`whitespace-nowrap shrink-0 px-3.5 py-2 font-bold rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer select-none border ${
              activeTab === 'local-backup'
                ? 'bg-white border-stone-300 text-stone-950 shadow-xs ring-1 ring-amber-500/30 border-b-2 border-b-amber-500'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/80 border-transparent'
            }`}
          >
            <FolderCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="hidden sm:inline">Local Machine Backup &amp; Archives</span>
            <span className="sm:hidden">Local Archives</span>
            {savedDirectoryHandle && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Direct local folder connected" />
            )}
          </button>

          {/* 5. Offline Storage & Cache */}
          <button
            ref={activeTab === 'pwa' ? activeTabBtnRef : undefined}
            type="button"
            onClick={() => setActiveTab('pwa')}
            className={`whitespace-nowrap shrink-0 px-3.5 py-2 font-bold rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer select-none border ${
              activeTab === 'pwa'
                ? 'bg-white border-stone-300 text-stone-950 shadow-xs ring-1 ring-amber-500/30 border-b-2 border-b-amber-500'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/80 border-transparent'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="hidden sm:inline">Offline Storage &amp; Cache</span>
            <span className="sm:hidden">Offline Cache</span>
            {needRefresh && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-stone-950 text-[10px] font-bold animate-pulse">
                Update
              </span>
            )}
          </button>

          {/* 6. Particulars & Service Catalog */}
          <button
            ref={activeTab === 'catalogue' ? activeTabBtnRef : undefined}
            type="button"
            onClick={() => setActiveTab('catalogue')}
            className={`whitespace-nowrap shrink-0 px-3.5 py-2 font-bold rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer select-none border ${
              activeTab === 'catalogue'
                ? 'bg-white border-stone-300 text-stone-950 shadow-xs ring-1 ring-amber-500/30 border-b-2 border-b-amber-500'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/80 border-transparent'
            }`}
          >
            <ListPlus className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <span className="hidden sm:inline">Particulars &amp; Service Catalog ({catalogueItems.length})</span>
            <span className="sm:hidden">Service Catalog ({catalogueItems.length})</span>
          </button>
        </div>

        {/* Right Scroll Navigation Button */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollTabs('right')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 z-20 p-1.5 bg-stone-900 text-amber-400 hover:bg-stone-800 rounded-md shadow-md transition-all cursor-pointer flex items-center justify-center border border-stone-700 shrink-0"
            title="Scroll tabs right"
            aria-label="Scroll tabs right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* TAB 1: HOTEL IDENTITY & KRA */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded-lg p-6 shadow-xs space-y-5 text-xs">
          {/* Quick Google Sheets Sync bar for credentials */}
          {formData.googleWebAppUrl && (
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="text-[11.5px] text-blue-950 font-medium">
                  Google Workspace connected. You can synchronize your hotel identity &amp; KRA credentials with Google Sheets.
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handlePullCredentialsFromSheets()}
                  disabled={isPullingCredentials}
                  className="px-2.5 py-1 bg-white hover:bg-blue-100 text-blue-800 border border-blue-300 font-bold text-[11px] rounded flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                  title="Populate Identity & KRA credentials from Google Sheets"
                >
                  <DownloadCloud className={`w-3.5 h-3.5 ${isPullingCredentials ? 'animate-bounce' : 'text-blue-600'}`} />
                  <span>{isPullingCredentials ? 'Populating...' : 'Populate from Sheets'}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePushCredentialsToSheets}
                  disabled={isPushingCredentials}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                  title="Save current identity credentials to Google Sheets"
                >
                  <UploadCloud className={`w-3.5 h-3.5 ${isPushingCredentials ? 'animate-bounce' : 'text-white'}`} />
                  <span>{isPushingCredentials ? 'Saving...' : 'Save to Sheets'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Logo upload and preview - always accessible for instant company branding */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-stone-50 border border-stone-200 rounded-lg">
            <div className="shrink-0">
              <HotelLogo logoBase64={formData.logoBase64} size={90} />
            </div>
            <div className="space-y-1.5 min-w-0 flex-1">
              <label className="block font-bold text-stone-800 text-sm">Company Logo &amp; Crest Branding</label>
              <p className="text-[11px] text-stone-500">
                Uploaded logo automatically persists across all applications, documents, receipts, statements, and live PDF exports. Leave blank for clean minimalist look.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <label className="px-3 py-1.5 bg-white border border-stone-300 rounded text-stone-700 font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-stone-50 transition-colors shadow-2xs">
                  <Upload className="w-3.5 h-3.5 text-amber-500" />
                  <span>Upload Custom Image</span>
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </label>
                {formData.logoBase64 && (
                  <button
                    type="button"
                    onClick={handleResetLogo}
                    className="text-rose-600 hover:text-rose-700 hover:underline text-[11px] font-medium cursor-pointer"
                  >
                    Clear Logo (Leave Blank)
                  </button>
                )}
              </div>
              {logoSaveFeedback && (
                <div className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1.5 mt-1 animate-fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{logoSaveFeedback}</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Hotel Business Name</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Leave blank (default) or enter hotel business name"
                className="w-full border border-stone-300 rounded px-2.5 py-1.5 text-stone-900 font-bold"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-stone-700">Tagline / Subtitle</label>
                {formData.tagline?.trim() && (
                  <button
                    type="button"
                    onClick={() => handleInputChange('tagline', '')}
                    className="text-[11px] text-rose-600 hover:text-rose-700 font-medium hover:underline cursor-pointer flex items-center gap-1"
                    title="Purge tagline and leave blank"
                  >
                    <span>Purge &amp; Leave Blank</span>
                  </button>
                )}
              </div>
              <input
                type="text"
                value={formData.tagline || ''}
                onChange={(e) => handleInputChange('tagline', e.target.value)}
                placeholder="Leave blank (default) or enter official subtitle"
                className="w-full border border-stone-300 rounded px-2.5 py-1.5 text-stone-900"
              />
              <p className="text-[11px] text-stone-400 mt-0.5">
                Default is completely blank. Invoices, receipts, and vouchers omit tagline when left blank.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-stone-700">KRA PIN</label>
                <button
                  type="button"
                  onClick={() => setShowSensitiveKra((prev) => !prev)}
                  className="text-[10px] text-stone-500 hover:text-stone-800 font-medium flex items-center gap-1 cursor-pointer"
                  title="Toggle shielding for KRA tax PIN"
                >
                  {showSensitiveKra ? (
                    <>
                      <EyeOff className="w-3 h-3 text-stone-500" />
                      <span>Shield PIN</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3 h-3 text-stone-500" />
                      <span>Reveal PIN</span>
                    </>
                  )}
                </button>
              </div>
              <input
                type={showSensitiveKra ? 'text' : 'password'}
                value={formData.kraPin || ''}
                onChange={(e) => handleInputChange('kraPin', e.target.value.toUpperCase())}
                placeholder="Leave blank (default) or enter KRA PIN e.g. P051234567Z"
                className="w-full border border-stone-300 rounded px-2.5 py-1.5 text-stone-900 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Default VAT Rate (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.vatRate !== undefined ? formData.vatRate : 16}
                onChange={(e) => handleInputChange('vatRate', Number(e.target.value))}
                className="w-full border border-stone-300 rounded px-2.5 py-1.5 text-stone-900 font-semibold"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Official Email Address</label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="Leave blank (default) or enter official email e.g. info@hotel.com"
                className="w-full border border-stone-300 rounded px-2.5 py-1.5 text-stone-900"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-stone-700">Telephone / Hotline</label>
                {formData.phone && (
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                      validateKenyanPhone(formData.phone).isValid
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {validateKenyanPhone(formData.phone).isValid
                      ? '✓ Valid Kenyan Format'
                      : 'Format: +254 7XX XXXXXX'}
                  </span>
                )}
              </div>
              <input
                type="text"
                value={formData.phone || ''}
                onChange={(e) =>
                  handleInputChange('phone', sanitizeKenyanPhoneLive(e.target.value))
                }
                onBlur={(e) =>
                  handleInputChange('phone', normalizeKenyanPhone(e.target.value))
                }
                placeholder="Leave blank (default) or e.g. +254 722 890 123 or 0722 890 123"
                className="w-full border border-stone-300 rounded px-2.5 py-1.5 text-stone-900 font-mono text-xs"
              />
              <p className="text-[10px] text-stone-500 mt-1">
                Strict autonomous normalization converts input into official Kenyan telephone format (+254 7XX XXXXXX, 07XXXXXXXX, or 01XXXXXXXX).
              </p>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Physical Location</label>
              <input
                type="text"
                value={formData.physicalLocation || ''}
                onChange={(e) => handleInputChange('physicalLocation', e.target.value)}
                placeholder="Leave blank (default) or enter physical location"
                className="w-full border border-stone-300 rounded px-2.5 py-1.5 text-stone-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Postal Address</label>
              <input
                type="text"
                value={formData.postalAddress || ''}
                onChange={(e) => handleInputChange('postalAddress', e.target.value)}
                placeholder="Leave blank (default) or enter postal address"
                className="w-full border border-stone-300 rounded px-2.5 py-1.5 text-stone-900"
              />
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: BANK & SETTLEMENT ACCOUNTS */}
      {activeTab === 'accounts' && (
        <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded p-6 shadow-xs space-y-5 text-xs">
          {formData.googleWebAppUrl && (
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="text-[11.5px] text-blue-950 font-medium">
                  Settlement &amp; Remittance accounts can be saved in Google Sheets and populated across terminals.
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handlePullCredentialsFromSheets()}
                  disabled={isPullingCredentials}
                  className="px-2.5 py-1 bg-white hover:bg-blue-100 text-blue-800 border border-blue-300 font-bold text-[11px] rounded flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                  title="Populate settlement account credentials from Google Sheets"
                >
                  <DownloadCloud className={`w-3.5 h-3.5 ${isPullingCredentials ? 'animate-bounce' : 'text-blue-600'}`} />
                  <span>{isPullingCredentials ? 'Populating...' : 'Populate from Sheets'}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePushCredentialsToSheets}
                  disabled={isPushingCredentials}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                  title="Save current settlement accounts to Google Sheets"
                >
                  <UploadCloud className={`w-3.5 h-3.5 ${isPushingCredentials ? 'animate-bounce' : 'text-white'}`} />
                  <span>{isPushingCredentials ? 'Saving...' : 'Save to Sheets'}</span>
                </button>
              </div>
            </div>
          )}

          <div className="p-3 bg-stone-50 border border-stone-200 rounded text-stone-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <strong className="text-stone-900">Settlement &amp; Remittance Accounts:</strong> All bank remittance and settlement account credentials are blank by default. All original default demo bank credentials have been purged completely. Enter your official hotel banking details below to appear on invoices, quotations, receipts, proformas, and statements.
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowSensitiveAccounts((prev) => !prev)}
                className="px-2.5 py-1 bg-white hover:bg-stone-100 text-stone-700 font-bold rounded text-[11px] transition-colors flex items-center gap-1 cursor-pointer border border-stone-300"
                title="Toggle shielding for sensitive account credentials"
              >
                {showSensitiveAccounts ? (
                  <>
                    <EyeOff className="w-3 h-3 text-stone-500" />
                    <span>Shield Sensitive Fields</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3 h-3 text-stone-500" />
                    <span>Reveal Sensitive Fields</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  handleInputChange('bankName', '');
                  handleInputChange('bankBranch', '');
                  handleInputChange('accountHolder', '');
                  handleInputChange('accountNumber', '');
                  handleInputChange('mpesaTillNumber', '');
                }}
                className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-700 font-bold rounded text-[11px] transition-colors flex items-center gap-1 cursor-pointer border border-rose-200"
                title="Purge all bank details completely and leave blank"
              >
                <RefreshCw className="w-3 h-3 text-rose-600" />
                <span>Purge Bank Details (Leave Blank)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Receiving Bank Name</label>
              <input
                type="text"
                value={formData.bankName || ''}
                onChange={(e) => handleInputChange('bankName', e.target.value)}
                placeholder="Leave blank (default) or enter receiving bank name"
                className="w-full border border-stone-300 rounded px-2.5 py-1.5 text-stone-900 font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Branch Name</label>
              <input
                type="text"
                value={formData.bankBranch || ''}
                onChange={(e) => handleInputChange('bankBranch', e.target.value)}
                placeholder="Leave blank (default) or enter branch name"
                className="w-full border border-stone-300 rounded px-2.5 py-1.5 text-stone-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Account Holder Name</label>
              <input
                type="text"
                value={formData.accountHolder || ''}
                onChange={(e) => handleInputChange('accountHolder', e.target.value)}
                placeholder="Leave blank (default) or enter account holder name"
                className="w-full border border-stone-300 rounded px-2.5 py-1.5 text-stone-900 font-bold"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-stone-700">Account Number</label>
                <span className="text-[10px] text-stone-400 font-medium">
                  {showSensitiveAccounts ? 'Plain' : 'Shielded'}
                </span>
              </div>
              <input
                type={showSensitiveAccounts ? 'text' : 'password'}
                value={formData.accountNumber || ''}
                onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                placeholder="Leave blank (default) or enter account number"
                className="w-full border border-stone-300 rounded px-2.5 py-1.5 text-stone-900 font-mono font-bold"
              />
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-emerald-800">
                  M-Pesa Buy Goods Till Number
                </label>
                <span className="text-[10px] text-stone-400 font-medium">
                  {showSensitiveAccounts ? 'Plain' : 'Shielded'}
                </span>
              </div>
              <input
                type={showSensitiveAccounts ? 'text' : 'password'}
                value={formData.mpesaTillNumber || ''}
                onChange={(e) => handleInputChange('mpesaTillNumber', e.target.value)}
                placeholder="Leave blank (default) or enter till number e.g. 5432100"
                className="w-full border border-emerald-300 bg-emerald-50/40 rounded px-2.5 py-1.5 text-emerald-950 font-mono font-bold text-sm"
              />
            </div>
          </div>
        </form>
      )}

      {/* TAB 3: GOOGLE WORKSPACE SYNC (HEADLESS ZERO-AUTH) */}
      {activeTab === 'google-sync' && (
        <div className="space-y-6 text-xs">
          {/* QUICK SHORTCUTS ACTION PANEL */}
          <div className="bg-stone-900 text-stone-100 rounded-lg p-4 sm:p-5 border border-stone-800 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800/80 pb-3">
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-amber-400" />
                  Google Workspace Direct Shortcuts
                </h3>
                <p className="text-stone-400 text-[11px] mt-0.5">
                  Instant one-click shortcuts to open the live Google Sheet master ledger and Google Drive archive folder.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-stone-400 font-medium">Pending Queue:</span>
                <span className="font-mono font-bold bg-stone-800 px-2 py-0.5 rounded text-amber-300 border border-stone-700">
                  {syncQueue.length} items
                </span>
                <button
                  type="button"
                  onClick={onTriggerSync}
                  className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold rounded flex items-center gap-1 border border-stone-700 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Sync Now
                </button>
              </div>
            </div>

            {/* Quick Link Shortcut Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <a
                href={
                  formData.googleSheetUrl ||
                  testResult?.sheetUrl ||
                  'https://docs.google.com/spreadsheets'
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-lg bg-emerald-950/50 hover:bg-emerald-950/80 border border-emerald-800/80 text-emerald-200 transition-colors group"
                title="Open Google Spreadsheet in a new tab"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded bg-emerald-900/80 text-emerald-300 shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-white group-hover:text-emerald-300 transition-colors flex items-center gap-1.5">
                      <span>Open Google Sheet Ledger</span>
                      <ExternalLink className="w-3 h-3 opacity-70 group-hover:opacity-100" />
                    </div>
                    <div className="text-[10.5px] text-emerald-400/80 truncate">
                      {formData.googleSheetUrl ? formData.googleSheetUrl : 'Click to launch Google Sheets'}
                    </div>
                  </div>
                </div>
              </a>

              <a
                href={
                  formData.googleDriveFolderUrl ||
                  'https://drive.google.com'
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-lg bg-blue-950/50 hover:bg-blue-950/80 border border-blue-800/80 text-blue-200 transition-colors group"
                title="Open Google Drive folder in a new tab"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded bg-blue-900/80 text-blue-300 shrink-0">
                    <FolderOpen className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-white group-hover:text-blue-300 transition-colors flex items-center gap-1.5">
                      <span>Open Google Drive Folder</span>
                      <ExternalLink className="w-3 h-3 opacity-70 group-hover:opacity-100" />
                    </div>
                    <div className="text-[10.5px] text-blue-400/80 truncate">
                      {formData.googleDriveFolderUrl
                        ? formData.googleDriveFolderUrl
                        : `Folder: ${formData.googleDriveFolder || 'Hotel Damview Archives'}`}
                    </div>
                  </div>
                </div>
              </a>
            </div>
          </div>

          {/* HEADLESS WEBHOOK CONFIGURATION FORM */}
          <div className="bg-white border border-stone-200 rounded-lg p-6 shadow-xs space-y-4">
            <div className="border-b border-stone-200 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-sm text-stone-900 flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-blue-600" />
                  Headless Webhook Configuration (No End-User Login)
                </h3>
                <p className="text-stone-500 text-[11px] mt-0.5">
                  Configure the Google Apps Script endpoint URL and destination Google Sheet/Drive URLs for seamless zero-auth background sync.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowSensitiveWebhookUrls((prev) => !prev)}
                className="px-2.5 py-1 bg-white hover:bg-stone-100 text-stone-700 font-bold rounded text-[11px] transition-colors flex items-center gap-1 cursor-pointer border border-stone-300 shrink-0"
                title="Toggle shielding for webhook endpoint and drive URLs"
              >
                {showSensitiveWebhookUrls ? (
                  <>
                    <EyeOff className="w-3 h-3 text-stone-500" />
                    <span>Shield Webhook URLs</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3 h-3 text-stone-500" />
                    <span>Reveal Webhook URLs</span>
                  </>
                )}
              </button>
            </div>

            <div className="space-y-4">
              {/* 1. Google Apps Script Web App Endpoint URL */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-stone-700">
                    1. Google Apps Script Web App Endpoint URL *
                  </label>
                  <span className="text-[10px] text-stone-400 font-medium">
                    {showSensitiveWebhookUrls ? 'Plain' : 'Shielded'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type={showSensitiveWebhookUrls ? 'url' : 'password'}
                    value={formData.googleWebAppUrl || ''}
                    onChange={(e) => handleInputChange('googleWebAppUrl', e.target.value)}
                    onBlur={() => {
                      if (formData.googleWebAppUrl && formData.googleWebAppUrl.trim().startsWith('https://script.google.com/macros/s/')) {
                        handleTestConnection();
                      }
                    }}
                    placeholder="https://script.google.com/macros/s/AKfycb.../exec (Leave blank by default)"
                    className="flex-1 border border-stone-300 rounded px-2.5 py-1.5 text-stone-900 font-mono text-[11px]"
                  />
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold rounded shrink-0 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin text-amber-400' : ''}`} />
                    {isTesting ? 'Testing...' : 'Test Connection'}
                  </button>
                </div>
                <p className="text-[10.5px] text-stone-500 mt-1">
                  Deployed as Web App with <em>&quot;Execute as: Me&quot;</em> and <em>&quot;Who has access: Anyone&quot;</em>. Testing connection or entering URL automatically populates Hotel Settings from Google Sheets.
                </p>
              </div>

              {/* 2. Google Spreadsheet Direct URL */}
              <div>
                <label className="block font-semibold text-stone-700 mb-1 flex items-center justify-between">
                  <span>2. Google Spreadsheet Direct URL</span>
                  {formData.googleSheetUrl && (
                    <a
                      href={formData.googleSheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 hover:underline inline-flex items-center gap-1 font-bold text-[11px]"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Launch Sheet
                    </a>
                  )}
                </label>
                <div className="flex gap-2">
                  <input
                    type={showSensitiveWebhookUrls ? 'url' : 'password'}
                    value={formData.googleSheetUrl || ''}
                    onChange={(e) => handleInputChange('googleSheetUrl', e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/1abcXYZ.../edit (Leave blank by default)"
                    className="flex-1 border border-stone-300 rounded px-2.5 py-1.5 text-stone-900 font-mono text-[11px]"
                  />
                  {formData.googleSheetUrl && (
                    <a
                      href={formData.googleSheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-semibold shrink-0 flex items-center gap-1"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      Open
                    </a>
                  )}
                </div>
                <p className="text-[10.5px] text-stone-500 mt-1">
                  Direct browser link to your Google Sheets document. Auto-populated when you test connection.
                </p>
              </div>

              {/* 3. Google Drive Folder Direct URL */}
              <div>
                <label className="block font-semibold text-stone-700 mb-1 flex items-center justify-between">
                  <span>3. Google Drive Archival Folder URL</span>
                  {formData.googleDriveFolderUrl && (
                    <a
                      href={formData.googleDriveFolderUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-700 hover:underline inline-flex items-center gap-1 font-bold text-[11px]"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Launch Drive
                    </a>
                  )}
                </label>
                <div className="flex gap-2">
                  <input
                    type={showSensitiveWebhookUrls ? 'url' : 'password'}
                    value={formData.googleDriveFolderUrl || ''}
                    onChange={(e) => handleInputChange('googleDriveFolderUrl', e.target.value)}
                    placeholder="https://drive.google.com/drive/folders/1abcXYZ... (Leave blank by default)"
                    className="flex-1 border border-stone-300 rounded px-2.5 py-1.5 text-stone-900 font-mono text-[11px]"
                  />
                  {formData.googleDriveFolderUrl && (
                    <a
                      href={formData.googleDriveFolderUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 rounded font-semibold shrink-0 flex items-center gap-1"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      Open
                    </a>
                  )}
                </div>
                <p className="text-[10.5px] text-stone-500 mt-1">
                  Direct browser link to your Google Drive archival folder where PDF invoices & receipts are stored.
                </p>
              </div>

              {/* 4. Drive Folder Name & Auto-Sync Switch */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    4. Google Drive Archival Folder Name
                  </label>
                  <input
                    type="text"
                    value={formData.googleDriveFolder || ''}
                    onChange={(e) => handleInputChange('googleDriveFolder', e.target.value)}
                    placeholder={`Leave blank (default: ${getHotelArchiveFolderName(formData.name)}) or enter archival folder name`}
                    className="w-full border border-stone-300 rounded px-2.5 py-1.5 text-stone-900"
                  />
                  <p className="text-[10.5px] text-stone-500 mt-1">
                    Folder automatically created in Drive if not yet existing (e.g. {getHotelArchiveFolderName(formData.name)}).
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    5. Google Sheet Embed / Published URL (Optional)
                  </label>
                  <input
                    type={showSensitiveWebhookUrls ? 'url' : 'password'}
                    value={formData.googleSheetEmbedUrl || ''}
                    onChange={(e) => handleInputChange('googleSheetEmbedUrl', e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/e/.../pubhtml (Leave blank by default)"
                    className="w-full border border-stone-300 rounded px-2.5 py-1.5 text-stone-900 font-mono text-[11px]"
                  />
                  <p className="text-[10.5px] text-stone-500 mt-1">
                    Optional published URL for in-app iframe embedding.
                  </p>
                </div>
              </div>

              {/* Auto sync checkbox */}
              <div className="p-3 bg-stone-50 rounded border border-stone-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="autoSyncEnabled"
                    checked={formData.autoSyncEnabled !== false}
                    onChange={(e) => handleInputChange('autoSyncEnabled', e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="autoSyncEnabled" className="font-semibold text-stone-800 cursor-pointer">
                    Enable Background Auto-Sync on Save, Convert & Payment Record
                  </label>
                </div>

                <button
                  type="button"
                  onClick={handleSubmit}
                  className="px-3 py-1 bg-stone-900 hover:bg-stone-800 text-amber-400 font-bold rounded text-xs flex items-center gap-1 shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Changes
                </button>
              </div>
            </div>

            {/* Test Result alert */}
              {testResult && (
                <div
                  className={`p-3 rounded text-xs flex items-center justify-between gap-2 ${
                    testResult.ok
                      ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                      : 'bg-rose-50 text-rose-900 border border-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {testResult.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{testResult.message}</span>
                  </div>

                  {testResult.sheetUrl && (
                    <a
                      href={testResult.sheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-bold text-[11px] flex items-center gap-1 shrink-0"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open Google Sheet
                    </a>
                  )}
                </div>
              )}

              {/* Google Drive Test PDF Upload Section */}
              <div className="p-4 rounded-lg bg-blue-50/70 border border-blue-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <h4 className="font-bold text-xs text-blue-950 flex items-center gap-1.5">
                      <UploadCloud className="w-4 h-4 text-blue-700" />
                      Google Drive PDF Cloud Archiving Test
                    </h4>
                    <p className="text-[11px] text-blue-800/80">
                      Generate an authentic A4 verification PDF and upload it directly to your designated Google Drive folder via the Web App.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleUploadTestPdf}
                    disabled={isUploadingTestPdf || !formData.googleWebAppUrl}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors disabled:opacity-50 shrink-0"
                  >
                    <UploadCloud className={`w-3.5 h-3.5 ${isUploadingTestPdf ? 'animate-bounce' : ''}`} />
                    {isUploadingTestPdf ? 'Uploading Test PDF...' : 'Upload Test PDF to Google Drive'}
                  </button>
                </div>

                {/* Test PDF Upload Result Notification */}
                {testPdfResult && (
                  <div
                    className={`p-3 rounded-md text-xs border ${
                      testPdfResult.ok
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                        : 'bg-rose-50 text-rose-900 border-rose-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        {testPdfResult.ok ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-1">
                          <p className="font-semibold">{testPdfResult.message}</p>
                          {testPdfResult.fileName && (
                            <div className="text-[11px] text-stone-600 font-mono flex flex-wrap gap-x-3">
                              <span>File: {testPdfResult.fileName}</span>
                              {testPdfResult.byteLength && (
                                <span>Size: {(testPdfResult.byteLength / 1024).toFixed(1)} KB</span>
                              )}
                              {testPdfResult.folderName && (
                                <span>Folder: {testPdfResult.folderName}</span>
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
                          View in Google Drive
                          <ExternalLink className="w-3 h-3 opacity-80" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
          </div>

          {/* COMPANION GOOGLE APPS SCRIPT CODE & STEP-BY-STEP INSTRUCTIONS */}
          <div className="bg-white border border-stone-200 rounded p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-stone-900 flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-amber-700" />
                    Companion Google Apps Script (Code.gs)
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    {GOOGLE_APPS_SCRIPT_VERSION} Synchronized
                  </span>
                </div>
                <p className="text-stone-500 text-[11px] mt-0.5">
                  Authoritative Apps Script code with 15 operational ERP sheets, dynamic header-index mapping, and zero login prompts.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleDownloadCodeGs}
                  className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 rounded font-bold flex items-center gap-1.5 text-xs transition-colors cursor-pointer"
                  title="Download Code.gs script file to your machine"
                >
                  <Download className="w-3.5 h-3.5 text-stone-600" />
                  <span>Download Code.gs</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyScript}
                  className="px-3 py-1.5 bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 rounded font-bold flex items-center gap-1.5 text-xs transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedCode ? 'Copied to Clipboard!' : 'Copy Script Code'}</span>
                </button>
              </div>
            </div>

            {/* Quick 4-Step Instructions */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-stone-700 text-[11px]">
              <div className="p-2.5 bg-stone-50 rounded border border-stone-200">
                <span className="font-bold text-stone-900 block mb-1">1. Create Spreadsheet</span>
                Open sheets.google.com and create a blank sheet named <em>"Hotel Damview ERP"</em>.
              </div>
              <div className="p-2.5 bg-stone-50 rounded border border-stone-200">
                <span className="font-bold text-stone-900 block mb-1">2. Paste Code.gs</span>
                Go to <strong>Extensions &gt; Apps Script</strong>, paste the script code from below into <code>Code.gs</code>.
              </div>
              <div className="p-2.5 bg-stone-50 rounded border border-stone-200">
                <span className="font-bold text-stone-900 block mb-1">3. Deploy as Web App</span>
                Click <strong>Deploy &gt; New deployment</strong>, select <strong>Web app</strong>, set access to <strong>"Anyone"</strong>.
              </div>
              <div className="p-2.5 bg-stone-50 rounded border border-stone-200">
                <span className="font-bold text-stone-900 block mb-1">4. Paste URL Here</span>
                Copy the generated Web App URL and paste it into the endpoint input above.
              </div>
            </div>

            {/* Read-Only Code Box */}
            <div className="relative">
              <pre className="bg-stone-900 text-stone-200 p-4 rounded text-[10.5px] font-mono overflow-x-auto max-h-72 leading-relaxed border border-stone-800">
                {GOOGLE_APPS_SCRIPT_CODE}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* TAB: LOCAL MACHINE ARCHIVES & BACKUP */}
      {activeTab === 'local-backup' && (
        <div className="bg-white border border-stone-200 rounded p-6 shadow-xs space-y-6 text-xs">
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-stone-900 text-white p-5 rounded-lg border border-stone-800">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <FolderCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Local Machine Filesystem Archiving</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                  {savedDirectoryHandle ? 'Native FS Connected' : 'Fallback Download Active'}
                </span>
              </div>
              <p className="text-stone-300 text-xs max-w-2xl">
                Automatically archives generated PDF invoices, quotations, proformas, and settlement receipts directly to your designated local Windows/OneDrive directory.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePickDirectory}
                disabled={isPickingDirectory}
                className="px-3.5 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <FolderOpen className="w-4 h-4" />
                <span>{savedDirectoryHandle ? 'Change Connected Folder' : 'Connect Local Folder'}</span>
              </button>
            </div>
          </div>

          {/* Designated Path Configuration */}
          <div className="p-4 bg-stone-50 border border-stone-200 rounded-lg space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 font-bold text-stone-800">
                <HardDrive className="w-4 h-4 text-amber-600" />
                <span>Target Local Filesystem Directory (Windows / OneDrive)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyTargetDirectoryPath}
                  className="px-2.5 py-1 bg-white border border-stone-300 rounded text-stone-700 hover:bg-stone-100 flex items-center gap-1 font-semibold transition-colors text-[11px]"
                  title="Copy designated path to clipboard"
                >
                  <Copy className="w-3.5 h-3.5 text-stone-500" />
                  <span>{copiedPath ? 'Copied!' : 'Copy Path'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const defaultPath = localBackupService.getTargetDirectoryPath(formData.name);
                    setLocalTargetPath(defaultPath);
                    localBackupService.setTargetDirectoryPath(defaultPath);
                    setPathSaveNotification(true);
                    setTimeout(() => setPathSaveNotification(false), 3000);
                  }}
                  className="px-2.5 py-1 bg-white border border-stone-300 rounded text-stone-700 hover:bg-stone-100 flex items-center gap-1 font-semibold transition-colors text-[11px]"
                  title={`Reset to default Documents/${getHotelArchiveFolderName(formData.name)} path`}
                >
                  <RefreshCw className="w-3.5 h-3.5 text-stone-500" />
                  <span>Reset Default</span>
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={localTargetPath}
                onChange={(e) => setLocalTargetPath(e.target.value)}
                className="w-full font-mono text-[11px] bg-white border border-stone-300 rounded px-3 py-2 text-stone-900 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                placeholder={`Documents/${getHotelArchiveFolderName(formData.name)}`}
              />
              <button
                type="button"
                onClick={handleSaveCustomTargetPath}
                className="px-3 py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded shrink-0 transition-colors"
              >
                Save Path
              </button>
            </div>

            {pathSaveNotification && (
              <p className="text-emerald-700 font-semibold text-[11px] flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Target directory path updated and saved.
              </p>
            )}

            <p className="text-[11px] text-stone-500 leading-relaxed">
              When using Google Chrome, Microsoft Edge, or Chromium browsers, granting permission to this folder via <em>"Connect Local Folder"</em> allows Hotel Damview to save generated PDF vouchers silently into this folder without prompting each time.
            </p>
          </div>

          {/* Connection Status and Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Status Card */}
            <div className="p-4 bg-white border border-stone-200 rounded-lg space-y-3">
              <h4 className="font-bold text-stone-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Filesystem Access Status</span>
              </h4>

              <div className="p-3 bg-stone-50 rounded border border-stone-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-stone-600">Native API Support:</span>
                  <span className="font-semibold text-stone-900">
                    {localBackupService.isFileSystemAccessSupported()
                      ? 'Supported (Chromium Engine)'
                      : localBackupService.isInEmbeddedFrame()
                      ? 'Restricted in Preview Iframe (Browser Download Active)'
                      : 'Unavailable in this browser'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-600">Active Directory Handle:</span>
                  <span className="font-bold text-stone-900">
                    {connectedDirName ? connectedDirName : 'None (Fallback mode active)'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-600">Active Mode:</span>
                  <span className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
                    savedDirectoryHandle
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {savedDirectoryHandle ? 'Silent Local Folder Write' : 'Seamless Browser Download Fallback'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <button
                  type="button"
                  onClick={handleTestLocalWrite}
                  disabled={isTestingLocalWrite}
                  className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold rounded flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileCheck className="w-3.5 h-3.5 text-stone-600" />
                  <span>{isTestingLocalWrite ? 'Testing Write...' : 'Test Write Access'}</span>
                </button>

                {savedDirectoryHandle && (
                  <button
                    type="button"
                    onClick={handleClearConnectedDirectory}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded flex items-center gap-1.5 border border-rose-200 transition-colors cursor-pointer"
                  >
                    <span>Disconnect Folder</span>
                  </button>
                )}
              </div>
            </div>

            {/* Complete Database Export Card */}
            <div className="p-4 bg-white border border-stone-200 rounded-lg space-y-3">
              <h4 className="font-bold text-stone-900 flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-600" />
                <span>Complete System Offline Export</span>
              </h4>
              <p className="text-stone-600 text-[11px] leading-relaxed">
                Download a complete, uncompressed JSON backup containing all hotel profile configurations, clients, billing documents, and payment receipts. Ideal for offline disaster recovery or importing into another workstation.
              </p>

              <button
                type="button"
                onClick={handleExportFullSystemJson}
                disabled={isExportingJson}
                className="w-full px-3.5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{isExportingJson ? 'Assembling Database...' : 'Download Full System Backup (JSON)'}</span>
              </button>
            </div>
          </div>

          {/* Test Write Result Banner */}
          {localWriteResult && (
            <div
              className={`p-3.5 rounded border text-xs flex items-start gap-2 ${
                localWriteResult.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {localWriteResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <span className="font-bold block">{localWriteResult.ok ? 'Operation Succeeded' : 'Operation Note'}</span>
                <p>{localWriteResult.message}</p>
              </div>
            </div>
          )}

          {/* Architecture Guidelines & Fallback Explanation */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 bg-stone-50 border border-stone-200 rounded">
              <span className="font-bold text-stone-900 block mb-1">1. Automatic Background Archival</span>
              <p className="text-stone-600 text-[11px] leading-relaxed">
                Every time you save, download, or print an Invoice, Quotation, or Receipt, the system writes a clean vector PDF directly to disk.
              </p>
            </div>
            <div className="p-3 bg-stone-50 border border-stone-200 rounded">
              <span className="font-bold text-stone-900 block mb-1">2. Canonical Naming & No Clutter</span>
              <p className="text-stone-600 text-[11px] leading-relaxed">
                Files are named canonically (<code>[DocNo]_[Client]_[Date].pdf</code>) to prevent accidental overwrites and duplicate confusion.
              </p>
            </div>
            <div className="p-3 bg-stone-50 border border-stone-200 rounded">
              <span className="font-bold text-stone-900 block mb-1">3. Transparent Fallback Guarantee</span>
              <p className="text-stone-600 text-[11px] leading-relaxed">
                If the File System Access API is disabled or not granted, documents seamlessly trigger direct browser download vouchers with zero interruption.
              </p>
            </div>
          </div>

          {/* Recent Local Backup History Log */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-stone-900 flex items-center gap-2">
                <History className="w-4 h-4 text-stone-600" />
                <span>Recent Local Machine Archival Activity</span>
                <span className="text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full border border-stone-200">
                  {backupHistory.length} Recorded
                </span>
              </h4>
              {backupHistory.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    localBackupService.clearBackupHistory();
                    setBackupHistory([]);
                  }}
                  className="text-stone-500 hover:text-rose-600 text-[11px] font-semibold"
                >
                  Clear History
                </button>
              )}
            </div>

            {backupHistory.length === 0 ? (
              <div className="p-6 bg-stone-50 border border-stone-200 rounded text-center text-stone-500">
                <FolderOpen className="w-6 h-6 mx-auto mb-1 text-stone-400" />
                <span>No local machine backups recorded yet in this session. Generate or save a document to see records here.</span>
              </div>
            ) : (
              <div className="overflow-x-auto border border-stone-200 rounded">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-100 text-stone-700 font-bold border-b border-stone-200">
                    <tr>
                      <th className="p-2.5">Timestamp</th>
                      <th className="p-2.5">File Name</th>
                      <th className="p-2.5">File Size</th>
                      <th className="p-2.5">Method</th>
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {backupHistory.slice(0, 15).map((log) => (
                      <tr key={log.id} className="hover:bg-stone-50">
                        <td className="p-2.5 text-stone-600 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="p-2.5 font-mono text-stone-900 font-medium">
                          {log.fileName}
                        </td>
                        <td className="p-2.5 text-stone-600 whitespace-nowrap">
                          {(log.byteLength / 1024).toFixed(1)} KB
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              log.method === 'FILE_SYSTEM_ACCESS_API'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-stone-100 text-stone-700'
                            }`}
                          >
                            {log.method === 'FILE_SYSTEM_ACCESS_API' ? 'Direct FS API' : 'Download Fallback'}
                          </span>
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              log.status === 'SUCCESS'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: OFFLINE CAPABILITIES & STORAGE */}
      {activeTab === 'pwa' && (
        <div className="bg-white border border-stone-200 rounded p-6 shadow-xs space-y-6 text-xs">
          <div className="bg-stone-900 text-white p-5 rounded-lg border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">App Version &amp; Automatic Update Center</h3>
              </div>
              <p className="text-stone-300 text-xs">
                Hotel Damview ERP runs with permanent local offline persistence and autonomous GitHub deployment updates.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded font-mono font-bold text-xs">
                v{CURRENT_APP_VERSION}
              </span>
            </div>
          </div>

          {/* GitHub Auto-Update Card */}
          <div className="p-4 bg-gradient-to-br from-stone-900 to-stone-950 text-white rounded-lg border border-stone-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-amber-400 flex items-center gap-2">
                <RefreshCw className={`w-4 h-4 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                <span>Live GitHub Deployment Synchronizer</span>
              </h4>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${needRefresh ? 'bg-amber-500 text-stone-950 animate-pulse' : 'bg-emerald-800 text-emerald-100'}`}>
                {needRefresh ? 'Update Pending' : 'Up to Date'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-stone-800/80 rounded border border-stone-700 text-[11px] font-mono">
              <div>
                <span className="text-stone-400 font-sans block">Running Build Timestamp:</span>
                <span className="text-amber-200 font-bold">{new Date(CURRENT_BUILD_TIME).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-stone-400 font-sans block">Remote Deployment Timestamp:</span>
                <span className="text-emerald-300 font-bold">
                  {remoteBuildTime ? new Date(remoteBuildTime).toLocaleString() : 'Synchronized with Live Server'}
                </span>
              </div>
              <div>
                <span className="text-stone-400 font-sans block">Service Worker Status:</span>
                <span className="text-stone-200 font-sans">{offlineReady ? 'Active (updateViaCache: none)' : 'Initializing...'}</span>
              </div>
              <div>
                <span className="text-stone-400 font-sans block">Last Checked:</span>
                <span className="text-stone-200">{lastChecked ? lastChecked.toLocaleTimeString() : 'Continuous (every 2m)'}</span>
              </div>
            </div>

            {updateCheckMsg && (
              <div className="p-2.5 bg-amber-950/80 border border-amber-600/60 rounded text-amber-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{updateCheckMsg}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <button
                type="button"
                onClick={handleManualUpdateCheck}
                disabled={isCheckingUpdate}
                className="px-3.5 py-2 bg-stone-800 hover:bg-stone-700 text-amber-300 font-bold rounded flex items-center gap-1.5 transition-colors cursor-pointer text-xs border border-stone-600"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                <span>{isCheckingUpdate ? 'Checking GitHub...' : 'Check for Updates Now'}</span>
              </button>

              {needRefresh && (
                <button
                  type="button"
                  onClick={() => applyUpdate()}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold rounded flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Reload to Apply Latest Changes</span>
                </button>
              )}

              <button
                type="button"
                disabled={isForceReloading}
                onClick={async () => {
                  setIsForceReloading(true);
                  await forceClearCacheAndReload();
                }}
                className="px-3.5 py-2 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 font-semibold rounded flex items-center gap-1.5 transition-colors cursor-pointer text-xs ml-auto"
                title="Permanently clears browser service worker cache storage and hard reloads"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>{isForceReloading ? 'Wiping Cache...' : 'Permanent Force Clear Cache & Reload'}</span>
              </button>
            </div>
          </div>

          {/* GitHub Pages 404 Resolution & Verification Guide */}
          <div className="p-4 bg-stone-900 text-white rounded-lg border border-amber-500/40 space-y-3 shadow-md">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-amber-400" />
              <h4 className="font-bold text-sm text-white">GitHub Pages Live Setup &amp; 404 Resolution Guide</h4>
            </div>
            <p className="text-stone-300 text-xs leading-relaxed">
              If GitHub displays <span className="font-mono text-rose-300 bg-stone-950 px-1.5 py-0.5 rounded border border-rose-900/60 font-semibold">404: There isn&apos;t a GitHub Pages site here</span>, activate hosting in your repository with these 3 steps:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
              <div className="p-3 bg-stone-950/80 rounded border border-stone-800 space-y-1">
                <span className="font-bold text-amber-400 block">Step 1: Open Settings</span>
                <span className="text-stone-300 block">In your GitHub repository, click the <strong className="text-white">Settings</strong> tab at the top.</span>
              </div>
              <div className="p-3 bg-stone-950/80 rounded border border-stone-800 space-y-1">
                <span className="font-bold text-amber-400 block">Step 2: Enable Pages</span>
                <span className="text-stone-300 block">In the left sidebar, click <strong className="text-white">Pages</strong>. Under <em>Build and deployment &rarr; Source</em>, select <strong className="text-amber-300">GitHub Actions</strong> (or branch <strong className="text-white">gh-pages</strong>).</span>
              </div>
              <div className="p-3 bg-stone-950/80 rounded border border-stone-800 space-y-1">
                <span className="font-bold text-amber-400 block">Step 3: Verification</span>
                <span className="text-stone-300 block">Click the <strong className="text-white">Actions</strong> tab to verify the deployment. Your site goes live without 404 errors!</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-stone-50 border border-stone-200 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-stone-900 font-bold">
                <HardDrive className="w-4 h-4 text-amber-600" />
                <span>IndexedDB Storage Vault</span>
              </div>
              <p className="text-stone-600 leading-relaxed text-[11px]">
                Invoices, quotations, receipts, clients, and company preferences persist permanently in your local browser storage.
              </p>
            </div>

            <div className="p-4 bg-stone-50 border border-stone-200 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-stone-900 font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Zero-Data Loss Architecture</span>
              </div>
              <p className="text-stone-600 leading-relaxed text-[11px]">
                If the internet drops mid-transaction, mutational actions are safely queued and synced automatically when connection resumes.
              </p>
            </div>

            <div className="p-4 bg-stone-50 border border-stone-200 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-stone-900 font-bold">
                <Wifi className="w-4 h-4 text-sky-600" />
                <span>Autonomous Cache Invalidation</span>
              </div>
              <p className="text-stone-600 leading-relaxed text-[11px]">
                The app checks <code>version.json</code> on focus, visibility change, and every 2 minutes to automatically activate new deployments without manual hard refresh.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: PARTICULARS & SERVICE CATALOGUE */}
      {activeTab === 'catalogue' && (
        <div className="bg-white border border-stone-200 rounded p-6 shadow-xs space-y-6 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
            <div>
              <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <ListPlus className="w-5 h-5 text-purple-600" />
                <span>Particulars &amp; Service Catalog Presets</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Manage pre-configured billing particulars, conference packages, banquet services, and unit rates for instant predictive autocomplete in document editors.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handlePurgeAllDemoData}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Purge all demo / mock records across all operational modules"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Purge All Demo Data</span>
              </button>
              {catalogueItems.length > 0 && (
                <button
                  type="button"
                  onClick={handlePurgeCatalogue}
                  className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Purge particulars catalog"
                >
                  <Trash2 className="w-3.5 h-3.5 text-stone-500" />
                  <span>Clear Catalog</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleOpenNewCatItem}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-amber-400 font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-xs transition-colors shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-amber-400" />
                <span>Add Service Preset</span>
              </button>
            </div>
          </div>

          {catalogueItems.length === 0 ? (
            <div className="p-8 text-center bg-stone-50 border border-dashed border-stone-300 rounded-lg space-y-3">
              <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
                <ListPlus className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-stone-800 text-sm">Service Catalog is Clean &amp; Ready</h4>
                <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto">
                  All demo records have been purged. Add your hotel&apos;s official room types, conference packages, and catering items for quick autocomplete during quotation &amp; invoice drafting.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenNewCatItem}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-md inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Service Particular</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-100 text-stone-700 border-b border-stone-200">
                    <th className="p-3 font-bold">Billing Particulars Name</th>
                    <th className="p-3 font-bold">Category</th>
                    <th className="p-3 font-bold text-right">Standard Rate (Ksh)</th>
                    <th className="p-3 font-bold">Tax Setting</th>
                    <th className="p-3 font-bold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {catalogueItems.map((item) => (
                    <tr key={item.id} className="hover:bg-stone-50 transition-colors">
                      <td className="p-3 font-bold text-stone-900">{item.particulars}</td>
                      <td className="p-3">
                        <span className="bg-stone-100 border border-stone-200 px-2 py-0.5 rounded text-[11px] font-medium text-stone-700">
                          {item.category}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-stone-900">
                        Ksh {(item.standardRate || 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-stone-600">
                        {item.taxable !== false ? '16% VAT Applicable' : 'Tax Exempt'}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEditCatItem(item)}
                            className="p-1 text-stone-600 hover:text-amber-700 rounded hover:bg-stone-100 transition-colors cursor-pointer"
                            title="Edit Preset"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCatItem(item.id)}
                            className="p-1 text-stone-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Permanently Remove Preset"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Service Particulars Add/Edit Modal */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-stone-200 overflow-hidden text-xs">
            <div className="bg-stone-900 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <ListPlus className="w-4 h-4 text-amber-400" />
                <span>{editingCatItem ? 'Edit Particulars Preset' : 'Add New Particulars Preset'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCatModalOpen(false)}
                className="text-stone-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCatItem} className="p-5 space-y-4">
              <div>
                <label className="block text-stone-700 font-semibold mb-1">Particulars Name / Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Full Board Conference Package, Executive Bed & Breakfast, Buffet Lunch"
                  value={catParticulars}
                  onChange={(e) => setCatParticulars(e.target.value)}
                  className="w-full border border-stone-300 rounded-md p-2 text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Category</label>
                <select
                  value={catCategory}
                  onChange={(e) => setCatCategory(e.target.value as any)}
                  className="w-full border border-stone-300 rounded-md p-2 text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                >
                  <option value="Conference & Banqueting">Conference & Banqueting</option>
                  <option value="Accommodation">Accommodation</option>
                  <option value="Food & Beverage">Food & Beverage</option>
                  <option value="Equipment & Services">Equipment & Services</option>
                </select>
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Standard Rate (Ksh)</label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  required
                  value={catStandardRate}
                  onChange={(e) => setCatStandardRate(parseFloat(e.target.value) || 0)}
                  className="w-full border border-stone-300 rounded-md p-2 text-stone-900 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-stone-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={catTaxable}
                    onChange={(e) => setCatTaxable(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                  />
                  <span className="text-stone-800 font-medium">Subject to 16% VAT</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsCatModalOpen(false)}
                  className="px-4 py-2 border border-stone-300 rounded-md text-stone-700 hover:bg-stone-100 font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-stone-900 hover:bg-stone-800 text-amber-400 font-bold rounded-md transition-colors cursor-pointer"
                >
                  Save Particulars Preset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
