import { ProductCard } from '@/features/storefront/components/ProductCard';
import { ProductGridSkeleton } from '@/features/storefront/components/Skeletons';
import type { StoreProduct } from '@/features/storefront/types';

type ProductGridProps = {
  products: StoreProduct[];
  loading?: boolean;
  vendorQuery?: string;
  onAdd: (product: StoreProduct) => void;
  emptyMessage?: string;
};

export function ProductGrid({
  products,
  loading,
  vendorQuery,
  onAdd,
  emptyMessage = 'No products match your filters.',
}: ProductGridProps) {
  if (loading) return <ProductGridSkeleton />;

  if (!products.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-white/80 px-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          vendorQuery={vendorQuery}
          onAdd={onAdd}
        />
      ))}
    </div>
  );
}
