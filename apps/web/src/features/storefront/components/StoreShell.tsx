import { useState, type ReactNode } from 'react';
import { Link, Outlet, useSearchParams } from 'react-router-dom';
import { StoreHeader } from '@/features/storefront/components/StoreHeader';
import { CartDrawer } from '@/features/storefront/components/CartDrawer';
import { useStoreCatalog } from '@/features/storefront/hooks/use-store-catalog';
import { useStoreCart } from '@/features/storefront/hooks/use-store-cart';

type StoreShellProps = {
  children?: ReactNode;
};

/** Full storefront chrome — header + cart drawer (replaces thin StoreLayout chrome). */
export function StoreShell({ children }: StoreShellProps) {
  const [params] = useSearchParams();
  const vendor = params.get('vendor') || params.get('vendorId');
  const vendorQuery = vendor ? `?vendor=${encodeURIComponent(vendor)}` : '';
  const { data, vendorId } = useStoreCatalog();
  const cart = useStoreCart(vendorId);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-[var(--md-atmosphere)]">
      <StoreHeader
        meta={data?.meta}
        cartCount={cart.count}
        onCartOpen={() => cart.setDrawerOpen(true)}
        onMenuOpen={() => setMenuOpen(true)}
        vendorQuery={vendorQuery}
      />

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
            onClick={() => setMenuOpen(false)}
          />
          <nav
            className="fixed inset-y-0 left-0 z-50 w-72 space-y-1 bg-white p-4 shadow-xl lg:hidden"
            aria-label="Store menu"
          >
            <p className="font-display mb-3 text-base font-bold">{data?.meta.storeName || 'Store'}</p>
            <Link
              to={`/store${vendorQuery}`}
              className="block rounded-xl px-3 py-2 text-sm font-semibold hover:bg-secondary"
              onClick={() => setMenuOpen(false)}
            >
              Home
            </Link>
            <a
              href="#store-catalog"
              className="block rounded-xl px-3 py-2 text-sm font-semibold text-[color-mix(in_srgb,var(--store-theme)_90%,#000)] hover:bg-secondary"
              onClick={() => setMenuOpen(false)}
            >
              Menu
            </a>
            <button
              type="button"
              className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold hover:bg-secondary"
              onClick={() => {
                setMenuOpen(false);
                cart.setDrawerOpen(true);
              }}
            >
              Cart
            </button>
            <Link
              to="/"
              className="block rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-secondary"
              onClick={() => setMenuOpen(false)}
            >
              ← Back to MithraDirect
            </Link>
          </nav>
        </>
      )}

      <main className="mx-auto w-full max-w-5xl pb-16">{children ?? <Outlet />}</main>

      <CartDrawer
        open={cart.drawerOpen}
        onClose={() => cart.setDrawerOpen(false)}
        lines={cart.lines}
        subtotal={cart.subtotal}
        onSetQty={cart.setQty}
        onRemove={cart.removeItem}
        vendorQuery={vendorQuery}
      />
    </div>
  );
}
