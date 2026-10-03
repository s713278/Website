import { canShopAsCustomer, loginPathForRole } from '@/app/router/role-home'
import { storeCartPath } from '@/modules/storefront/lib/store-paths'
import { isLiveApi } from '@/shared/api'
import type { User } from '@/shared/types'

export type CustomerLoginState = {
  from: string
  shopName?: string
  shopLogoUrl?: string
}

export type CartNavTarget =
  | string
  | {
      pathname: string
      state: CustomerLoginState
    }

/** Same target add-to-cart uses: `/login` plus `from` so the shop logo can show. */
export function customerLoginLink(
  from: string,
  shop?: { name?: string; logoUrl?: string },
): { to: string; state: CustomerLoginState } {
  const shopName = shop?.name?.trim()
  const shopLogoUrl = shop?.logoUrl?.trim()
  return {
    to: loginPathForRole('customer'),
    state: {
      from,
      ...(shopName ? { shopName } : {}),
      ...(shopLogoUrl ? { shopLogoUrl } : {}),
    },
  }
}

export function linkFromNavTarget(target: CartNavTarget): { to: string; state?: CustomerLoginState } {
  if (typeof target === 'string') return { to: target }
  return { to: target.pathname, state: target.state }
}

/**
 * Live customer session → cart. Anyone else (guest or vendor session) → customer login.
 * A vendor login is not a customer session, even for the same phone.
 */
export function cartNavTarget(
  user: User | null | undefined,
  storeId?: string,
): CartNavTarget {
  const cartPath = storeId ? storeCartPath(storeId) : '/cart'
  if (isLiveApi() && !canShopAsCustomer(user)) {
    return {
      pathname: loginPathForRole('customer'),
      state: { from: cartPath },
    }
  }
  return cartPath
}

/** Live guests and vendor sessions must not see the customer cart badge. */
export function visibleCartCount(
  user: User | null | undefined,
  count: number,
): number {
  if (isLiveApi() && !canShopAsCustomer(user)) return 0
  return count
}
