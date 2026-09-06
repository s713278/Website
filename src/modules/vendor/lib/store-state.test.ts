import { describe, expect, it } from 'vitest'
import type { StoreState } from '@/modules/vendor/types/dashboard'
import {
  deriveStoreState,
  presentStoreState,
  setupProgress,
  storeStateAction,
} from './store-state'

const ALL_STATES: StoreState[] = ['SETTING_UP', 'UNDER_REVIEW', 'OPEN', 'REJECTED', 'SUSPENDED']

/** The four states that share the parameterised non-open screen. */
const NON_OPEN_STATES = ALL_STATES.filter((state) => state !== 'OPEN')

describe('deriveStoreState', () => {
  it('reads the live dev vendor as still setting up', () => {
    // Vendor 96 as the deployed API returns it: nothing submitted, step 1 of 10.
    expect(
      deriveStoreState({ vendorStatus: 'INACTIVE', approvalStatus: 'PENDING', nextStep: 1 }),
    ).toBe('SETTING_UP')
  })

  it('treats a submitted store awaiting an administrator as under review', () => {
    expect(
      deriveStoreState({ vendorStatus: 'ACTIVE', approvalStatus: 'PENDING', nextStep: 11 }),
    ).toBe('UNDER_REVIEW')
  })

  it('treats an approved store as open', () => {
    expect(
      deriveStoreState({ vendorStatus: 'ACTIVE', approvalStatus: 'APPROVED', nextStep: 11 }),
    ).toBe('OPEN')
  })

  it('reports rejection, which nothing in the app handled before', () => {
    expect(
      deriveStoreState({ vendorStatus: 'ACTIVE', approvalStatus: 'REJECTED', nextStep: 11 }),
    ).toBe('REJECTED')
  })

  it('lets suspension outrank approval, because the platform acted against the store', () => {
    expect(
      deriveStoreState({ vendorStatus: 'SUSPENDED', approvalStatus: 'APPROVED', nextStep: 11 }),
    ).toBe('SUSPENDED')
  })

  it('lets suspension outrank rejection too', () => {
    expect(
      deriveStoreState({ vendorStatus: 'SUSPENDED', approvalStatus: 'REJECTED', nextStep: 4 }),
    ).toBe('SUSPENDED')
  })

  it('lets rejection outrank unfinished setup', () => {
    // An administrator's decision must be visible even if the account looks unfinished.
    expect(
      deriveStoreState({ vendorStatus: 'ACTIVE', approvalStatus: 'REJECTED', nextStep: 6 }),
    ).toBe('REJECTED')
  })

  it('falls back to vendor status when next_step is missing', () => {
    // `next_step` is authoritative but optional; go-live is what sets ACTIVE, so
    // anything else means nothing was ever submitted.
    expect(
      deriveStoreState({ vendorStatus: 'INACTIVE', approvalStatus: 'PENDING', nextStep: null }),
    ).toBe('SETTING_UP')
  })

  it('does not call an unsubmitted store open just because approval says APPROVED', () => {
    expect(
      deriveStoreState({ vendorStatus: 'INACTIVE', approvalStatus: 'APPROVED', nextStep: 3 }),
    ).toBe('SETTING_UP')
  })

  it('is case-insensitive, since the contract types these as bare strings', () => {
    expect(
      deriveStoreState({ vendorStatus: 'active', approvalStatus: 'approved', nextStep: 11 }),
    ).toBe('OPEN')
  })

  it('assumes under review rather than open when both fields are missing', () => {
    // Claiming a store is live is the more damaging error of the two.
    expect(
      deriveStoreState({ vendorStatus: null, approvalStatus: null, nextStep: null }),
    ).toBe('UNDER_REVIEW')
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

  it('offers nothing to a store waiting on an administrator', () => {
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
