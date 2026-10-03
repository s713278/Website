import type { OnboardingEntry } from '@/modules/vendor/lib/onboarding-entry'
import type { User, UserRole } from '@/shared/types'

/** Vendor setup route (React page). New vendors run the onboarding wizard first. */
export const VENDOR_ONBOARDING_HREF = '/onboarding'

export function homePathForRole(role: UserRole) {
  return role === 'vendor' ? '/vendor' : '/cart'
}

export function loginPathForRole(role?: UserRole) {
  return role === 'vendor' ? '/vendor/login' : '/login'
}

function isSafePath(path: string) {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('://')
}

export function homePathForUser(user: User) {
  return homePathForRole(user.role)
}

/**
 * Shop cart, add, checkout, and orders.
 * The active login is the audience. A vendor login for the same phone is a different
 * session and must not shop until the customer screen is used.
 */
export function canShopAsCustomer(user: User | null | undefined): boolean {
  return user?.role === 'customer'
}

/**
 * Where a vendor lands, given what their account actually holds.
 *
 * A vendor who has already submitted their store has no unfinished setup, so sending
 * them to the wizard is wrong — they go to the dashboard. `/onboarding` stays reachable
 * on purpose: opening it deliberately shows the submitted store's status, link and QR.
 *
 * `entry` is `null` when the account could not be read. Setup is the safe default: a
 * vendor who still needs it must never be stranded on a dashboard with no route back.
 */
export function vendorLandingPath(entry: OnboardingEntry | null) {
  return entry?.kind === 'submitted' ? homePathForRole('vendor') : VENDOR_ONBOARDING_HREF
}

/**
 * Where a session lands after signing in.
 *
 * The login screen chooses the session. A customer login stays on the shop, even when
 * the same phone also has a vendor role. A vendor login stays on vendor setup or the
 * dashboard. The two sides do not share one landing.
 *
 * `entry` carries the vendor's account state when the caller has already resolved it,
 * so a submitted store is not routed into setup only to be bounced out again.
 */
function customerResumePath(from: string) {
  if (from === '/checkout' || from === '/orders') return from
  if (from === '/cart') return '/'
  if (!from.startsWith('/stores')) return from

  const pathname = from.split('?')[0]
  const cartOnShop = /^\/stores\/([^/]+)\/cart\/?$/.exec(pathname)
  return cartOnShop ? `/stores/${cartOnShop[1]}` : from
}

export function resumePathAfterLogin(
  user: User,
  from?: string | null,
  entry?: OnboardingEntry | null,
) {
  if (user.role === 'vendor') return vendorLandingPath(entry ?? null)

  if (
    from &&
    isSafePath(from) &&
    (from === '/checkout' || from === '/orders' || from === '/cart' || from.startsWith('/stores'))
  ) {
    return customerResumePath(from)
  }

  return '/'
}
