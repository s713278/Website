import { loginPathForRole } from '@/app/router/role-home'
import { canShopAsCustomer } from '@/modules/storefront/lib/request-add-to-cart'
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
 * Live + logged out → customer login (resume cart after OTP).
 * Demo / signed-in customer → cart route.
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

/** Live guests must not see leftover local cart badges. */
export function visibleCartCount(
  user: User | null | undefined,
  count: number,
): number {
  if (isLiveApi() && !canShopAsCustomer(user)) return 0
  return count
}
