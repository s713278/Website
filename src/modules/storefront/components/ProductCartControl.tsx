import { type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { requestAddToCart } from '@/modules/storefront/lib/request-add-to-cart'
import { storeCartPath } from '@/modules/storefront/lib/store-paths'
import { variantCartId } from '@/modules/storefront/lib/product-variants'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import type { Product, ProductVariant } from '@/modules/storefront/types'
import { useAuthStore } from '@/shared/auth/store/auth-store'

type ProductCartControlProps = {
  storeId: string
  storeName: string
  product: Product
  variant: ProductVariant
  className?: string
}

/** Blinkit-style ADD pill that expands into a compact − qty + stepper on the card. */
export function ProductCartControl({
  storeId,
  storeName,
  product,
  variant,
  className,
}: ProductCartControlProps) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const lineId = variantCartId(product.id, variant.id)
  const qty = useCartStore((s) => s.lines.find((line) => line.itemId === lineId)?.qty ?? 0)
  const setQty = useCartStore((s) => s.setQty)

  function stopNav(event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
  }

  function handleAdd(event: MouseEvent) {
    stopNav(event)
    requestAddToCart({
      user,
      navigate,
      storeId,
      storeName,
      product,
      variant,
      qty: 1,
      returnTo: storeCartPath(storeId),
    })
  }

  function handleIncrease(event: MouseEvent) {
    stopNav(event)
    requestAddToCart({
      user,
      navigate,
      storeId,
      storeName,
      product,
      variant,
      qty: 1,
      returnTo: storeCartPath(storeId),
    })
  }

  function handleDecrease(event: MouseEvent) {
    stopNav(event)
    setQty(lineId, qty - 1)
  }

  const aria = variant.unit
    ? `Add ${product.name}, ${variant.unit}`
    : `Add ${product.name} to cart`

  if (qty <= 0) {
    return (
      <button
        type="button"
        onClick={handleAdd}
        className={cn(
          'inline-flex h-9 min-h-9 min-w-[4.75rem] items-center justify-center gap-0.5 rounded-full border border-[var(--store-theme,var(--md-green-600))] bg-white px-3 text-[11px] font-bold uppercase tracking-wide text-[var(--store-theme,var(--md-green-700))] shadow-sm transition duration-200 hover:bg-[var(--store-theme-soft,rgba(16,185,129,0.14))] active:scale-95',
          className,
        )}
        aria-label={aria}
      >
        <Plus className="size-3.5" strokeWidth={2.5} aria-hidden />
        <span>Add</span>
      </button>
    )
  }

  return (
    <div
      className={cn(
        'inline-flex h-9 min-h-9 min-w-[5.75rem] items-stretch overflow-hidden rounded-full bg-[var(--store-theme,var(--md-green-600))] text-white shadow-sm',
        className,
      )}
      role="group"
      aria-label={`${product.name} quantity`}
    >
      <button
        type="button"
        onClick={handleDecrease}
        className="inline-flex w-9 shrink-0 items-center justify-center transition hover:bg-black/10 active:bg-black/15"
        aria-label={`Decrease ${product.name} quantity`}
      >
        <Minus className="size-3.5" strokeWidth={2.5} aria-hidden />
      </button>
      <span
        className="flex min-w-[1.75rem] flex-1 items-center justify-center text-xs font-bold tabular-nums"
        aria-live="polite"
        aria-atomic="true"
      >
        {qty}
      </span>
      <button
        type="button"
        onClick={handleIncrease}
        className="inline-flex w-9 shrink-0 items-center justify-center transition hover:bg-black/10 active:bg-black/15"
        aria-label={`Increase ${product.name} quantity`}
      >
        <Plus className="size-3.5" strokeWidth={2.5} aria-hidden />
      </button>
    </div>
  )
}
