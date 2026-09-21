import type { StoreState } from '@/modules/vendor/types/dashboard'
import type { VendorContext } from '@/shared/api'
import { isStoreSubmitted } from './onboarding-account-status'

/** `onboarding.next_step` reports this once all ten setup steps are done. */
const SETUP_COMPLETE_STEP = 11

// delete the flag once the backend returns `approval_status: APPROVED` on completed onboarding.
const TREAT_PENDING_AS_APPROVED = true
// Module memory makes the reminder once per application session, including shell remounts.
let warnedAboutPendingApprovalFlag = false

// Console-only: the wizard's independent approval gate must keep refusing pending size creation.
function isVendorApproved(approvalStatus: string | null, coercePendingApproval: boolean): boolean {
  return (
    approvalStatus === 'APPROVED'
    || (TREAT_PENDING_AS_APPROVED && coercePendingApproval && approvalStatus === 'PENDING')
  )
}

/** The subset of the vendor context this derivation reads. */
export type StoreStateInput = {
  vendorStatus: string | null
  approvalStatus: string | null
  onboarding?: VendorContext['onboarding']
}

/**
 * The single condition of a store, derived from setup progress, submission and approval.
 *
 * Ranking matters, because more than one can be true at once:
 *
 * 1. **Suspended** outranks everything — it is the only state where the platform has
 *    acted against the store, and it must not be hidden behind a setup prompt.
 * 2. **Rejected** outranks the rest for the same reason: verification decided
 *    something the vendor has to see.
 * 3. **Setting up** covers unfinished onboarding even when the account is already
 *    active or approved. Activation alone cannot override explicit setup progress.
 * 4. Past that, approval decides between **open** and **under review**.
 *
 * Note that open is not "accepting orders". Nothing in the backend contract expresses
 * order acceptance, so nothing here may imply it.
 *
 * Demo callers opt out of the live-backend compensation with `coercePendingApproval: false`.
 */
export function deriveStoreState(
  input: StoreStateInput,
  { coercePendingApproval = true }: { coercePendingApproval?: boolean } = {},
): StoreState {
  const vendorStatus = input.vendorStatus?.toUpperCase() ?? null
  const approvalStatus = input.approvalStatus?.toUpperCase() ?? null

  if (
    import.meta.env.DEV && TREAT_PENDING_AS_APPROVED && coercePendingApproval
    && approvalStatus === 'APPROVED' && !warnedAboutPendingApprovalFlag
  ) {
    warnedAboutPendingApprovalFlag = true
    console.warn(
      'Live context returned approval_status: APPROVED. Delete TREAT_PENDING_AS_APPROVED in store-state.ts once the backend returns this on completed onboarding.',
    )
  }

  if (vendorStatus === 'SUSPENDED') return 'SUSPENDED'
  if (approvalStatus === 'REJECTED') return 'REJECTED'

  if (!isStoreSubmitted({ context: input })) return 'SETTING_UP'

  return isVendorApproved(approvalStatus, coercePendingApproval) ? 'OPEN' : 'UNDER_REVIEW'
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

export type StoreStateAction = { label: string; to: string }

/**
 * The one action a store in a given state can take, or none.
 *
 * At most one, deliberately. A store that is waiting on verification has nothing to do,
 * and a screen that offers three buttons anyway implies the vendor is holding things up.
 * `null` is the honest answer for waiting and for suspension: neither is theirs to resolve
 * from this console, and no route in the contract lets them.
 *
 * `OPEN` has none because an open store does not get this screen at all — it gets the work
 * queue.
 */
export function storeStateAction(state: StoreState): StoreStateAction | null {
  switch (state) {
    case 'SETTING_UP':
      return { label: 'Continue setup', to: '/onboarding' }
    case 'REJECTED':
      // Not "resubmit": nothing in the contract re-opens a rejected application from here.
      // Reading back what was submitted is the one thing this console can honestly offer.
      return { label: 'Check your store details', to: '/vendor/settings' }
    case 'UNDER_REVIEW':
    case 'SUSPENDED':
    case 'OPEN':
      return null
  }
}
