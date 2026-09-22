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
import { Menu, Wifi, WifiOff, Plus, RefreshCw } from 'lucide-react';
import { HotelLogo } from './components/HotelLogo';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineBanner } from './components/OfflineBanner';
import { PWAReloadPrompt } from './components/PWAReloadPrompt';

export default function App() {
  const [currentModule, setCurrentModule] = useState<MainNavModule>('dashboard');
  const [profile, setProfile] = useState<HotelProfile>(DEFAULT_HOTEL_PROFILE);
  const [clients, setClients] = useState<Client[]>([]);
  const [documents, setDocuments] = useState<BillingDocument[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState(false);

  // Active document being created or edited
  const [editingDoc, setEditingDoc] = useState<BillingDocument | null>(null);

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
      const [p, c, d, pay, q] = await Promise.all([
        dbService.getHotelProfile(),
        dbService.getClients(),
        dbService.getDocuments(),
        dbService.getPayments(),
        dbService.getSyncQueue(),
      ]);
      setProfile(p);
      setClients(c);
      setDocuments(d);
      setPayments(pay);
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

    // Start 5-second real-time auto-sync background loop
    syncManager.startAutoSync(5);

    // Periodic local refresh as safety fallback
    const interval = setInterval(() => {
      refreshData();
    }, 10000);

    return () => {
      unsubscribeSync();
      window.removeEventListener('damview:data-changed', handleRemoteDataChanged);
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

  // Document Editor navigation triggers
  const handleOpenNewDocument = (type: DocumentType = 'INVOICE') => {
    setEditingDoc(null);
    if (type === 'QUOTATION') setCurrentModule('quotations');
    else if (type === 'PROFORMA') setCurrentModule('proformas');
    else setCurrentModule('invoices');
  };

  const handleEditDocument = (doc: BillingDocument) => {
    setEditingDoc(doc);
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
    if (targetType === 'QUOTATION') setCurrentModule('quotations');
    else if (targetType === 'PROFORMA') setCurrentModule('proformas');
    else setCurrentModule('invoices');
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

    // Asynchronous background persistence and sync
    dbService.saveDocument(doc).catch((err) => console.warn('Persistence error:', err));
    syncManager.syncDocument(doc).catch((err) => console.warn('Sync error:', err));
  };

  const handleDeleteDocument = async (docId: string) => {
    const targetDoc = documents.find((d) => d.id === docId);
    
    // Optimistic local state update
    setDocuments((prev) => prev.filter((d) => d.id !== docId));

    dbService.deleteDocument(docId).catch((err) => console.warn('Delete document error:', err));
    if (targetDoc) {
      syncManager.cascadeDeleteDocument(
        targetDoc.id,
        targetDoc.documentNumber,
        profile.googleDriveFolder
      ).catch((err) => console.warn('Cascade delete document sync error:', err));
    }
  };

  // Client Management Handlers
  const handleSaveClient = async (client: Client) => {
    // Optimistic local state update
    setClients((prev) => {
      const idx = prev.findIndex((c) => c.id === client.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = client;
        return next;
      }
      return [client, ...prev];
    });

    dbService.saveClient(client).catch((err) => console.warn('Save client error:', err));
    syncManager.syncClient(client).catch((err) => console.warn('Sync client error:', err));
  };

  const handleDeleteClient = async (clientId: string) => {
    // Optimistic local state update
    setClients((prev) => prev.filter((c) => c.id !== clientId));

    dbService.deleteClient(clientId).catch((err) => console.warn('Delete client error:', err));
    syncManager.cascadeDeleteClient(clientId).catch((err) => console.warn('Cascade delete client sync error:', err));
  };

  const handleViewClientLedger = (clientId: string) => {
    setStatementClientId(clientId);
    setCurrentModule('statements');
  };

  const handleNewDocForClient = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (client) {
      dbService.getNextDocumentNumber('INVOICE').then((docNum) => {
        const newDoc: BillingDocument = {
          id: 'doc-new-' + Date.now(),
          documentType: 'INVOICE',
          documentNumber: docNum,
          clientId: client.id,
          clientName: client.name,
          clientKraPin: client.kraPin,
          clientAddress: client.address,
          clientPhone: client.phone,
          clientEmail: client.email,
          issueDate: new Date().toISOString().split('T')[0],
          validityDays: 14,
          dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
          lineItems: [
            {
              id: 'li-1',
              particulars: 'Executive Suite Accommodation (Full Board)',
              quantity: 1,
              days: 1,
              rate: 9500,
              discount: 0,
              amount: 9500,
            },
          ],
          subtotal: 9500,
          vatAmount: 1520,
          grandTotal: 11020,
          amountPaid: 0,
          balanceDue: 11020,
          status: 'Draft',
          notes: 'Standard check-in 12:00 PM, check-out 10:00 AM.',
          terms: 'Payable via M-Pesa Buy Goods Till 5432100 or KCB Bank.',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setEditingDoc(newDoc);
        setCurrentModule('invoices');
      });
    }
  };

  // Payment Settlement Handlers
  const handleOpenPaymentModal = (doc?: BillingDocument, clientId?: string) => {
    setPaymentModalDoc(doc || null);
    setPaymentModalClientId(clientId);
    setIsPaymentModalOpen(true);
  };

  const handleSavePayment = async (payment: PaymentRecord) => {
    // Optimistic local state update
    setPayments((prev) => [payment, ...prev]);

    // Optimistically update document balance
    if (payment.documentId) {
      setDocuments((prevDocs) =>
        prevDocs.map((doc) => {
          if (doc.id === payment.documentId) {
            const newPaid = Math.round(((doc.amountPaid || 0) + payment.amount) * 100) / 100;
            const newBalance = Math.max(0, Math.round((doc.grandTotal - newPaid) * 100) / 100);
            return {
              ...doc,
              amountPaid: newPaid,
              balanceDue: newBalance,
              status: newBalance <= 0 ? 'Paid' : 'Sent',
            };
          }
          return doc;
        })
      );
    }

    dbService.savePayment(payment).catch((err) => console.warn('Save payment error:', err));
    syncManager.syncPayment(payment).catch((err) => console.warn('Sync payment error:', err));
  };

  const handleDeletePayment = async (
    payment: PaymentRecord,
    options?: { cascadeSheet?: boolean; cascadeDrive?: boolean }
  ) => {
    // Optimistic local state update
    setPayments((prev) => prev.filter((p) => p.id !== payment.id));

    dbService.deletePayment(payment.id).catch((err) => console.warn('Delete payment error:', err));
    if (options?.cascadeSheet !== false) {
      syncManager.cascadeDeletePayment(
        payment.id,
        payment.receiptNumber,
        payment.documentNumber,
        options?.cascadeDrive !== false ? profile.googleDriveFolder : undefined
      ).catch((err) => console.warn('Cascade delete payment sync error:', err));
    }
  };

  // Profile Save
  const handleSaveProfile = async (newProfile: HotelProfile) => {
    setProfile(newProfile);
    dbService.saveHotelProfile(newProfile).catch((err) => console.warn('Save profile error:', err));
  };

  // Live badge counts for persistent sidebar
  const quotationsCount = useMemo(() => {
    return documents.filter((d) => d.documentType === 'QUOTATION' && d.status !== 'Paid').length;
  }, [documents]);

  const proformasCount = useMemo(() => {
    return documents.filter((d) => d.documentType === 'PROFORMA').length;
  }, [documents]);

  const unpaidInvoicesCount = useMemo(() => {
    return documents.filter((d) => d.documentType === 'INVOICE' && (d.balanceDue || 0) > 0).length;
  }, [documents]);

  const hasOverdueInvoices = useMemo(() => {
    return documents.some((d) => d.documentType === 'INVOICE' && d.status === 'Overdue');
  }, [documents]);

  return (
    <div className="flex h-[100dvh] w-screen overflow-hidden bg-slate-100 text-slate-900 antialiased select-auto">
      {/* 1. PERSISTENT COLLAPSIBLE LEFT SIDEBAR */}
      <Sidebar
        currentModule={currentModule}
        onSelectModule={(mod) => {
          setEditingDoc(null);
          setCurrentModule(mod);
        }}
        profile={profile}
        isOnline={isOnline}
        isSyncing={isSyncing}
        pendingSyncCount={syncQueue.length}
        onTriggerSync={handleTriggerSync}
        onQuickNewDoc={() => handleOpenNewDocument('INVOICE')}
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
              className="p-1.5 rounded text-stone-300 hover:text-white hover:bg-stone-800"
              title="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <HotelLogo logoBase64={profile.logoBase64} size={28} />
              <span className="font-bold text-xs uppercase tracking-wider text-amber-400 font-serif">
                {profile.name || 'HOTEL DAMVIEW'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <PWAInstallButton variant="compact" />

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

            <button
              type="button"
              onClick={() => handleOpenNewDocument('INVOICE')}
              className="bg-amber-500 hover:bg-amber-400 text-stone-950 px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1 shadow-xs"
            >
              <Plus className="w-3 h-3 stroke-[3]" />
              <span>New</span>
            </button>
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
              onNavigateToJournal={() => setCurrentModule('invoices')}
              onNavigateToStatement={() => setCurrentModule('statements')}
              onEditDocument={handleEditDocument}
            />
          )}

          {/* Quotations Module (with New Quotation, Journal, Expired/Archived sub-tabs) */}
          {currentModule === 'quotations' && (
            <DocumentModule
              moduleType="QUOTATION"
              documents={documents}
              clients={clients}
              profile={profile}
              editingDocument={editingDoc}
              onSaveDocument={handleSaveDocument}
              onDeleteDocument={handleDeleteDocument}
              onRecordPayment={(doc) => handleOpenPaymentModal(doc)}
              onConvertDocument={handleConvertDocument}
              onStartNewDocument={(type) => {
                setEditingDoc(null);
                handleOpenNewDocument(type);
              }}
              onStartEditDocument={handleEditDocument}
              onCancelEditor={() => setEditingDoc(null)}
              onAddNewClient={() => setCurrentModule('clients')}
            />
          )}

          {/* Proforma Invoices Module (with New Proforma, Journal, Converted sub-tabs) */}
          {currentModule === 'proformas' && (
            <DocumentModule
              moduleType="PROFORMA"
              documents={documents}
              clients={clients}
              profile={profile}
              editingDocument={editingDoc}
              onSaveDocument={handleSaveDocument}
              onDeleteDocument={handleDeleteDocument}
              onRecordPayment={(doc) => handleOpenPaymentModal(doc)}
              onConvertDocument={handleConvertDocument}
              onStartNewDocument={(type) => {
                setEditingDoc(null);
                handleOpenNewDocument(type);
              }}
              onStartEditDocument={handleEditDocument}
              onCancelEditor={() => setEditingDoc(null)}
              onAddNewClient={() => setCurrentModule('clients')}
            />
          )}

          {/* Invoices Module (with New Invoice, Sales Journal, Unpaid/Overdue sub-tabs) */}
          {currentModule === 'invoices' && (
            <DocumentModule
              moduleType="INVOICE"
              documents={documents}
              clients={clients}
              profile={profile}
              editingDocument={editingDoc}
              onSaveDocument={handleSaveDocument}
              onDeleteDocument={handleDeleteDocument}
              onRecordPayment={(doc) => handleOpenPaymentModal(doc)}
              onConvertDocument={handleConvertDocument}
              onStartNewDocument={(type) => {
                setEditingDoc(null);
                handleOpenNewDocument(type);
              }}
              onStartEditDocument={handleEditDocument}
              onCancelEditor={() => setEditingDoc(null)}
              onAddNewClient={() => setCurrentModule('clients')}
            />
          )}

          {/* Payment Receipts Journal Module */}
          {currentModule === 'receipts' && (
            <ReceiptsManager
              payments={payments}
              clients={clients}
              documents={documents}
              profile={profile}
              onRecordNewPayment={() => handleOpenPaymentModal()}
              onDeletePayment={handleDeletePayment}
              onViewDocument={(docId) => {
                const doc = documents.find((d) => d.id === docId);
                if (doc) {
                  handleEditDocument(doc);
                  if (doc.documentType === 'INVOICE') setCurrentModule('invoices');
                  else if (doc.documentType === 'QUOTATION') setCurrentModule('quotations');
                  else setCurrentModule('proformas');
                }
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
              onRecordPayment={(cliId, doc) => handleOpenPaymentModal(doc, cliId)}
              onEditDocument={(doc) => {
                handleEditDocument(doc);
                if (doc.documentType === 'INVOICE') setCurrentModule('invoices');
                else if (doc.documentType === 'QUOTATION') setCurrentModule('quotations');
                else setCurrentModule('proformas');
              }}
              onNewDocumentForClient={(clientId) => handleNewDocForClient(clientId)}
            />
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
