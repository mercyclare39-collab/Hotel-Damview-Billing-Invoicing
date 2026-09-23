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
import { Menu, Wifi, WifiOff, Plus, RefreshCw, Search } from 'lucide-react';
import { HotelLogo } from './components/HotelLogo';
import { OfflineBanner } from './components/OfflineBanner';
import { PWAReloadPrompt } from './components/PWAReloadPrompt';
import { logSystemIncident } from './services/selfHealingPatch';
import { StatementRecord } from './types';

export default function App() {
  const [currentModule, setCurrentModule] = useState<MainNavModule>('dashboard');
  const [profile, setProfile] = useState<HotelProfile>(DEFAULT_HOTEL_PROFILE);
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
  const [editingDoc, setEditingDoc] = useState<BillingDocument | null>(null);
  const [docModuleSubTab, setDocModuleSubTab] = useState<'new' | 'journal'>('journal');
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

  // Payment Modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentModalDoc, setPaymentModalDoc] = useState<BillingDocument | null>(null);
  const [paymentModalClientId, setPaymentModalClientId] = useState<string | undefined>(undefined);

  // Statement client filter state
  const [statementClientId, setStatementClientId] = useState<string | undefined>(undefined);

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

  useEffect(() => {
    refreshData();

    // Subscribe to real-time sync manager state updates
    const unsubscribeSync = syncManager.subscribe((syncState) => {
      setIsOnline(syncState.isOnline);
      setIsSyncing(syncState.isSyncing);
    });

    // Listen for remote real-time data changes pulled from Google Sheets
    const handleRemoteDataChanged = () => {
      refreshData();
    };

    window.addEventListener('damview:data-changed', handleRemoteDataChanged);

    // Global keyboard shortcut listener (Cmd/Ctrl + K or / to open Command Palette)
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);

    // Start 5-second real-time auto-sync background loop
    syncManager.startAutoSync(5);

    // Periodic local refresh as safety fallback
    const interval = setInterval(() => {
      refreshData();
    }, 10000);

    return () => {
      unsubscribeSync();
      window.removeEventListener('damview:data-changed', handleRemoteDataChanged);
      window.removeEventListener('keydown', handleGlobalKeyDown);
      syncManager.stopAutoSync();
      clearInterval(interval);
    };
  }, [refreshData]);

  // Handle manual sync trigger
  const handleTriggerSync = async () => {
    setIsSyncing(true);
    try {
      await syncManager.syncBidirectional();
      await refreshData();
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
      terms: docData.terms || 'Settlement due upon invoice presentation.',
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

    // Immediate local persistence & asynchronous background cloud sync
    try {
      await dbService.saveDocument(doc);
      // Trigger background sync without blocking UI
      syncManager.syncBidirectional().catch((syncErr) => {
        logSystemIncident('WARNING', `Background sync after save document failed: ${syncErr.message}`);
      });
    } catch (err: any) {
      logSystemIncident('ERROR', `Failed saving document to DB: ${err.message}`);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
    if (editingDoc?.id === docId) {
      setEditingDoc(null);
    }
    try {
      await dbService.deleteDocument(docId);
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
      await dbService.savePayment(payment);
      syncManager.syncBidirectional().catch(() => {});
      // Refresh documents to reflect updated payment balances
      dbService.getDocuments().then(setDocuments);
    } catch (err: any) {
      logSystemIncident('ERROR', `Failed saving payment: ${err.message}`);
    }
  };

  const handleDeletePayment = async (paymentId: string, skipConfirm = false) => {
    if (!skipConfirm && !confirm('Are you sure you want to delete this payment record? The related invoice balance will be adjusted.')) return;
    setPayments((prev) => prev.filter((p) => p.id !== paymentId));
    try {
      await dbService.deletePayment(paymentId);
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
      await dbService.saveClient(client);
      syncManager.syncBidirectional().catch(() => {});
    } catch (err: any) {
      logSystemIncident('ERROR', `Failed saving client: ${err.message}`);
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    if (!confirm('Are you sure you want to delete this client? Documents associated with them will remain in records.')) return;
    setClients((prev) => prev.filter((c) => c.id !== clientId));
    try {
      await dbService.deleteClient(clientId);
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
        terms: 'Payment due within 14 days of invoice issue.',
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
      };
      setEditingDoc(newDoc);
      setCurrentModule('invoices');
    });
  };

  // Hotel Profile Settings Handler
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
              <RestaurantPOS profile={profile} clients={clients} />
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

      {/* PWA Service Worker Registration & Cache Reload Prompt */}
      <PWAReloadPrompt />
    </div>
  );
}
