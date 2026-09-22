import React, { useState } from 'react';
import { Download, Share, X, Check, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'full' | 'sidebar';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'full' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already running as an installed PWA in standalone mode, hide the button
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    setIsInstalling(true);
    try {
      await install();
    } finally {
      setIsInstalling(false);
    }
  };

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    if (variant === 'sidebar') {
      return (
        <button
          type="button"
          onClick={handleInstallClick}
          disabled={isInstalling}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 text-xs font-bold rounded-md shadow-xs transition-all"
        >
          <Download className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Install Damview App</span>
        </button>
      );
    }

    if (variant === 'compact') {
      return (
        <button
          type="button"
          onClick={handleInstallClick}
          disabled={isInstalling}
          title="Install Hotel Damview as PWA"
          className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded text-xs font-bold shadow-xs transition-colors"
        >
          <Download className="w-3 h-3 stroke-[2.5]" />
          <span>Install</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={handleInstallClick}
        disabled={isInstalling}
        className="inline-flex items-center gap-2 rounded-md bg-stone-900 hover:bg-stone-800 border border-amber-500/40 px-3.5 py-1.5 text-xs font-semibold text-amber-400 shadow-xs transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari flow (beforeinstallprompt is not supported by WebKit)
  if (isIOS) {
    return (
      <>
        {variant === 'sidebar' ? (
          <button
            type="button"
            onClick={() => setShowIOSGuide(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-stone-800 hover:bg-stone-700 text-amber-300 text-xs font-medium rounded-md border border-stone-700 transition-colors"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Install on iOS</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowIOSGuide(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-700 bg-stone-800/80 px-2.5 py-1 text-xs font-medium text-stone-300 hover:bg-stone-800 hover:text-white"
          >
            <Share className="w-3 h-3" />
            <span>Install on iPhone</span>
          </button>
        )}

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 backdrop-blur-xs p-4 animate-fade-in">
            <div className="w-full max-w-sm rounded-xl bg-stone-900 border border-stone-700 p-5 shadow-2xl text-stone-100 space-y-4">
              <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Install on iPhone / iPad</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-stone-400 hover:text-white rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-stone-300">
                <div className="flex items-start gap-3 bg-stone-950/60 p-2.5 rounded-lg border border-stone-800">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500 text-stone-950 font-bold text-xs flex items-center justify-center">
                    1
                  </span>
                  <p>
                    Tap the <strong>Share</strong> button (
                    <Share className="w-3 h-3 inline-block text-amber-400 mx-0.5" />
                    ) in Safari's bottom toolbar.
                  </p>
                </div>

                <div className="flex items-start gap-3 bg-stone-950/60 p-2.5 rounded-lg border border-stone-800">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500 text-stone-950 font-bold text-xs flex items-center justify-center">
                    2
                  </span>
                  <p>
                    Scroll down and tap <strong>Add to Home Screen</strong>.
                  </p>
                </div>

                <div className="flex items-start gap-3 bg-stone-950/60 p-2.5 rounded-lg border border-stone-800">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500 text-stone-950 font-bold text-xs flex items-center justify-center">
                    3
                  </span>
                  <p>
                    Tap <strong>Add</strong> in the top-right corner to launch Damview ERP directly in offline mode.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-md bg-stone-800 hover:bg-stone-700 py-2 text-xs font-semibold text-stone-200 transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
