import type { ReactNode } from 'react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

export type DataColumn<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
};

type Props<T extends { id: string }> = {
  columns: Array<DataColumn<T>>;
  rows: T[];
  selectedIds: string[];
  onToggleRow: (id: string) => void;
  onToggleAll: (ids: string[], selected: boolean) => void;
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
  selectable?: boolean;
  emptyMessage?: string;
  className?: string;
};

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  selectedIds,
  onToggleRow,
  onToggleAll,
  page,
  pageCount,
  total,
  onPageChange,
  selectable = true,
  emptyMessage = 'No rows match these filters.',
  className,
}: Props<T>) {
  const pageIds = rows.map((r) => r.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  return (
    <div className={cn('space-y-3', className)}>
      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <thead className="bg-[color-mix(in_srgb,var(--store-theme-soft)_45%,#fff)] text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <tr>
              {selectable ? (
                <th scope="col" className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all on page"
                    checked={allSelected}
                    onChange={(e) => onToggleAll(pageIds, e.target.checked)}
                    className="h-4 w-4 accent-[var(--store-theme)]"
                  />
                </th>
              ) : null}
              {columns.map((col) => (
                <th key={col.id} scope="col" className={cn('px-3 py-3', col.className)}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-3 py-10 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-border/80 hover:bg-secondary/40">
                  {selectable ? (
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${row.id}`}
                        checked={selectedIds.includes(row.id)}
                        onChange={() => onToggleRow(row.id)}
                        className="h-4 w-4 accent-[var(--store-theme)]"
                      />
                    </td>
                  ) : null}
                  {columns.map((col) => (
                    <td key={col.id} className={cn('px-3 py-3 align-middle', col.className)}>
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p>
          {total} result{total === 1 ? '' : 's'} · Page {page} of {pageCount}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
