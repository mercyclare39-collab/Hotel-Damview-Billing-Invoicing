/**
 * CENTRALIZED INTERACTIVE APP NOTIFICATION & PROCESS MONITORING SERVICE
 * Hotel Damview ERP (Kenya)
 *
 * High-performance, low-latency notification engine supporting:
 * 1. Interactive action prompts with secondary controls and confirmation workflows
 * 2. Non-intrusive presentation with pause-on-interaction & silent focus modes
 * 3. Categorized real-time telemetry (Sync, Parity, Apps Script, Engine Updates, Self-Healing)
 * 4. Synthetic zero-asset Web Audio cues for critical confirmations
 * 5. Persistent diagnostic history with search and export capabilities
 */

export type NotificationCategory =
  | 'APPS_SCRIPT'
  | 'PROPAGATION_VALIDATION'
  | 'SYNC_PROCESS'
  | 'APP_UPDATE'
  | 'DOCUMENT'
  | 'SELF_HEALING'
  | 'SYSTEM_PROMPT';

export type NotificationSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'PROMPT';

export type NotificationPriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';

export interface NotificationActionItem {
  id: string;
  label: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  actionType?: 'OPEN_PARITY_VALIDATOR' | 'OPEN_APPS_SCRIPT_DIFF' | 'VIEW_SETTINGS' | 'CUSTOM';
  targetDocumentNumber?: string;
  onClick?: (notif: AppNotification) => Promise<void> | void;
}

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  priority: NotificationPriority;
  title: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  read: boolean;
  autoDismissMs?: number; // 0 or undefined for persistent / manual dismiss
  resolved?: boolean;
  action?: NotificationActionItem;
  actions?: NotificationActionItem[];
  documentNumber?: string;
  isPrompt?: boolean;
  requiresConfirmation?: boolean;
  onConfirm?: () => Promise<void> | void;
  onCancel?: () => void;
  isLoadingAction?: boolean;
}

type NotificationSubscriber = (notifications: AppNotification[]) => void;

class AppNotificationService {
  private notifications: AppNotification[] = [];
  private subscribers: Set<NotificationSubscriber> = new Set();
  private maxHistory = 60;
  private soundEnabled = false;
  private audioCtx: AudioContext | null = null;

