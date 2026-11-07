import { describe, expect, it } from 'vitest'
import type { VendorContext } from '@/shared/api'
import { isStoreSubmitted, storeSubmittedAtSignIn } from './onboarding-account-status'

type Onboarding = VendorContext['onboarding']

const onboarding = (status: Onboarding['status'], nextStep: number | null): Onboarding => ({
  status, description: null, nextStep,
})

describe('storeSubmittedAtSignIn', () => {
  it.each([
    ['no status', null, onboarding('COMPLETED', 11)],
    ['an empty status', '', onboarding('COMPLETED', 11)],
    ['no usable step and an unknown status', 'ACTIVE', onboarding('UNKNOWN', null)],
    ['a step below range and an unknown status', 'ACTIVE', onboarding('UNKNOWN', 0)],
    ['a step above range and an unknown status', 'ACTIVE', onboarding('UNKNOWN', 12)],
  ])('cannot decide on %s', (_label, status, progress) => {
    expect(storeSubmittedAtSignIn({ status, onboarding: progress })).toBeNull()
  })

  it.each([
    ['ACTIVE', onboarding('COMPLETED', 11)],
    ['ACTIVE', onboarding('IN_PROGRESS', 11)],
    ['active', onboarding('COMPLETED', 11)],
    ['ACTIVE', onboarding('IN_PROGRESS', 3)],
    ['ACTIVE', onboarding('COMPLETED', 3)],
    ['ACTIVE', onboarding('COMPLETED', null)],
    ['ACTIVE', onboarding('IN_PROGRESS', null)],
    ['ACTIVE', onboarding('NOT_STARTED' as Onboarding['status'], null)],
    ['ACTIVE', onboarding('COMPLETED', 99)],
    ['ACTIVE', onboarding('UNKNOWN', 11)],
    ['ACTIVE', onboarding('UNKNOWN', 1)],
    ['INACTIVE', onboarding('COMPLETED', 11)],
    ['INACTIVE', onboarding('COMPLETED', null)],
    ['SETTING_UP', onboarding('IN_PROGRESS', 5)],
  ])('agrees with isStoreSubmitted for %s and %j', (status, progress) => {
    const decided = storeSubmittedAtSignIn({ status, onboarding: progress })

    expect(decided).not.toBeNull()
    expect(decided).toBe(isStoreSubmitted({ context: { vendorStatus: status, approvalStatus: null, onboarding: progress } }))
  })

  it('ignores approval, which a membership does not carry', () => {
    const progress = onboarding('COMPLETED', 11)

    for (const approvalStatus of [null, 'PENDING', 'REJECTED', 'APPROVED']) {
      expect(isStoreSubmitted({ context: { vendorStatus: 'ACTIVE', approvalStatus, onboarding: progress } })).toBe(true)
    }
    expect(storeSubmittedAtSignIn({ status: 'ACTIVE', onboarding: progress })).toBe(true)
  })

  it('submits only an active store at the last step', () => {
    expect(storeSubmittedAtSignIn({ status: 'ACTIVE', onboarding: onboarding('COMPLETED', 11) })).toBe(true)
    expect(storeSubmittedAtSignIn({ status: 'ACTIVE', onboarding: onboarding('IN_PROGRESS', 10) })).toBe(false)
    expect(storeSubmittedAtSignIn({ status: 'INACTIVE', onboarding: onboarding('COMPLETED', 11) })).toBe(false)
  })
})
