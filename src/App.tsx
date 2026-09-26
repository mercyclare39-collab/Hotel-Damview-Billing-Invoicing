import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BillingDocument,
  Client,
  DocumentType,
  HotelProfile,
  PaymentRecord,
  SyncQueueItem,
} from './types';
import { dbService, DEFAULT_HOTEL_PROFILE } from './services/db';
import { syncManager } from './services/sync';
import { Sidebar, MainNavModule } from './components/Sidebar';
import { DocumentModule } from './components/DocumentModule';
import { Dashboard } from './components/Dashboard';
import { StatementOfAccount } from './components/StatementOfAccount';
import { ClientsManager } from './components/ClientsManager';
import { HotelSettings } from './components/HotelSettings';
import { GoogleSyncModule } from './components/GoogleSyncModule';
import { PaymentModal } from './components/PaymentModal';
import { ReceiptsManager } from './components/ReceiptsManager';
import { CommandPalette } from './components/CommandPalette';
import { ReservationsManager } from './components/ReservationsManager';
import { RestaurantPOS } from './components/RestaurantPOS';
import { NightAuditReports } from './components/NightAuditReports';
import { DriveVault } from './components/DriveVault';
import { Menu, Wifi, WifiOff, Plus, RefreshCw, Search, Sparkles, X, AlertCircle, AlertTriangle } from 'lucide-react';
import { HotelLogo } from './components/HotelLogo';
import { OfflineBanner } from './components/OfflineBanner';
import { PWAReloadPrompt } from './components/PWAReloadPrompt';
import { AppNotificationToaster } from './components/AppNotificationToaster';
import { DocumentPropagationParityModal } from './components/DocumentPropagationParityModal';
import { logSystemIncident } from './services/selfHealingPatch';
import { StatementRecord } from './types';
import { GOOGLE_APPS_SCRIPT_VERSION } from './services/googleScriptCode';
import { ExcelWorkstationModule } from './components/ExcelWorkstationModule';
import {
  generateMasterSuiteWorkbook,
  saveWorkbookToLocalArchive,
  getSavedDirectoryHandle,
  WORKBOOK_FILENAME,
} from './services/excelEngine';

