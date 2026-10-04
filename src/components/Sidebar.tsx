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

interface NavItem {
  id: MainNavModule;
  label: string;
  subtitle: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  badge: string | number | null;
  badgeColor: string;
  description?: string;
}

interface NavCategory {
  title: string;
  shortTitle?: string;
  items: NavItem[];
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

  // When collapsed: hovering auto-expands the sidebar menu smoothly (auto-hide behavior)
  const effectiveCollapsed = isCollapsed && !isHovered;

  const navCategories: NavCategory[] = [
    {
      title: 'OVERVIEW',
      shortTitle: 'OVERVIEW',
      items: [
        {
          id: 'dashboard',
          label: 'Executive Dashboard',
          subtitle: 'Real-time KPIs & Financials',
          shortLabel: 'Dashboard',
          icon: LayoutDashboard,
          badge: null,
          badgeColor: '',
        },
      ],
    },
    {
      title: 'BILLING & INVOICING',
      shortTitle: 'BILLING',
      items: [
        {
          id: 'quotations',
          label: 'Quotations',
          subtitle: 'Price Estimates & Proposals',
          shortLabel: 'Quotations',
          icon: FileClock,
          badge: quotationsCount > 0 ? quotationsCount : null,
          badgeColor: 'bg-blue-100 text-blue-900 border border-blue-300 font-bold',
        },
        {
          id: 'proformas',
          label: 'Proforma Invoices',
          subtitle: 'Advance Billing & Orders',
          shortLabel: 'Proformas',
          icon: Receipt,
          badge: proformasCount > 0 ? proformasCount : null,
          badgeColor: 'bg-purple-100 text-purple-900 border border-purple-300 font-bold',
        },
        {
          id: 'invoices',
          label: 'Tax Invoices',
          subtitle: 'Accounts Receivable & Billing',
          shortLabel: 'Invoices',
          icon: FileText,
          badge: unpaidInvoicesCount > 0 ? `${unpaidInvoicesCount} due` : null,
          badgeColor: hasOverdueInvoices
            ? 'bg-rose-100 text-rose-900 border border-rose-300 font-bold animate-pulse'
            : 'bg-amber-100 text-amber-900 border border-amber-300 font-bold',
        },
      ],
    },
    {
      title: 'PAYMENTS & SETTLEMENTS',
      shortTitle: 'PAYMENTS',
      items: [
        {
          id: 'receipts',
          label: 'Payment Receipts',
          subtitle: 'Remittance Proof & Vouchers',
          shortLabel: 'Receipts',
          icon: CreditCard,
          badge: receiptsCount > 0 ? receiptsCount : null,
          badgeColor: 'bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold',
        },
        {
          id: 'statements',
          label: 'Statement of Accounts',
          subtitle: 'Client Ledgers & Balances',
          shortLabel: 'Statements',
          icon: BookOpen,
          badge: null,
          badgeColor: '',
        },
      ],
    },
    {
      title: 'HOSPITALITY',
      shortTitle: 'HOSPITALITY',
      items: [
        {
          id: 'reservations',
          label: 'Room & Hall Folios',
          subtitle: 'Guest Lodging & Bookings',
          shortLabel: 'Folios',
          icon: Bed,
          badge: 'Live',
          badgeColor: 'bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold',
        },
        {
          id: 'pos',
          label: 'Restaurant & Bar POS',
          subtitle: 'Counter Sales & Food Orders',
          shortLabel: 'Restaurant POS',
          icon: Utensils,
          badge: null,
          badgeColor: '',
        },
      ],
    },
    {
      title: 'OPERATIONS',
      shortTitle: 'OPERATIONS',
      items: [
        {
          id: 'nightaudit',
          label: 'Night Audit & Reports',
          subtitle: 'Daily Revenue & VAT Schedules',
          shortLabel: 'Night Audit',
          icon: TrendingUp,
          badge: 'Daily',
          badgeColor: 'bg-amber-500 text-stone-950 font-bold',
        },
        {
          id: 'clients',
          label: 'Client Directory',
          subtitle: 'Corporate Accounts & PINs',
          shortLabel: 'Clients',
          icon: Users,
          badge: clientsCount > 0 ? clientsCount : null,
          badgeColor: 'bg-stone-700 text-stone-200 font-semibold',
        },
      ],
    },
    {
      title: 'INTEGRATIONS & VAULT',
      shortTitle: 'INTEGRATIONS',
      items: [
        {
          id: 'vault',
          label: 'Google Drive Vault',
          subtitle: 'Cloud Document Archival',
          shortLabel: 'Drive Vault',
          icon: FolderGit2,
          badge: null,
          badgeColor: '',
        },
        {
          id: 'sync',
          label: 'Google Sync Engine',
          subtitle: 'Real-time Google Sheets Sync',
          shortLabel: 'Sync Engine',
          icon: Cloud,
          badge: pendingSyncCount > 0 ? pendingSyncCount : null,
          badgeColor: 'bg-amber-500 text-stone-950 font-bold',
        },
        {
          id: 'excel',
          label: 'Excel Master Suite (.xlsm)',
          subtitle: 'VBA Macro Workstation',
          shortLabel: 'Excel Suite',
          icon: FileSpreadsheet,
          badge: 'Offline',
          badgeColor: 'bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold',
        },
        {
          id: 'settings',
          label: 'Hotel Settings',
          subtitle: 'Profile, Tax & System Setup',
          shortLabel: 'Settings',
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
    // If in collapsed/auto-hide mode, close the hover panel immediately on selection
    if (isCollapsed) {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      setIsHovered(false);
    }
  };

  const renderSidebarContent = (forceExpanded: boolean = false) => {
    // When forced (such as in mobile drawer or expanded aside), never collapse
    const effectiveCollapsed = forceExpanded ? false : (isCollapsed && !isHovered);

    return (
      <div className="flex flex-col h-full bg-stone-900 text-stone-100 select-none border-r border-stone-800">
        {/* 1. Header: Branding & Crest */}
        <div className="p-3.5 border-b border-stone-800 flex items-center justify-between">
          <div
            onClick={() => handleNavClick('dashboard')}
            className="flex items-center gap-3 cursor-pointer overflow-hidden min-w-0 flex-1"
            title="Hotel Damview ERP"
          >
            <div className="shrink-0 flex flex-col items-center justify-center">
              <HotelLogo logoBase64={profile.logoBase64} size={effectiveCollapsed ? 34 : 42} />
              {effectiveCollapsed && (
                <span className="text-[9.5px] font-bold text-amber-400 uppercase tracking-widest mt-1 text-center font-serif truncate max-w-full">
                  DAMVIEW
                </span>
              )}
            </div>
            {!effectiveCollapsed && (
              <div className="min-w-0 transition-opacity duration-200 pl-0.5">
                <div
                  className="font-bold text-base tracking-wider uppercase text-amber-400 font-serif leading-tight truncate"
                  title={profile.name || 'HOTEL DAMVIEW'}
                >
                  {profile.name || 'HOTEL DAMVIEW'}
                </div>
                <div
                  className="text-xs text-stone-300 tracking-wide truncate font-medium mt-0.5"
                  title={`${profile.physicalLocation || ''} • ${profile.postalAddress || ''}`}
                >
                  {profile.physicalLocation || profile.postalAddress || profile.tagline || 'Machakos, Kenya'}
                </div>
                {profile.kraPin && (
                  <div className="text-[10px] font-mono text-stone-400 truncate mt-0.5 font-semibold">
                    PIN: {profile.kraPin}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Desktop Collapse / Expand Toggle Button in Header */}
          {!effectiveCollapsed ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              title={isCollapsed ? 'Expand Navigation Menu' : 'Collapse Navigation Menu'}
              className="hidden lg:flex p-1.5 rounded-lg text-stone-300 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer shrink-0 ml-1 border border-stone-800"
            >
              <ChevronLeft className="w-4 h-4 text-amber-400" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Expand Navigation Menu"
              className="hidden lg:flex p-1 rounded-md text-stone-400 hover:text-amber-400 hover:bg-stone-800 transition-colors cursor-pointer shrink-0 border border-stone-800/80 mt-1"
            >
              <ChevronRight className="w-3.5 h-3.5 text-amber-400" />
            </button>
          )}

          {/* Mobile close button */}
          {isMobileOpen && (
            <button
              type="button"
              onClick={onToggleMobile}
              title="Close Navigation"
              className="lg:hidden p-1.5 rounded-lg text-stone-300 hover:text-white hover:bg-stone-800 transition-colors"
            >
              <X className="w-5 h-5 text-amber-400" />
            </button>
          )}
        </div>

        {/* 2. Search / Quick Command Palette Launcher */}
        {onOpenSearch && (
          <div className="px-3 pt-3 pb-1">
            <button
              type="button"
              onClick={onOpenSearch}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 bg-stone-950/80 hover:bg-stone-800 border border-stone-700/80 rounded-lg text-xs text-stone-300 hover:text-white transition-colors cursor-pointer shadow-xs ${
                effectiveCollapsed ? 'flex-col items-center justify-center text-center p-2' : ''
              }`}
              title="Search documents, clients, receipts (Cmd+K)"
            >
              <div className={`flex items-center gap-2.5 min-w-0 ${effectiveCollapsed ? 'flex-col items-center gap-0.5' : ''}`}>
                <Search className="w-4 h-4 text-amber-400 shrink-0" />
                <span className={effectiveCollapsed ? 'text-[9.5px] font-semibold text-stone-200' : 'text-[12.5px] font-medium text-stone-200'}>
                  {effectiveCollapsed ? 'Search' : 'Quick Search (Cmd+K)...'}
                </span>
              </div>
              {!effectiveCollapsed && (
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-stone-300 bg-stone-800 rounded border border-stone-700 font-bold">
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
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  isOnline
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80'
                    : 'bg-rose-950/80 text-rose-300 border-rose-700/80'
                }`}
                title={isOnline ? 'Online: Automated Cloud sync active' : 'Offline: Local IndexedDB persistence active'}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                  }`}
                />
                <span>{isOnline ? 'Online Sync' : 'Offline Mode'}</span>
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
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded border transition-colors ${
                  pendingSyncCount > 0
                    ? 'bg-amber-950/90 text-amber-300 border-amber-600 hover:bg-amber-900'
                    : 'text-stone-300 border-stone-700 hover:text-white hover:bg-stone-800'
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

        {/* 4. Categorized Navigation Links - Highly visible titles and labels */}
        <nav className="flex-1 px-2.5 py-3 space-y-4 overflow-y-auto custom-scrollbar">
          {navCategories.map((category) => (
            <div key={category.title} className="space-y-1">
              {/* Category / Menu Section Header */}
              {!effectiveCollapsed ? (
                <div
                  className="px-3 pt-3.5 pb-1.5 flex items-center justify-between border-b border-stone-800/80 mb-1.5 select-none"
                  title={category.title}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    <span className="text-[11.5px] font-bold uppercase tracking-wider text-amber-400 font-mono truncate">
                      {category.title}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-medium text-stone-400 shrink-0 uppercase tracking-wider">
                    {category.items.length} {category.items.length === 1 ? 'module' : 'modules'}
                  </span>
                </div>
              ) : (
                <div className="px-1 pt-2.5 pb-1 text-center select-none" title={category.title}>
                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-amber-400/90 font-mono block truncate px-0.5 pb-1 border-b border-stone-800/70">
                    {category.shortTitle || category.title.split(' ')[0]}
                  </span>
                </div>
              )}

              {/* Module Navigation Buttons */}
              <div className="space-y-1">
                {category.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentModule === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavClick(item.id)}
                      title={`${item.label} — ${item.subtitle}`}
                      className={`group w-full flex rounded-xl transition-all cursor-pointer ${
                        effectiveCollapsed
                          ? 'flex-col items-center justify-center px-1.5 py-2.5 text-center'
                          : 'items-center justify-between px-3 py-2 text-[13.5px]'
                      } ${
                        isActive
                          ? 'bg-amber-500/15 text-amber-300 shadow-xs border-l-4 border-amber-400 ring-1 ring-amber-500/30'
                          : 'text-stone-200 hover:text-white hover:bg-stone-800/90 border-l-4 border-transparent'
                      }`}
                    >
                      <div
                        className={`flex ${
                          effectiveCollapsed
                            ? 'flex-col items-center gap-1 w-full text-center'
                            : 'items-center gap-3 min-w-0 flex-1'
                        }`}
                      >
                        <div className="relative shrink-0 flex items-center justify-center">
                          <div
                            className={`p-1.5 rounded-lg transition-colors ${
                              isActive
                                ? 'bg-amber-500/25 text-amber-300'
                                : 'bg-stone-800/60 text-stone-300 group-hover:text-amber-300 group-hover:bg-stone-800'
                            }`}
                          >
                            <Icon
                              className={`shrink-0 transition-colors ${
                                effectiveCollapsed ? 'w-5 h-5' : 'w-4.5 h-4.5'
                              } ${isActive ? 'text-amber-300' : 'text-stone-300 group-hover:text-amber-300'}`}
                            />
                          </div>
                          {effectiveCollapsed && item.badge !== null && (
                            <span className="absolute -top-1 -right-1.5 min-w-[14px] h-3.5 px-1 rounded-full bg-amber-500 text-stone-950 text-[9px] font-extrabold flex items-center justify-center shadow-xs">
                              {typeof item.badge === 'number' ? item.badge : '•'}
                            </span>
                          )}
                        </div>

                        {/* ALWAYS SHOW NAVIGATION MODULE NAME - HIGHLY LEGIBLE, READABLE & VISIBLE */}
                        {!effectiveCollapsed ? (
                          <div className="flex flex-col min-w-0 text-left">
                            <span
                              className={`text-[13.5px] leading-tight tracking-tight truncate ${
                                isActive ? 'font-bold text-amber-300' : 'font-semibold text-stone-100 group-hover:text-white'
                              }`}
                            >
                              {item.label}
                            </span>
                            <span className="text-[11px] text-stone-400 group-hover:text-stone-300 truncate mt-0.5 font-normal">
                              {item.subtitle}
                            </span>
                          </div>
                        ) : (
                          <span
                            className={`text-[11px] leading-tight text-center max-w-full px-0.5 tracking-tight ${
                              isActive ? 'text-amber-300 font-bold' : 'text-stone-200 group-hover:text-white font-semibold'
                            }`}
                          >
                            {item.shortLabel || item.label}
                          </span>
                        )}
                      </div>

                      {/* Expanded Badges & Quick Action Triggers */}
                      {!effectiveCollapsed && (
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {item.badge !== null && (
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-full font-bold leading-none shadow-2xs ${item.badgeColor}`}
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
                              title={`Create New ${item.label}`}
                              className="p-1 rounded text-stone-400 hover:text-amber-300 hover:bg-stone-700 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* 5. Action shortcut & Collapse controls */}
        <div className="p-3 border-t border-stone-800/80 space-y-2 bg-stone-950/30">
          {!effectiveCollapsed ? (
            <button
              type="button"
              onClick={onQuickNewDoc}
              className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Create New Document</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onQuickNewDoc}
              title="Create New Document"
              className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 py-2 px-1 rounded-md flex flex-col items-center justify-center shadow-xs cursor-pointer gap-0.5"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span className="text-[10px] font-bold tracking-tight">Create</span>
            </button>
          )}

          {/* Desktop Collapse / Expand Toggle Button */}
          <button
            type="button"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand Navigation Menu' : 'Collapse Navigation Menu'}
            className={`hidden lg:flex w-full items-center justify-center rounded-lg font-semibold transition-colors cursor-pointer ${
              effectiveCollapsed
                ? 'flex-col py-2 text-stone-300 hover:text-white hover:bg-stone-800/80 gap-0.5 text-[10.5px] border border-stone-800/60'
                : 'gap-2 py-2 text-stone-300 hover:text-white hover:bg-stone-800/80 border border-stone-800 text-xs'
            }`}
          >
            {isCollapsed ? (
              <>
                <ChevronRight className="w-4 h-4 text-amber-400" />
                <span className="text-[10.5px] text-stone-200 font-semibold">Expand Menu</span>
              </>
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 text-amber-400" />
                <span>Collapse Sidebar</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Persistent / Ambient Floating Sidebar */}
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`hidden lg:block shrink-0 transition-all duration-300 ease-in-out h-screen sticky top-0 z-30 ${
          isCollapsed ? 'w-26' : 'w-80'
        }`}
      >
        <div
          className={`h-full transition-all duration-200 ${
            isCollapsed && isHovered
              ? 'absolute top-0 left-0 w-80 shadow-2xl z-50'
              : 'w-full'
          }`}
        >
          {renderSidebarContent(false)}
        </div>
      </aside>

      {/* Mobile Off-canvas Drawer (< lg screens) - ALWAYS FULLY EXPANDED WITH VISIBLE TITLES & LABELS */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-stone-950/80 backdrop-blur-xs transition-opacity"
            onClick={onToggleMobile}
          />

          {/* Drawer Panel - Always Expanded */}
          <div className="relative flex-1 flex flex-col w-84 max-w-[88vw] bg-stone-900 shadow-2xl z-10 animate-slide-in">
            {renderSidebarContent(true)}
          </div>
        </div>
      )}
    </>
  );
};
