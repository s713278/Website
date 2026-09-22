/**
 * UI entry for cart mutations.
 * - Customer → cart-actions (API / demo)
 * - Guest → pending + login
 * - Errors → backend `user_message` (401 → login)
 */
import type { NavigateFunction } from 'react-router-dom'
import { loginPathForRole } from '@/app/router/role-home'
import {
  addToVendorCart,
  cartActionErrorMessage,
  setVendorCartQty,
} from '@/modules/storefront/lib/cart-actions'
import { savePendingCartAdd } from '@/modules/storefront/lib/pending-cart-add'
import { storeCartPath } from '@/modules/storefront/lib/store-paths'
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
  if (!isApiError(error)) return false
  if (error.status === 404) return true
  const body = error.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false
  const record = body as Record<string, unknown>
  if (String(record.reason_code ?? '') === '404' || String(record.status ?? '') === '404') {
    return true
  }
  return /cart not found/i.test(`${record.failure_reason ?? ''} ${record.user_message ?? ''}`)
}

export function redirectCartUnauthorized(
  error: unknown,
  navigate: NavigateFunction,
  from: string,
): boolean {
  if (!isUnauthorized(error)) return false
  navigate(loginPathForRole('customer'), { replace: true, state: { from } })
  return true
}

function goLogin(navigate: NavigateFunction, from: string) {
  navigate(loginPathForRole('customer'), { replace: true, state: { from } })
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
): false {
  if (isUnauthorized(error)) {
    goLogin(navigate, from)
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
  const from = returnTo ?? storeCartPath(storeId)

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
    navigate(loginPathForRole('customer'), { state: { from, shopName: storeName } })
    return false
  }

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
    return onMutationError(error, storeId, navigate, from, onError)
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
  const from = returnTo ?? storeCartPath(storeId)

  if (!canShopAsCustomer(user)) {
    goLogin(navigate, from)
    return false
  }

  try {
    await setVendorCartQty(storeId, itemId, qty, storeName, products)
    return true
  } catch (error) {
    return onMutationError(error, storeId, navigate, from, onError)
  }
}
