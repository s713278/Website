import { Link } from 'react-router-dom';
import { Menu, Search, ShoppingBag } from 'lucide-react';
import { env } from '@/shared/lib/env';
import type { StoreMeta } from '@/features/storefront/types';

type StoreHeaderProps = {
  meta?: StoreMeta;
  cartCount: number;
  onCartOpen: () => void;
  onMenuOpen?: () => void;
  searchHref?: string;
  vendorQuery?: string;
};

export function StoreHeader({
  meta,
  cartCount,
  onCartOpen,
  onMenuOpen,
  searchHref = '#store-catalog',
  vendorQuery = '',
}: StoreHeaderProps) {
  const name = meta?.storeName || `${env.VITE_APP_NAME} Store`;

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-2 px-3 sm:px-4">
        <div className="flex items-center gap-1">
          {onMenuOpen && (
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-secondary lg:hidden"
              aria-label="Open menu"
              onClick={onMenuOpen}
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          <Link
            to={`/store${vendorQuery}`}
            className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-1"
            aria-label={`${name} home`}
          >
            {meta?.logoUrl ? (
              <img src={meta.logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--store-theme-soft)] text-sm"
                aria-hidden
              >
                🏪
              </span>
            )}
            <span className="font-display truncate text-sm font-bold text-md-green-deep sm:text-base">
              {name}
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-1">
          <a
            href={searchHref}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-secondary"
            aria-label="Search products"
          >
            <Search className="h-5 w-5" />
          </a>
          <button
            type="button"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-secondary"
            aria-label={`Cart, ${cartCount} items`}
            onClick={onCartOpen}
          >
            <ShoppingBag className="h-5 w-5" />
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--store-theme)] px-1 text-[10px] font-bold text-white">
              {cartCount}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
