import type { OnboardingStep, VendorOnboardingDraftV1 } from '../types/onboarding'
import { onboardingDraftStorage } from './onboarding-persistence'

export type OtpRequestResult = {
  maskedPhone: string
  sent: false
}

export type VendorOnboardingAdapter = {
  id: 'local-prototype'
  drafts: typeof onboardingDraftStorage
  requestOtp: (phone: string, signal?: AbortSignal) => Promise<OtpRequestResult>
  verifyOtp: (phone: string, otp: string, signal?: AbortSignal) => Promise<boolean>
  complete: (draft: VendorOnboardingDraftV1, draftSlug: string) => VendorOnboardingDraftV1
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('The request was cancelled.', 'AbortError'))
      return
    }

    const timer = window.setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer)
        reject(new DOMException('The request was cancelled.', 'AbortError'))
      },
      { once: true },
    )
  })
}

function maskPhone(phone: string): string {
  return `+91 ••••••${phone.slice(-4)}`
}

export const localPrototypeOnboardingAdapter: VendorOnboardingAdapter = {
  id: 'local-prototype',
  drafts: onboardingDraftStorage,
  async requestOtp(phone, signal) {
    await delay(650, signal)
    return { maskedPhone: maskPhone(phone), sent: false }
  },
  async verifyOtp(_phone, otp, signal) {
    await delay(450, signal)
    return otp === '1234'
  },
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
