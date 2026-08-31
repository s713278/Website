import { cn } from '@/lib/utils'
import type { Product } from '@/modules/storefront/types'
import { EmptyState, SectionHeader } from '@/shared/components'
import { ProductCard } from './ProductCard'
import { ProductGridSkeleton } from './ProductGridSkeleton'

type ProductGridProps = {
  storeId: string
  storeName: string
  title?: string
  products: Product[]
  actionLabel?: string
  onAction?: () => void
  emptyTitle?: string
  emptyDescription?: string
  hideHeader?: boolean
  loading?: boolean
  skeletonCount?: number
  className?: string
}

export function ProductGrid({
  storeId,
  storeName,
  title = '',
  products,
  actionLabel = 'View all',
  onAction,
  emptyTitle = 'No products',
  emptyDescription = 'Nothing to show in this section yet.',
  hideHeader = false,
  loading = false,
  skeletonCount = 6,
  className,
}: ProductGridProps) {
  const showSkeleton = loading && products.length === 0

  return (
    <section className={cn(className)}>
      {!hideHeader && title ? (
        <SectionHeader
          compact
          title={title}
          actionLabel={!showSkeleton && onAction ? actionLabel : undefined}
          onAction={onAction}
        />
      ) : null}
      {showSkeleton ? (
        <ProductGridSkeleton count={skeletonCount} />
      ) : products.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="store-product-grid grid grid-cols-2 gap-3.5 sm:gap-4 lg:grid-cols-3 lg:gap-5">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              storeId={storeId}
              storeName={storeName}
              product={product}
            />
          ))}
        </div>
      )}
    </section>
  )
}
