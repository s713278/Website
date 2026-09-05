import { describe, expect, it } from 'vitest'
import type { User, VendorMembership } from '@/shared/types'
import { navigationFloor, resolveOnboardingAccess } from './onboarding-access'

/**
 * Every session state the module can report, not just the happy one: a vendor whose
 * number is verified but whose account is not usable is still verified, and must not be
 * walked back through the identity steps either.
 */
const MEMBERSHIP: VendorMembership = { vendorId: '91', name: 'SK Organic Store' }

function user(saved: Partial<User> = {}): User {
  return {
    id: '7',
    name: 'Sanjay Kumar',
    email: 'sanjay@example.com',
    role: 'vendor',
    roles: ['vendor'],
    vendorId: '91',
    vendors: [MEMBERSHIP],
    ...saved,
  }
}

describe('navigationFloor', () => {
  it('is the first identity step without a session', () => {
    expect(navigationFloor(resolveOnboardingAccess(null))).toBe(1)
  })

  it('is the business type step for a fully resolved vendor', () => {
    expect(navigationFloor(resolveOnboardingAccess(user()))).toBe(3)
  })

  it('is the business type step for a session that is not a vendor', () => {
    const access = resolveOnboardingAccess(user({ role: 'customer', roles: ['customer'] }))
    expect(access.state).toBe('not-a-vendor')
    expect(navigationFloor(access)).toBe(3)
  })

  it('is the business type step for a vendor with no store record', () => {
    const access = resolveOnboardingAccess(user({ vendorId: undefined, vendors: [] }))
    expect(access.state).toBe('vendor-not-provisioned')
    expect(navigationFloor(access)).toBe(3)
  })

  it('is the business type step while a vendor is still being chosen', () => {
    const access = resolveOnboardingAccess(
      user({ vendorId: undefined, vendors: [MEMBERSHIP, { ...MEMBERSHIP, vendorId: '92' }] }),
    )
    expect(access.state).toBe('vendor-selection-required')
    expect(navigationFloor(access)).toBe(3)
  })
})
