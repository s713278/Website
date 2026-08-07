import { useState } from 'react';
import type { TableFilters } from '@/features/dashboard/types';

type Options = {
  pageSize?: number;
  initialStatus?: string;
};

function inDateRange(iso: string, from: string, to: string) {
  if (!from && !to) return true;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return true;
  if (from) {
    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    if (t < start.getTime()) return false;
  }
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    if (t > end.getTime()) return false;
  }
  return true;
}

export function useTableState(options: Options = {}) {
  const pageSize = options.pageSize ?? 8;
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(options.initialStatus ?? 'all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filters: TableFilters = { search, status, dateFrom, dateTo };

  const resetPage = () => setPage(1);

  const setSearchAndReset = (value: string) => {
    setSearch(value);
    resetPage();
  };
  const setStatusAndReset = (value: string) => {
    setStatus(value);
    resetPage();
  };
  const setDateFromAndReset = (value: string) => {
    setDateFrom(value);
    resetPage();
  };
  const setDateToAndReset = (value: string) => {
    setDateTo(value);
    resetPage();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const setAllSelected = (ids: string[], selected: boolean) => {
    setSelectedIds((prev) => {
      if (selected) {
        const merged = new Set([...prev, ...ids]);
        return [...merged];
      }
      const drop = new Set(ids);
      return prev.filter((id) => !drop.has(id));
    });
  };

  const clearSelection = () => setSelectedIds([]);

  return {
    filters,
    search,
    status,
    dateFrom,
    dateTo,
    page,
    pageSize,
    selectedIds,
    setSearch: setSearchAndReset,
    setStatus: setStatusAndReset,
    setDateFrom: setDateFromAndReset,
    setDateTo: setDateToAndReset,
    setPage,
    toggleSelect,
    setAllSelected,
    clearSelection,
    setSelectedIds,
  };
}

export function filterByTableState<T extends { id: string }>(
  rows: T[],
  filters: TableFilters,
  options: {
    getSearchText: (row: T) => string;
    getStatus: (row: T) => string;
    getDate?: (row: T) => string;
  },
) {
  const q = filters.search.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.status !== 'all' && options.getStatus(row) !== filters.status) return false;
    if (q && !options.getSearchText(row).toLowerCase().includes(q)) return false;
    if (options.getDate && !inDateRange(options.getDate(row), filters.dateFrom, filters.dateTo)) {
      return false;
    }
    return true;
  });
}

export function paginateRows<T>(rows: T[], page: number, pageSize: number) {
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * pageSize;
  return {
    page: safePage,
    pageCount,
    total,
    rows: rows.slice(start, start + pageSize),
  };
}
