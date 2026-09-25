import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  Check,
  RotateCcw,
  Sparkles,
  FileEdit,
  Send,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { BillingDocument, DocumentStatus } from '../types';
import {
  DOCUMENT_STATUS_CONFIG,
  ALL_DOCUMENT_STATUSES,
  computeDocumentStatus,
} from '../utils/documentLifecycle';

interface DocumentStatusDropdownProps {
  document: BillingDocument;
  onStatusChange: (newStatus: DocumentStatus, isManualOverride: boolean) => void;
  size?: 'xs' | 'sm';
  disabled?: boolean;
}

export const DocumentStatusDropdown: React.FC<DocumentStatusDropdownProps> = ({
  document: doc,
  onStatusChange,
  size = 'xs',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentStatus = doc.status || 'Draft';
  const meta = DOCUMENT_STATUS_CONFIG[currentStatus] || DOCUMENT_STATUS_CONFIG.Draft;
  const isManual = Boolean(doc.isManualStatusOverride);
  const autoCalculatedStatus = computeDocumentStatus(doc, undefined, true);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectStatus = (status: DocumentStatus) => {
    setIsOpen(false);
    if (status === currentStatus && isManual) return;
    onStatusChange(status, true);
  };

  const handleResetToAuto = () => {
    setIsOpen(false);
    onStatusChange(autoCalculatedStatus, false);
  };

  const getStatusIcon = (status: DocumentStatus) => {
    switch (status) {
      case 'Draft':
        return <FileEdit className="w-3 h-3 text-stone-600" />;
      case 'Sent':
        return <Send className="w-3 h-3 text-sky-600" />;
      case 'Partial':
        return <Clock className="w-3 h-3 text-amber-600" />;
      case 'Paid':
        return <CheckCircle2 className="w-3 h-3 text-emerald-600" />;
      case 'Overdue':
        return <AlertTriangle className="w-3 h-3 text-rose-600" />;
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative inline-block text-left"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Interactive Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        title={
          isManual
            ? `Manual Status Override: ${currentStatus}. Click to change or revert to auto-lifecycle.`
            : `Lifecycle Status: ${currentStatus}. Click to manually override.`
        }
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border shadow-2xs transition-all cursor-pointer select-none focus:outline-none focus:ring-1 focus:ring-amber-500 ${
          meta.badgeClass
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
        <span>{meta.label}</span>
        {isManual && (
          <span
            className="text-[9px] px-1 py-0.2 rounded bg-stone-900/10 text-stone-700 font-mono lowercase"
            title="Manual override active"
          >
            man
          </span>
        )}
        <ChevronDown
          className={`w-3 h-3 text-stone-500 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Floating Status Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute z-50 mt-1 right-0 sm:left-0 sm:right-auto w-56 bg-white rounded-lg shadow-xl border border-stone-200 py-1.5 text-xs text-stone-800 animate-in fade-in zoom-in-95 duration-100 divide-y divide-stone-100"
        >
          {/* Header */}
          <div className="px-3 py-1.5 bg-stone-50/80 text-[10px] uppercase font-bold text-stone-500 tracking-wider flex items-center justify-between">
            <span>Status Management</span>
            {isManual && (
              <span className="text-amber-700 font-semibold lowercase">manual override</span>
            )}
          </div>

          {/* Status Options */}
          <div className="py-1">
            {ALL_DOCUMENT_STATUSES.map((status) => {
              const itemMeta = DOCUMENT_STATUS_CONFIG[status];
              const isSelected = currentStatus === status;

              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => handleSelectStatus(status)}
                  className={`w-full text-left px-3 py-2 flex items-start gap-2.5 hover:bg-stone-50 transition-colors cursor-pointer ${
                    isSelected ? 'bg-amber-50/60 font-semibold' : ''
                  }`}
                >
                  <div className="pt-0.5 shrink-0">{getStatusIcon(status)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-stone-900 font-bold">{itemMeta.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-700 shrink-0" />}
                    </div>
                    <p className="text-[10px] text-stone-500 leading-tight mt-0.5">
                      {itemMeta.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Revert to Auto-Lifecycle Option */}
          {isManual && (
            <div className="p-1">
              <button
                type="button"
                onClick={handleResetToAuto}
                className="w-full text-left px-2.5 py-1.5 text-[11px] rounded bg-stone-100 hover:bg-amber-100 text-stone-800 hover:text-amber-900 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Reset manual override and let payment reconciliation auto-manage status"
              >
                <RotateCcw className="w-3 h-3 text-stone-600" />
                <span>Revert to Auto Lifecycle ({autoCalculatedStatus})</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
