import { invalidateCartWrites } from '@/modules/storefront/lib/cart-actions'
import { clearPendingCartAdd } from '@/modules/storefront/lib/pending-cart-add'
import { clearAllProductCaches } from '@/modules/storefront/lib/product-catalog-cache'
import { CART_STORAGE_KEY, useCartStore } from '@/modules/storefront/store/cart-store'

/**
 * Drop this identity's cart and pending add.
 * Keep the public storefront cache — login still needs the shop name and logo.
 */
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
  clearAllProductCaches()
}
