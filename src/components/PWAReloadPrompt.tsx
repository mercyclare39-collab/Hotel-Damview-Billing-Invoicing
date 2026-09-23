import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, X, Sparkles } from 'lucide-react';
import { usePWA } from '../hooks/usePWA';

export const PWAReloadPrompt: React.FC = () => {
  const { needRefresh, offlineReady, isCheckingUpdate, applyUpdate } = usePWA();
  const [dismissed, setDismissed] = useState(false);
  const [showOfflineToast, setShowOfflineToast] = useState(false);

  // Auto-show offline ready toast once for 5 seconds when first cached
  useEffect(() => {
    if (offlineReady && !needRefresh && !dismissed) {
      setShowOfflineToast(true);
      const timer = setTimeout(() => {
        setShowOfflineToast(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [offlineReady, needRefresh, dismissed]);

  // Reset dismissal if a new update arrives
  useEffect(() => {
    if (needRefresh) {
      setDismissed(false);
    }
  }, [needRefresh]);

  if (dismissed || (!needRefresh && !showOfflineToast)) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-stone-700/80 bg-stone-900/95 backdrop-blur-md p-4 shadow-2xl text-stone-100 animate-slide-up no-print"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-stone-800 border border-stone-700 shrink-0 mt-0.5">
          {needRefresh ? (
            <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          )}
        </div>

        <div className="flex-1 space-y-1">
          <p className="text-xs font-bold text-white flex items-center gap-2">
            {needRefresh ? 'Update Available' : 'Ready for Offline Use'}
          </p>
          <p className="text-[11px] text-stone-300 leading-relaxed">
            {needRefresh
              ? 'Hotel Damview has been updated to the latest version. Reload to apply improvements.'
              : 'Hotel Damview is precached and fully operational offline on this device.'}
          </p>

          <div className="flex items-center gap-2 pt-2">
            {needRefresh ? (
              <button
                type="button"
                onClick={() => applyUpdate()}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className="w-3 h-3 stroke-[2.5]" />
                <span>Reload to Apply</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => {
                setDismissed(true);
                setShowOfflineToast(false);
              }}
              className="px-2.5 py-1.5 text-xs text-stone-400 hover:text-white rounded-lg border border-stone-700/80 hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            setShowOfflineToast(false);
          }}
          className="text-stone-400 hover:text-white p-1 rounded-md cursor-pointer hover:bg-stone-800 transition-colors"
          aria-label="Close notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
