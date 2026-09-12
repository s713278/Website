import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { StoreState } from '@/modules/vendor/types/dashboard'
import {
  deriveStoreState,
  presentStoreState,
  setupProgress,
  storeStateAction,
  type StoreStateInput,
} from './store-state'

const ALL_STATES: StoreState[] = ['SETTING_UP', 'UNDER_REVIEW', 'OPEN', 'REJECTED', 'SUSPENDED']

/** The four states that share the parameterised non-open screen. */
const NON_OPEN_STATES = ALL_STATES.filter((state) => state !== 'OPEN')

describe('deriveStoreState', () => {
  beforeEach(() => vi.stubEnv('DEV', false))
  afterEach(() => vi.unstubAllEnvs())

  it('accepts only submission and approval as inputs', () => {
    expectTypeOf<keyof StoreStateInput>().toEqualTypeOf<'vendorStatus' | 'approvalStatus'>()
  })

  it('keeps an unsubmitted store in setup', () => {
    expect(
      deriveStoreState({ vendorStatus: 'INACTIVE', approvalStatus: 'PENDING' }),
    ).toBe('SETTING_UP')
  })

  it('keeps TREAT_PENDING_AS_APPROVED compensating for completed onboarding returning PENDING', () => {
    expect(
      deriveStoreState({ vendorStatus: 'ACTIVE', approvalStatus: 'PENDING' }),
    ).toBe('OPEN')
  })

  it('leaves demo approval uncoerced so UNDER_REVIEW remains reachable', () => {
    expect(deriveStoreState(
      { vendorStatus: 'ACTIVE', approvalStatus: 'PENDING' },
      { coercePendingApproval: false },
    )).toBe('UNDER_REVIEW')
  })

  it.each([null, 'UNKNOWN'])('does not coerce missing or unknown approval: %s', (approvalStatus) => {
    expect(deriveStoreState({ vendorStatus: 'ACTIVE', approvalStatus })).toBe('UNDER_REVIEW')
  })

  it('treats an approved store as open', () => {
    expect(
      deriveStoreState({ vendorStatus: 'ACTIVE', approvalStatus: 'APPROVED' }),
    ).toBe('OPEN')
  })

  it('reports rejection, which nothing in the app handled before', () => {
    expect(
      deriveStoreState({ vendorStatus: 'ACTIVE', approvalStatus: 'REJECTED' }),
    ).toBe('REJECTED')
  })

  it('lets suspension outrank approval, because the platform acted against the store', () => {
    expect(
      deriveStoreState({ vendorStatus: 'SUSPENDED', approvalStatus: 'APPROVED' }),
    ).toBe('SUSPENDED')
  })

  it('lets suspension outrank rejection too', () => {
    expect(
      deriveStoreState({ vendorStatus: 'SUSPENDED', approvalStatus: 'REJECTED' }),
    ).toBe('SUSPENDED')
  })

  it('lets rejection outrank unfinished setup', () => {
    // Verification's decision must be visible even if the account looks unfinished.
    expect(
      deriveStoreState({ vendorStatus: 'INACTIVE', approvalStatus: 'REJECTED' }),
    ).toBe('REJECTED')
  })

  it('keeps an unknown vendor status in setup', () => {
    expect(
      deriveStoreState({ vendorStatus: 'UNKNOWN', approvalStatus: 'PENDING' }),
    ).toBe('SETTING_UP')
  })

  it('does not call an unsubmitted store open just because approval says APPROVED', () => {
    expect(
      deriveStoreState({ vendorStatus: 'INACTIVE', approvalStatus: 'APPROVED' }),
    ).toBe('SETTING_UP')
  })

  it('is case-insensitive, since the contract types these as bare strings', () => {
    expect(
      deriveStoreState({ vendorStatus: 'active', approvalStatus: 'approved' }),
    ).toBe('OPEN')
  })

  it('keeps a store in setup when submission is unknown', () => {
    expect(
      deriveStoreState({ vendorStatus: null, approvalStatus: null }),
    ).toBe('SETTING_UP')
  })

  it.each([null, '', 'UNKNOWN', 'INACTIVE'])('requires submission even with approval: %s', (vendorStatus) => {
    expect(deriveStoreState({ vendorStatus, approvalStatus: 'APPROVED' })).toBe('SETTING_UP')
  })
})

describe('setupProgress', () => {
  it('reports the resume step against the ten setup steps', () => {
    expect(setupProgress(1)).toEqual({ step: 1, total: 10 })
    expect(setupProgress(10)).toEqual({ step: 10, total: 10 })
  })

  it('reports nothing once setup is complete', () => {
    expect(setupProgress(11)).toBeNull()
    expect(setupProgress(null)).toBeNull()
  })
})

