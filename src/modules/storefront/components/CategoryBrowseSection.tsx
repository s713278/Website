import { cn } from '@/lib/utils'
import type { CategoryFilter } from '@/modules/storefront/lib/catalog-filters'
import type { Product, StoreCategory } from '@/modules/storefront/types'
import { Button } from '@/shared/components/ui'
import { CategoryScroller } from './CategoryScroller'
import { ProductGrid } from './ProductGrid'

type CategoryBrowseSectionProps = {
  storeId: string
  storeName: string
  categories: StoreCategory[]
  products: Product[]
  categoryFilter: CategoryFilter
  /** Raw draft text in the search box (for empty-state copy). */
  query?: string
  /** True when an active search filter is applied (min length met). */
  searching?: boolean
  /** True when user typed 1 character — show hint, keep catalog visible. */
  searchTooShort?: boolean
  onCategoryChange: (filter: CategoryFilter) => void
  totalElements?: number
  hasMore?: boolean
  loadingMore?: boolean
  loading?: boolean
  onLoadMore?: () => void
  className?: string
}

export function CategoryBrowseSection({
  storeId,
  storeName,
  categories,
  products,
  categoryFilter,
  query = '',
  searching = false,
  searchTooShort = false,
  onCategoryChange,
  totalElements,
  hasMore = false,
  loadingMore = false,
  loading = false,
  onLoadMore,
  className,
}: CategoryBrowseSectionProps) {
  const showSkeleton = loading && products.length === 0 && !searching
  const count = searching ? products.length : (totalElements ?? products.length)
  const q = query.trim()

  return (
    <section className={cn('flex flex-col gap-4 sm:gap-5', className)}>
      <CategoryScroller
        categories={categories}
        activeFilter={categoryFilter}
        onSelect={onCategoryChange}
        showAllOption
      />

      {searchTooShort ? (
        <p className="text-sm text-slate-500">Type 2 or more characters to search</p>
      ) : !showSkeleton && count > 0 ? (
        <p className="break-words text-sm text-slate-600">
          {searching ? (
            <>
              <span className="font-semibold text-slate-900">{count}</span>
              {count === 1 ? ' result' : ' results'}
              {q ? (
                <>
                  {' '}
                  for{' '}
                  <span className="font-medium break-all text-slate-800">“{q}”</span>
                </>
              ) : null}
            </>
          ) : (
            <>
              <span className="font-semibold text-slate-900">{count}</span>
              {count === 1 ? ' product' : ' products'}
            </>
          )}
        </p>
      ) : null}

      <ProductGrid
        storeId={storeId}
        storeName={storeName}
        products={products}
        hideHeader
        loading={showSkeleton}
        skeletonCount={6}
        emptyTitle={searching ? 'No results' : 'No products match'}
        emptyDescription={
          searching
            ? `Nothing matched "${q}". Try another word.`
            : 'Try another category or tap All.'
        }
      />

      {hasMore && !searching && !searchTooShort && !showSkeleton ? (
        <div className="flex justify-center pt-1">
          <Button
            type="button"
            variant="outline"
            disabled={loadingMore}
            onClick={onLoadMore}
            className="min-w-[10rem]"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </section>
  )
}
