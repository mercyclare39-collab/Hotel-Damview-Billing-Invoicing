import { usePWA } from './usePWA';

export { type BeforeInstallPromptEvent } from '../services/pwaService';

export function usePWAInstall() {
  const { isInstallable, isInstalled, isIOS, isMobile, install } = usePWA();

  return {
    isInstallable,
    hasPrompt: isInstallable,
    isInstalled,
    isIOS,
    isMobile,
    install,
  };
}
