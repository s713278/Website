import { isStoreSubmitted } from './onboarding-account-status'
import type { ServerOnboardingState } from './onboarding-resume'

/**
 * What the vendor's account says the wizard should do for them.
 *
 * `submitted` means the store has been sent for review — `vendor_status: ACTIVE`, whether or
 * not an admin has approved it yet. Approval is a separate, later transition, so it is
 * deliberately not part of this decision: a vendor waiting on approval needs no further
 * setup just as much as one already public, and neither should be handed a setup form.
 *
 * Submission is never read from `onboarding.status` or `onboarding.next_step`. Both are
 * derived server-side and move backwards — a submitted store still reports `IN_PROGRESS`.
 * See docs/API_GAPS.md.
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
