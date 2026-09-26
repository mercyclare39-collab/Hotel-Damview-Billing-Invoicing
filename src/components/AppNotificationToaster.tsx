import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  X,
  FileCode,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  HelpCircle,
  Loader2,
} from 'lucide-react';
import {
  appNotificationService,
  AppNotification,
  NotificationCategory,
  NotificationSeverity,
  NotificationActionItem,
} from '../services/appNotificationService';

interface NotificationToastItemProps {
  notif: AppNotification;
  onDismiss: (id: string) => void;
}

const NotificationToastItem: React.FC<NotificationToastItemProps> = ({ notif, onDismiss }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);

  const isSticky = notif.isPrompt || notif.autoDismissMs === 0;
  const totalDuration = notif.autoDismissMs || (notif.severity === 'ERROR' || notif.severity === 'WARNING' ? 8500 : 4500);
  const [remainingMs, setRemainingMs] = useState(totalDuration);

  // Manage individual toast auto-dismiss countdown with pause on hover
  useEffect(() => {
    if (isSticky || isHovered || remainingMs <= 0) {
      return;
    }

    const interval = 100;
    const timer = setInterval(() => {
      setRemainingMs((prev) => Math.max(0, prev - interval));
    }, interval);

    return () => {
      clearInterval(timer);
    };
  }, [isSticky, isHovered, remainingMs]);

  // Safely trigger dismiss outside of React render phase
  useEffect(() => {
    if (!isSticky && remainingMs <= 0) {
      onDismiss(notif.id);
    }
  }, [isSticky, remainingMs, notif.id, onDismiss]);

  const handleActionExecution = async (act: NotificationActionItem) => {
    setExecutingActionId(act.id);
    try {
      if (act.actionType === 'OPEN_APPS_SCRIPT_DIFF') {
        window.dispatchEvent(new CustomEvent('damview:open-apps-script-diff'));
      }

      if (act.onClick) {
        await act.onClick(notif);
      }

      // If notification is resolved or was a prompt confirmation, auto-dismiss
      if (notif.resolved || notif.isPrompt || notif.severity === 'SUCCESS') {
        onDismiss(notif.id);
      } else {
        setRemainingMs(2500);
      }
    } catch (err) {
      console.error('[NotificationToast] Action error:', err);
    } finally {
      setExecutingActionId(null);
    }
  };

  const getCategoryBadge = (category: NotificationCategory) => {
    switch (category) {
      case 'APPS_SCRIPT':
        return { label: 'Apps Script', bg: 'bg-purple-900/80 text-purple-200 border-purple-700', icon: FileCode };
      case 'PROPAGATION_VALIDATION':
        return { label: 'Variance Audit', bg: 'bg-emerald-950/80 text-emerald-300 border-emerald-700', icon: ShieldCheck };
      case 'SYNC_PROCESS':
        return { label: 'Sync Pipeline', bg: 'bg-blue-950/80 text-blue-300 border-blue-700', icon: RefreshCw };
      case 'APP_UPDATE':
        return { label: 'App Engine', bg: 'bg-amber-950/80 text-amber-300 border-amber-700', icon: Sparkles };
      case 'SELF_HEALING':
        return { label: 'Self Healing', bg: 'bg-teal-950/80 text-teal-300 border-teal-700', icon: CheckCircle2 };
      case 'SYSTEM_PROMPT':
        return { label: 'Interactive Prompt', bg: 'bg-amber-500/20 text-amber-300 border-amber-500/50', icon: HelpCircle };
      default:
        return { label: 'System', bg: 'bg-stone-800 text-stone-300 border-stone-700', icon: Bell };
    }
  };

  const getSeverityIcon = (severity: NotificationSeverity) => {
    switch (severity) {
      case 'SUCCESS':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'WARNING':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'ERROR':
        return <XCircle className="w-4 h-4 text-rose-400 shrink-0" />;
      case 'PROMPT':
        return <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />;
      default:
        return <Info className="w-4 h-4 text-sky-400 shrink-0" />;
    }
  };

  const cat = getCategoryBadge(notif.category);
  const IconComponent = cat.icon;
  const progressPercent = isSticky ? 100 : Math.max(0, Math.min(100, (remainingMs / totalDuration) * 100));

  // Determine actions to render
  const actionsToRender: NotificationActionItem[] = notif.actions && notif.actions.length > 0
    ? notif.actions
    : notif.action
    ? [notif.action]
    : [];

  return (
    <div
      className={`pointer-events-auto bg-stone-900/95 border backdrop-blur-md rounded-xl p-3.5 shadow-2xl text-stone-100 text-xs transition-all animate-slide-in-right overflow-hidden relative ${
        notif.isPrompt
          ? 'border-amber-500/80 ring-1 ring-amber-500/30'
          : notif.severity === 'ERROR'
          ? 'border-rose-700/80'
          : notif.severity === 'WARNING'
          ? 'border-amber-700/80'
          : 'border-stone-700/80'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <div className="mt-0.5">{getSeverityIcon(notif.severity)}</div>
          <div className="min-w-0 space-y-1.5 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${cat.bg}`}
              >
                <IconComponent className="w-3 h-3" />
                <span>{cat.label}</span>
              </span>
              <span className="font-bold text-white text-[12px] truncate">{notif.title}</span>
              {notif.resolved && (
                <span className="px-1.5 py-0.2 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded text-[9.5px] font-semibold flex items-center gap-0.5">
                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                  <span>Resolved</span>
                </span>
              )}
            </div>

            <p className="text-stone-300 text-[11.5px] leading-relaxed break-words">{notif.message}</p>

            {/* Interactive Action Buttons */}
            {actionsToRender.length > 0 && (
              <div className="pt-1 flex items-center gap-2 flex-wrap">
                {actionsToRender.map((act) => {
                  const isBusy = executingActionId === act.id;
                  const isPrimary = act.variant === 'primary' || (!act.variant && act.id === actionsToRender[0]?.id);
                  const isDanger = act.variant === 'danger';
                  const isGhost = act.variant === 'ghost';

                  return (
                    <button
                      key={act.id}
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleActionExecution(act)}
                      className={`px-2.5 py-1 font-bold rounded text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50 ${
                        isDanger
                          ? 'bg-rose-600 hover:bg-rose-500 text-white'
                          : isGhost
                          ? 'bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white border border-stone-700'
                          : isPrimary
                          ? 'bg-amber-500 hover:bg-amber-400 text-stone-950'
                          : 'bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-600/40'
                      }`}
                    >
                      {isBusy && <Loader2 className="w-3 h-3 animate-spin text-inherit" />}
                      <span>{act.label}</span>
                      {!isBusy && isPrimary && <ArrowRight className="w-2.5 h-2.5 text-inherit" />}
                    </button>
                  );
                })}

                {notif.resolved && (
                  <span className="text-[10px] text-emerald-400">
                    Auto-closing ({Math.ceil(remainingMs / 1000)}s)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {notif.details && Object.keys(notif.details).length > 0 && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-stone-400 hover:text-stone-200 rounded cursor-pointer"
              title="Toggle diagnostic details"
            >
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
          <button
            type="button"
            onClick={() => onDismiss(notif.id)}
            className="p-1 text-stone-400 hover:text-white rounded hover:bg-stone-800 transition-colors cursor-pointer"
            title="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expandable diagnostic details view */}
      {isExpanded && notif.details && (
        <div className="mt-2.5 pt-2.5 border-t border-stone-800 text-[11px] font-mono bg-stone-950/90 p-2.5 rounded-lg max-h-48 overflow-y-auto space-y-1 text-stone-300">
          {Object.entries(notif.details).map(([key, val]) => (
            <div key={key} className="break-words flex items-start gap-1">
              <strong className="text-amber-400 font-sans shrink-0">{key}:</strong>{' '}
              <span className="text-stone-300">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Visual countdown progress bar */}
      {!isSticky && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-stone-800 overflow-hidden">
          <div
            className={`h-full transition-all duration-100 ease-linear ${
              notif.resolved || notif.severity === 'SUCCESS'
                ? 'bg-emerald-400'
                : notif.severity === 'ERROR'
                ? 'bg-rose-500'
                : 'bg-amber-400'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}
    </div>
  );
};

export const AppNotificationToaster: React.FC = () => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    const unsubscribe = appNotificationService.subscribe((items) => {
      // Prioritize prompt/critical items, and display up to 4 concurrent toasts
      setNotifications(items.slice(0, 4));
    });
    return unsubscribe;
  }, []);

  const handleDismiss = (id: string) => {
    appNotificationService.dismiss(id);
  };

  if (notifications.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-20 right-4 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none no-print"
    >
      {notifications.map((notif) => (
        <NotificationToastItem key={notif.id} notif={notif} onDismiss={handleDismiss} />
      ))}
    </div>
  );
};