describe('pending-approval flag removal warning', () => {
  beforeEach(() => {
    // A fresh module represents a new application session; no reset hook leaks into production.
    vi.resetModules()
    vi.stubEnv('DEV', true)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('warns once per session when a live context finally reports APPROVED', async () => {
    const { deriveStoreState } = await import('./store-state')
    const input = { vendorStatus: 'ACTIVE', approvalStatus: 'APPROVED' }

    deriveStoreState(input, { coercePendingApproval: true })
    deriveStoreState(input, { coercePendingApproval: true })

    expect(console.warn).toHaveBeenCalledTimes(1)
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('TREAT_PENDING_AS_APPROVED'))
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('approval_status: APPROVED'))
  })

  it('stays silent while live contexts still return PENDING', async () => {
    const { deriveStoreState } = await import('./store-state')

    expect(deriveStoreState({ vendorStatus: 'ACTIVE', approvalStatus: 'PENDING' })).toBe('OPEN')
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('does not warn for demo approval or consume the later live warning', async () => {
    const { deriveStoreState } = await import('./store-state')
    const input = { vendorStatus: 'ACTIVE', approvalStatus: 'APPROVED' }

    expect(deriveStoreState(input, { coercePendingApproval: false })).toBe('OPEN')
    expect(console.warn).not.toHaveBeenCalled()

    deriveStoreState(input, { coercePendingApproval: true })
    expect(console.warn).toHaveBeenCalledTimes(1)
  })

  it('stays silent in production even when the live backend returns APPROVED', async () => {
    vi.stubEnv('DEV', false)
    const { deriveStoreState } = await import('./store-state')

    expect(deriveStoreState(
      { vendorStatus: 'ACTIVE', approvalStatus: 'APPROVED' },
      { coercePendingApproval: true },
    )).toBe('OPEN')
    expect(console.warn).not.toHaveBeenCalled()
  })
})

describe('presentStoreState', () => {
  it('never implies a live store is accepting orders', () => {
    // The old dashboard badge said "Online · accepting orders"; nothing in the contract
    // expresses order acceptance.
    const { label, description } = presentStoreState('OPEN')
    expect(`${label} ${description}`.toLowerCase()).not.toContain('accepting')
  })

  it('gives every state a label and a description', () => {
    for (const state of ALL_STATES) {
      const presentation = presentStoreState(state)
      expect(presentation.label).toBeTruthy()
      expect(presentation.description).toBeTruthy()
    }
  })

  it('never lets a non-open state read as though submission were approval', () => {
    // The four non-open states share one screen. Each has to say plainly that the store is
    // not reachable by customers yet; "submitted" must never be dressed up as "live".
    for (const state of NON_OPEN_STATES) {
      const { label, description } = presentStoreState(state)
      const copy = `${label} ${description}`.toLowerCase()
      expect(copy).not.toContain('your store is live')
      expect(copy).not.toContain('customers can find')
    }
  })

  it('tones each state by how bad it is for the vendor', () => {
    expect(presentStoreState('OPEN').tone).toBe('success')
    expect(presentStoreState('SETTING_UP').tone).toBe('warning')
    expect(presentStoreState('UNDER_REVIEW').tone).toBe('warning')
    expect(presentStoreState('REJECTED').tone).toBe('danger')
    expect(presentStoreState('SUSPENDED').tone).toBe('danger')
  })
})

describe('storeStateAction', () => {
  it('offers at most one action per state', () => {
    // The shared screen renders whatever this returns. Returning a list would let a state
    // grow a row of buttons, which is what the old dashboard did.
    for (const state of ALL_STATES) {
      const action = storeStateAction(state)
      if (action) {
        expect(action.label).toBeTruthy()
        expect(action.to.startsWith('/')).toBe(true)
      }
    }
  })

  it('sends an unfinished store back to setup', () => {
    expect(storeStateAction('SETTING_UP')).toEqual({ label: 'Continue setup', to: '/onboarding' })
  })

  it('offers nothing to a store waiting on verification', () => {
    // Neither waiting nor suspension is the vendor's to resolve, and no route in the
    // contract lets this console resolve it for them.
    expect(storeStateAction('UNDER_REVIEW')).toBeNull()
    expect(storeStateAction('SUSPENDED')).toBeNull()
  })

  it('does not offer a rejected store a resubmit it cannot perform', () => {
    const action = storeStateAction('REJECTED')
    expect(action?.label.toLowerCase()).not.toContain('resubmit')
    expect(action?.label.toLowerCase()).not.toContain('submit again')
  })

  it('offers nothing for an open store, which gets the work queue instead', () => {
    expect(storeStateAction('OPEN')).toBeNull()
  })
})
