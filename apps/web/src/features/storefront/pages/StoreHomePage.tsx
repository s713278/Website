import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StoreHero } from '@/features/storefront/components/StoreHero';
import { CategoryBar } from '@/features/storefront/components/CategoryBar';
import { SearchBar } from '@/features/storefront/components/SearchBar';
import { FiltersPanel } from '@/features/storefront/components/FiltersPanel';
import { ProductGrid } from '@/features/storefront/components/ProductGrid';
import { Pagination } from '@/features/storefront/components/Pagination';
import { InfiniteScrollSentinel } from '@/features/storefront/components/InfiniteScrollSentinel';
import { useStoreProducts } from '@/features/storefront/hooks/use-store-products';
import { useStoreCart } from '@/features/storefront/hooks/use-store-cart';
import type { StoreProduct } from '@/features/storefront/types';

export function StoreHomePage() {
  const [params] = useSearchParams();
  const vendor = params.get('vendor') || params.get('vendorId');
  const vendorQuery = vendor ? `?vendor=${encodeURIComponent(vendor)}` : '';
  const store = useStoreProducts();
  const { addItem } = useStoreCart(store.vendorId);

  const onAdd = useCallback(
    (product: StoreProduct) => {
      const sku = product.skus.find((s) => s.inStock) || product.skus[0];
      if (!sku) return;
      addItem(product, sku, 1);
    },
    [addItem],
  );

  const loadMore = useCallback(() => store.loadMore(), [store.loadMore]);

  return (
    <div>
      <StoreHero meta={store.meta} />

      <div className="space-y-4 px-3 py-4 sm:px-4">
        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--store-theme)_25%,#fff)] bg-[color-mix(in_srgb,var(--store-theme-soft)_55%,#fff)] px-3 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[color-mix(in_srgb,var(--store-theme)_85%,#000)]">
            Trust signals
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-secondary-foreground">
            <span>🌿 100% Natural</span>
            <span>🚫 No Preservatives</span>
            <span>🧼 Hygienic & Safe</span>
            <span>🚚 Home Delivery</span>
          </div>
        </div>

        <section id="store-catalog" className="scroll-mt-20 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-bold">Menu</h2>
              <p className="text-sm text-muted-foreground">
                {store.isLoading
                  ? 'Loading catalog…'
                  : `${store.totalFiltered} products · ${store.data?.source === 'api' ? 'live' : 'demo'} catalog`}
              </p>
            </div>
          </div>

          <CategoryBar
            categories={store.categories}
            activeId={store.filters.categoryId}
            onSelect={store.setCategoryId}
            loading={store.isLoading}
          />

          <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
            <div className="space-y-3">
              <SearchBar value={store.searchInput} onChange={store.setSearchInput} />
              <FiltersPanel
                loading={store.isLoading}
                minPrice={store.filters.minPrice}
                maxPrice={store.filters.maxPrice}
                bounds={store.bounds}
                inStockOnly={store.filters.inStockOnly}
                sort={store.filters.sort}
                onMinPrice={store.setMinPrice}
                onMaxPrice={store.setMaxPrice}
                onInStockOnly={store.setInStockOnly}
                onSort={store.setSort}
              />
            </div>

            <div className="space-y-4">
              <ProductGrid
                products={store.pageItems}
                loading={store.isLoading}
                vendorQuery={vendorQuery}
                onAdd={onAdd}
              />

              <Pagination
                mode={store.browseMode}
                onModeChange={store.setBrowseMode}
                page={store.page}
                totalPages={store.totalPages}
                pageSize={store.pageSize}
                onPageSize={store.setPageSize}
                onPage={store.goToPage}
                totalItems={store.totalFiltered}
                visibleCount={store.pageItems.length}
              />

              {store.browseMode === 'infinite' && (
                <InfiniteScrollSentinel enabled={store.hasMore} onLoadMore={loadMore} />
              )}
            </div>
          </div>
        </section>

        <p className="pb-4 text-center text-xs text-muted-foreground">
          Powered by MithraDirect · Local support, direct connection
        </p>
      </div>
    </div>
  );
}
