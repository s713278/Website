import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { fetchStoreProduct } from '@/features/storefront/api/fetch-store';
import { ProductDetailSkeleton } from '@/features/storefront/components/Skeletons';
import { ProductGallery } from '@/features/storefront/components/ProductGallery';
import { VariantPicker } from '@/features/storefront/components/VariantPicker';
import { Reviews } from '@/features/storefront/components/Reviews';
import { RelatedProducts } from '@/features/storefront/components/RelatedProducts';
import { useStoreCart } from '@/features/storefront/hooks/use-store-cart';
import { relatedProducts } from '@/features/storefront/lib/filter-products';
import { applyStoreTheme, formatMoney } from '@/features/storefront/lib/theme';
import type { StoreProduct } from '@/features/storefront/types';

export function ProductDetailPage() {
  const { productId = '' } = useParams();
  const [params] = useSearchParams();
  const vendor = params.get('vendor') || params.get('vendorId');
  const vendorQuery = vendor ? `?vendor=${encodeURIComponent(vendor)}` : '';

  const query = useQuery({
    queryKey: ['mithra', 'storefront', 'product', vendor || 'local', productId],
    queryFn: () => fetchStoreProduct(productId, vendor),
    enabled: Boolean(productId),
  });

  const product = query.data?.product ?? null;
  const catalog = query.data?.catalog;
  const cart = useStoreCart(catalog?.meta.vendorId ?? vendor);

  const [skuId, setSkuId] = useState('');
  const [qty, setQty] = useState(1);
  const [imageIdx, setImageIdx] = useState(0);

  useEffect(() => {
    if (catalog?.meta.themeColor) applyStoreTheme(catalog.meta.themeColor);
  }, [catalog?.meta.themeColor]);

  const activeSku = useMemo(() => {
    if (!product) return null;
    return (
      product.skus.find((s) => s.id === skuId) ||
      product.skus.find((s) => s.inStock) ||
      product.skus[0] ||
      null
    );
  }, [product, skuId]);

  const related = useMemo(() => {
    if (!product || !catalog) return [];
    return relatedProducts(catalog.products, product, 4);
  }, [product, catalog]);

  const onAddRelated = (p: StoreProduct) => {
    const sku = p.skus.find((s) => s.inStock) || p.skus[0];
    if (sku) cart.addItem(p, sku, 1);
  };

  if (query.isLoading) {
    return (
      <div className="px-3 py-6 sm:px-4">
        <ProductDetailSkeleton />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="px-3 py-16 text-center sm:px-4">
        <p className="font-display text-xl font-bold">Product not found</p>
        <Button asChild className="mt-4" variant="secondary">
          <Link to={`/store${vendorQuery}`}>Back to store</Link>
        </Button>
      </div>
    );
  }

  const category = catalog?.categories.find((c) => String(c.id) === String(product.categoryId));

  return (
    <div className="space-y-8 px-3 py-5 sm:px-4">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
        <ProductGallery product={product} imageIdx={imageIdx} onImageIdx={setImageIdx} />

        <div className="space-y-4">
          <nav className="text-xs text-muted-foreground" aria-label="Breadcrumb">
            <Link to={`/store${vendorQuery}`} className="hover:underline">
              Home
            </Link>
            {' · '}
            <span>{category?.name || 'Menu'}</span>
            {' · '}
            <span className="text-secondary-foreground">{product.name}</span>
          </nav>

          <h1 className="font-display text-2xl font-bold sm:text-3xl">{product.name}</h1>
          <p className="text-sm text-amber-600">
            {'★'.repeat(Math.round(product.rating))}
            {'☆'.repeat(5 - Math.round(product.rating))}{' '}
            <span className="text-muted-foreground">({product.reviewCount} reviews)</span>
          </p>
          <p className="text-sm leading-relaxed text-secondary-foreground">{product.description}</p>

          <VariantPicker
            skus={product.skus}
            activeId={activeSku?.id}
            onSelect={setSkuId}
          />

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center rounded-full border border-border">
              <button
                type="button"
                className="px-3 py-2"
                aria-label="Decrease quantity"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-8 text-center text-sm font-bold">{qty}</span>
              <button
                type="button"
                className="px-3 py-2"
                aria-label="Increase quantity"
                onClick={() => setQty((q) => q + 1)}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <p className="text-lg font-bold text-[color-mix(in_srgb,var(--store-theme)_88%,#000)]">
              {formatMoney((activeSku?.price || product.minPrice) * qty)}
            </p>
          </div>

          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={!activeSku?.inStock}
            onClick={() => activeSku && cart.addItem(product, activeSku, qty)}
          >
            Add to cart
          </Button>
        </div>
      </div>

      <Reviews productId={product.id} rating={product.rating} reviewCount={product.reviewCount} />
      <RelatedProducts products={related} vendorQuery={vendorQuery} onAdd={onAddRelated} />
    </div>
  );
}
