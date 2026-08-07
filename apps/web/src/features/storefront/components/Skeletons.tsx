import { Skeleton } from '@/shared/components/ui/skeleton';

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      aria-busy="true"
      aria-label="Loading products"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-border bg-white">
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-9 w-full rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function FiltersSkeleton() {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-white p-4" aria-busy="true">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-10 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 flex-1" />
      </div>
    </div>
  );
}

export function ProductDetailSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]" aria-busy="true" aria-label="Loading product">
      <Skeleton className="aspect-square w-full rounded-3xl" />
      <div className="space-y-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-20 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-11 w-24 rounded-full" />
          <Skeleton className="h-11 w-24 rounded-full" />
        </div>
        <Skeleton className="h-12 w-full rounded-full" />
      </div>
    </div>
  );
}

export function CartSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading cart">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-3 rounded-2xl border border-border p-3">
          <Skeleton className="h-16 w-16 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-8 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CategoryBarSkeleton() {
  return (
    <div className="flex gap-2 overflow-hidden" aria-busy="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-24 shrink-0 rounded-full" />
      ))}
    </div>
  );
}
