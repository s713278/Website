import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { cn } from '@/shared/lib/utils';

export type FilterOption = { value: string; label: string };

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  status: string;
  onStatusChange: (value: string) => void;
  statusOptions: FilterOption[];
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  className?: string;
  showDates?: boolean;
};

export function FiltersBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  status,
  onStatusChange,
  statusOptions,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  className,
  showDates = true,
}: Props) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border bg-white/80 p-3 sm:flex-row sm:flex-wrap sm:items-end',
        className,
      )}
    >
      <div className="min-w-[12rem] flex-1 space-y-1.5">
        <Label htmlFor="dash-filter-search">Search</Label>
        <Input
          id="dash-filter-search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
        />
      </div>
      <div className="min-w-[9rem] space-y-1.5">
        <Label htmlFor="dash-filter-status">Status</Label>
        <select
          id="dash-filter-status"
          className="flex h-11 w-full rounded-xl border border-input bg-white px-3 text-sm"
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      {showDates ? (
        <>
          <div className="min-w-[9rem] space-y-1.5">
            <Label htmlFor="dash-filter-from">From</Label>
            <Input
              id="dash-filter-from"
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
            />
          </div>
          <div className="min-w-[9rem] space-y-1.5">
            <Label htmlFor="dash-filter-to">To</Label>
            <Input
              id="dash-filter-to"
              type="date"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
