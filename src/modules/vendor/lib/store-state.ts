import type { StoreState } from '@/modules/vendor/types/dashboard'

/** `onboarding.next_step` reports this once all ten setup steps are done. */
const SETUP_COMPLETE_STEP = 11

/** The subset of the vendor context this derivation reads. */
export type StoreStateInput = {
  vendorStatus: string | null
  approvalStatus: string | null
  nextStep: number | null
}

/**
 * The single condition of a store, derived from three fields that each answer only part
 * of the question.
 *
 * Ranking matters, because more than one can be true at once:
 *
 * 1. **Suspended** outranks everything — it is the only state where the platform has
 *    acted against the store, and it must not be hidden behind a setup prompt.
 * 2. **Rejected** outranks the rest for the same reason: an administrator decided
 *    something the vendor has to see.
 * 3. **Setting up** covers anyone who has not submitted. `next_step` is authoritative
 *    (see `onboarding-resume.ts`), but `vendor_status` is checked too: go-live is what
 *    sets `ACTIVE`, so anything else means nothing was ever submitted, and that holds
 *    even if `next_step` is missing from the response.
 * 4. Past that, approval decides between **open** and **under review**.
 *
 * Note that open is not "accepting orders". Nothing in the backend contract expresses
 * order acceptance, so nothing here may imply it.
 */
export function deriveStoreState(input: StoreStateInput): StoreState {
  const vendorStatus = input.vendorStatus?.toUpperCase() ?? null
  const approvalStatus = input.approvalStatus?.toUpperCase() ?? null

  if (vendorStatus === 'SUSPENDED') return 'SUSPENDED'
  if (approvalStatus === 'REJECTED') return 'REJECTED'

  const setupIncomplete = input.nextStep != null && input.nextStep < SETUP_COMPLETE_STEP
  const neverSubmitted = vendorStatus != null && vendorStatus !== 'ACTIVE'
  if (setupIncomplete || neverSubmitted) return 'SETTING_UP'

  return approvalStatus === 'APPROVED' ? 'OPEN' : 'UNDER_REVIEW'
}

/** Whether the vendor still has setup steps left, and which one they resume on. */
export function setupProgress(nextStep: number | null) {
  if (nextStep == null || nextStep >= SETUP_COMPLETE_STEP) return null
  return { step: nextStep, total: SETUP_COMPLETE_STEP - 1 }
}

export type StoreStatePresentation = {
  label: string
  description: string
  tone: 'neutral' | 'success' | 'warning' | 'danger'
}

/**
 * Display only. The state machine above is the truth; this maps it to words, and must
 * never become a second source of state.
 */
export function presentStoreState(state: StoreState): StoreStatePresentation {
  switch (state) {
    case 'SUSPENDED':
      return {
        label: 'Store suspended',
        description: 'Your store has been suspended and is not reachable by customers.',
        tone: 'danger',
      }
    case 'REJECTED':
      return {
        label: 'Setup needs changes',
        description: 'Your store was not approved. Contact support to find out what to change.',
        tone: 'danger',
      }
    case 'SETTING_UP':
      return {
        label: 'Setup incomplete',
        description: 'Finish setting up your store to send it for review.',
        tone: 'warning',
      }
    case 'UNDER_REVIEW':
      return {
        label: 'Awaiting approval',
        description: 'Your store has been submitted. Customers can reach it once approved.',
        tone: 'warning',
      }
    case 'OPEN':
      return {
        label: 'Your store is live',
        description: 'Customers can find and order from your store.',
        tone: 'success',
      }
  }
}
