import { cn } from '@/lib/utils'
import { StoreBone } from './store-skeleton-bone'

type ProductGridSkeletonProps = {
  count?: number
  className?: string
}

function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
      <StoreBone className="aspect-[5/4] w-full rounded-none" />
      <div className="space-y-2.5 px-3.5 py-3 sm:px-4">
        <div className="flex items-start justify-between gap-2">
          <StoreBone className="h-4 w-3/5" />
          <StoreBone className="h-4 w-14 shrink-0" />
        </div>
        <StoreBone className="h-3 w-24" />
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          <StoreBone className="h-7 w-14 rounded-full" />
          <StoreBone className="h-7 w-16 rounded-full" />
          <StoreBone className="h-7 w-12 rounded-full" />
        </div>
        <StoreBone className="h-3 w-28" />
      </div>
    </div>
  )
}

/** Product grid placeholder while storefront products load. */
export function ProductGridSkeleton({ count = 6, className }: ProductGridSkeletonProps) {
  return (
    <div
      className={cn(
        'store-product-grid grid grid-cols-2 gap-3.5 sm:gap-4 lg:grid-cols-3 lg:gap-5',
        className,
      )}
      aria-hidden
    >
      {Array.from({ length: count }, (_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  )
}
