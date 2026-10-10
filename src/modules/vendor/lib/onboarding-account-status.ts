import type { VendorContext } from '@/shared/api'

type AccountStatusState = {
  context: Pick<VendorContext, 'vendorStatus' | 'approvalStatus'> & {
    onboarding?: VendorContext['onboarding']
  }
}

/**
 * The documented approval value is APPROVED. Some current vendor contexts report ACTIVE in
 * `approval_status`, so keep that wire value compatible at this boundary until the backend
 * publishes one canonical enum.
 */
export function isApprovalGranted(approvalStatus: string | null): boolean {
  const status = approvalStatus?.toUpperCase()
  return status === 'APPROVED' || status === 'ACTIVE'
}

/** Whether `next_step` is a usable 1-based wizard position, with `11` meaning complete. */
function isKnownNextStep(nextStep: number | null | undefined): nextStep is number {
  return nextStep != null && Number.isInteger(nextStep) && nextStep >= 1 && nextStep <= 11
}

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
export function isStoreSubmitted(state: AccountStatusState): boolean {
  const { vendorStatus, onboarding } = state.context
  if (vendorStatus?.toUpperCase() !== 'ACTIVE') return false

  // The backend's progress wins even if the account was activated manually. Only a
  // context with no onboarding evidence falls back to the legacy activation signal.
  const nextStep = onboarding?.nextStep
  if (isKnownNextStep(nextStep)) return nextStep === 11
  if (onboarding && onboarding.status !== 'UNKNOWN') return onboarding.status === 'COMPLETED'
  return true
}

/**
 * `isStoreSubmitted` over a `verify-otp` membership, or `null` when the entry cannot decide it.
 *
 * Deciding needs the vendor status and some onboarding evidence — a usable `next_step` or a
 * known status. Without that, `isStoreSubmitted` would fall back to activation alone, so the
 * caller reads the vendor context instead. Approval is never consulted.
 */
export function storeSubmittedAtSignIn(membership: {
  status: string | null
  onboarding: NonNullable<AccountStatusState['context']['onboarding']>
}): boolean | null {
  const { status, onboarding } = membership
  if (!status) return null
  if (!isKnownNextStep(onboarding.nextStep) && onboarding.status === 'UNKNOWN') return null
  return isStoreSubmitted({ context: { vendorStatus: status, approvalStatus: null, onboarding } })
}

export function isVendorApproved(state: AccountStatusState): boolean {
  return isApprovalGranted(state.context.approvalStatus)
}
