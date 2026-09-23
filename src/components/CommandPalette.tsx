import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  FileText,
  Users,
  Receipt,
  Plus,
  ArrowRight,
  Sparkles,
  X,
  CreditCard,
  Cloud,
  DownloadCloud,
  Layers,
  Building,
} from 'lucide-react';
import { BillingDocument, Client, PaymentRecord, DocumentType } from '../types';
import { formatKsh, formatDate } from '../utils/formatters';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  documents: BillingDocument[];
  clients: Client[];
  payments: PaymentRecord[];
  onSelectDocument: (doc: BillingDocument) => void;
  onSelectClient: (clientId: string) => void;
  onNavigateToNewDoc: (type: DocumentType) => void;
  onNavigateToModule: (module: any) => void;
  onTriggerSync: () => void;
  onOpenPaymentModal: (doc?: BillingDocument) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  documents,
  clients,
  payments,
  onSelectDocument,
  onSelectClient,
  onNavigateToNewDoc,
  onNavigateToModule,
  onTriggerSync,
  onOpenPaymentModal,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Aggregate searchable items
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items: Array<{
      id: string;
      title: string;
      subtitle: string;
      badge: string;
      badgeColor: string;
      category: 'Actions' | 'Documents' | 'Clients' | 'Receipts';
      action: () => void;
    }> = [];

    // 1. Quick Actions (Always visible or filtered)
    const quickActions = [
      {
        id: 'action-new-inv',
        title: 'Create Tax Invoice',
        subtitle: 'Issue a new tax invoice with KRA compliance and line items',
        badge: 'ACTION',
        badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        category: 'Actions' as const,
        action: () => {
          onNavigateToNewDoc('INVOICE');
          onClose();
        },
      },
      {
        id: 'action-new-quote',
        title: 'Create Quotation / Estimate',
        subtitle: 'Draft a price proposal for corporate, conferences or events',
        badge: 'ACTION',
        badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
        category: 'Actions' as const,
        action: () => {
          onNavigateToNewDoc('QUOTATION');
          onClose();
        },
      },
      {
        id: 'action-new-proforma',
        title: 'Create Proforma Invoice',
        subtitle: 'Issue an advance billing voucher before final invoice',
        badge: 'ACTION',
        badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
        category: 'Actions' as const,
        action: () => {
          onNavigateToNewDoc('PROFORMA');
          onClose();
        },
      },
      {
        id: 'action-nav-reservations',
        title: 'Room & Conference Hall Folios',
        subtitle: 'Manage hotel guest bookings, check-in, check-out & hall reservations',
        badge: 'HOSPITALITY',
        badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        category: 'Actions' as const,
        action: () => {
          onNavigateToModule('reservations');
          onClose();
        },
      },
      {
        id: 'action-nav-pos',
        title: 'Restaurant & Bar POS Quick-Billing',
        subtitle: 'Touchscreen dining counter, drink orders & M-Pesa Till settlement',
        badge: 'POS',
        badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        category: 'Actions' as const,
        action: () => {
          onNavigateToModule('pos');
          onClose();
        },
      },
      {
        id: 'action-nav-nightaudit',
        title: 'Night Audit & Debtor Aging Report',
        subtitle: 'Daily managerial closure, 30-90 day aging & KRA 16% VAT schedules',
        badge: 'REPORTS',
        badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
        category: 'Actions' as const,
        action: () => {
          onNavigateToModule('nightaudit');
          onClose();
        },
      },
      {
        id: 'action-nav-vault',
        title: 'Google Drive & Document Vault',
        subtitle: 'Browse all archived PDFs, WhatsApp dispatch & cloud sync ledger',
        badge: 'VAULT',
        badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
        category: 'Actions' as const,
        action: () => {
          onNavigateToModule('vault');
          onClose();
        },
      },
      {
        id: 'action-record-pay',
        title: 'Record Payment / Settlement',
        subtitle: 'Log Cash, M-Pesa, Bank EFT, or Cheque receipt',
        badge: 'ACTION',
        badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        category: 'Actions' as const,
        action: () => {
          onOpenPaymentModal();
          onClose();
        },
      },
      {
        id: 'action-new-statement',
        title: 'New Statement of Account',
        subtitle: 'Generate period ledger statement for corporate client',
        badge: 'ACTION',
        badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        category: 'Actions' as const,
        action: () => {
          onNavigateToModule('statements');
          onClose();
        },
      },
      {
        id: 'action-sync-sheets',
        title: 'Sync with Google Workspace Sheets',
        subtitle: 'Trigger background push & pull backup sync',
        badge: 'SYNC',
        badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
        category: 'Actions' as const,
        action: () => {
          onTriggerSync();
          onClose();
        },
      },
    ];

    if (!q) {
      items.push(...quickActions);

      // Add 5 most recent documents
      documents.slice(0, 5).forEach((doc) => {
        const isInvoice = doc.documentType === 'INVOICE';
        const isQuote = doc.documentType === 'QUOTATION';
        items.push({
          id: `doc-${doc.id}`,
          title: `${doc.documentNumber} — ${doc.clientName}`,
          subtitle: `${formatKsh(doc.grandTotal)} • ${doc.status} • Issued ${formatDate(doc.issueDate)}`,
          badge: doc.documentType,
          badgeColor: isInvoice
            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
            : isQuote
            ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
            : 'bg-purple-500/20 text-purple-300 border-purple-500/40',
          category: 'Documents',
          action: () => {
            onSelectDocument(doc);
            onClose();
          },
        });
      });

      // Add top clients
      clients.slice(0, 3).forEach((client) => {
        items.push({
          id: `client-${client.id}`,
          title: client.name,
          subtitle: `${client.contactPerson ? client.contactPerson + ' • ' : ''}${client.phone || client.email || 'No contact'}`,
          badge: 'CLIENT',
          badgeColor: 'bg-stone-700 text-stone-300 border-stone-600',
          category: 'Clients',
          action: () => {
            onSelectClient(client.id);
            onClose();
          },
        });
      });

      return items;
    }

    // Filter Quick Actions matching query
    quickActions.forEach((qa) => {
      if (qa.title.toLowerCase().includes(q) || qa.subtitle.toLowerCase().includes(q)) {
        items.push(qa);
      }
    });

    // Filter Documents matching query
    documents.forEach((doc) => {
      const matchDocNo = doc.documentNumber.toLowerCase().includes(q);
      const matchClient = doc.clientName.toLowerCase().includes(q);
      const matchItems = doc.lineItems?.some((it) => it.particulars.toLowerCase().includes(q)) || false;
      const matchStatus = doc.status.toLowerCase().includes(q);

      if (matchDocNo || matchClient || matchItems || matchStatus) {
        const isInvoice = doc.documentType === 'INVOICE';
        const isQuote = doc.documentType === 'QUOTATION';
        items.push({
          id: `doc-${doc.id}`,
          title: `${doc.documentNumber} — ${doc.clientName}`,
          subtitle: `${formatKsh(doc.grandTotal)} • ${doc.status} • ${doc.lineItems?.length || 0} item(s)`,
          badge: doc.documentType,
          badgeColor: isInvoice
            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
            : isQuote
            ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
            : 'bg-purple-500/20 text-purple-300 border-purple-500/40',
          category: 'Documents',
          action: () => {
            onSelectDocument(doc);
            onClose();
          },
        });
      }
    });

    // Filter Clients matching query
    clients.forEach((client) => {
      const matchName = client.name.toLowerCase().includes(q);
      const matchContact = (client.contactPerson || '').toLowerCase().includes(q);
      const matchPhone = (client.phone || '').toLowerCase().includes(q);
      const matchPin = (client.kraPin || '').toLowerCase().includes(q);

      if (matchName || matchContact || matchPhone || matchPin) {
        items.push({
          id: `client-${client.id}`,
          title: client.name,
          subtitle: `${client.contactPerson ? client.contactPerson + ' • ' : ''}${client.phone ? client.phone + ' • ' : ''}${client.kraPin ? 'PIN: ' + client.kraPin : 'Client Ledger'}`,
          badge: 'CLIENT',
          badgeColor: 'bg-stone-700 text-stone-300 border-stone-600',
          category: 'Clients',
          action: () => {
            onSelectClient(client.id);
            onClose();
          },
        });
      }
    });

    // Filter Receipts matching query
    payments.forEach((payment) => {
      const matchReceipt = (payment.receiptNumber || '').toLowerCase().includes(q);
      const matchClient = (payment.clientName || '').toLowerCase().includes(q);
      const matchRef = (payment.referenceNote || '').toLowerCase().includes(q);
      const matchMethod = (payment.paymentMode || '').toLowerCase().includes(q);

      if (matchReceipt || matchClient || matchRef || matchMethod) {
        items.push({
          id: `payment-${payment.id}`,
          title: `Receipt ${payment.receiptNumber || 'REC'} — ${payment.clientName || 'Client'}`,
          subtitle: `${formatKsh(payment.amount)} via ${payment.paymentMode} • Ref: ${payment.referenceNote || 'N/A'} • ${formatDate(payment.date)}`,
          badge: 'RECEIPT',
          badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          category: 'Receipts',
          action: () => {
            onNavigateToModule('receipts');
            onClose();
          },
        });
      }
    });

    return items;
  }, [query, documents, clients, payments, onNavigateToNewDoc, onNavigateToModule, onSelectDocument, onSelectClient, onTriggerSync, onOpenPaymentModal, onClose]);

  // Keyboard listener for navigation (ArrowUp, ArrowDown, Enter, Esc)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, results.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + results.length) % Math.max(1, results.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[selectedIndex]) {
          results[selectedIndex].action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, onClose]);

  // Ensure selected item stays in view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-stone-950/80 backdrop-blur-xs animate-fade-in text-stone-100"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl bg-stone-900 border border-stone-700/90 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-stone-800 bg-stone-950/50">
          <Search className="w-5 h-5 text-amber-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command, document number (e.g. INV-0001), client, or receipt..."
            className="flex-1 bg-transparent border-none text-sm text-white placeholder-stone-400 focus:outline-hidden focus:ring-0"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 text-stone-400 hover:text-white rounded-md cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-stone-400 bg-stone-800 rounded border border-stone-700">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-1">
          {results.length === 0 ? (
            <div className="py-12 text-center text-stone-400 text-xs">
              <p className="font-semibold text-stone-300">No matching records found</p>
              <p className="mt-1">Try searching by client name, document number, KRA PIN, or amount.</p>
            </div>
          ) : (
            results.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  data-index={idx}
                  onClick={() => item.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-amber-500/15 border border-amber-500/30 text-white'
                      : 'hover:bg-stone-800/60 border border-transparent text-stone-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${item.badgeColor}`}
                    >
                      {item.badge}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate text-white">{item.title}</p>
                      <p className="text-[11px] text-stone-400 truncate">{item.subtitle}</p>
                    </div>
                  </div>

                  <ArrowRight
                    className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                      isSelected ? 'text-amber-400 translate-x-0.5' : 'text-stone-600'
                    }`}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Footer Shortcut Hints */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-stone-800 bg-stone-950/70 text-[11px] text-stone-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-stone-800 border border-stone-700 rounded font-mono text-[10px]">
                ↑
              </kbd>
              <kbd className="px-1 py-0.5 bg-stone-800 border border-stone-700 rounded font-mono text-[10px]">
                ↓
              </kbd>{' '}
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-stone-800 border border-stone-700 rounded font-mono text-[10px]">
                ↵
              </kbd>{' '}
              Select
            </span>
          </div>
          <span className="text-[10px] text-stone-500">Press Cmd+K anytime</span>
        </div>
      </div>
    </div>
  );
};
