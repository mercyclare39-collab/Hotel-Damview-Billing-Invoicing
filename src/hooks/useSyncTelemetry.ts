import { useState, useEffect, useCallback } from 'react';
import { SyncTelemetry, SyncHumanStatus } from '../types';
import { syncManager } from '../services/syncManager';

const DEFAULT_TELEMETRY: SyncTelemetry = {
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSyncing: false,
  pendingCount: 0,
  syncingCount: 0,
  failedCount: 0,
  totalQueuedCount: 0,
  lastSyncTimestamp: null,
  lastError: null,
  statusText: 'All Changes Saved Locally',
  humanStatus: 'All Changes Saved Locally',
};

export interface UseSyncTelemetryReturn extends SyncTelemetry {
  forceSyncNow: () => Promise<{ success: boolean; message: string; processedCount: number }>;
  triggerSync: () => void;
}

export function useSyncTelemetry(): UseSyncTelemetryReturn {
  const [telemetry, setTelemetry] = useState<SyncTelemetry>(DEFAULT_TELEMETRY);

  useEffect(() => {
    // Initial fetch
    syncManager.getTelemetry().then(setTelemetry).catch(() => {});

    // Subscribe to SyncManager reactive stream
    const unsubscribe = syncManager.subscribeTelemetry((newTelemetry) => {
      setTelemetry(newTelemetry);
    });

    // Also listen to custom window events
    const handleWindowEvent = (event: Event) => {
      const customEvent = event as CustomEvent<SyncTelemetry>;
      if (customEvent.detail) {
        setTelemetry(customEvent.detail);
      }
    };

    window.addEventListener('damview:sync-telemetry', handleWindowEvent);

    return () => {
      unsubscribe();
      window.removeEventListener('damview:sync-telemetry', handleWindowEvent);
    };
  }, []);

  const handleForceSyncNow = useCallback(async () => {
    return await syncManager.forceSyncNow();
  }, []);

  const handleTriggerSync = useCallback(() => {
    syncManager.triggerBackgroundSync();
  }, []);

  return {
    ...telemetry,
    forceSyncNow: handleForceSyncNow,
    triggerSync: handleTriggerSync,
  };
}
