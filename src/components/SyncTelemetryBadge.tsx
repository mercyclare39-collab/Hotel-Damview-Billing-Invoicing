import React, { useState } from 'react';
import {
  Wifi,
  WifiOff,
  Cloud,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Database,
  ArrowUpRight,
} from 'lucide-react';
import { useSyncTelemetry } from '../hooks/useSyncTelemetry';

interface SyncTelemetryBadgeProps {
  compact?: boolean;
  className?: string;
  showForceSyncButton?: boolean;
}

export const SyncTelemetryBadge: React.FC<SyncTelemetryBadgeProps> = ({
  compact = false,
  className = '',
  showForceSyncButton = true,
}) => {
  const {
    isOnline,
    isSyncing,
    pendingCount,
    syncingCount,
    failedCount,
    totalQueuedCount,
    humanStatus,
    statusText,
    lastError,
    forceSyncNow,
  } = useSyncTelemetry();

  const [isForcing, setIsForcing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleForceSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isForcing || isSyncing) return;
    setIsForcing(true);
    setFeedback(null);
    try {
      const res = await forceSyncNow();
      setFeedback(res.message);
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      setFeedback(err.message || 'Sync failed');
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setIsForcing(false);
    }
  };

  const renderStatusIcon = () => {
    if (!isOnline) {
      return <WifiOff className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
    }
    if (isSyncing || isForcing) {
      return <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />;
    }
    if (failedCount > 0 && pendingCount === 0) {
      return <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    }
    if (totalQueuedCount === 0) {
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    }
    return <Database className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
  };

  const getStatusColors = () => {
    if (!isOnline) {
      return 'bg-rose-950/70 border-rose-800/80 text-rose-300';
    }
    if (isSyncing || isForcing) {
      return 'bg-amber-950/70 border-amber-800/80 text-amber-300';
    }
    if (totalQueuedCount === 0) {
      return 'bg-emerald-950/70 border-emerald-800/80 text-emerald-300';
    }
    return 'bg-stone-800/90 border-stone-700 text-stone-200';
  };

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 ${className}`}>
        <div
          className={`px-2 py-1 rounded text-[11px] font-medium border flex items-center gap-1.5 transition-all ${getStatusColors()}`}
          title={`${humanStatus} - ${statusText} (Total Queue Depth: ${totalQueuedCount})`}
        >
          {renderStatusIcon()}
          <span>{humanStatus}</span>
          {totalQueuedCount > 0 && (
            <span className="px-1.5 py-0.2 text-[10px] bg-stone-900/80 rounded-full font-bold">
              {totalQueuedCount}
            </span>
          )}
        </div>

        {showForceSyncButton && isOnline && (
          <button
            type="button"
            onClick={handleForceSync}
            disabled={isForcing || isSyncing}
            className="px-2 py-1 bg-stone-800 hover:bg-stone-700 disabled:opacity-50 text-stone-300 hover:text-white rounded border border-stone-700 text-[11px] flex items-center gap-1 transition-colors"
            title="Force immediate local queue flush to Google Apps Script"
          >
            <RefreshCw className={`w-3 h-3 ${isForcing ? 'animate-spin text-amber-400' : 'text-stone-400'}`} />
            <span className="hidden sm:inline">{isForcing ? 'Flushing...' : 'Sync'}</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`p-3 rounded-lg border bg-stone-900/90 backdrop-blur-sm shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${getStatusColors()} ${className}`}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-md bg-stone-950/60 border border-stone-800/80">
          {renderStatusIcon()}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm tracking-wide text-white">
              {humanStatus}
            </span>
            {totalQueuedCount > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {totalQueuedCount} queued
              </span>
            )}
            {isOnline ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/60">
                <Wifi className="w-2.5 h-2.5" /> Online
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] text-rose-400 bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-800/60">
                <WifiOff className="w-2.5 h-2.5" /> Offline
              </span>
            )}
          </div>
          <p className="text-stone-400 text-[11px] mt-0.5 leading-relaxed">
            {statusText}
            {lastError && !isSyncing && (
              <span className="block text-rose-400 text-[10px] mt-0.5">
                Notice: {lastError}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center">
        {feedback && (
          <span className="text-[11px] text-amber-300 font-medium animate-pulse">
            {feedback}
          </span>
        )}
        {showForceSyncButton && (
          <button
            type="button"
            onClick={handleForceSync}
            disabled={isForcing || isSyncing || !isOnline}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:bg-stone-800 disabled:text-stone-500 text-stone-950 font-bold rounded text-xs flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isForcing || isSyncing ? 'animate-spin' : ''}`} />
            {isForcing ? 'Flushing Queue...' : 'Force Sync Now'}
          </button>
        )}
      </div>
    </div>
  );
};
