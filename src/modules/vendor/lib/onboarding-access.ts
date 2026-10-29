import type { User, VendorMembership } from '@/shared/types'
import type { OnboardingStep } from '../types/onboarding'

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

/**
 * The lowest step navigation may reach.
 *
 * Steps 1-2 exist to produce a session, so once one exists they have nothing left to
 * ask: re-running OTP would sign a different vendor in underneath the draft rather than
 * edit anything. The floor is therefore a function of the session alone.
 *
 * It used to require a *submitted* store on top of the session, which made it 1 for
 * every vendor mid-setup — exactly the vendors who could still walk back and be asked
 * for a number they had already given. Note that the floor clears the identity steps for
 * every session, including one that turns out not to be a vendor: that identity is still
 * verified, and `canEnterCatalogSteps` is what decides whether the step is usable.
 *
 * The only route back below the floor is signing out.
 */
export function navigationFloor(access: OnboardingAccess): OnboardingStep {
  return access.state === 'anonymous' ? 1 : 3
}
