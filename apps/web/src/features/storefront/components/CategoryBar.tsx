import { cn } from '@/shared/lib/utils';
import { CategoryBarSkeleton } from '@/features/storefront/components/Skeletons';
import type { StoreCategory } from '@/features/storefront/types';

type CategoryBarProps = {
  categories: StoreCategory[];
  activeId: string;
  onSelect: (id: string) => void;
  loading?: boolean;
};

export function CategoryBar({ categories, activeId, onSelect, loading }: CategoryBarProps) {
  if (loading) return <CategoryBarSkeleton />;

  const items: StoreCategory[] = [{ id: 'all', name: 'All', icon: '🍽️' }, ...categories];

  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="listbox"
      aria-label="Product categories"
    >
      {items.map((cat) => {
        const active = String(activeId) === String(cat.id);
        return (
          <button
            key={cat.id}
            type="button"
            role="option"
            aria-selected={active}
            onClick={() => onSelect(cat.id)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold transition',
              active
                ? 'border-transparent bg-[var(--store-theme)] text-white shadow-sm'
                : 'border-border bg-white text-secondary-foreground hover:border-[color-mix(in_srgb,var(--store-theme)_35%,#fff)]',
            )}
          >
            {(cat.icon || cat.image) && (
              <span className="text-sm" aria-hidden>
                {cat.image ? (
                  <img src={cat.image} alt="" className="h-4 w-4 rounded-full object-cover" />
                ) : (
                  cat.icon
                )}
              </span>
            )}
            {cat.name}
          </button>
        );
      })}
    </div>
  );
}
