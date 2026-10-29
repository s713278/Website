import {
  clearPendingCartAdd,
  readPendingCartAdd,
  savePendingCartAdd,
} from '@/modules/storefront/lib/pending-cart-add'
import { addToVendorCart } from '@/modules/storefront/lib/cart-actions'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import { isLiveApi } from '@/shared/api/mode'

/** After customer OTP — push pending into vendor cart. */
export async function applyPendingCartAdd(): Promise<void> {
  const pending = readPendingCartAdd()
  if (!pending) return

  clearPendingCartAdd()

  if (!isLiveApi()) {
    useCartStore.getState().addPendingLine(pending)
    return
  }

  try {
    await addToVendorCart({
      vendorId: pending.vendorId,
      storeName: pending.storeName,
      product: {
        id: pending.productId,
        name: pending.name,
        description: '',
        price: pending.price,
        veg: true,
      },
      variant: {
        id: pending.skuId,
        unit: pending.label,
        price: pending.price,
        onSale: false,
        skuType: 'ITEM',
      },
      qty: pending.qty,
    })
  } catch {
    savePendingCartAdd(pending)
    throw new Error('Could not apply pending cart item')
  }
}