import type { User, VendorMembership } from '@/shared/types'

/**
 * Whether the current session may perform vendor-scoped onboarding work.
 *
 * Steps 1-2 establish this. Everything from Step 3 onward needs `ready`, because a
 * vendor-scoped write without a real `vendor_id` would either fail or, worse, touch
 * the wrong account. No state here is ever inferred from the role requested at login.
 */
export type OnboardingAccess =
  | { state: 'anonymous' }
  | { state: 'not-a-vendor' }
  | { state: 'vendor-not-provisioned' }
  | { state: 'vendor-selection-required'; vendors: VendorMembership[] }
  | { state: 'ready'; vendorId: string }

export function resolveOnboardingAccess(user: User | null): OnboardingAccess {
  if (!user) return { state: 'anonymous' }

  // Verified roles only. `user.role` is the active audience, not proof of authority.
  if (!user.roles.includes('vendor')) return { state: 'not-a-vendor' }

  // A verified vendor with no vendor record cannot be scoped to anything. The wizard
  // stops here rather than creating a vendor, which onboarding has no contract for.
  if (!user.vendors.length) return { state: 'vendor-not-provisioned' }

  // Multiple memberships must be chosen explicitly; never silently take the first.
  if (!user.vendorId) return { state: 'vendor-selection-required', vendors: user.vendors }

  return { state: 'ready', vendorId: user.vendorId }
}

/** Steps 3+ perform vendor-scoped work and require a resolved vendor. */
export function canEnterCatalogSteps(access: OnboardingAccess): boolean {
  return access.state === 'ready'
}
