import { useEffect, useState, useCallback } from 'react';
import { pwaService, PWAState } from '../services/pwaService';

export function usePWA() {
  const [state, setState] = useState<PWAState>(() => pwaService.getState());

  useEffect(() => {
    const unsubscribe = pwaService.subscribe((newState) => {
      setState(newState);
    });
    return unsubscribe;
  }, []);

  const install = useCallback(async () => {
    return await pwaService.promptInstall();
  }, []);

  const checkForUpdate = useCallback(async () => {
    return await pwaService.checkForUpdate();
  }, []);

  const applyUpdate = useCallback(() => {
    pwaService.applyUpdate();
  }, []);

  const checkRemoteVersionJson = useCallback(async () => {
    return await pwaService.checkRemoteVersionJson();
  }, []);

  const forceClearCacheAndReload = useCallback(async () => {
    await pwaService.forceClearCacheAndReload();
  }, []);

  return {
    ...state,
    install,
    checkForUpdate,
    checkRemoteVersionJson,
    applyUpdate,
    forceClearCacheAndReload,
  };
}
