import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  column: string;
  direction: SortDirection;
}

export type ValueExtractor<T> = (item: T) => string | number | boolean | Date | null | undefined;

/**
 * Custom React hook for persistent table column sorting.
 * Automatically loads and persists sort configurations per table ID
 * across module navigation and user browser sessions.
 */
export function usePersistentSort<T = any>(
  tableId: string,
  initialColumn: string,
  initialDirection: SortDirection = 'desc'
) {
  const storageKey = `damview_sort_${tableId}`;

  // Initialize from localStorage or fallback to defaults
  const [sortConfig, setSortConfig] = useState<SortConfig>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (
            parsed &&
            typeof parsed.column === 'string' &&
            (parsed.direction === 'asc' || parsed.direction === 'desc')
          ) {
            return parsed;
          }
        }
      } catch (e) {
        console.warn(`Failed reading sort state for ${tableId}:`, e);
      }
    }
    return { column: initialColumn, direction: initialDirection };
  });

  // Persist to localStorage on change
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(sortConfig));
      } catch (e) {
        console.warn(`Failed saving sort state for ${tableId}:`, e);
      }
    }
  }, [storageKey, sortConfig]);

  // Toggle or switch active column
  const toggleSort = useCallback((column: string, defaultDir: SortDirection = 'asc') => {
    setSortConfig((prev) => {
      if (prev.column === column) {
        return {
          column,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      return {
        column,
        direction: defaultDir,
      };
    });
  }, []);

  // Multi-type deterministic comparator
  const sortData = useCallback(
    (items: T[], customExtractors?: Record<string, ValueExtractor<T>>): T[] => {
      if (!items || items.length === 0 || !sortConfig.column) {
        return items || [];
      }

      const { column, direction } = sortConfig;
      const multiplier = direction === 'asc' ? 1 : -1;

      return [...items].sort((a, b) => {
        let valA: any;
        let valB: any;

        if (customExtractors && customExtractors[column]) {
          valA = customExtractors[column](a);
          valB = customExtractors[column](b);
        } else {
          valA = (a as any)[column];
          valB = (b as any)[column];
        }

        // Handle null/undefined values by placing them at the bottom
        if (valA === undefined || valA === null || valA === '') return 1;
        if (valB === undefined || valB === null || valB === '') return -1;

        // Number comparison
        if (typeof valA === 'number' && typeof valB === 'number') {
          if (isNaN(valA)) return 1;
          if (isNaN(valB)) return -1;
          return (valA - valB) * multiplier;
        }

        // Boolean comparison
        if (typeof valA === 'boolean' && typeof valB === 'boolean') {
          return ((valA ? 1 : 0) - (valB ? 1 : 0)) * multiplier;
        }

        // Date comparison (ISO strings or date formats)
        const isDatePattern = /^\d{4}-\d{2}-\d{2}/.test(String(valA)) && /^\d{4}-\d{2}-\d{2}/.test(String(valB));
        if (isDatePattern) {
          const timeA = new Date(valA).getTime();
          const timeB = new Date(valB).getTime();
          if (!isNaN(timeA) && !isNaN(timeB)) {
            return (timeA - timeB) * multiplier;
          }
        }

        // String comparison
        const strA = String(valA).trim().toLowerCase();
        const strB = String(valB).trim().toLowerCase();
        return strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' }) * multiplier;
      });
    },
    [sortConfig]
  );

  return {
    sortConfig,
    setSortConfig,
    toggleSort,
    sortData,
  };
}

interface SortableHeaderProps {
  column: string;
  label: React.ReactNode;
  currentSort: SortConfig;
  onSort: (column: string, defaultDir?: SortDirection) => void;
  defaultDirection?: SortDirection;
  align?: 'left' | 'center' | 'right';
  className?: string;
  title?: string;
}

/**
 * Accessible table header cell with interactive sort indicator
 */
export const SortableHeader: React.FC<SortableHeaderProps> = ({
  column,
  label,
  currentSort,
  onSort,
  defaultDirection = 'asc',
  align = 'left',
  className = '',
  title,
}) => {
  const isActive = currentSort.column === column;
  const isAsc = isActive && currentSort.direction === 'asc';

  const justifyClass =
    align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';

  return (
    <th
      scope="col"
      aria-sort={isActive ? (isAsc ? 'ascending' : 'descending') : 'none'}
      className={`py-2.5 px-3 select-none ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(column, defaultDirection)}
        title={title || `Sort by ${typeof label === 'string' ? label : column}`}
        className={`group inline-flex items-center gap-1.5 w-full font-bold transition-colors cursor-pointer text-xs ${justifyClass} ${
          isActive ? 'text-amber-950 font-extrabold' : 'text-stone-700 hover:text-stone-950'
        }`}
      >
        <span>{label}</span>
        <span
          className={`shrink-0 transition-transform ${
            isActive
              ? 'text-amber-600 bg-amber-100 p-0.5 rounded shadow-2xs'
              : 'text-stone-400 group-hover:text-stone-600 opacity-60 group-hover:opacity-100'
          }`}
        >
          {isActive ? (
            isAsc ? (
              <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5 stroke-[2.5]" />
            )
          ) : (
            <ChevronsUpDown className="w-3.5 h-3.5 stroke-[2]" />
          )}
        </span>
      </button>
    </th>
  );
};
