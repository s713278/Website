import { resolveOnboardingEntry } from '@/modules/vendor/lib/onboarding-entry'
import { peekVendorOnboardingState } from '@/modules/vendor/lib/onboarding-state-cache'
import { isLiveApi } from '@/shared/api'
import type { User } from '@/shared/types'
import { resumePathAfterLogin } from './role-home'

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

  const cached = peekVendorOnboardingState(user.vendorId)
  return cached ? resumePathAfterLogin(user, from, resolveOnboardingEntry(cached)) : null
}

/**
 * Where a session lands, resolved against the vendor's real account.
 *
 * Routing a vendor purely on their role sends everyone into setup, including vendors who
 * submitted it — they then have to be bounced back out, which is the flash this avoids.
 * The read is cached, so the wizard reuses it instead of fetching again.
 *
 * Any failure falls through to the role-only answer. Setup is the safe default: being
 * sent there wrongly costs a click, while being sent to a dashboard wrongly leaves a
 * half-finished store with no route back.
 */
export async function resolveLandingPath(user: User, from?: string | null): Promise<string> {
  if (!needsAccountRead(user)) return resumePathAfterLogin(user, from)

  const cached = peekVendorOnboardingState(user.vendorId)
  if (cached) return resumePathAfterLogin(user, from, resolveOnboardingEntry(cached))

  try {
    // Imported on demand: this module is reachable from the eagerly-routed login screens,
    // and `onboarding-server-state` pulls the resume/API graph. Only a vendor who actually
    // needs an account read should pay for it, and by then they are already signing in.
    const { loadVendorOnboardingState } = await import(
      '@/modules/vendor/lib/onboarding-server-state'
    )
    const state = await loadVendorOnboardingState(user.vendorId)
    return resumePathAfterLogin(user, from, resolveOnboardingEntry(state))
  } catch {
    return resumePathAfterLogin(user, from)
  }
}
