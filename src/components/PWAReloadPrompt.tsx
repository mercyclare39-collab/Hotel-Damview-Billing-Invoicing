import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, X } from 'lucide-react';

export const PWAReloadPrompt: React.FC = () => {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(() => {
          setOfflineReady(true);
        })
        .catch((err) => {
          console.warn('SW ready check:', err);
        });

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  }, []);

  const handleUpdate = () => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg && reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    }
  };

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-stone-700 bg-stone-900 p-4 shadow-2xl text-stone-100 animate-slide-up no-print">
      <div className="flex items-start gap-3">
        {offlineReady ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        ) : (
          <RefreshCw className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        )}

        <div className="flex-1 space-y-1">
          <p className="text-xs font-semibold text-white">
            {offlineReady ? 'App Ready for Offline Use' : 'New Update Available'}
          </p>
          <p className="text-[11px] text-stone-300">
            {offlineReady
              ? 'Hotel Damview is cached and operational on this device.'
              : 'A new version has been cached. Reload to apply updates.'}
          </p>

          <div className="flex items-center gap-2 pt-2">
            {needRefresh && (
              <button
                type="button"
                onClick={handleUpdate}
                className="bg-amber-500 hover:bg-amber-400 text-stone-950 px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer"
              >
                Reload Now
              </button>
            )}
            <button
              type="button"
              onClick={close}
              className="px-2.5 py-1 text-xs text-stone-400 hover:text-white rounded border border-stone-700 hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={close}
          className="text-stone-400 hover:text-white p-1 rounded cursor-pointer"
          aria-label="Close notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
