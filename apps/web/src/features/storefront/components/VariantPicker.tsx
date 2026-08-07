import { cn } from '@/shared/lib/utils';
import { formatMoney } from '@/features/storefront/lib/theme';
import type { StoreSku } from '@/features/storefront/types';

type VariantPickerProps = {
  skus: StoreSku[];
  activeId?: string;
  onSelect: (skuId: string) => void;
};

export function VariantPicker({ skus, activeId, onSelect }: VariantPickerProps) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-bold">Choose variant</h2>
      <div className="flex flex-wrap gap-2" role="listbox" aria-label="Product variants">
        {skus.map((sku) => {
          const selected = activeId === sku.id;
          return (
            <button
              key={sku.id}
              type="button"
              role="option"
              aria-selected={selected}
              disabled={!sku.inStock}
              onClick={() => onSelect(sku.id)}
              className={cn(
                'rounded-full border px-3 py-2 text-xs font-bold transition',
                selected
                  ? 'border-transparent bg-[var(--store-theme)] text-white'
                  : 'border-border bg-white',
                !sku.inStock && 'cursor-not-allowed opacity-40',
              )}
            >
              {sku.label} · {formatMoney(sku.price)}
              {!sku.inStock ? ' · Sold out' : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
}
