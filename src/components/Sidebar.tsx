import React from 'react';
import {
  LayoutDashboard,
  FileText,
  FileClock,
  Receipt,
  BookOpen,
  Users,
  Settings,
  Plus,
  Wifi,
  WifiOff,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  CreditCard,
  Cloud,
  Search,
  Bed,
  Utensils,
  TrendingUp,
  FolderGit2,
  FileSpreadsheet,
} from 'lucide-react';
import { HotelLogo } from './HotelLogo';
import { HotelProfile } from '../types';
import { usePWA } from '../hooks/usePWA';

export type MainNavModule =
  | 'dashboard'
  | 'reservations'
  | 'pos'
  | 'quotations'
  | 'proformas'
  | 'invoices'
  | 'receipts'
  | 'statements'
  | 'nightaudit'
  | 'vault'
  | 'clients'
  | 'sync'
  | 'excel'
  | 'settings';

interface SidebarProps {
  currentModule: MainNavModule;
  onSelectModule: (module: MainNavModule) => void;
  profile: HotelProfile;
  isOnline: boolean;
  isSyncing?: boolean;
  pendingSyncCount: number;
  onTriggerSync: () => void;
  onQuickNewDoc: () => void;
  onNewQuotation?: () => void;
  onNewProforma?: () => void;
  onNewInvoice?: () => void;
  onRecordPayment?: () => void;
  onOpenSearch?: () => void;
  // Live badge counts
  quotationsCount: number;
  proformasCount: number;
  unpaidInvoicesCount: number;
  hasOverdueInvoices: boolean;
  clientsCount: number;
  receiptsCount?: number;
  // Collapse state
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  // Mobile drawer state
  isMobileOpen: boolean;
  onToggleMobile: () => void;
}

