import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  LayoutDashboard,
  FileText,
  FileSpreadsheet,
  Users,
  Settings,
  Plus,
  Sparkles,
  RefreshCw,
  Bell,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  ShieldCheck,
  X,
  Volume2,
  VolumeX,
  Search,
  Download,
  HelpCircle,
  Check,
  Filter,
} from 'lucide-react';
import { HotelLogo } from './HotelLogo';
import { HotelProfile } from '../types';
import { SyncTelemetryBadge } from './SyncTelemetryBadge';
import { usePWA } from '../hooks/usePWA';
import {
  appNotificationService,
  AppNotification,
  NotificationCategory,
  NotificationActionItem,
} from '../services/appNotificationService';

export type NavTab =
  | 'dashboard'
  | 'quotations'
  | 'proformas'
  | 'invoices'
  | 'journal'
  | 'statements'
  | 'clients'
  | 'settings'
  | 'new_doc';

interface NavbarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  profile: HotelProfile;
  isOnline: boolean;
  pendingSyncCount: number;
  onTriggerSync: () => void;
  onQuickNewDoc: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  profile,
  isOnline,
  pendingSyncCount,
  onTriggerSync,
  onQuickNewDoc,
}) => {
  const { needRefresh, applyUpdate, isCheckingUpdate, checkForUpdate, checkRemoteVersionJson } = usePWA();
  const [updateFeedback, setUpdateFeedback] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifSearch, setNotifSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | NotificationCategory>('ALL');
  const [soundEnabled, setSoundEnabled] = useState(() => appNotificationService.isSoundEnabled());
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);

  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = appNotificationService.subscribe((list) => {
      setNotifications(list);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    if (isNotifOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNotifOpen]);

  const handleManualCheckUpdates = async () => {
    const hasSw = await checkForUpdate();
    const hasRemote = await checkRemoteVersionJson();
    if (hasSw || hasRemote) {
      setUpdateFeedback('Update Ready');
      appNotificationService.notifyAppUpdate(
        'New App Update Available',
        'A newer build of Hotel Damview has been detected. Click "Update Ready" to apply.',
        'SUCCESS'
      );
    } else {
      setUpdateFeedback('Up to Date');
      appNotificationService.notifyAppUpdate(
        'Application is Up to Date',
        'Hotel Damview ERP is synchronized with the latest deployment on GitHub with 100% cache parity.',
        'INFO'
      );
      setTimeout(() => setUpdateFeedback(null), 3000);
    }
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    appNotificationService.setSoundEnabled(next);
  };

  const handleExportDiagnostics = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(notifications, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `damview-telemetry-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExecuteDrawerAction = async (notif: AppNotification, act: NotificationActionItem) => {
    setExecutingActionId(act.id);
    try {
      if (act.actionType === 'OPEN_PARITY_VALIDATOR') {
        window.dispatchEvent(
          new CustomEvent('damview:open-parity-validator', {
            detail: { documentNumber: act.targetDocumentNumber || notif.documentNumber },
          })
        );
      } else if (act.actionType === 'OPEN_APPS_SCRIPT_DIFF') {
        window.dispatchEvent(new CustomEvent('damview:open-apps-script-diff'));
      }

      if (act.onClick) {
        await act.onClick(notif);
      }

      setIsNotifOpen(false);
      if (notif.resolved || notif.isPrompt) {
        appNotificationService.dismiss(notif.id);
      }
    } catch (err) {
      console.error('[Navbar Notification] Action error:', err);
    } finally {
      setExecutingActionId(null);
    }
  };

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (categoryFilter !== 'ALL' && n.category !== categoryFilter) return false;
      if (notifSearch.trim()) {
        const query = notifSearch.toLowerCase();
        const matchTitle = n.title.toLowerCase().includes(query);
        const matchMsg = n.message.toLowerCase().includes(query);
        const matchDoc = (n.documentNumber || '').toLowerCase().includes(query);
        return matchTitle || matchMsg || matchDoc;
      }
      return true;
    });
  }, [notifications, categoryFilter, notifSearch]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="no-print bg-stone-900 border-b border-stone-800 text-stone-100 sticky top-0 z-40 shadow-sm select-none">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
        {/* Brand identity */}
        <div
          className="flex items-center gap-3 cursor-pointer py-1"
          onClick={() => onSelectTab('dashboard')}
        >
          <HotelLogo logoBase64={profile.logoBase64} size={38} />
          <div>
            <div className="font-bold text-sm tracking-wider uppercase text-amber-400 font-serif leading-none">
              {profile.name || 'HOTEL DAMVIEW'}
            </div>
            <div className="text-[10px] text-stone-400 tracking-wide mt-0.5">
              Billing & Documentation ERP
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center space-x-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => onSelectTab('dashboard')}
            className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ${
              currentTab === 'dashboard'
                ? 'bg-stone-800 text-amber-400'
                : 'text-stone-300 hover:text-white hover:bg-stone-800/60'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Dashboard
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('journal')}
            className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ${
              currentTab === 'journal' || currentTab === 'quotations' || currentTab === 'proformas' || currentTab === 'invoices'
                ? 'bg-stone-800 text-amber-400'
                : 'text-stone-300 hover:text-white hover:bg-stone-800/60'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Document Journal
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('statements')}
            className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ${
              currentTab === 'statements'
                ? 'bg-stone-800 text-amber-400'
                : 'text-stone-300 hover:text-white hover:bg-stone-800/60'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Statements
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('clients')}
            className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ${
              currentTab === 'clients'
                ? 'bg-stone-800 text-amber-400'
                : 'text-stone-300 hover:text-white hover:bg-stone-800/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Clients
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('settings')}
            className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ${
              currentTab === 'settings'
                ? 'bg-stone-800 text-amber-400'
                : 'text-stone-300 hover:text-white hover:bg-stone-800/60'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            Settings & Sync
          </button>
        </nav>

        {/* Right Section: Status Pills & Action Button */}
        <div className="flex items-center gap-2 text-xs">
          {/* App Latest Updates Trigger Button */}
          {needRefresh ? (
            <button
              type="button"
              onClick={() => applyUpdate()}
              className="px-2.5 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-stone-950 font-bold rounded-lg flex items-center gap-1.5 shadow-xs transition-all cursor-pointer animate-pulse text-[11px]"
              title="New version available! Click to update safely without losing drafts"
            >
              <Sparkles className="w-3.5 h-3.5 text-stone-950 stroke-[2.5]" />
              <span>Update Ready</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleManualCheckUpdates}
              disabled={isCheckingUpdate}
              className="p-1.5 sm:px-2.5 sm:py-1.5 bg-stone-800/90 hover:bg-stone-700 text-stone-300 hover:text-amber-400 border border-stone-700/80 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer text-xs"
              title="Click to check for latest app updates from GitHub"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin text-amber-400' : 'text-stone-400'}`} />
              {updateFeedback ? (
                <span className="text-[11px] text-emerald-400 font-semibold">{updateFeedback}</span>
              ) : (
                <span className="hidden sm:inline text-[11px] text-stone-300 font-medium">
                  {isCheckingUpdate ? 'Checking...' : 'Check Updates'}
                </span>
              )}
            </button>
          )}

          {/* Reactive Sync Telemetry Badge */}
          <SyncTelemetryBadge compact={true} showForceSyncButton={true} />

          {/* Trigger & Process Notifications Center Button */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => {
                setIsNotifOpen(!isNotifOpen);
                if (!isNotifOpen && unreadCount > 0) {
                  appNotificationService.markAllAsRead();
                }
              }}
              className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white border border-stone-700/80 transition-colors relative cursor-pointer"
              title="View system process triggers, prompts & telemetry notifications"
            >
              <Bell className="w-3.5 h-3.5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-stone-950 font-bold text-[9px] rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Center Popover */}
            {isNotifOpen && (
              <div className="absolute right-0 top-full mt-2 w-84 sm:w-104 bg-stone-900 border border-stone-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-slide-down text-stone-100 flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="p-3 border-b border-stone-800 flex items-center justify-between bg-stone-950/90 shrink-0">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-xs">Process & Telemetry Center</span>
                    <span className="px-1.5 py-0.2 bg-stone-800 text-[10px] text-stone-400 rounded-full font-mono">
                      {notifications.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleSound}
                      className={`p-1 rounded transition-colors cursor-pointer ${
                        soundEnabled ? 'text-amber-400 hover:bg-stone-800' : 'text-stone-500 hover:text-stone-300'
                      }`}
                      title={soundEnabled ? 'Sound alert cues enabled (Click to mute)' : 'Sound alert cues muted (Click to enable)'}
                    >
                      {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                    </button>

                    {notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={handleExportDiagnostics}
                        className="p-1 text-stone-400 hover:text-emerald-400 rounded transition-colors cursor-pointer"
                        title="Export telemetry diagnostics JSON"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {notifications.some((n) => n.resolved || n.severity === 'SUCCESS') && (
                      <button
                        type="button"
                        onClick={() => appNotificationService.dismissResolved()}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 cursor-pointer transition-colors"
                        title="Clear all resolved items"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Resolved</span>
                      </button>
                    )}

                    {notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={() => appNotificationService.clearHistory()}
                        className="text-[11px] text-stone-400 hover:text-rose-400 flex items-center gap-0.5 cursor-pointer transition-colors"
                        title="Clear notification history"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Clear</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setIsNotifOpen(false)}
                      className="text-stone-400 hover:text-white p-0.5 rounded cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Filter and Search Sub-header */}
                <div className="p-2.5 bg-stone-950/60 border-b border-stone-800 space-y-2 shrink-0">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      value={notifSearch}
                      onChange={(e) => setNotifSearch(e.target.value)}
                      placeholder="Search telemetry triggers, doc numbers..."
                      className="w-full pl-8 pr-2.5 py-1 text-[11px] bg-stone-900 border border-stone-700/80 rounded-lg text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[10px]">
                    {[
                      { id: 'ALL', label: 'All' },
                      { id: 'PROPAGATION_VALIDATION', label: 'Parity' },
                      { id: 'SYNC_PROCESS', label: 'Sync' },
                      { id: 'APPS_SCRIPT', label: 'Apps Script' },
                      { id: 'SYSTEM_PROMPT', label: 'Prompts' },
                      { id: 'SELF_HEALING', label: 'Self-Healing' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setCategoryFilter(tab.id as any)}
                        className={`px-2 py-0.5 rounded-full whitespace-nowrap font-medium transition-colors cursor-pointer ${
                          categoryFilter === tab.id
                            ? 'bg-amber-500 text-stone-950 font-bold'
                            : 'bg-stone-800 text-stone-400 hover:bg-stone-700 hover:text-stone-200'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notification Items List */}
                <div className="overflow-y-auto divide-y divide-stone-800/80 flex-1">
                  {filteredNotifications.length === 0 ? (
                    <div className="p-6 text-center text-stone-400 space-y-1">
                      <CheckCircle2 className="w-6 h-6 text-stone-600 mx-auto" />
                      <p className="text-xs font-semibold text-stone-300">
                        {notifSearch || categoryFilter !== 'ALL'
                          ? 'No matching telemetry records'
                          : 'All Systems Operating Optimally'}
                      </p>
                      <p className="text-[11px] text-stone-500">
                        Apps Script updates, document parity checks, and sync events will stream here in real time.
                      </p>
                    </div>
                  ) : (
                    filteredNotifications.map((notif) => {
                      const actionsToRender: NotificationActionItem[] =
                        notif.actions && notif.actions.length > 0
                          ? notif.actions
                          : notif.action
                          ? [notif.action]
                          : [];

                      return (
                        <div key={notif.id} className="p-3 hover:bg-stone-800/40 transition-colors space-y-1.5 group">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold border ${
                                  notif.category === 'APPS_SCRIPT'
                                    ? 'bg-purple-950 text-purple-300 border-purple-800'
                                    : notif.category === 'PROPAGATION_VALIDATION'
                                    ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                    : notif.category === 'SYNC_PROCESS'
                                    ? 'bg-blue-950 text-blue-300 border-blue-800'
                                    : notif.category === 'SYSTEM_PROMPT'
                                    ? 'bg-amber-950 text-amber-300 border-amber-800'
                                    : 'bg-stone-800 text-stone-300 border-stone-700'
                                }`}
                              >
                                {notif.category.replace('_', ' ')}
                              </span>
                              {notif.resolved && (
                                <span className="px-1.5 py-0.2 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded text-[9px] font-bold flex items-center gap-0.5">
                                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                                  <span>Resolved</span>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-stone-500 font-mono">
                                {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <button
                                type="button"
                                onClick={() => appNotificationService.dismiss(notif.id)}
                                className="text-stone-500 hover:text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 cursor-pointer"
                                title="Dismiss"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <p className="font-bold text-xs text-white leading-tight">{notif.title}</p>
                          <p className="text-[11px] text-stone-300 leading-relaxed">{notif.message}</p>

                          {/* Action Buttons */}
                          {actionsToRender.length > 0 && (
                            <div className="pt-1 flex items-center gap-2 flex-wrap">
                              {actionsToRender.map((act) => (
                                <button
                                  key={act.id}
                                  type="button"
                                  disabled={executingActionId === act.id}
                                  onClick={() => handleExecuteDrawerAction(notif, act)}
                                  className={`px-2 py-0.5 font-bold rounded text-[10px] inline-flex items-center gap-1 cursor-pointer transition-colors ${
                                    act.variant === 'danger'
                                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                                      : act.variant === 'ghost'
                                      ? 'bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700'
                                      : 'bg-amber-500 hover:bg-amber-400 text-stone-950'
                                  }`}
                                >
                                  {act.actionType === 'OPEN_PARITY_VALIDATOR' && (
                                    <ShieldCheck className="w-3 h-3 text-inherit" />
                                  )}
                                  <span>{act.label}</span>
                                </button>
                              ))}
                              {notif.resolved && (
                                <span className="text-[9.5px] text-emerald-400">Synchronized</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick New Document Button */}
          <button
            type="button"
            onClick={onQuickNewDoc}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-stone-950" />
            <span className="hidden sm:inline">New Document</span>
          </button>
        </div>
      </div>
    </header>
  );
};
