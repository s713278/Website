import type { ServerOnboardingState } from './onboarding-resume'

/**
 * Whether the vendor's store has been submitted, and whether an admin has approved it.
 *
 * A leaf module on purpose. Sign-in has to answer "is this store submitted?" to decide
 * where to send the vendor, and that question is reachable from the login screens, which
 * are eagerly routed. Keeping the two predicates here means `vendor-landing` does not have
 * to import `onboarding-resume` — and through it `@/shared/api`, the mappers and the
 * onboarding defaults — into the initial bundle every marketing visitor downloads.
 *
 * The import above is `import type`, so it is erased at build time.
 */
export function isStoreSubmitted(state: ServerOnboardingState): boolean {
  return state.context.vendorStatus?.toUpperCase() === 'ACTIVE'
}

export function isVendorApproved(state: ServerOnboardingState): boolean {
  return state.context.approvalStatus?.toUpperCase() === 'APPROVED'
}
