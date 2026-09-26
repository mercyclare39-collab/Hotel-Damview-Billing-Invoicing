import React from 'react';
import {
  LayoutDashboard,
  FileText,
  FileSpreadsheet,
  Users,
  Settings,
  Plus,
} from 'lucide-react';
import { HotelLogo } from './HotelLogo';
import { HotelProfile } from '../types';
import { SyncTelemetryBadge } from './SyncTelemetryBadge';
import { usePWA } from '../hooks/usePWA';
import { Sparkles, RefreshCw } from 'lucide-react';

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
  const [updateFeedback, setUpdateFeedback] = React.useState<string | null>(null);

  const handleManualCheckUpdates = async () => {
    const hasSw = await checkForUpdate();
    const hasRemote = await checkRemoteVersionJson();
    if (!hasSw && !hasRemote) {
      setUpdateFeedback('Up to Date');
      setTimeout(() => setUpdateFeedback(null), 3000);
    }
  };
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
          {/* App Latest Updates Trigger Icon / Button */}
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

          {/* Quick New Document Button */}
          <button
            type="button"
            onClick={onQuickNewDoc}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded flex items-center gap-1 shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-stone-950" />
            <span className="hidden sm:inline">New Document</span>
          </button>
        </div>
      </div>
    </header>
  );
};
