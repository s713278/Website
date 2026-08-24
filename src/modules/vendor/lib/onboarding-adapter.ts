import type { OnboardingStep, VendorOnboardingDraftV1 } from '../types/onboarding'
import { onboardingDraftStorage } from './onboarding-persistence'

/**
 * Local draft persistence for the wizard.
 *
 * Mobile verification is no longer simulated here — Steps 1-2 call the shared
 * WhatsApp OTP service and create a real session. What remains local is the
 * pre-submit draft buffer and the completion marker for the steps whose backend
 * contract is still unresolved (see docs/API_GAPS.md).
 */
export type VendorOnboardingAdapter = {
  id: 'browser-draft'
  drafts: typeof onboardingDraftStorage
  complete: (draft: VendorOnboardingDraftV1, draftSlug: string) => VendorOnboardingDraftV1
}

/** Display-only mask. The full number is never persisted. */
export function maskPhone(phone: string): string {
  return `+91 ••••••${phone.slice(-4)}`
}

export const onboardingDraftAdapter: VendorOnboardingAdapter = {
  id: 'browser-draft',
  drafts: onboardingDraftStorage,
  complete(draft, draftSlug) {
    const completedAt = new Date().toISOString()
    return {
      ...draft,
      completedSteps: Array.from(
        new Set([...draft.completedSteps, 10]),
      ).sort((a, b) => a - b) as OnboardingStep[],
      publication: { state: 'prototype-complete', draftSlug, completedAt },
    }
  },
}