interface NavCategory {
  title: string;
  items: {
    id: MainNavModule;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge: string | number | null;
    badgeColor: string;
    description?: string;
  }[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentModule,
  onSelectModule,
  profile,
  isOnline,
  isSyncing = false,
  pendingSyncCount,
  onTriggerSync,
  onQuickNewDoc,
  onNewQuotation,
  onNewProforma,
  onNewInvoice,
  onRecordPayment,
  onOpenSearch,
  quotationsCount,
  proformasCount,
  unpaidInvoicesCount,
  hasOverdueInvoices,
  clientsCount,
  receiptsCount = 0,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onToggleMobile,
}) => {
  const { needRefresh } = usePWA();
  const [isHovered, setIsHovered] = React.useState(false);
  const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    // Smooth 250ms autohide delay to prevent jitter
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 250);
  };

  React.useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  // Always show labels on menu items
  const effectiveCollapsed = false;

  const navCategories: NavCategory[] = [
    {
      title: 'OVERVIEW',
      items: [
        {
          id: 'dashboard',
          label: 'Executive Dashboard',
          icon: LayoutDashboard,
          badge: null,
          badgeColor: '',
        },
      ],
    },
    {
      title: 'BILLING & INVOICING',
      items: [
        {
          id: 'quotations',
          label: 'Quotations',
          icon: FileClock,
          badge: quotationsCount > 0 ? quotationsCount : null,
          badgeColor: 'bg-blue-100 text-blue-900 border border-blue-300',
        },
        {
          id: 'proformas',
          label: 'Proforma Invoices',
          icon: Receipt,
          badge: proformasCount > 0 ? proformasCount : null,
          badgeColor: 'bg-purple-100 text-purple-900 border border-purple-300',
        },
        {
          id: 'invoices',
          label: 'Tax Invoices',
          icon: FileText,
          badge: unpaidInvoicesCount > 0 ? `${unpaidInvoicesCount} due` : null,
          badgeColor: hasOverdueInvoices
            ? 'bg-rose-100 text-rose-900 border border-rose-300 font-bold animate-pulse'
            : 'bg-amber-100 text-amber-900 border border-amber-300',
        },
      ],
    },
    {
      title: 'PAYMENTS & SETTLEMENTS',
      items: [
        {
          id: 'receipts',
          label: 'Payment Receipts',
          icon: CreditCard,
          badge: receiptsCount > 0 ? receiptsCount : null,
          badgeColor: 'bg-emerald-100 text-emerald-900 border border-emerald-300',
        },
        {
          id: 'statements',
          label: 'Statement of Accounts',
          icon: BookOpen,
          badge: null,
          badgeColor: '',
        },
      ],
    },
    {
      title: 'HOSPITALITY',
      items: [
        {
          id: 'reservations',
          label: 'Room & Hall Folios',
          icon: Bed,
          badge: 'Live',
          badgeColor: 'bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold',
        },
        {
          id: 'pos',
          label: 'Restaurant & Bar POS',
          icon: Utensils,
          badge: null,
          badgeColor: '',
        },
      ],
    },
    {
      title: 'OPERATIONS',
      items: [
        {
          id: 'nightaudit',
          label: 'Night Audit & Reports',
          icon: TrendingUp,
          badge: 'Daily',
          badgeColor: 'bg-amber-500 text-stone-950 font-bold',
        },
        {
          id: 'clients',
          label: 'Client Directory',
          icon: Users,
          badge: clientsCount > 0 ? clientsCount : null,
          badgeColor: 'bg-stone-700 text-stone-200',
        },
      ],
    },
    {
      title: 'INTEGRATIONS & VAULT',
      items: [
        {
          id: 'vault',
          label: 'Google Drive Vault',
          icon: FolderGit2,
          badge: null,
          badgeColor: '',
        },
        {
          id: 'sync',
          label: 'Google Sync Engine',
          icon: Cloud,
          badge: pendingSyncCount > 0 ? pendingSyncCount : null,
          badgeColor: 'bg-amber-500 text-stone-950 font-bold',
        },
        {
          id: 'excel',
          label: 'Excel Master Suite (.xlsm)',
          icon: FileSpreadsheet,
          badge: 'Offline',
          badgeColor: 'bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold',
        },
        {
          id: 'settings',
          label: 'Hotel Settings',
          icon: Settings,
          badge: needRefresh ? 'Update' : null,
          badgeColor: 'bg-amber-500 text-stone-950 font-bold animate-pulse',
        },
      ],
    },
  ];

  const handleNavClick = (id: MainNavModule) => {
    onSelectModule(id);
    if (isMobileOpen) {
      onToggleMobile();
    }
    // Auto hide menu / collapse sidebar on selection to maximize workspace
    if (!isCollapsed && onToggleCollapse) {
      onToggleCollapse();
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-stone-900 text-stone-100 select-none border-r border-stone-800">
      {/* 1. Header: Branding & Crest */}
      <div className="p-4 border-b border-stone-800/80 flex items-center justify-between">
        <div
          onClick={() => handleNavClick('dashboard')}
          className="flex items-center gap-3 cursor-pointer overflow-hidden"
          title="Hotel Damview ERP"
        >
          <div className="shrink-0">
            <HotelLogo logoBase64={profile.logoBase64} size={effectiveCollapsed ? 36 : 40} />
          </div>
          {!effectiveCollapsed && (
            <div className="min-w-0 transition-opacity duration-200">
              <div
                className="font-bold text-sm tracking-wider uppercase text-amber-400 font-serif leading-tight truncate"
                title={profile.name || 'HOTEL DAMVIEW'}
              >
                {profile.name || 'HOTEL DAMVIEW'}
              </div>
              <div
                className="text-[10px] text-stone-300 tracking-wide truncate font-medium"
                title={`${profile.physicalLocation || ''} • ${profile.postalAddress || ''}`}
              >
                {profile.physicalLocation || profile.postalAddress || profile.tagline || ''}
              </div>
              {profile.kraPin && (
                <div className="text-[9px] font-mono text-stone-400 truncate mt-0.5">
                  PIN: {profile.kraPin}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile close button */}
        {isMobileOpen && (
          <button
            type="button"
            onClick={onToggleMobile}
            className="lg:hidden p-1 rounded text-stone-400 hover:text-white hover:bg-stone-800"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* 2. Search / Quick Command Palette Launcher */}
      {onOpenSearch && (
        <div className="px-3 pt-3 pb-1">
          <button
            type="button"
            onClick={onOpenSearch}
            className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 bg-stone-950/60 hover:bg-stone-800/80 border border-stone-800 rounded-lg text-xs text-stone-400 hover:text-stone-200 transition-colors cursor-pointer ${
              effectiveCollapsed ? 'justify-center px-2' : ''
            }`}
            title="Search documents, clients, receipts (Cmd+K)"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Search className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              {!effectiveCollapsed && <span className="truncate">Quick Search...</span>}
            </div>
            {!effectiveCollapsed && (
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-stone-400 bg-stone-900 rounded border border-stone-700">
                ⌘K
              </kbd>
            )}
          </button>
        </div>
      )}

      {/* 3. Connection Status & Sync Pill */}
      <div className={`px-3 py-2 border-b border-stone-800/60 bg-stone-950/40 ${effectiveCollapsed ? 'text-center' : ''}`}>
        {!effectiveCollapsed ? (
          <div className="flex items-center justify-between gap-2">
            <div
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                isOnline
                  ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800/80'
                  : 'bg-rose-950/70 text-rose-300 border-rose-800/80'
              }`}
              title={isOnline ? 'Online: Automated Cloud sync active' : 'Offline: Local IndexedDB persistence active'}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span>{isOnline ? 'Online Sync' : 'Offline Cache'}</span>
            </div>

            {/* Quick sync trigger button */}
            <button
              type="button"
              onClick={onTriggerSync}
              disabled={isSyncing}
              title={
                pendingSyncCount > 0
                  ? `${pendingSyncCount} item(s) pending sync to Google Workspace. Click to sync now.`
                  : 'All records synced with Google Workspace. Click to refresh.'
              }
              className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border transition-colors ${
                pendingSyncCount > 0
                  ? 'bg-amber-950/80 text-amber-300 border-amber-700/80 hover:bg-amber-900'
                  : 'text-stone-400 border-stone-800 hover:text-stone-200 hover:bg-stone-800'
              }`}
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-amber-400' : ''}`} />
              <span>{pendingSyncCount > 0 ? `${pendingSyncCount} queued` : 'Synced'}</span>
            </button>
          </div>
        ) : (
          <div className="flex justify-center" title={isOnline ? 'Online' : 'Offline'}>
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isOnline ? 'bg-emerald-400' : 'bg-rose-500'
              }`}
            />
          </div>
        )}
      </div>

      {/* 4. Categorized Navigation Links */}
      <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto">
        {navCategories.map((category) => (
          <div key={category.title} className="space-y-1">
            {!effectiveCollapsed && (
              <div className="px-3 py-1 text-[10px] font-bold tracking-wider text-stone-400 uppercase">
                {category.title}
              </div>
            )}
            {effectiveCollapsed && (
              <div className="w-6 h-px bg-stone-800 mx-auto my-2" />
            )}

            <div className="space-y-0.5">
              {category.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentModule === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    title={effectiveCollapsed ? item.label : undefined}
                    className={`group w-full flex items-center justify-between rounded-lg transition-all text-xs font-semibold ${
                      effectiveCollapsed ? 'px-2 py-2.5 justify-center' : 'px-3 py-2'
                    } ${
                      isActive
                        ? 'bg-stone-800 text-amber-400 shadow-xs border-l-3 border-amber-400'
                        : 'text-stone-300 hover:text-white hover:bg-stone-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-amber-400' : 'text-stone-400'
                        }`}
                      />
                      {!effectiveCollapsed && <span className="truncate">{item.label}</span>}
                    </div>

                    {!effectiveCollapsed && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.badge !== null && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none ${item.badgeColor}`}
                          >
                            {item.badge}
                          </span>
                        )}
                        {(item.id === 'quotations' || item.id === 'proformas' || item.id === 'invoices' || item.id === 'receipts') && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (item.id === 'quotations') onNewQuotation?.();
                              else if (item.id === 'proformas') onNewProforma?.();
                              else if (item.id === 'invoices') onNewInvoice?.();
                              else if (item.id === 'receipts') onRecordPayment?.();
                            }}
                            title={`New ${item.label}`}
                            className="p-0.5 rounded text-stone-400 hover:text-amber-300 hover:bg-stone-700 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Plus className="w-3 h-3 stroke-[2.5]" />
                          </span>
                        )}
                      </div>
                    )}

                    {effectiveCollapsed && item.badge !== null && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* 5. Action shortcut & Collapse controls */}
      <div className="p-3 border-t border-stone-800/80 space-y-2 bg-stone-950/20">
        {!effectiveCollapsed ? (
          <button
            type="button"
            onClick={onQuickNewDoc}
            className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs py-2 px-3 rounded-md flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>Create Document</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onQuickNewDoc}
            title="Create New Document"
            className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 p-2 rounded-md flex items-center justify-center shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
          </button>
        )}

        {/* Desktop Collapse / Expand Toggle Button */}
        <button
          type="button"
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          className="hidden lg:flex w-full items-center justify-center gap-2 py-1.5 text-stone-400 hover:text-stone-200 hover:bg-stone-800/60 rounded text-[11px] font-medium transition-colors cursor-pointer"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse Sidebar</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent / Ambient Floating Sidebar */}
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`hidden lg:block shrink-0 transition-all duration-300 ease-in-out h-screen sticky top-0 z-30 ${
          effectiveCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Off-canvas Drawer (< lg screens) */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-stone-950/80 backdrop-blur-xs transition-opacity"
            onClick={onToggleMobile}
          />

          {/* Drawer Panel */}
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-stone-900 shadow-2xl z-10 animate-slide-in">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
