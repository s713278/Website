import type { Product } from '@mithra/domain';
import { formatMoney } from '@mithra/domain';
import { useStore } from '../home/store-context';

export function SkuControls({ product }: { product: Product }) {
  const { addToCart, setQty, lineQty } = useStore();
  const variants = (product.variants || []).filter((v) => v.active !== false);

  return (
    <div className="space-y-2">
      {variants.map((v) => {
        const qty = lineQty(v.id);
        return (
          <div key={v.id} className="flex items-center justify-between gap-2 text-sm">
            <div>
              <div className="font-medium">{v.label}</div>
              <div className="text-xs text-slate-500">{formatMoney(v.price)}</div>
            </div>
            {qty === 0 ? (
              <button
                type="button"
                className="md-btn md-btn-primary md-btn-sm"
                data-cta="add_sku"
                onClick={() => addToCart(product.id, v.id, 1)}
              >
                Add
              </button>
            ) : (
              <div className="qty-stepper">
                <button type="button" aria-label="Decrease" onClick={() => setQty(v.id, qty - 1)}>
                  −
                </button>
                <span className="min-w-[1.25rem] text-center font-semibold">{qty}</span>
                <button type="button" aria-label="Increase" onClick={() => setQty(v.id, qty + 1)}>
                  +
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
