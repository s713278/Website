/**
 * Cart orchestration: call cartService → write Zustand.
 * Wait for API success before updating UI (live mode).
 * Mutations for one vendor run in a queue so overlapping add/remove
 * cannot apply a stale cart snapshot.
 */
import { getErrorMessage, isLiveApi } from '@/shared/api'
import { mergeProductRecords } from '@/shared/api/mappers/storefront-products'
import { cartService } from '@/shared/api/services/cart.service'
import { isMissingCartItemError } from '@/modules/storefront/lib/cart-errors'
import { enrichCartLinesWithCatalog } from '@/modules/storefront/lib/cart-utils'
import { listCachedStoreProducts } from '@/modules/storefront/lib/product-catalog-cache'
import {
  cartSkuId,
  resolveOwnedVariant,
  variantLineName,
} from '@/modules/storefront/lib/product-variants'
import { enqueueVendorCart, resetVendorCartQueue } from '@/modules/storefront/lib/vendor-cart-queue'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import type { CartLine, CartSummary, Product, ProductVariant } from '@/modules/storefront/types'

let writeEpoch = 0

/** Drop in-flight cart writes so a logout cannot be overwritten by a late response. */
export function invalidateCartWrites() {
  writeEpoch += 1
  resetVendorCartQueue()
}

function catalogForVendor(vendorId: string, extra: Product[] = []): Product[] {
  const cached = listCachedStoreProducts(vendorId)
  if (!cached.length) return extra
  if (!extra.length) return cached

  const byId = new Map(cached.map((product) => [product.id, product]))
  for (const product of extra) {
    const current = byId.get(product.id)
    byId.set(product.id, current ? mergeProductRecords(current, product) : product)
  }
  return [...byId.values()]
}

function applyServerCart(
  vendorId: string,
  apiLines: CartLine[],
  summary: CartSummary,
  storeName: string,
  products: Product[] = [],
  skuLabels: Record<string, string> = {},
) {
  const previous = useCartStore.getState().lines.filter((line) => line.storeId === vendorId)
  const enriched = enrichCartLinesWithCatalog(
    apiLines.map((line) => ({ ...line, storeName: storeName || line.storeName })),
    catalogForVendor(vendorId, products),
    previous,
    skuLabels,
  )
  useCartStore.getState().replaceVendorCart(vendorId, enriched, summary)
}

function stillCurrent(epoch: number) {
  return epoch === writeEpoch
}

async function refreshVendorCart(
  vendorId: string,
  storeName = '',
  products: Product[] = [],
  epoch = writeEpoch,
) {
  const snap = await cartService.get(vendorId, storeName)
  if (!stillCurrent(epoch)) return
  applyServerCart(vendorId, snap.lines, snap.summary, storeName, products)
}

async function syncVendorCartNow(
  vendorId: string,
  storeName = '',
  products: Product[] = [],
): Promise<void> {
  if (!isLiveApi()) return
  const epoch = writeEpoch
  const snap = await cartService.get(vendorId, storeName)
  if (!stillCurrent(epoch)) return
  applyServerCart(vendorId, snap.lines, snap.summary, storeName, products)
}

async function hydrateVendorCartNow(
  vendorId: string,
  storeName = '',
  products: Product[] = [],
): Promise<void> {
  await syncVendorCartNow(vendorId, storeName, products)
}

async function addToVendorCartNow(input: {
  vendorId: string
  storeName: string
  product: Product
  variant: ProductVariant
  qty?: number
}): Promise<void> {
  const qty = Math.max(1, input.qty ?? 1)
  const variant = resolveOwnedVariant(input.product, input.variant)
  const skuId = cartSkuId(input.product, variant)
  const tappedName = variantLineName(input.product.name, variant.unit)

  if (!isLiveApi()) {
    useCartStore.getState().addItem(input.vendorId, input.storeName, input.product, variant, qty)
    return
  }

  const epoch = writeEpoch
  const snap = await cartService.addItem(
    input.vendorId,
    { skuId, quantity: qty },
    input.storeName,
  )
  if (!stillCurrent(epoch)) return
  applyServerCart(
    input.vendorId,
    snap.lines,
    snap.summary,
    input.storeName,
    [input.product],
    tappedName ? { [skuId]: tappedName } : {},
  )
}

async function removeVendorCartLineNow(vendorId: string, itemId: string): Promise<void> {
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

  const epoch = writeEpoch
  try {
    await cartService.removeItem(vendorId, line.cartItemId)
    if (!stillCurrent(epoch)) return
    useCartStore.getState().removeItem(line.itemId)
  } catch (error) {
    if (!isMissingCartItemError(error)) throw error
    await refreshVendorCart(vendorId, line.storeName, [], epoch)
  }
}

async function setVendorCartQtyNow(
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
    await removeVendorCartLineNow(vendorId, line.itemId)
    return
  }

  if (!line.cartItemId) return

  const epoch = writeEpoch
  try {
    const snap = await cartService.setItemQty(
      vendorId,
      line.cartItemId,
      qty,
      storeName || line.storeName,
    )
    if (!stillCurrent(epoch)) return
    applyServerCart(vendorId, snap.lines, snap.summary, storeName || line.storeName, products)
  } catch (error) {
    if (!isMissingCartItemError(error)) throw error
    await refreshVendorCart(vendorId, storeName || line.storeName, products, epoch)
    if (!stillCurrent(epoch)) return
    const latest = useCartStore.getState().findLine(vendorId, itemId)
    if (!latest?.cartItemId) return
    const snap = await cartService.setItemQty(
      vendorId,
      latest.cartItemId,
      qty,
      storeName || latest.storeName,
    )
    if (!stillCurrent(epoch)) return
    applyServerCart(vendorId, snap.lines, snap.summary, storeName || latest.storeName, products)
  }
}

/** Replace this vendor's local cart with the live server snapshot. */
export function syncVendorCart(
  vendorId: string,
  storeName = '',
  products: Product[] = [],
): Promise<void> {
  return enqueueVendorCart(vendorId, () => syncVendorCartNow(vendorId, storeName, products))
}

/** Load this vendor from the server (same as sync). */
export function hydrateVendorCart(
  vendorId: string,
  storeName = '',
  products: Product[] = [],
): Promise<void> {
  return enqueueVendorCart(vendorId, () => hydrateVendorCartNow(vendorId, storeName, products))
}

export function addToVendorCart(input: {
  vendorId: string
  storeName: string
  product: Product
  variant: ProductVariant
  qty?: number
}): Promise<void> {
  return enqueueVendorCart(input.vendorId, () => addToVendorCartNow(input))
}

export function setVendorCartQty(
  vendorId: string,
  itemId: string,
  qty: number,
  storeName = '',
  products: Product[] = [],
): Promise<void> {
  return enqueueVendorCart(vendorId, () =>
    setVendorCartQtyNow(vendorId, itemId, qty, storeName, products),
  )
}

export function removeVendorCartLine(vendorId: string, itemId: string): Promise<void> {
  return enqueueVendorCart(vendorId, () => removeVendorCartLineNow(vendorId, itemId))
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
