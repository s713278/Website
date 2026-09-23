import { invalidateCartWrites } from '@/modules/storefront/lib/cart-actions'
import { clearPendingCartAdd } from '@/modules/storefront/lib/pending-cart-add'
import { clearAllProductCaches } from '@/modules/storefront/lib/product-catalog-cache'
import { clearStorePageCache } from '@/modules/storefront/hooks/useStorePage'
import { CART_STORAGE_KEY, useCartStore } from '@/modules/storefront/store/cart-store'

/** Auth, cart persist, pending add, and storefront session caches for this browser. */
export function clearCustomerSessionCaches() {
  invalidateCartWrites()
  useCartStore.getState().clear()
  const persistApi = useCartStore.persist
  persistApi?.clearStorage?.()
  try {
    localStorage.removeItem(CART_STORAGE_KEY)
  } catch {
    /* private mode */
  }
  clearPendingCartAdd()
  clearStorePageCache()
  clearAllProductCaches()
}
