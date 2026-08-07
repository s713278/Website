import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { CartSkeleton } from '@/features/storefront/components/Skeletons';
import { formatMoney } from '@/features/storefront/lib/theme';
import type { CartLine } from '@/features/storefront/types';

type CartDrawerProps = {
  open: boolean;
  onClose: () => void;
  lines: CartLine[];
  subtotal: number;
  onSetQty: (skuId: string, qty: number) => void;
  onRemove: (skuId: string) => void;
  loading?: boolean;
  vendorQuery?: string;
};

export function CartDrawer({
  open,
  onClose,
  lines,
  subtotal,
  onSetQty,
  onRemove,
  loading,
  vendorQuery = '',
}: CartDrawerProps) {
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/35 transition ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!open}
        aria-label="Shopping cart"
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-display text-lg font-bold">Your cart</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-secondary"
            aria-label="Close cart"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <CartSkeleton />
          ) : !lines.length ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-4xl" aria-hidden>
                🛒
              </p>
              <p className="text-sm text-muted-foreground">Your cart is empty</p>
              <Button asChild variant="secondary" size="sm">
                <Link to={`/store${vendorQuery}`} onClick={onClose}>
                  Browse products
                </Link>
              </Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {lines.map((line) => (
                <li
                  key={line.skuId}
                  className="flex gap-3 rounded-2xl border border-border p-3"
                >
                  <div
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-2xl"
                    style={{ backgroundColor: line.color || 'var(--store-theme-soft)' }}
                  >
                    {line.image ? (
                      <img src={line.image} alt="" className="h-full w-full rounded-xl object-cover" />
                    ) : (
                      <span aria-hidden>{line.icon || '🫙'}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{line.name}</p>
                    <p className="text-xs text-muted-foreground">{line.label}</p>
                    <p className="mt-0.5 text-sm font-semibold text-[color-mix(in_srgb,var(--store-theme)_88%,#000)]">
                      {formatMoney(line.price * line.qty)}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="inline-flex items-center rounded-full border border-border">
                        <button
                          type="button"
                          className="px-2 py-1"
                          aria-label="Decrease quantity"
                          onClick={() => onSetQty(line.skuId, line.qty - 1)}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-6 text-center text-xs font-bold">{line.qty}</span>
                        <button
                          type="button"
                          className="px-2 py-1"
                          aria-label="Increase quantity"
                          onClick={() => onSetQty(line.skuId, line.qty + 1)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-destructive"
                        aria-label={`Remove ${line.name}`}
                        onClick={() => onRemove(line.skuId)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!!lines.length && (
          <footer className="space-y-3 border-t border-border p-4">
            <div className="flex items-center justify-between text-sm font-bold">
              <span>Subtotal</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
            <Button className="w-full" type="button">
              Proceed to checkout
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              WhatsApp order flow · powered by MithraDirect
            </p>
          </footer>
        )}
      </aside>
    </>
  );
}
