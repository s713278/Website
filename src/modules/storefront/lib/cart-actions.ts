/**
 * Cart orchestration: call cartService → write Zustand.
 * Wait for API success before updating UI (live mode).
 */
import { getErrorMessage, isLiveApi } from '@/shared/api'
import { cartService } from '@/shared/api/services/cart.service'
import { enrichCartLinesWithCatalog } from '@/modules/storefront/lib/cart-utils'
import { resolveVariant } from '@/modules/storefront/lib/product-variants'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import type { CartLine, CartSummary, Product, ProductVariant } from '@/modules/storefront/types'

function applyServerCart(
  vendorId: string,
  apiLines: CartLine[],
  summary: CartSummary,
  storeName: string,
  products: Product[] = [],
) {
  const previous = useCartStore.getState().lines.filter((line) => line.storeId === vendorId)
  const enriched = enrichCartLinesWithCatalog(
    apiLines.map((line) => ({ ...line, storeName: storeName || line.storeName })),
    products,
    previous,
  )
  useCartStore.getState().replaceVendorCart(vendorId, enriched, summary)
}

/** Cold start only — skip when this vendor already has local lines. */
export async function hydrateVendorCart(
  vendorId: string,
  storeName = '',
  products: Product[] = [],
): Promise<void> {
  if (!isLiveApi()) return
  const local = useCartStore.getState().lines.filter((line) => line.storeId === vendorId)
  if (local.length > 0) return

  const snap = await cartService.get(vendorId, storeName)
  applyServerCart(vendorId, snap.lines, snap.summary, storeName, products)
}

export async function addToVendorCart(input: {
  vendorId: string
  storeName: string
  product: Product
  variant: ProductVariant
  qty?: number
}): Promise<void> {
  const qty = Math.max(1, input.qty ?? 1)
  const variant = resolveVariant(input.product, input.variant)
  const skuId = variant.id === 'default' ? input.product.id : variant.id

  if (!isLiveApi()) {
    useCartStore.getState().addItem(input.vendorId, input.storeName, input.product, variant, qty)
    return
  }

  const snap = await cartService.addItem(
    input.vendorId,
    { skuId, quantity: qty },
    input.storeName,
  )
  applyServerCart(input.vendorId, snap.lines, snap.summary, input.storeName, [input.product])
}

export async function setVendorCartQty(
  vendorId: string,
  itemId: string,
  qty: number,
  storeName = '',
  products: Product[] = [],
): Promise<void> {
  const line = useCartStore.getState().findLine(vendorId, itemId)
  if (!line) return

  if (!isLiveApi()) {
    useCartStore.getState().setQty(line.itemId, qty)
    return
  }

  if (qty <= 0) {
    await removeVendorCartLine(vendorId, line.itemId)
    return
  }

  if (!line.cartItemId) return

  const snap = await cartService.setItemQty(
    vendorId,
    line.cartItemId,
    qty,
    storeName || line.storeName,
  )
  applyServerCart(vendorId, snap.lines, snap.summary, storeName || line.storeName, products)
}

export async function removeVendorCartLine(vendorId: string, itemId: string): Promise<void> {
  const line = useCartStore.getState().findLine(vendorId, itemId)
  if (!line) return

  if (!isLiveApi()) {
    useCartStore.getState().removeItem(line.itemId)
    return
  }

  if (!line.cartItemId) {
    useCartStore.getState().removeItem(line.itemId)
    return
  }

  await cartService.removeItem(vendorId, line.cartItemId)
  // DELETE has no cart body — drop the line locally (store recalculates summary).
  useCartStore.getState().removeItem(line.itemId)
}

/** Prefer backend `user_message` for alerts. */
export function cartActionErrorMessage(error: unknown) {
  const body =
    error && typeof error === 'object' && 'body' in error
      ? (error as { body?: unknown }).body
      : undefined
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const userMessage = (body as { user_message?: unknown }).user_message
    if (typeof userMessage === 'string' && userMessage.trim()) {
      return userMessage.trim()
    }
  }
  return getErrorMessage(error, 'Could not update cart. Please try again.')
}
