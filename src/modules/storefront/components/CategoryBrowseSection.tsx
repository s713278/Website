import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { filterProducts } from '@/modules/storefront/lib/catalog-filters'
import type { Product, StoreCategory } from '@/modules/storefront/types'
import { CategoryScroller } from './CategoryScroller'
import { ProductGrid } from './ProductGrid'

type CategoryBrowseSectionProps = {
  storeId: string
  storeName: string
  categories: StoreCategory[]
  products: Product[]
  categoryId: string
  query?: string
  onCategoryChange: (categoryId: string) => void
  className?: string
}
export function CategoryBrowseSection({
  storeId,
  storeName,
  categories,
  products,
  categoryId,
  query = '',
  onCategoryChange,
  className,
}: CategoryBrowseSectionProps) {
  const filtered = useMemo(
    () => filterProducts(products, categoryId, query),
    [products, categoryId, query],
  )

  return (
    <section className={cn('flex flex-col gap-4 sm:gap-5', className)}>
      <CategoryScroller
        categories={categories}
        activeId={categoryId}
        onSelect={onCategoryChange}
        showAllOption
      />

      {filtered.length > 0 ? (
        <p className="text-xs text-slate-500 sm:text-sm">
          {filtered.length} product{filtered.length === 1 ? '' : 's'}
        </p>
      ) : null}

      <ProductGrid
        storeId={storeId}
        storeName={storeName}
        products={filtered}
        hideHeader
        emptyTitle={query.trim() ? 'No results' : 'No products match'}
        emptyDescription={
          query.trim()
            ? `Nothing matched "${query.trim()}". Try another word.`
            : 'Try another category or tap All.'
        }
      />
    </section>
  )
}
