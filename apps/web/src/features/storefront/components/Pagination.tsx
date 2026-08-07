import { Button } from '@/shared/components/ui/button';
import type { BrowseMode } from '@/features/storefront/types';

type PaginationProps = {
  mode: BrowseMode;
  onModeChange: (mode: BrowseMode) => void;
  page: number;
  totalPages: number;
  pageSize: number;
  onPageSize: (size: number) => void;
  onPage: (page: number) => void;
  totalItems: number;
  visibleCount: number;
};

export function Pagination({
  mode,
  onModeChange,
  page,
  totalPages,
  pageSize,
  onPageSize,
  onPage,
  totalItems,
  visibleCount,
}: PaginationProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
        <span>
          Showing {Math.min(visibleCount, totalItems)} of {totalItems}
        </span>
        <label className="inline-flex items-center gap-1.5">
          <span>Page size</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="h-8 rounded-lg border border-input bg-white px-2 text-xs"
          >
            {[8, 12, 16, 24].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="inline-flex rounded-full border border-border p-0.5">
          <button
            type="button"
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
              mode === 'infinite' ? 'bg-[var(--store-theme)] text-white' : ''
            }`}
            onClick={() => onModeChange('infinite')}
          >
            Infinite
          </button>
          <button
            type="button"
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
              mode === 'pages' ? 'bg-[var(--store-theme)] text-white' : ''
            }`}
            onClick={() => onModeChange('pages')}
          >
            Pages
          </button>
        </div>
      </div>

      {mode === 'pages' && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          >
            Prev
          </Button>
          <span className="text-xs font-bold text-secondary-foreground">
            {page} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
