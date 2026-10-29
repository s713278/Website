import { canShopAsCustomer, loginPathForRole } from '@/app/router/role-home'
import { isLiveApi } from '@/shared/api'
import type { User } from '@/shared/types'

export type CustomerLoginState = {
  from: string
  shopName?: string
  shopLogoUrl?: string
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

/**
 * Whether this session can hold a customer cart, and so whether a header shows the cart icon.
 * Live, only a customer session can: a guest or vendor session is sent to customer login by
 * add-to-cart instead. Demo carts are local, so anyone can.
 * A vendor login is not a customer session, even for the same phone.
 */
export function canHoldCart(user: User | null | undefined): boolean {
  return !isLiveApi() || canShopAsCustomer(user)
}

/** Live guests and vendor sessions must not see the customer cart badge. */
export function visibleCartCount(
  user: User | null | undefined,
  count: number,
): number {
  return canHoldCart(user) ? count : 0
}
