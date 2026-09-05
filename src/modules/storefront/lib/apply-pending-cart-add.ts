import {
  clearPendingCartAdd,
  readPendingCartAdd,
} from '@/modules/storefront/lib/pending-cart-add'
import { useCartStore } from '@/modules/storefront/store/cart-store'

/**
 * Call only after a successful customer OTP session is applied.
 * Safe no-op when nothing is pending.
 */
export function applyPendingCartAdd(): void {
  const pending = readPendingCartAdd()
  if (!pending) return

  useCartStore.getState().addPendingLine(pending)
  clearPendingCartAdd()
}