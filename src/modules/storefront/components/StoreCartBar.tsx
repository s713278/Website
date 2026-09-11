import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { storeCartPath } from '@/modules/storefront/lib/store-paths'
import { formatCurrency } from '@/shared/lib/utils'
import { cn } from '@/lib/utils'

type StoreCartBarProps = {
  storeId: string
  itemCount: number
  /** Line items subtotal (before delivery / packaging). */
  subtotal: number
  className?: string
}

/**
 * Sticky catalog CTA — count + total + Go to Cart.
 * Shown only when this store already has lines; never creates cart lines.
 */
export function StoreCartBar({ storeId, itemCount, subtotal, className }: StoreCartBarProps) {
  if (itemCount <= 0) return null

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(0.85rem,env(safe-area-inset-bottom))]',
        className,
      )}
    >
      <div
        className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-2xl bg-[var(--store-theme,var(--md-green-700))] px-4 py-3 text-white shadow-[0_14px_30px_rgba(6,95,70,0.35)]"
        role="status"
        aria-live="polite"
      >
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-white/90">
            {itemCount} {itemCount === 1 ? 'Item' : 'Items'}
          </p>
          <p className="text-sm font-bold tabular-nums">{formatCurrency(subtotal)}</p>
        </div>
        <Link
          to={storeCartPath(storeId)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-[var(--store-theme,var(--md-green-800))] transition hover:bg-white/95 active:scale-[0.98]"
        >
          Go to Cart
          <ArrowRight className="size-3.5" strokeWidth={2.5} aria-hidden />
        </Link>
      </div>
    </div>
  )
}

/** Spacer so page content is not hidden behind StoreCartBar. */
export const STORE_CART_BAR_PAD = 'pb-24'
