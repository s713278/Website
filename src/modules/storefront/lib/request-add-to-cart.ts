/**
 * UI entry for cart mutations.
 * - Customer → cart-actions (API / demo)
 * - Guest → pending + login, then back to the shop (not the cart)
 * - Errors → backend `user_message` (401 → login)
 */
import type { NavigateFunction } from 'react-router-dom'
import { getCachedStore } from '@/modules/storefront/hooks/useStorePage'
import { customerLoginLink } from '@/modules/storefront/lib/cart-nav'
import {
  addToVendorCart,
  cartActionErrorMessage,
  setVendorCartQty,
} from '@/modules/storefront/lib/cart-actions'
import { isMissingVendorCartError } from '@/modules/storefront/lib/cart-errors'
import {
  beginCartWrite,
  cartWriteKey,
  cartWriteKeyFromItemId,
  endCartWrite,
} from '@/modules/storefront/lib/cart-write-pending'
import { savePendingCartAdd } from '@/modules/storefront/lib/pending-cart-add'
import { storeIdFromPath, storePath } from '@/modules/storefront/lib/store-paths'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import type { Product, ProductVariant } from '@/modules/storefront/types'
import { isApiError } from '@/shared/api'
import type { User } from '@/shared/types'

export function canShopAsCustomer(user: User | null | undefined): boolean {
  return user?.role === 'customer'
}

function isUnauthorized(error: unknown): boolean {
  return isApiError(error) && (error.status === 401 || error.kind === 'unauthorized')
}

function isCartNotFound(error: unknown): boolean {
  return isMissingVendorCartError(error)
}

function shopForLogin(storeId: string, storeName?: string) {
  const cached = getCachedStore(storeId)
  return {
    name: storeName || cached?.name,
    logoUrl: cached?.theme?.logoImage,
  }
}

function goCustomerLogin(
  navigate: NavigateFunction,
  from: string,
  storeId: string,
  storeName?: string,
  replace = true,
) {
  const login = customerLoginLink(from, shopForLogin(storeId, storeName))
  navigate(login.to, { replace, state: login.state })
}

export function redirectCartUnauthorized(
  error: unknown,
  navigate: NavigateFunction,
  from: string,
  storeId?: string,
  storeName?: string,
): boolean {
  if (!isUnauthorized(error)) return false
  const shopId = storeId || storeIdFromPath(from) || ''
  goCustomerLogin(navigate, from, shopId, storeName)
  return true
}

function showError(onError: ((message: string) => void) | undefined, error: unknown) {
  const message = cartActionErrorMessage(error)
  if (onError) onError(message)
  else window.alert(message)
}

function onMutationError(
  error: unknown,
  storeId: string,
  navigate: NavigateFunction,
  from: string,
  onError?: (message: string) => void,
  storeName?: string,
): false {
  if (isUnauthorized(error)) {
    goCustomerLogin(navigate, from, storeId, storeName)
    return false
  }
  if (isCartNotFound(error)) {
    useCartStore.getState().clearVendor(storeId)
  }
  showError(onError, error)
  return false
}

type AddArgs = {
  user: User | null | undefined
  navigate: NavigateFunction
  storeId: string
  storeName: string
  product: Product
  variant: ProductVariant
  qty?: number
  returnTo?: string
  onError?: (message: string) => void
}

type SetQtyArgs = {
  user: User | null | undefined
  navigate: NavigateFunction
  storeId: string
  storeName?: string
  itemId: string
  qty: number
  products?: Product[]
  returnTo?: string
  onError?: (message: string) => void
}

export async function requestAddToCart({
  user,
  navigate,
  storeId,
  storeName,
  product,
  variant,
  qty = 1,
  returnTo,
  onError,
}: AddArgs): Promise<boolean> {
  const amount = Math.max(1, qty)
  const from = returnTo ?? storePath(storeId)

  if (!canShopAsCustomer(user)) {
    savePendingCartAdd({
      vendorId: storeId,
      storeName,
      productId: product.id,
      skuId: variant.id,
      qty: amount,
      name: product.name,
      label: variant.unit ?? '',
      price: variant.price,
      returnTo: from,
    })
    goCustomerLogin(navigate, from, storeId, storeName, false)
    return false
  }

  const writeKey = cartWriteKey(storeId, product.id, variant.id)
  beginCartWrite(writeKey)
  try {
    await addToVendorCart({
      vendorId: storeId,
      storeName,
      product,
      variant,
      qty: amount,
    })
    return true
  } catch (error) {
    return onMutationError(error, storeId, navigate, from, onError, storeName)
  } finally {
    endCartWrite(writeKey)
  }
}

export async function requestSetCartQty({
  user,
  navigate,
  storeId,
  storeName = '',
  itemId,
  qty,
  products = [],
  returnTo,
  onError,
}: SetQtyArgs): Promise<boolean> {
  const from = returnTo ?? storePath(storeId)

  if (!canShopAsCustomer(user)) {
    goCustomerLogin(navigate, from, storeId, storeName)
    return false
  }

  const writeKey = cartWriteKeyFromItemId(storeId, itemId)
  beginCartWrite(writeKey)
  try {
    await setVendorCartQty(storeId, itemId, qty, storeName, products)
    return true
  } catch (error) {
    return onMutationError(error, storeId, navigate, from, onError, storeName)
  } finally {
    endCartWrite(writeKey)
  }
}
