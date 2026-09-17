import { isStoreSubmitted } from './onboarding-account-status'
import type { ServerOnboardingState } from './onboarding-resume'

/**
 * What the vendor's account says the wizard should do for them.
 *
 * `submitted` means setup is complete and the store is active, whether or not it has
 * been approved. Explicit unfinished onboarding takes precedence over activation and
 * approval, including accounts whose status was changed outside the setup flow.
 */
export type OnboardingEntry = { kind: 'submitted' } | { kind: 'resume' }

/**
 * Deliberately carries no step. It used to expose an `openAt` derived from
 * `earliestIncompleteStep`, which nothing read — `vendorLandingPath` only ever branches
 * on `kind` — and which contradicted `resumeStep`, whose whole point is that the
 * backend's `next_step` is authoritative and resource-derivation is a last resort.
 * The wizard decides where to open; this decides only which route to land on.
 */
export function resolveOnboardingEntry(state: ServerOnboardingState): OnboardingEntry {
  return isStoreSubmitted(state) ? { kind: 'submitted' } : { kind: 'resume' }
}
