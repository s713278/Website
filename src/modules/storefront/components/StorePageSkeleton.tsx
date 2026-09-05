import { StoreBone } from './store-skeleton-bone'
import { ProductGridSkeleton } from './ProductGridSkeleton'

/** Header chrome shared by all storefront pages. */
export function StoreHeaderSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <header className="border-b border-slate-100 bg-white" aria-hidden>
      <div className="store-shell-inner flex h-14 items-center justify-between gap-3 sm:h-16">
        <div className="flex min-w-0 items-center gap-2.5">
          <StoreBone className="size-9 shrink-0 rounded-full sm:size-10" />
          <StoreBone className="h-4 w-24 sm:w-32" />
        </div>
        {!compact ? (
          <div className="hidden items-center gap-1 md:flex">
            <StoreBone className="h-8 w-14 rounded-full" />
            <StoreBone className="h-8 w-20 rounded-full" />
            <StoreBone className="h-8 w-24 rounded-full" />
            <StoreBone className="h-8 w-16 rounded-full" />
          </div>
        ) : (
          <StoreBone className="h-4 w-28 md:hidden" />
        )}
        <div className="flex items-center gap-2">
          <StoreBone className="size-9 rounded-full" />
          <StoreBone className="size-9 rounded-full" />
        </div>
      </div>
    </header>
  )
}

function CategoryRowSkeleton() {
  return (
    <section className="space-y-3" aria-hidden>
      <div className="flex items-center justify-between gap-3">
        <StoreBone className="h-5 w-36" />
        <StoreBone className="h-4 w-16" />
      </div>
      <div className="flex gap-3 overflow-hidden py-1">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex w-[4.5rem] shrink-0 flex-col items-center gap-2">
            <StoreBone className="size-14 rounded-full sm:size-[3.75rem]" />
            <StoreBone className="h-2.5 w-10" />
          </div>
        ))}
      </div>
    </section>
  )
}

/** Store home — hero, service bar, categories, product grid. */
export function StoreHomeSkeleton() {
  return (
    <>
      <StoreHeaderSkeleton />
      <main className="store-shell-inner flex flex-col gap-5 py-5 sm:gap-6 sm:py-6">
        <StoreBone className="min-h-[220px] w-full rounded-2xl sm:min-h-[250px] lg:min-h-[280px]" />
        <div className="grid gap-3 rounded-2xl border border-slate-100 bg-white p-4 sm:grid-cols-3 sm:gap-4">
          <StoreBone className="h-14 rounded-xl" />
          <StoreBone className="h-14 rounded-xl" />
          <StoreBone className="h-14 rounded-xl" />
        </div>
        <div className="space-y-2 rounded-2xl border border-slate-100 bg-white p-4">
          <StoreBone className="h-4 w-24" />
          <StoreBone className="h-3 w-full" />
          <StoreBone className="h-3 w-5/6" />
        </div>
        <CategoryRowSkeleton />
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <StoreBone className="h-5 w-28" />
            <StoreBone className="h-4 w-16" />
          </div>
          <ProductGridSkeleton count={6} />
        </section>
      </main>
      <footer className="mt-auto border-t border-slate-100 bg-white py-8" aria-hidden>
        <div className="store-shell-inner space-y-3">
          <StoreBone className="h-4 w-40" />
          <StoreBone className="h-3 w-full max-w-md" />
          <StoreBone className="h-3 w-48" />
        </div>
      </footer>
    </>
  )
}

/** Sub-pages — compact header + content blocks (cart, checkout, PDP, etc.). */
export function StorePanelSkeleton() {
  return (
    <>
      <StoreHeaderSkeleton compact />
      <main className="store-shell-inner flex flex-col gap-4 py-5 sm:gap-5 sm:py-6">
        <StoreBone className="h-6 w-40" />
        <div className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4">
          <div className="flex gap-3">
            <StoreBone className="size-20 shrink-0 rounded-xl" />
            <div className="flex flex-1 flex-col gap-2">
              <StoreBone className="h-4 w-3/4" />
              <StoreBone className="h-3 w-1/2" />
              <StoreBone className="h-4 w-20" />
            </div>
          </div>
          <StoreBone className="h-10 w-full rounded-xl" />
          <StoreBone className="h-10 w-full rounded-xl" />
        </div>
        <StoreBone className="h-11 w-full rounded-xl" />
      </main>
    </>
  )
}

export type StorePageSkeletonLayout = 'home' | 'panel'

export function StorePageSkeleton({ layout = 'panel' }: { layout?: StorePageSkeletonLayout }) {
  return layout === 'home' ? <StoreHomeSkeleton /> : <StorePanelSkeleton />
}
