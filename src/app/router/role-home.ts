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
  return entry?.kind === 'complete' ? homePathForRole('vendor') : VENDOR_ONBOARDING_HREF
}

/**
 * Where a session lands after signing in.
 *
 * Keyed on the roles the backend verified, not the screen that was used. The same phone
 * number opens both login forms, so a vendor who signs in through the customer one still
 * has a store: sending them to the cart strands a half-finished setup with no route back
 * to it. An explicit customer destination still wins, so a vendor who was heading to
 * checkout is not dragged into store setup instead.
 *
 * `entry` carries the vendor's account state when the caller has already resolved it,
 * so a finished store is not routed into the wizard only to be bounced out again.
 */
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
    return from
  }

  return user.roles.includes('vendor') ? vendorLandingPath(entry ?? null) : '/cart'
}
