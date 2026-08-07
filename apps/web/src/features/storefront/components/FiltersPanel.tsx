import { FiltersSkeleton } from '@/features/storefront/components/Skeletons';
import { formatMoney } from '@/features/storefront/lib/theme';
import type { ProductSort } from '@/features/storefront/types';

type FiltersPanelProps = {
  loading?: boolean;
  minPrice: number;
  maxPrice: number;
  bounds: { min: number; max: number };
  inStockOnly: boolean;
  sort: ProductSort;
  onMinPrice: (v: number) => void;
  onMaxPrice: (v: number) => void;
  onInStockOnly: (v: boolean) => void;
  onSort: (v: ProductSort) => void;
};

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'popular', label: 'Popular' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'name', label: 'Name A–Z' },
];

export function FiltersPanel({
  loading,
  minPrice,
  maxPrice,
  bounds,
  inStockOnly,
  sort,
  onMinPrice,
  onMaxPrice,
  onInStockOnly,
  onSort,
}: FiltersPanelProps) {
  if (loading) return <FiltersSkeleton />;

  return (
    <aside className="space-y-4 rounded-2xl border border-border bg-white p-4 shadow-sm">
      <h2 className="font-display text-sm font-bold text-foreground">Filters</h2>

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold text-muted-foreground">Sort</span>
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value as ProductSort)}
          className="h-10 w-full rounded-xl border border-input bg-white px-3 text-sm"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
          <span>Price range</span>
          <span>
            {formatMoney(minPrice)} – {formatMoney(maxPrice)}
          </span>
        </div>
        <label className="block space-y-1">
          <span className="sr-only">Minimum price</span>
          <input
            type="range"
            min={bounds.min}
            max={bounds.max}
            value={minPrice}
            onChange={(e) => onMinPrice(Math.min(Number(e.target.value), maxPrice))}
            className="w-full accent-[var(--store-theme)]"
          />
        </label>
        <label className="block space-y-1">
          <span className="sr-only">Maximum price</span>
          <input
            type="range"
            min={bounds.min}
            max={bounds.max}
            value={maxPrice}
            onChange={(e) => onMaxPrice(Math.max(Number(e.target.value), minPrice))}
            className="w-full accent-[var(--store-theme)]"
          />
        </label>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-secondary-foreground">
        <input
          type="checkbox"
          checked={inStockOnly}
          onChange={(e) => onInStockOnly(e.target.checked)}
          className="h-4 w-4 rounded border-border accent-[var(--store-theme)]"
        />
        In stock only
      </label>
    </aside>
  );
}
