/**
 * PWA Service Worker Lifecycle, In-App Installation & Auto-Update Engine
 * Hotel Damview Management Suite
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface PWAState {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  isMobile: boolean;
  needRefresh: boolean;
  offlineReady: boolean;
  isCheckingUpdate: boolean;
  lastChecked: Date | null;
  remoteBuildTime?: string;
  localBuildTime?: string;
}

declare const __APP_VERSION__: string | undefined;
declare const __BUILD_TIME__: string | undefined;

export const CURRENT_APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '5.0.0';
export const CURRENT_BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '2026-09-26T10:40:00.000Z';

type PWAEventListener = (state: PWAState) => void;

class PWAService {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private registration: ServiceWorkerRegistration | null = null;
  private listeners: Set<PWAEventListener> = new Set();
  private refreshing = false;
  private updateCheckInterval: any = null;
  private versionCheckInterval: any = null;

  private state: PWAState = {
    isInstallable: false,
    isInstalled: false,
    isIOS: false,
    isMobile: false,
    needRefresh: false,
    offlineReady: false,
    isCheckingUpdate: false,
    lastChecked: null,
    localBuildTime: CURRENT_BUILD_TIME,
  };

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  /**
   * Initializes service worker listeners, install interception, and update loops
   */
  private init() {
    this.detectDeviceAndDisplay();
    this.setupInstallPromptListener();
    this.setupServiceWorkerLifecycle();
    this.setupBackgroundUpdateChecks();
    
    // Initial check 3 seconds after boot
    setTimeout(() => {
      this.checkForUpdate();
      this.checkRemoteVersionJson();
    }, 3000);
  }

  /**
   * Detects device ecosystem (iOS vs Android/Desktop) and standalone display modes
   */
  private detectDeviceAndDisplay() {
    if (typeof window === 'undefined') return;

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    this.state.isIOS = isIOSDevice;
    this.state.isMobile = isMobileDevice;
    this.state.isInstalled = isStandalone;

    // Listen for standalone display mode changes
    try {
      const mediaQuery = window.matchMedia('(display-mode: standalone)');
      mediaQuery.addEventListener('change', (e) => {
        if (e.matches) {
          this.state.isInstalled = true;
          this.state.isInstallable = false;
          this.deferredPrompt = null;
          this.notify();
        }
      });
    } catch {
      // Fallback for older browsers
    }
  }

  /**
   * Stashes the beforeinstallprompt event for direct 1-click in-app install triggers
   */
  private setupInstallPromptListener() {
    if (typeof window === 'undefined') return;

    window.addEventListener('beforeinstallprompt', (e: Event) => {
      // Suppress default ambient browser bar to provide direct custom in-app button
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.state.isInstallable = true;
      this.notify();
    });

    window.addEventListener('appinstalled', () => {
      this.state.isInstalled = true;
      this.state.isInstallable = false;
      this.deferredPrompt = null;
      this.notify();
    });
  }

  /**
   * Orchestrates the service worker registration and lifecycle events
   */
  private setupServiceWorkerLifecycle() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    // Register service worker with updateViaCache: 'none' so browser never uses HTTP cache for sw.js
    navigator.serviceWorker.ready
      .then((registration) => {
        this.registration = registration;
        this.state.offlineReady = true;
        this.notify();

        // If a worker is already waiting in background, notify or activate
        if (registration.waiting) {
          this.onNewVersionAvailable(registration.waiting);
        }

        // Listen for new service worker installation
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // New update available
                this.onNewVersionAvailable(newWorker);
              } else {
                // Precached for offline use for the first time
                this.state.offlineReady = true;
                this.notify();
              }
            }
          });
        });
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker ready error:', err);
      });

    // When the controlling service worker changes, safely refresh or notify
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (this.refreshing) return;

      // Check if the user is actively typing or filling documents before auto-reloading
      if (this.isUserActivelyEditing()) {
        this.state.needRefresh = true;
        this.notify();
      } else {
        this.refreshing = true;
        window.location.reload();
      }
    });
  }

  /**
   * Sets up background periodic update checks on focus, online reconnection, and intervals
   */
  private setupBackgroundUpdateChecks() {
    if (typeof window === 'undefined') return;

    // 1. Periodic ServiceWorker check every 60 seconds
    this.updateCheckInterval = setInterval(() => {
      this.checkForUpdate();
      this.checkRemoteVersionJson();
    }, 60 * 1000);

    // 2. Check immediately when network reconnects
    window.addEventListener('online', () => {
      this.checkForUpdate();
      this.checkRemoteVersionJson();
    });

    // 3. Check when the tab gains focus or returns to visibility
    window.addEventListener('focus', () => {
      this.checkForUpdate();
      this.checkRemoteVersionJson();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.checkForUpdate();
        this.checkRemoteVersionJson();
      }
    });
  }

  /**
   * Fetches remote version.json bypassing all HTTP and ServiceWorker caches
   */
  public async checkRemoteVersionJson(): Promise<boolean> {
    if (typeof window === 'undefined' || !navigator.onLine) return false;

    try {
      // Determine base URL path
      const baseUrl = window.location.pathname.endsWith('/')
        ? window.location.pathname
        : window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);

      const versionUrl = `${baseUrl}version.json?t=${Date.now()}`;
      const res = await fetch(versionUrl, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      if (!res.ok) return false;

      const data = await res.json();
      if (data && data.buildTime) {
        this.state.remoteBuildTime = data.buildTime;
        const remoteTime = new Date(data.buildTime).getTime();
        const localTime = new Date(CURRENT_BUILD_TIME).getTime();

        if (remoteTime > localTime || (data.version && data.version !== CURRENT_APP_VERSION)) {
          this.state.needRefresh = true;
          this.notify();

          // Auto-trigger service worker update
          if (this.registration) {
            await this.registration.update();
            if (this.registration.waiting) {
              this.onNewVersionAvailable(this.registration.waiting);
            }
          }
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Programmatically requests the browser to check for updated Service Worker manifests
   */
  public async checkForUpdate(): Promise<boolean> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;

    try {
      this.state.isCheckingUpdate = true;
      this.notify();

      const reg = this.registration || (await navigator.serviceWorker.getRegistration());
      if (reg) {
        this.registration = reg;
        await reg.update();
        this.state.lastChecked = new Date();

        if (reg.waiting) {
          this.onNewVersionAvailable(reg.waiting);
          return true;
        }
      }
      return false;
    } catch (err) {
      console.warn('[PWA] Periodic update check encountered an issue:', err);
      return false;
    } finally {
      this.state.isCheckingUpdate = false;
      this.notify();
    }
  }

  /**
   * Handles new service worker detection
   */
  private onNewVersionAvailable(worker: ServiceWorker) {
    this.state.needRefresh = true;
    this.notify();

    // If user is NOT editing anything, auto-activate smoothly
    if (!this.isUserActivelyEditing()) {
      worker.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  /**
   * Checks if user is currently interacting with an active form or editing a document
   * to protect uncommitted financial entries from unexpected page reloads
   */
  public isUserActivelyEditing(): boolean {
    if (typeof document === 'undefined') return false;

    const activeEl = document.activeElement;
    if (activeEl) {
      const tagName = activeEl.tagName.toLowerCase();
      const isInput = tagName === 'input' || tagName === 'textarea' || tagName === 'select';
      const isContentEditable = activeEl.getAttribute('contenteditable') === 'true';
      if (isInput || isContentEditable) {
        return true;
      }
    }

    // Check if any active modal or document editor is mounted
    const hasActiveModal = document.querySelector('[role="dialog"], .modal-open, #document-editor');
    return !!hasActiveModal;
  }

  /**
   * Applies the waiting update and safely reloads the application with zero data loss
   */
  public applyUpdate() {
    if (typeof window === 'undefined') return;

    try {
      // Notify all active forms/editors to flush unsaved draft state immediately
      window.dispatchEvent(new CustomEvent('damview-before-app-update'));
    } catch {}

    if (this.registration && this.registration.waiting) {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    this.refreshing = true;
    setTimeout(() => {
      window.location.reload();
    }, 80);
  }

  /**
   * Permanent Nuclear Cache Wipe & Force Update:
   * Clears CacheStorage, unregisters stale Service Workers, and forces hard reload
   */
  public async forceClearCacheAndReload(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      // 1. Delete all CacheStorage caches
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }

      // 2. Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((reg) => reg.unregister()));
      }

      // 3. Clear session storage flags
      try {
        sessionStorage.clear();
      } catch {}

      // 4. Force hard reload with cache buster query
      const url = new URL(window.location.href);
      url.searchParams.set('force_update', Date.now().toString());
      window.location.href = url.toString();
    } catch {
      window.location.reload();
    }
  }

  /**
   * Invokes the direct 1-click in-app install prompt
   */
  public async promptInstall(): Promise<'accepted' | 'dismissed' | 'unsupported'> {
    if (!this.deferredPrompt) {
      return 'unsupported';
    }

    try {
      await this.deferredPrompt.prompt();
      const choice = await this.deferredPrompt.userChoice;

      if (choice.outcome === 'accepted') {
        this.state.isInstalled = true;
        this.state.isInstallable = false;
        this.deferredPrompt = null;
        this.notify();
        return 'accepted';
      }
      return 'dismissed';
    } catch (err) {
      console.warn('[PWA] In-App prompt invocation error:', err);
      return 'unsupported';
    }
  }

  /**
   * State subscription pattern
   */
  public subscribe(listener: PWAEventListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): PWAState {
    return { ...this.state };
  }

  private notify() {
    const currentState = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(currentState);
      } catch (err) {
        console.error('[PWA] Listener notification error:', err);
      }
    });
  }
}

export const pwaService = new PWAService();
