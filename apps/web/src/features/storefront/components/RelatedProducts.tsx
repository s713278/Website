import { ProductCard } from '@/features/storefront/components/ProductCard';
import type { StoreProduct } from '@/features/storefront/types';

type RelatedProductsProps = {
  products: StoreProduct[];
  vendorQuery?: string;
  onAdd: (product: StoreProduct) => void;
};

export function RelatedProducts({ products, vendorQuery, onAdd }: RelatedProductsProps) {
  if (!products.length) return null;

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-bold">Related products</h2>
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
    </section>
  );
}
