import React from 'react';
import { WifiOff, Database, ShieldCheck } from 'lucide-react';

interface OfflineBannerProps {
  isOnline: boolean;
  pendingSyncCount: number;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ isOnline, pendingSyncCount }) => {
  if (isOnline) return null;

  return (
    <div className="bg-stone-900 border-b border-amber-500/30 px-4 py-2 text-stone-200 text-xs flex items-center justify-between no-print shadow-xs">
      <div className="flex items-center gap-2">
        <div className="p-1 bg-amber-500/20 text-amber-400 rounded">
          <WifiOff className="w-3.5 h-3.5" />
        </div>
        <div>
          <span className="font-semibold text-amber-300">Offline Mode Active:</span>{' '}
          <span className="text-stone-300">
            All edits, invoices, quotations, and payments are safely stored in your browser's IndexedDB.
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-stone-400">
        {pendingSyncCount > 0 && (
          <span className="bg-amber-950/80 text-amber-300 border border-amber-800/80 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
            <Database className="w-3 h-3" />
            {pendingSyncCount} {pendingSyncCount === 1 ? 'item' : 'items'} queued for Google Sync
          </span>
        )}
        <span className="hidden sm:flex items-center gap-1 text-emerald-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Local Vault Secure</span>
        </span>
      </div>
    </div>
  );
};