export default function App() {
  const [currentModule, setCurrentModuleState] = useState<MainNavModule>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('damview_active_module') as MainNavModule;
      const validModules: MainNavModule[] = [
        'dashboard',
        'reservations',
        'pos',
        'quotations',
        'proformas',
        'invoices',
        'receipts',
        'statements',
        'nightaudit',
        'vault',
        'clients',
        'sync',
        'excel',
        'settings',
      ];
      if (saved && validModules.includes(saved)) {
        return saved;
      }
    }
    return 'dashboard';
  });

  const setCurrentModule = (mod: MainNavModule) => {
    setCurrentModuleState(mod);
    try {
      localStorage.setItem('damview_active_module', mod);
    } catch {}
  };

  const [profile, setProfile] = useState<HotelProfile>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = localStorage.getItem('damview_profile');
        if (stored) {
          const parsed = JSON.parse(stored);
          const legacyTaglines = [
            'premier hospitality, accommodation & dining',
            'luxury & serenity by the dam',
            'luxury & serenity',
            'luxury and serenity by the dam',
            'premier hospitality',
            'serenity by the dam',
          ];
          if (parsed.tagline && legacyTaglines.includes(String(parsed.tagline).toLowerCase().trim())) {
            parsed.tagline = '';
          }
          const legacyBanks = [
            'kcb bank kenya',
            'kenya commercial bank',
            'kenya commercial bank (kcb)',
            'kcb',
            'equity bank',
            'equity bank kenya',
            'equity bank machakos',
            'equity bank limited',
          ];
          const legacyAccs = ['1102983746', '0123456789012'];
          const legacyBranches = ['mariakani branch', 'machakos branch', 'machakos main branch', 'machakos'];
          const legacyHolders = ['hotel damview enterprises ltd', 'hotel damview ltd', 'hotel damview'];

          const bankNameLower = (parsed.bankName || '').toLowerCase().trim();
          const accNoTrim = (parsed.accountNumber || '').trim();
          const branchLower = (parsed.bankBranch || '').toLowerCase().trim();
          const holderLower = (parsed.accountHolder || '').toLowerCase().trim();

          if (
            legacyBanks.includes(bankNameLower) ||
            legacyAccs.includes(accNoTrim) ||
            (branchLower && legacyBranches.includes(branchLower)) ||
            (holderLower && legacyHolders.includes(holderLower))
          ) {
            parsed.bankName = '';
            parsed.bankBranch = '';
            parsed.accountHolder = '';
            parsed.accountNumber = '';
            if (parsed.mpesaTillNumber === '5432100') parsed.mpesaTillNumber = '';
          }
          try {
            localStorage.setItem('damview_profile', JSON.stringify(parsed));
          } catch {}
          return parsed;
        }
      } catch {}
    }
    return DEFAULT_HOTEL_PROFILE;
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [documents, setDocuments] = useState<BillingDocument[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [statements, setStatements] = useState<StatementRecord[]>([]);
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState(false);

  // Active document being created or edited
  const [editingDoc, setEditingDocState] = useState<BillingDocument | null>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = localStorage.getItem('damview_active_editing_doc');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return null;
  });

  const setEditingDoc = (doc: BillingDocument | null) => {
    setEditingDocState(doc);
    try {
      if (doc) {
        localStorage.setItem('damview_active_editing_doc', JSON.stringify(doc));
      } else {
        localStorage.removeItem('damview_active_editing_doc');
      }
    } catch {}
  };

  const [docModuleSubTab, setDocModuleSubTabState] = useState<'new' | 'journal'>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('damview_doc_subtab');
      if (saved === 'new' || saved === 'journal') return saved;
    }
    return 'journal';
  });

  const setDocModuleSubTab = (tab: 'new' | 'journal') => {
    setDocModuleSubTabState(tab);
    try {
      localStorage.setItem('damview_doc_subtab', tab);
    } catch {}
  };

  const [docModuleKey, setDocModuleKey] = useState(0);

  // Collapsible sidebar state (persists in localStorage)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('damview_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  // Mobile drawer open state
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Command palette spotlight search state
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Google Apps Script Auto-Update Notification Banner State
  const [gasUpdateNotification, setGasUpdateNotification] = useState<string | null>(null);

  // Payment Modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentModalDoc, setPaymentModalDoc] = useState<BillingDocument | null>(null);
  const [paymentModalClientId, setPaymentModalClientId] = useState<string | undefined>(undefined);

  // Global Parity Modal triggerable from notification actions across any module
  const [globalParityDoc, setGlobalParityDoc] = useState<BillingDocument | null>(null);
  const [isGlobalParityOpen, setIsGlobalParityOpen] = useState(false);
  const [globalParityTargetDocNum, setGlobalParityTargetDocNum] = useState<string | null>(null);

  // Statement client filter state
  const [statementClientId, setStatementClientId] = useState<string | undefined>(undefined);

  // App-Wide Sync Warning Notification State across ALL active modules
  const [syncWarningNotification, setSyncWarningNotification] = useState<{
    id: string;
    title: string;
    message: string;
    type: 'warning' | 'error' | 'info';
    timestamp: string;
  } | null>(null);

  // Toggle sidebar collapse
  const handleToggleCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('damview_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Load all initial data from IndexedDB
  const refreshData = useCallback(async () => {
    try {
      const [p, c, d, pay, stmts, q] = await Promise.all([
        dbService.getHotelProfile(),
        dbService.getClients(),
        dbService.getDocuments(),
        dbService.getPayments(),
        dbService.getStatements(),
        dbService.getSyncQueue(),
      ]);
      setProfile(p);
      setClients(c);
      setDocuments(d);
      setPayments(pay);
      setStatements(stmts);
      setSyncQueue(q);
    } catch (err) {
      console.error('Failed to load local data:', err);
    }
  }, []);

  // Safe Auto-Refresh Guard: prevents refreshing state if user is actively typing or editing a document/modal
  const isUserInteracting = useCallback(() => {
    if (editingDoc !== null || isPaymentModalOpen || isCommandPaletteOpen || isGlobalParityOpen) {
      return true;
    }
    if (typeof document !== 'undefined' && document.activeElement) {
      const tag = document.activeElement.tagName.toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (document.activeElement as HTMLElement).isContentEditable) {
        return true;
      }
    }
    return false;
  }, [editingDoc, isPaymentModalOpen, isCommandPaletteOpen, isGlobalParityOpen]);

  const safeRefreshData = useCallback(() => {
    if (!isUserInteracting()) {
      refreshData();
    }
  }, [isUserInteracting, refreshData]);

  useEffect(() => {
    refreshData();

    // Subscribe to real-time sync manager state updates
    const unsubscribeSync = syncManager.subscribe((syncState) => {
      setIsOnline(syncState.isOnline);
      setIsSyncing(syncState.isSyncing);
    });

    // Listen for remote real-time data changes, sync completions, and renumbering notices
    const handleRemoteDataChanged = () => {
      safeRefreshData();
      // Auto-clear resolved sync warning banners upon successful sync completion
      setSyncWarningNotification(null);
    };

    // Listen for sync queue item failure warnings globally across ALL modules
    const handleSyncWarning = (e: any) => {
      const detail = e.detail;
      if (detail && detail.errorMsg) {
        const isTransient =
          detail.errorMsg.includes('System busy') ||
          detail.errorMsg.includes('busy processing') ||
          detail.errorMsg.includes('timed out') ||
          detail.errorMsg.includes('Network timeout') ||
          detail.errorMsg.includes('AbortError');

        // Suppress transient lock busy & timeout notices from floating banners
        if (isTransient) {
          return;
        }

        let userFriendly = detail.errorMsg;
        if (detail.errorMsg.includes('HTML page instead of JSON')) {
          userFriendly = 'Google Apps Script returned an HTML page. Ensure Web App deployment is set to "Execute as: Me" and "Who has access: Anyone".';
        } else if (detail.errorMsg.includes('404')) {
          userFriendly = 'Google Web App URL returned HTTP 404 (Not Found). Verify Web App URL in Hotel Settings > Google Workspace Sync.';
        }

        const warnId = 'warn-' + Date.now();
        setSyncWarningNotification({
          id: warnId,
          title: 'Sync Notice',
          message: userFriendly,
          type: detail.errorMsg.includes('HTML page') || detail.errorMsg.includes('404') ? 'error' : 'warning',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        });

        // Auto-close warning banner after viewing
        setTimeout(() => {
          setSyncWarningNotification((curr) => (curr?.id === warnId ? null : curr));
        }, 12000);
      }
    };

    const handleNavigateModule = (e: any) => {
      const targetMod = e?.detail;
      if (targetMod) {
        setCurrentModule(targetMod);
      }
    };

    window.addEventListener('damview:data-changed', handleRemoteDataChanged);
    window.addEventListener('damview-sync-completed', handleRemoteDataChanged);
    window.addEventListener('damview-renumbered', handleRemoteDataChanged);
    window.addEventListener('damview:sync-warning', handleSyncWarning);
    window.addEventListener('damview:navigate-module', handleNavigateModule);

    // Sync when tab receives focus to catch changes from other devices immediately
    const handleWindowFocus = () => {
      syncManager.syncBidirectional().catch(() => {});
      safeRefreshData();
    };
    window.addEventListener('focus', handleWindowFocus);

    // Global keyboard shortcut listener (Cmd/Ctrl + K or / to open Command Palette)
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);

    // Global listener for opening Document Propagation Parity Validator from notifications or triggers
    const handleOpenParityValidator = (e: Event) => {
      const customEvent = e as CustomEvent<{ documentNumber?: string }>;
      const targetDocNum = customEvent.detail?.documentNumber || null;
      setGlobalParityTargetDocNum(targetDocNum);
      if (targetDocNum) {
        dbService.getDocuments().then((allDocs) => {
          const found = allDocs.find(
            (d) => (d.documentNumber || '').trim().toLowerCase() === targetDocNum.trim().toLowerCase()
          );
          setGlobalParityDoc(found || null);
          setIsGlobalParityOpen(true);
        });
      } else {
        setGlobalParityDoc(null);
        setIsGlobalParityOpen(true);
      }
    };

    const handleOpenAppsScriptDiff = () => {
      setCurrentModule('settings');
    };

    window.addEventListener('damview:open-parity-validator', handleOpenParityValidator);
    window.addEventListener('damview:open-apps-script-diff', handleOpenAppsScriptDiff);

    // Auto-detect and notify if Google Apps Script in-app code or schemas are updated
    const CURRENT_GAS_VERSION = GOOGLE_APPS_SCRIPT_VERSION;
    try {
      const storedGasVer = localStorage.getItem('damview_last_gas_version');
      if (storedGasVer !== CURRENT_GAS_VERSION) {
        setGasUpdateNotification(
          `Google Apps Script backend engine updated to ${CURRENT_GAS_VERSION} with dynamic header mapping across all 15 operational ERP sheets.`
        );
        localStorage.setItem('damview_last_gas_version', CURRENT_GAS_VERSION);

        // Auto-close banner after viewing (9 seconds)
        setTimeout(() => {
          setGasUpdateNotification(null);
        }, 9000);
      }
    } catch {}

    // Initial immediate sync & start 3-second real-time auto-sync background loop
    syncManager.syncBidirectional().catch(() => {});
    syncManager.startAutoSync(3);

    // Non-disruptive background local refresh interval (auto-refreshes state safely without interrupting active form inputs)
    const interval = setInterval(() => {
      safeRefreshData();
    }, 12000);

    return () => {
      unsubscribeSync();
      window.removeEventListener('damview:data-changed', handleRemoteDataChanged);
      window.removeEventListener('damview-sync-completed', handleRemoteDataChanged);
      window.removeEventListener('damview-renumbered', handleRemoteDataChanged);
      window.removeEventListener('damview:sync-warning', handleSyncWarning);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('damview:open-parity-validator', handleOpenParityValidator);
      window.removeEventListener('damview:open-apps-script-diff', handleOpenAppsScriptDiff);
      syncManager.stopAutoSync();
      clearInterval(interval);
    };
  }, [refreshData, safeRefreshData]);

  // Handle manual sync trigger
  const handleTriggerSync = async () => {
    setIsSyncing(true);
    try {
      await syncManager.syncBidirectional();
      await refreshData();

      // Automated Local Workbook Sync trigger
      if (localStorage.getItem('damview_excel_auto_sync') !== 'false') {
        try {
          const handle = await getSavedDirectoryHandle();
          if (handle) {
            const buf = await generateMasterSuiteWorkbook({
              profile,
              clients,
              documents,
              payments,
              statements,
            });
            await saveWorkbookToLocalArchive(buf, WORKBOOK_FILENAME);
          }
        } catch (e) {
          console.warn('Auto Excel sync update skipped:', e);
        }
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Document Editor navigation triggers (Zero-friction deep action routing)
  const handleOpenNewDocument = (type: DocumentType = 'INVOICE') => {
    setEditingDoc(null);
    setDocModuleSubTab('new');
    setDocModuleKey((prev) => prev + 1);
    if (type === 'QUOTATION') setCurrentModule('quotations');
    else if (type === 'PROFORMA') setCurrentModule('proformas');
    else setCurrentModule('invoices');
  };

  const handleEditDocument = (doc: BillingDocument) => {
    setEditingDoc(doc);
    setDocModuleSubTab('new');
    setDocModuleKey((prev) => prev + 1);
    if (doc.documentType === 'QUOTATION') setCurrentModule('quotations');
    else if (doc.documentType === 'PROFORMA') setCurrentModule('proformas');
    else setCurrentModule('invoices');
  };

  // Convert Document Lifecycle
  const handleConvertDocument = async (sourceDoc: BillingDocument, targetType: DocumentType) => {
    const nextNum = await dbService.getNextDocumentNumber(targetType);
    const converted: BillingDocument = {
      ...sourceDoc,
      id: 'doc-conv-' + Date.now(),
      documentType: targetType,
      documentNumber: nextNum,
      relatedDocNumber: sourceDoc.documentNumber,
      relatedDocId: sourceDoc.id,
      status: 'Draft',
      amountPaid: 0,
      balanceDue: sourceDoc.grandTotal,
      issueDate: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };
    setEditingDoc(converted);
    setDocModuleSubTab('new');
    setDocModuleKey((prev) => prev + 1);
    if (targetType === 'QUOTATION') setCurrentModule('quotations');
    else if (targetType === 'PROFORMA') setCurrentModule('proformas');
    else setCurrentModule('invoices');
  };

  const handleConvertFolioToInvoice = async (docData: Partial<BillingDocument>) => {
    const nextNum = await dbService.getNextDocumentNumber('INVOICE');
    const fullDoc: BillingDocument = {
      id: 'doc-inv-' + Date.now(),
      documentType: 'INVOICE',
      documentNumber: nextNum,
      clientId: docData.clientId || 'cli-001',
      clientName: docData.clientName || 'Valued Guest',
      clientKraPin: docData.clientKraPin || '',
      clientAddress: docData.clientAddress || profile.physicalLocation,
      clientPhone: docData.clientPhone || '',
      clientEmail: docData.clientEmail || '',
      issueDate: docData.issueDate || new Date().toISOString().split('T')[0],
      validityDays: docData.validityDays || 14,
      dueDate: docData.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      lineItems: docData.lineItems || [],
      subtotal: docData.subtotal || 0,
      vatAmount: docData.vatAmount || 0,
      grandTotal: docData.grandTotal || 0,
      amountPaid: docData.amountPaid || 0,
      balanceDue: docData.balanceDue || 0,
      status: (docData.status as any) || 'Draft',
      notes: docData.notes || '',
      terms: docData.terms || '',
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };
    setEditingDoc(fullDoc);
    setDocModuleSubTab('new');
    setDocModuleKey((prev) => prev + 1);
    setCurrentModule('invoices');
  };

  const handleSaveDocument = async (doc: BillingDocument) => {
    // Optimistic local state update (0ms perceived latency)
    setDocuments((prev) => {
      const idx = prev.findIndex((d) => d.id === doc.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = doc;
        return next;
      }
      return [doc, ...prev];
    });
    setEditingDoc(null);

    // Immediate local persistence & asynchronous cloud sync
    try {
      await syncManager.syncDocument(doc);
      // Trigger bidirectional sync
      syncManager.syncBidirectional().catch((syncErr) => {
        logSystemIncident('WARNING', `Background sync after save document failed: ${syncErr.message}`);
      });
    } catch (err: any) {
      logSystemIncident('ERROR', `Failed saving document to DB: ${err.message}`);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    const target = documents.find((d) => d.id === docId);
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
    if (editingDoc?.id === docId) {
      setEditingDoc(null);
    }
    try {
      await syncManager.cascadeDeleteDocument(docId, target?.documentNumber || '');
      syncManager.syncBidirectional().catch(() => {});
    } catch (err: any) {
      logSystemIncident('ERROR', `Failed deleting document from DB: ${err.message}`);
    }
  };

  // Payment Recording modal triggers
  const handleOpenPaymentModal = (doc?: BillingDocument) => {
    setPaymentModalDoc(doc || null);
    setPaymentModalClientId(doc?.clientId);
    setIsPaymentModalOpen(true);
  };

  const handleSavePayment = async (payment: PaymentRecord) => {
    setIsPaymentModalOpen(false);
    setPaymentModalDoc(null);

    // Optimistic payment update
    setPayments((prev) => [payment, ...prev]);

    try {
      await syncManager.syncPayment(payment);
      syncManager.syncBidirectional().catch(() => {});
      // Refresh documents to reflect updated payment balances
      dbService.getDocuments().then(setDocuments);
    } catch (err: any) {
      logSystemIncident('ERROR', `Failed saving payment: ${err.message}`);
    }
  };

  const handleDeletePayment = async (paymentId: string, skipConfirm = false) => {
    if (!skipConfirm && !confirm('Are you sure you want to delete this payment record? The related invoice balance will be adjusted.')) return;
    const target = payments.find((p) => p.id === paymentId);
    setPayments((prev) => prev.filter((p) => p.id !== paymentId));
    try {
      await syncManager.cascadeDeletePayment(paymentId, target?.receiptNumber || '', target?.documentNumber);
      syncManager.syncBidirectional().catch(() => {});
      dbService.getDocuments().then(setDocuments);
    } catch (err: any) {
      logSystemIncident('ERROR', `Failed deleting payment: ${err.message}`);
    }
  };

  // Client Management Handlers
  const handleSaveClient = async (client: Client) => {
    // Instant optimistic commit in-memory
    setClients((prev) => {
      const idx = prev.findIndex((c) => c.id === client.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = client;
        return next;
      }
      return [client, ...prev];
    });
    try {
      await syncManager.syncClient(client);
      syncManager.syncBidirectional().catch(() => {});
    } catch (err: any) {
      logSystemIncident('ERROR', `Failed saving client: ${err.message}`);
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    if (!confirm('Are you sure you want to delete this client? Documents associated with them will remain in records.')) return;
    setClients((prev) => prev.filter((c) => c.id !== clientId));
    try {
      await syncManager.cascadeDeleteClient(clientId);
      syncManager.syncBidirectional().catch(() => {});
    } catch (err: any) {
      logSystemIncident('ERROR', `Failed deleting client: ${err.message}`);
    }
  };

  const handleViewClientLedger = (clientId: string) => {
    setStatementClientId(clientId);
    setCurrentModule('statements');
  };

  const handleNewDocForClient = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;

    dbService.getNextDocumentNumber('INVOICE').then((nextDocNo) => {
      const newDoc: BillingDocument = {
        id: 'doc-' + Date.now(),
        documentType: 'INVOICE',
        documentNumber: nextDocNo,
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        validityDays: 14,
        status: 'Draft',
        clientId: client.id,
        clientName: client.name,
        clientAddress: client.address || '',
        clientPhone: client.phone || '',
        clientEmail: client.email || '',
        clientKraPin: client.kraPin || '',
        lineItems: [
          {
            id: 'item-1',
            particulars: '',
            quantity: 1,
            days: 1,
            rate: 0,
            amount: 0,
          },
        ],
        subtotal: 0,
        discount: 0,
        vatAmount: 0,
        grandTotal: 0,
        amountPaid: 0,
        balanceDue: 0,
        notes: '',
        terms: '',
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
      };
      setEditingDoc(newDoc);
      setCurrentModule('invoices');
    });
  };

  // Handler for 1-click auto-repairing /dev or invalid Google Web App URLs
  const handleAutoFixWebAppUrl = async () => {
    let url = profile.googleWebAppUrl || '';
    if (url.includes('/dev')) {
      url = url.replace(/\/dev(\/|\?|$)/, '/exec$1');
      const updated = { ...profile, googleWebAppUrl: url };
      setProfile(updated);
      await dbService.saveHotelProfile(updated);
      setSyncWarningNotification(null);
      await handleTriggerSync();
    } else {
      setCurrentModule('settings');
      setSyncWarningNotification(null);
    }
  };
  const handleSaveProfile = async (newProfile: HotelProfile) => {
    setProfile(newProfile);
    await dbService.saveHotelProfile(newProfile);
    await syncManager.syncProfile(newProfile);
  };

  // Summary counts for navigation badges
  const quotationsCount = useMemo(() => {
    return documents.filter((d) => d.documentType === 'QUOTATION' && d.status !== 'Paid').length;
  }, [documents]);

  const proformasCount = useMemo(() => {
    return documents.filter((d) => d.documentType === 'PROFORMA').length;
  }, [documents]);

  const unpaidInvoices = useMemo(() => {
    return documents.filter(
      (d) => d.documentType === 'INVOICE' && (d.balanceDue || 0) > 0
    );
  }, [documents]);

  const unpaidInvoicesCount = unpaidInvoices.length;

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const hasOverdueInvoices = useMemo(() => {
    return unpaidInvoices.some((d) => d.dueDate < todayStr);
  }, [unpaidInvoices, todayStr]);

  return (
    <div className="flex h-screen bg-stone-950 text-stone-100 font-sans overflow-hidden antialiased selection:bg-amber-500 selection:text-stone-950">
      {/* 1. COLLAPSIBLE PERSISTENT / AMBIENT SIDEBAR */}
      <Sidebar
        currentModule={currentModule}
        onSelectModule={(mod) => {
          setCurrentModule(mod);
          setEditingDoc(null);
          setDocModuleSubTab('journal');
        }}
        profile={profile}
        isOnline={isOnline}
        isSyncing={isSyncing}
        pendingSyncCount={syncQueue.length}
        onTriggerSync={handleTriggerSync}
        onQuickNewDoc={() => handleOpenNewDocument('INVOICE')}
        onNewQuotation={() => handleOpenNewDocument('QUOTATION')}
        onNewProforma={() => handleOpenNewDocument('PROFORMA')}
        onNewInvoice={() => handleOpenNewDocument('INVOICE')}
        onRecordPayment={() => handleOpenPaymentModal()}
        onOpenSearch={() => setIsCommandPaletteOpen(true)}
        quotationsCount={quotationsCount}
        proformasCount={proformasCount}
        unpaidInvoicesCount={unpaidInvoicesCount}
        hasOverdueInvoices={hasOverdueInvoices}
        clientsCount={clients.length}
        receiptsCount={payments.length}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleCollapse}
        isMobileOpen={isMobileOpen}
        onToggleMobile={() => setIsMobileOpen(!isMobileOpen)}
      />

      {/* 2. MAIN APPLICATION CONTENT VIEWPORT */}
      <div className="flex-1 flex flex-col min-w-0 h-[100dvh] overflow-hidden">
        {/* Mobile Top App Bar (< lg screens) */}
        <header className="lg:hidden no-print bg-stone-900 text-white px-4 py-3 flex items-center justify-between border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsMobileOpen(true)}
              className="p-1.5 rounded text-stone-300 hover:text-white hover:bg-stone-800 cursor-pointer"
              title="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div
              className="flex items-center gap-2 cursor-pointer min-w-0"
              onClick={() => setCurrentModule('dashboard')}
            >
              <HotelLogo logoBase64={profile.logoBase64} size={28} />
              <div className="min-w-0">
                <span className="font-bold text-xs uppercase tracking-wider text-amber-400 font-serif truncate block max-w-[130px]">
                  {profile.name || 'HOTEL DAMVIEW'}
                </span>
                <span className="text-[9px] text-stone-400 truncate block max-w-[130px]">
                  {profile.physicalLocation || profile.postalAddress || 'Machakos'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Spotlight Search Icon Button */}
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              className="p-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white rounded-md border border-stone-700 cursor-pointer"
              title="Search ERP (Cmd+K)"
            >
              <Search className="w-3.5 h-3.5 text-amber-400" />
            </button>

            <div
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1 border ${
                isOnline
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                  : 'bg-rose-950/80 text-rose-300 border-rose-800'
              }`}
            >
              {isOnline ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </div>
          </div>
        </header>

        {/* Global Offline Status & IndexedDB Local Vault Banner */}
        <OfflineBanner isOnline={isOnline} pendingSyncCount={syncQueue.length} />

        {/* Google Apps Script Auto-Update Notification Banner */}
        {gasUpdateNotification && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between text-xs text-amber-200 animate-fade-in shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{gasUpdateNotification}</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setCurrentModule('settings');
                  setGasUpdateNotification(null);
                }}
                className="font-bold underline text-amber-400 hover:text-amber-300 cursor-pointer"
              >
                View in Settings
              </button>
              <button
                type="button"
                onClick={() => setGasUpdateNotification(null)}
                className="text-stone-400 hover:text-stone-200 p-0.5 cursor-pointer"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Global Sync Queue Warning / Error Notification Banner (App-Wide across ALL active modules) */}
        {syncWarningNotification && (
          <div className={`px-4 py-2.5 flex items-center justify-between text-xs border-b animate-fade-in shrink-0 ${
            syncWarningNotification.type === 'error'
              ? 'bg-rose-950/80 border-rose-500/40 text-rose-200'
              : 'bg-amber-950/80 border-amber-500/40 text-amber-200'
          }`}>
            <div className="flex items-center gap-2 min-w-0 pr-2">
              {syncWarningNotification.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <div className="truncate">
                <span className="font-bold mr-1.5">{syncWarningNotification.title}:</span>
                <span className="opacity-90">{syncWarningNotification.message}</span>
                <span className="ml-2 text-[10px] opacity-60">({syncWarningNotification.timestamp})</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {(syncWarningNotification.message.includes('HTML page') ||
                syncWarningNotification.message.includes('Execute as') ||
                (profile.googleWebAppUrl && profile.googleWebAppUrl.includes('/dev'))) && (
                <button
                  type="button"
                  onClick={handleAutoFixWebAppUrl}
                  className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold transition cursor-pointer text-[11px] flex items-center gap-1 shadow-2xs"
                  title="Auto-repair /dev Web App URL or view deployment guidance in Settings"
                >
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  <span>Fix Web App URL</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setCurrentModule('sync');
                  setSyncWarningNotification(null);
                }}
                className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 font-medium transition cursor-pointer text-[11px]"
              >
                Sync Control
              </button>
              <button
                type="button"
                onClick={() => {
                  handleTriggerSync();
                  setSyncWarningNotification(null);
                }}
                className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold transition cursor-pointer text-[11px]"
              >
                Retry Now
              </button>
              <button
                type="button"
                onClick={() => setSyncWarningNotification(null)}
                className="text-stone-400 hover:text-stone-200 p-1 cursor-pointer"
                aria-label="Dismiss warning"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Route Modules */}
        <main className="flex-1 overflow-y-auto min-w-0 relative">
          {/* Dashboard Module */}
          {currentModule === 'dashboard' && (
            <Dashboard
              documents={documents}
              clients={clients}
              payments={payments}
              profile={profile}
              onNavigateToNewDoc={handleOpenNewDocument}
              onNavigateToClients={() => setCurrentModule('clients')}
              onNavigateToJournal={() => {
                setDocModuleSubTab('journal');
                setCurrentModule('invoices');
              }}
              onNavigateToStatement={() => setCurrentModule('statements')}
              onRecordPayment={() => handleOpenPaymentModal()}
              onOpenParityValidator={() => {
                setGlobalParityDoc(null);
                setGlobalParityTargetDocNum(null);
                setIsGlobalParityOpen(true);
              }}
              onEditDocument={handleEditDocument}
            />
          )}

          {/* Room & Hall Folios / Reservations Module */}
          {currentModule === 'reservations' && (
            <div className="p-6 max-w-7xl mx-auto">
              <ReservationsManager
                profile={profile}
                clients={clients}
                onConvertToInvoice={handleConvertFolioToInvoice}
                onShowPaymentModal={handleOpenPaymentModal}
              />
            </div>
          )}

          {/* Restaurant & Bar POS Quick-Billing Module */}
          {currentModule === 'pos' && (
            <div className="p-6 max-w-7xl mx-auto">
              <RestaurantPOS
                profile={profile}
                clients={clients}
                onConvertToInvoice={handleConvertFolioToInvoice}
              />
            </div>
          )}

          {/* Quotations Module */}
          {currentModule === 'quotations' && (
            <DocumentModule
              key={`quotations-${docModuleKey}`}
              moduleType="QUOTATION"
              documents={documents}
              clients={clients}
              profile={profile}
              editingDocument={editingDoc}
              initialSubTab={docModuleSubTab}
              onSaveDocument={handleSaveDocument}
              onDeleteDocument={handleDeleteDocument}
              onRecordPayment={handleOpenPaymentModal}
              onConvertDocument={handleConvertDocument}
              onStartNewDocument={() => handleOpenNewDocument('QUOTATION')}
              onStartEditDocument={handleEditDocument}
              onCancelEditor={() => {
                setEditingDoc(null);
                setDocModuleSubTab('journal');
              }}
              onAddNewClient={() => setCurrentModule('clients')}
            />
          )}

          {/* Proforma Invoices Module */}
          {currentModule === 'proformas' && (
            <DocumentModule
              key={`proformas-${docModuleKey}`}
              moduleType="PROFORMA"
              documents={documents}
              clients={clients}
              profile={profile}
              editingDocument={editingDoc}
              initialSubTab={docModuleSubTab}
              onSaveDocument={handleSaveDocument}
              onDeleteDocument={handleDeleteDocument}
              onRecordPayment={handleOpenPaymentModal}
              onConvertDocument={handleConvertDocument}
              onStartNewDocument={() => handleOpenNewDocument('PROFORMA')}
              onStartEditDocument={handleEditDocument}
              onCancelEditor={() => {
                setEditingDoc(null);
                setDocModuleSubTab('journal');
              }}
              onAddNewClient={() => setCurrentModule('clients')}
            />
          )}

          {/* Tax Invoices Module */}
          {currentModule === 'invoices' && (
            <DocumentModule
              key={`invoices-${docModuleKey}`}
              moduleType="INVOICE"
              documents={documents}
              clients={clients}
              profile={profile}
              editingDocument={editingDoc}
              initialSubTab={docModuleSubTab}
              onSaveDocument={handleSaveDocument}
              onDeleteDocument={handleDeleteDocument}
              onRecordPayment={handleOpenPaymentModal}
              onConvertDocument={handleConvertDocument}
              onStartNewDocument={() => handleOpenNewDocument('INVOICE')}
              onStartEditDocument={handleEditDocument}
              onCancelEditor={() => {
                setEditingDoc(null);
                setDocModuleSubTab('journal');
              }}
              onAddNewClient={() => setCurrentModule('clients')}
            />
          )}

          {/* Payment Receipts Manager */}
          {currentModule === 'receipts' && (
            <ReceiptsManager
              payments={payments}
              documents={documents}
              clients={clients}
              profile={profile}
              onRecordNewPayment={() => handleOpenPaymentModal()}
              onViewDocument={(docId) => {
                const doc = documents.find((d) => d.id === docId);
                if (doc) {
                  handleEditDocument(doc);
                }
              }}
              onDeletePayment={async (payment) => {
                await handleDeletePayment(payment.id, true);
              }}
            />
          )}

          {/* Statement of Accounts Module */}
          {currentModule === 'statements' && (
            <StatementOfAccount
              clients={clients}
              documents={documents}
              payments={payments}
              profile={profile}
              initialClientId={statementClientId}
              onEditDocument={handleEditDocument}
              onConvertDocument={handleConvertDocument}
              onRecordPayment={(clientId, doc) => handleOpenPaymentModal(doc)}
              onNewDocumentForClient={(clientId) => handleNewDocForClient(clientId)}
            />
          )}

          {/* Night Audit & Financial Analytics Module */}
          {currentModule === 'nightaudit' && (
            <div className="p-6 max-w-7xl mx-auto">
              <NightAuditReports
                documents={documents}
                payments={payments}
                clients={clients}
                profile={profile}
              />
            </div>
          )}

          {/* Google Drive Document Vault Module */}
          {currentModule === 'vault' && (
            <div className="p-6 max-w-7xl mx-auto">
              <DriveVault
                documents={documents}
                payments={payments}
                statements={statements}
                profile={profile}
                onViewDocument={handleEditDocument}
                onSyncToDrive={handleTriggerSync}
                isSyncing={isSyncing}
              />
            </div>
          )}

          {/* Clients Directory Module */}
          {currentModule === 'clients' && (
            <ClientsManager
              clients={clients}
              onSaveClient={handleSaveClient}
              onDeleteClient={handleDeleteClient}
              onViewLedger={handleViewClientLedger}
              onNewDocForClient={handleNewDocForClient}
            />
          )}

          {/* Google Sync & Centralized Worksheet Control Module */}
          {currentModule === 'sync' && (
            <GoogleSyncModule
              profile={profile}
              isOnline={isOnline}
              onUpdateProfile={handleSaveProfile}
              onNavigateToDocument={(doc) => {
                handleEditDocument(doc);
                if (doc.documentType === 'INVOICE') setCurrentModule('invoices');
                else if (doc.documentType === 'QUOTATION') setCurrentModule('quotations');
                else setCurrentModule('proformas');
              }}
            />
          )}

          {/* Excel Master Suite (.xlsm) Workstation Module */}
          {currentModule === 'excel' && (
            <div className="p-6 max-w-7xl mx-auto">
              <ExcelWorkstationModule
                profile={profile}
                clients={clients}
                documents={documents}
                payments={payments}
                statements={statements}
                onTriggerSync={handleTriggerSync}
              />
            </div>
          )}

          {/* Hotel Settings & Sync Module */}
          {currentModule === 'settings' && (
            <HotelSettings
              profile={profile}
              syncQueue={syncQueue}
              onSaveProfile={handleSaveProfile}
              onTriggerSync={handleTriggerSync}
            />
          )}
        </main>
      </div>

      {/* Global Command Palette (Cmd/Ctrl + K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        documents={documents}
        clients={clients}
        payments={payments}
        onSelectDocument={(doc) => {
          handleEditDocument(doc);
        }}
        onSelectClient={(clientId) => {
          handleViewClientLedger(clientId);
        }}
        onNavigateToNewDoc={(type) => {
          handleOpenNewDocument(type);
        }}
        onNavigateToModule={(mod) => {
          setCurrentModule(mod);
        }}
        onTriggerSync={handleTriggerSync}
        onOpenPaymentModal={handleOpenPaymentModal}
      />

      {/* Payment Settlement Modal (Global Access) */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        document={paymentModalDoc}
        clients={clients}
        profile={profile}
        initialClientId={paymentModalClientId}
        onClose={() => setIsPaymentModalOpen(false)}
        onSavePayment={handleSavePayment}
      />

      {/* Centralized Process & Trigger Notification Toasts */}
      <AppNotificationToaster />

      {/* Global Document Propagation Parity Validator Modal (triggerable via notification actions & triggers) */}
      <DocumentPropagationParityModal
        document={globalParityDoc}
        targetDocumentNumber={globalParityTargetDocNum}
        isOpen={isGlobalParityOpen || !!globalParityDoc}
        onClose={() => {
          setIsGlobalParityOpen(false);
          setGlobalParityDoc(null);
          setGlobalParityTargetDocNum(null);
        }}
        onRefreshDocument={(updated) => {
          handleSaveDocument(updated);
        }}
        onRefreshAllDocuments={(updatedDocs) => {
          setDocuments((prev) => {
            const updatedMap = new Map(updatedDocs.map((d) => [d.id, d]));
            return prev.map((doc) => updatedMap.get(doc.id) || doc);
          });
          refreshData();
        }}
      />

      {/* PWA Service Worker Registration & Cache Reload Prompt */}
      <PWAReloadPrompt />
    </div>
  );
}
