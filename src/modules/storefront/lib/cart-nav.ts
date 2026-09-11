import { loginPathForRole } from '@/app/router/role-home'
import { canShopAsCustomer } from '@/modules/storefront/lib/request-add-to-cart'
import { storeCartPath } from '@/modules/storefront/lib/store-paths'
import { isLiveApi } from '@/shared/api'
import type { User } from '@/shared/types'

export type CartNavTarget =
  | string
  | {
      pathname: string
      state: { from: string }
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
