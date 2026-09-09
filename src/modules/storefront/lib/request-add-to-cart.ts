import type { NavigateFunction } from 'react-router-dom'
import { loginPathForRole } from '@/app/router/role-home'
import { savePendingCartAdd } from '@/modules/storefront/lib/pending-cart-add'
import { storeCartPath } from '@/modules/storefront/lib/store-paths'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import type { Product, ProductVariant } from '@/modules/storefront/types'
import type { User } from '@/shared/types'

export function canShopAsCustomer(user: User | null | undefined): boolean {
  return user?.role === 'customer'
}

type RequestAddToCartInput = {
  user: User | null | undefined
  navigate: NavigateFunction
  storeId: string
  storeName: string
  product: Product
  variant: ProductVariant
  qty?: number
  /** Defaults to store cart path. */
  returnTo?: string
}

/**
 * Customer → write md-cart immediately.
 * Guest / vendor → save pending + customer OTP; do not touch md-cart.
 * @returns true if line was added to cart; false if redirected to login.
 */
export function requestAddToCart({
  user,
  navigate,
  storeId,
  storeName,
  product,
  variant,
  qty = 1,
  returnTo,
}: RequestAddToCartInput): boolean {
  const amount = Math.max(1, qty)
  const resumePath = returnTo ?? storeCartPath(storeId)

  if (canShopAsCustomer(user)) {
    useCartStore.getState().addItem(storeId, storeName, product, variant, amount)
    return true
  }

  savePendingCartAdd({
    vendorId: storeId,
    storeName,
    productId: product.id,
    skuId: variant.id,
    qty: amount,
    name: product.name,
    label: variant.unit ?? '',
    price: variant.price,
    returnTo: resumePath,
  })

  navigate(loginPathForRole('customer'), {
    state: { from: resumePath },
  })

  return false
}