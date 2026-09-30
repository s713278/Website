import { useSyncExternalStore } from 'react'
import { variantCartId } from '@/modules/storefront/lib/product-variants'

const pending = new Set<string>()
const listeners = new Set<() => void>()

export function cartWriteKey(storeId: string, productId: string, variantId: string) {
  return `${storeId}:${variantCartId(productId, variantId)}`
}

export function cartWriteKeyFromItemId(storeId: string, itemId: string) {
  return `${storeId}:${itemId}`
}

function emit() {
  for (const listener of listeners) listener()
}

export function beginCartWrite(key: string) {
  pending.add(key)
  emit()
}

export function endCartWrite(key: string) {
  if (!pending.delete(key)) return
  emit()
}

export function clearCartWrites() {
  if (pending.size === 0) return
  pending.clear()
  emit()
}

export function isCartWritePending(key: string) {
  return pending.has(key)
}

export function getCartWriteSnapshot() {
  return pending.size === 0 ? '' : [...pending].sort().join('|')
}

export function subscribeCartWrites(onStoreChange: () => void) {
  listeners.add(onStoreChange)
  return () => {
    listeners.delete(onStoreChange)
  }
}

export function cartWriteIsPending(
  snapshot: string,
  storeId: string,
  productId: string,
  variantId: string,
) {
  if (!snapshot) return false
  return snapshot.split('|').includes(cartWriteKey(storeId, productId, variantId))
}

/** True while this SKU's add/qty write has not finished — survives variant remounts. */
export function useCartWritePending(storeId: string, productId: string, variantId: string) {
  const snapshot = useSyncExternalStore(subscribeCartWrites, getCartWriteSnapshot, getCartWriteSnapshot)
  return cartWriteIsPending(snapshot, storeId, productId, variantId)
}

export function useCartWriteSnapshot() {
  return useSyncExternalStore(subscribeCartWrites, getCartWriteSnapshot, getCartWriteSnapshot)
}

/** Which SKU write is still in flight. */
export function useProductVariantCartState(storeId: string, productId: string) {
  const snapshot = useCartWriteSnapshot()
  return {
    isPending: (variantId: string) => cartWriteIsPending(snapshot, storeId, productId, variantId),
  }
}