  constructor() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = localStorage.getItem('damview_notification_history');
        if (saved) {
          this.notifications = JSON.parse(saved).slice(0, this.maxHistory);
        }
        const soundPref = localStorage.getItem('damview_notif_sound');
        this.soundEnabled = soundPref === 'true';
      } catch {}
    }
  }

  public isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
    try {
      localStorage.setItem('damview_notif_sound', String(enabled));
    } catch {}
  }

  /**
   * Plays a subtle synthesized acoustic chime for interactive prompts/alerts (Zero external dependencies)
   */
  private playChime(type: 'success' | 'alert' | 'prompt' = 'prompt') {
    if (!this.soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'alert') {
        osc.frequency.setValueAtTime(440, now); // A4
        osc.frequency.setValueAtTime(349.23, now + 0.08); // F4
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else {
        // Subtle interactive prompt ping
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.08); // E5
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      }
    } catch {
      // Non-blocking audio fallback
    }
  }

  /**
   * Broadcasts a new notification with interactive capability
   */
  public notify(options: {
    category: NotificationCategory;
    severity?: NotificationSeverity;
    priority?: NotificationPriority;
    title: string;
    message: string;
    details?: Record<string, any>;
    autoDismissMs?: number;
    resolved?: boolean;
    action?: NotificationActionItem;
    actions?: NotificationActionItem[];
    documentNumber?: string;
    isPrompt?: boolean;
    requiresConfirmation?: boolean;
    onConfirm?: () => Promise<void> | void;
    onCancel?: () => void;
  }): AppNotification {
    const severity = options.severity || 'INFO';
    const isPrompt = options.isPrompt || options.requiresConfirmation || severity === 'PROMPT';
    
    // Determine auto-dismiss policy
    let autoDismiss = options.autoDismissMs;
    if (autoDismiss === undefined) {
      if (isPrompt) {
        autoDismiss = 0; // Sticky until user interactively decides
      } else if (severity === 'ERROR') {
        autoDismiss = 9000;
      } else if (severity === 'WARNING') {
        autoDismiss = 7500;
      } else if (severity === 'SUCCESS') {
        autoDismiss = 4000;
      } else {
        autoDismiss = 5000;
      }
    }

    const notification: AppNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      category: options.category,
      severity,
      priority: options.priority || (isPrompt || severity === 'ERROR' ? 'HIGH' : 'NORMAL'),
      title: options.title,
      message: options.message,
      details: options.details,
      timestamp: new Date().toISOString(),
      read: false,
      autoDismissMs: autoDismiss,
      resolved: options.resolved ?? (severity === 'SUCCESS'),
      action: options.action,
      actions: options.actions || (options.action ? [options.action] : []),
      documentNumber: options.documentNumber,
      isPrompt,
      requiresConfirmation: options.requiresConfirmation,
      onConfirm: options.onConfirm,
      onCancel: options.onCancel,
    };

    // Sort priority: CRITICAL & HIGH top
    this.notifications = [notification, ...this.notifications].slice(0, this.maxHistory);
    this.persist();
    this.emit();

    if (severity === 'SUCCESS') {
      this.playChime('success');
    } else if (severity === 'ERROR' || severity === 'WARNING') {
      this.playChime('alert');
    } else if (isPrompt) {
      this.playChime('prompt');
    }

    return notification;
  }

  /**
   * Interactive Prompt Notification: Asks user for confirmation or quick decision
   */
  public prompt(options: {
    title: string;
    message: string;
    category?: NotificationCategory;
    confirmLabel?: string;
    cancelLabel?: string;
    details?: Record<string, any>;
    onConfirm: () => Promise<void> | void;
    onCancel?: () => void;
  }): AppNotification {
    return this.notify({
      category: options.category || 'SYSTEM_PROMPT',
      severity: 'PROMPT',
      priority: 'HIGH',
      title: options.title,
      message: options.message,
      details: options.details,
      isPrompt: true,
      requiresConfirmation: true,
      onConfirm: options.onConfirm,
      onCancel: options.onCancel,
      actions: [
        {
          id: 'confirm',
          label: options.confirmLabel || 'Confirm Action',
          variant: 'primary',
          onClick: async (notif) => {
            if (options.onConfirm) {
              await options.onConfirm();
            }
            this.dismiss(notif.id);
          },
        },
        {
          id: 'cancel',
          label: options.cancelLabel || 'Dismiss',
          variant: 'ghost',
          onClick: (notif) => {
            if (options.onCancel) {
              options.onCancel();
            }
            this.dismiss(notif.id);
          },
        },
      ],
    });
  }

  // Standard category dispatchers
  public notifyAppsScript(title: string, message: string, details?: Record<string, any>) {
    return this.notify({
      category: 'APPS_SCRIPT',
      severity: 'SUCCESS',
      title,
      message,
      details,
      resolved: true,
      autoDismissMs: 4500,
      action: {
        id: 'apps-script-diff',
        label: 'View Diff',
        actionType: 'OPEN_APPS_SCRIPT_DIFF',
      },
    });
  }

  public notifyPropagationValidation(
    documentNumber: string,
    isIdentical: boolean,
    varianceSummary: string,
    details?: Record<string, any>
  ) {
    if (isIdentical) {
      this.resolvePropagation(documentNumber);
    }

    return this.notify({
      category: 'PROPAGATION_VALIDATION',
      severity: isIdentical ? 'SUCCESS' : 'WARNING',
      title: isIdentical
        ? `Parity Verified: ${documentNumber}`
        : `Propagation Variance: ${documentNumber}`,
      message: varianceSummary,
      details: { ...details, documentNumber },
      documentNumber,
      resolved: isIdentical,
      autoDismissMs: isIdentical ? 4000 : 9000,
      action: {
        id: 'open-validator',
        label: isIdentical ? 'View Parity' : 'Open Validator',
        actionType: 'OPEN_PARITY_VALIDATOR',
        targetDocumentNumber: documentNumber,
      },
    });
  }

  public resolvePropagation(documentNumber: string) {
    if (!documentNumber) return;
    const cleanNum = documentNumber.trim().toLowerCase();
    const prevCount = this.notifications.length;

    this.notifications = this.notifications.filter((n) => {
      const docNum = (n.documentNumber || n.details?.documentNumber || '').trim().toLowerCase();
      if (n.category === 'PROPAGATION_VALIDATION' && docNum === cleanNum) {
        return false;
      }
      return true;
    });

    if (this.notifications.length !== prevCount) {
      this.persist();
      this.emit();
    }
  }

  public dismissResolved() {
    const prevCount = this.notifications.length;
    this.notifications = this.notifications.filter((n) => !n.resolved && n.severity !== 'SUCCESS');
    if (this.notifications.length !== prevCount) {
      this.persist();
      this.emit();
    }
  }

  public notifySync(title: string, message: string, severity: NotificationSeverity = 'SUCCESS', details?: Record<string, any>) {
    return this.notify({
      category: 'SYNC_PROCESS',
      severity,
      title,
      message,
      details,
    });
  }

  public notifyConfigError(title: string, message: string, details?: Record<string, any>) {
    return this.notify({
      category: 'APPS_SCRIPT',
      severity: 'ERROR',
      priority: 'HIGH',
      title,
      message,
      details,
      action: {
        id: 'open-settings-action',
        label: 'Open Settings',
        actionType: 'VIEW_SETTINGS',
        onClick: () => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('damview:navigate-module', { detail: 'settings' }));
          }
        },
      },
    });
  }

  public notifyAppUpdate(title: string, message: string, severity: NotificationSeverity = 'INFO', details?: Record<string, any>) {
    return this.notify({
      category: 'APP_UPDATE',
      severity,
      title,
      message,
      details,
    });
  }

  public notifySelfHealing(title: string, message: string, details?: Record<string, any>) {
    return this.notify({
      category: 'SELF_HEALING',
      severity: 'INFO',
      title,
      message,
      details,
    });
  }

  public markAllAsRead() {
    this.notifications = this.notifications.map((n) => ({ ...n, read: true }));
    this.persist();
    this.emit();
  }

  public clearHistory() {
    this.notifications = [];
    this.persist();
    this.emit();
  }

  public dismiss(id: string) {
    this.notifications = this.notifications.filter((n) => n.id !== id);
    this.persist();
    this.emit();
  }

  public getNotifications(): AppNotification[] {
    return [...this.notifications];
  }

  public getUnreadCount(): number {
    return this.notifications.filter((n) => !n.read).length;
  }

  public subscribe(subscriber: NotificationSubscriber): () => void {
    this.subscribers.add(subscriber);
    subscriber(this.getNotifications());
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  private emit() {
    const list = this.getNotifications();
    this.subscribers.forEach((sub) => {
      try {
        sub(list);
      } catch (err) {
        console.error('[NotificationService] Subscriber error:', err);
      }
    });
  }

  private persist() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('damview_notification_history', JSON.stringify(this.notifications));
      } catch {}
    }
  }
}

export const appNotificationService = new AppNotificationService();
