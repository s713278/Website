import { storeSubmittedAtSignIn } from '@/modules/vendor/lib/onboarding-account-status'
import { resolveOnboardingEntry } from '@/modules/vendor/lib/onboarding-entry'
import { peekVendorAccountContext } from '@/modules/vendor/lib/onboarding-state-cache'
import { isLiveApi, type VendorSignInMembership } from '@/shared/api'
import type { User } from '@/shared/types'
import { homePathForRole, resumePathAfterLogin, VENDOR_ONBOARDING_HREF } from './role-home'
import { preloadVendorDashboard } from './vendor-dashboard-chunks'

/** Whether this session's destination depends on reading a vendor account at all. */
function needsAccountRead(user: User): user is User & { vendorId: string } {
  return isLiveApi() && user.roles.includes('vendor') && Boolean(user.vendorId)
}

/**
 * The destination when it is already known, or `null` when the account must be read.
 *
 * Lets a caller redirect on the first render instead of showing a spinner for a decision
 * that needs no network — a plain customer, demo mode, or an account already cached.
 */
export function landingPathIfKnown(user: User, from?: string | null): string | null {
  if (!needsAccountRead(user)) return resumePathAfterLogin(user, from)

  const context = peekVendorAccountContext(user.vendorId)
  return context ? resumePathAfterLogin(user, from, resolveOnboardingEntry({ context })) : null
}

/**
 * The destination from `verify-otp`'s own membership snapshot, or `null` when it cannot decide.
 *
 * Saves sign-in the seconds a context read takes. The snapshot is only good for this sign-in, so
 * nothing persists it, and every later landing (`VendorLandingRedirect`) reads the context. The
 * reads the destination needs are started here without being awaited, through the same caches
 * the dashboard and wizard read from, so they join these requests instead of making their own.
 */
function landingPathFromSignIn(
  user: User & { vendorId: string },
  from: string | null | undefined,
  signInVendors: readonly VendorSignInMembership[] | undefined,
): string | null {
  const membership = signInVendors?.find((entry) => entry.vendorId === user.vendorId)
  const submitted = membership ? storeSubmittedAtSignIn(membership) : null
  if (submitted === null) return null

  const path = resumePathAfterLogin(user, from, { kind: submitted ? 'submitted' : 'resume' })
  const { vendorId } = user
  if (path === homePathForRole('vendor')) {
    preloadVendorDashboard()
    // The provider surfaces a failed context, and the billing read never rejects.
    import('@/modules/vendor/lib/onboarding-server-state')
      .then(({ loadVendorAccountContext }) => loadVendorAccountContext(vendorId))
      .catch(() => {})
    // The shell's chrome reads billing on every store state; this starts that same shared read
    // alongside the context instead of after it (TEMP(vendor-billing-reads): no new request).
    import('@/modules/vendor/store/live-billing')
      .then(({ readLiveBilling }) => readLiveBilling(vendorId))
      .catch(() => {})
  } else if (path === VENDOR_ONBOARDING_HREF) {
    // No context to seed it with: the snapshot reads it through the shared context cache.
    import('@/modules/vendor/lib/onboarding-server-state')
      .then(({ loadVendorOnboardingState }) => loadVendorOnboardingState(vendorId))
      .catch(() => {})
  }
  return path
}

/**
 * Where a session lands, resolved against the vendor's real account.
 *
 * Routing a vendor purely on their role sends everyone into setup, including vendors who
 * submitted it — they then have to be bounced back out, which is the flash this avoids.
 * The decision needs only the vendor context, so that is all sign-in waits for. A submitted
 * store goes to the dashboard, which reuses the cached context; the wizard's setup reads
 * are started only for a vendor who is headed into it, seeded with the same context.
 *
 * Sign-in passes `signInVendors`, `verify-otp`'s membership snapshot; when it settles the
 * question, no context is awaited (see `landingPathFromSignIn`). Otherwise the context decides.
 *
 * Any failure falls through to the role-only answer. Setup is the safe default: being
 * sent there wrongly costs a click, while being sent to a dashboard wrongly leaves a
 * half-finished store with no route back.
 */
export async function resolveLandingPath(
  user: User,
  from?: string | null,
  signInVendors?: readonly VendorSignInMembership[],
): Promise<string> {
  if (!needsAccountRead(user)) return resumePathAfterLogin(user, from)

  const known = landingPathIfKnown(user, from) ?? landingPathFromSignIn(user, from, signInVendors)
  if (known) return known

  // A returning vendor is headed for the dashboard, so its chunks download while the context
  // is in flight. The wizard is not guessed at; its route chunk still loads on navigation.
  preloadVendorDashboard()

  try {
    // Imported on demand: this module is reachable from the eagerly-routed login screens,
    // and `onboarding-server-state` pulls the resume/API graph. Only a vendor who actually
    // needs an account read should pay for it, and by then they are already signing in.
    const { loadVendorAccountContext, loadVendorOnboardingState } = await import(
      '@/modules/vendor/lib/onboarding-server-state'
    )
    const { context } = await loadVendorAccountContext(user.vendorId)
    const path = resumePathAfterLogin(user, from, resolveOnboardingEntry({ context }))
    // Not awaited: the wizard's reads overlap the navigation and its route chunk instead of
    // holding the login spinner. A failure is dropped from the cache and the wizard retries.
    if (path === VENDOR_ONBOARDING_HREF) {
      loadVendorOnboardingState(user.vendorId, { context }).catch(() => {})
    }
    return path
  } catch {
    return resumePathAfterLogin(user, from)
  }
}
