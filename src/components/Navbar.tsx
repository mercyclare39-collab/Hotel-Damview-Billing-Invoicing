import React from 'react';
import {
  LayoutDashboard,
  FileText,
  FileSpreadsheet,
  Users,
  Settings,
  Plus,
  Wifi,
  WifiOff,
  Cloud,
  CloudOff,
  RefreshCw,
} from 'lucide-react';
import { HotelLogo } from './HotelLogo';
import { HotelProfile } from '../types';

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
          {/* Online/Offline status pill */}
          <div
            className={`px-2 py-1 rounded-full text-[11px] font-medium flex items-center gap-1 border ${
              isOnline
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80'
                : 'bg-rose-950/80 text-rose-300 border-rose-800/80'
            }`}
            title={isOnline ? 'Internet connection active' : 'Working offline (IndexedDB local cache active)'}
          >
            {isOnline ? <Wifi className="w-3 h-3 text-emerald-400" /> : <WifiOff className="w-3 h-3 text-rose-400" />}
            <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline Mode'}</span>
          </div>

          {/* Sync Status Button */}
          {profile.googleWebAppUrl && (
            <button
              type="button"
              onClick={onTriggerSync}
              className="px-2 py-1 bg-stone-800 hover:bg-stone-700 rounded text-[11px] text-stone-300 hover:text-white border border-stone-700 flex items-center gap-1.5 transition-colors"
              title={
                pendingSyncCount > 0
                  ? `${pendingSyncCount} changes waiting to sync to Google Sheets`
                  : 'Google Sheets webhook connected and up to date'
              }
            >
              <Cloud className="w-3 h-3 text-blue-400" />
              {pendingSyncCount > 0 ? (
                <span className="font-bold text-amber-400">{pendingSyncCount} pending</span>
              ) : (
                <span className="text-stone-400 hidden sm:inline">Synced</span>
              )}
            </button>
          )}

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
