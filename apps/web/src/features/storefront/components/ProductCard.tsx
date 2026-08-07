import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { WishlistButton } from '@/features/storefront/components/WishlistButton';
import { formatMoney } from '@/features/storefront/lib/theme';
import type { StoreProduct } from '@/features/storefront/types';

type ProductCardProps = {
  product: StoreProduct;
  vendorQuery?: string;
  onAdd: (product: StoreProduct) => void;
};

export function ProductCard({ product, vendorQuery = '', onAdd }: ProductCardProps) {
  const href = `/store/products/${encodeURIComponent(product.id)}${vendorQuery}`;
  const stars = '★'.repeat(Math.round(product.rating)) + '☆'.repeat(5 - Math.round(product.rating));

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link to={href} className="relative block aspect-square overflow-hidden bg-[var(--store-theme-soft)]">
        {product.image ? (
          <img
            src={product.image}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-5xl"
            style={{ backgroundColor: product.color }}
            aria-hidden
          >
            {product.icon}
          </div>
        )}
        {!product.inStock && (
          <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Out of stock
          </span>
        )}
        <WishlistButton productId={product.id} size="sm" className="absolute right-2 top-2" />
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <Link to={href} className="min-w-0">
          <h3 className="font-display line-clamp-2 text-sm font-bold text-foreground">{product.name}</h3>
          <p className="mt-1 text-sm font-semibold text-[color-mix(in_srgb,var(--store-theme)_88%,#000)]">
            From {formatMoney(product.minPrice)}
          </p>
          <p className="mt-0.5 text-xs text-amber-600" aria-label={`Rating ${product.rating} of 5`}>
            {stars}{' '}
            <span className="text-muted-foreground">({product.reviewCount})</span>
          </p>
        </Link>

        <Button
          type="button"
          size="sm"
          className="mt-auto w-full"
          disabled={!product.inStock}
          onClick={() => onAdd(product)}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add
        </Button>
      </div>
    </article>
  );
}
