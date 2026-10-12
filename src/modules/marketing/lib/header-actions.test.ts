import { describe, expect, it } from 'vitest'
import {
  resolveHeaderActions,
  type HeaderAccountRead,
  type HeaderActionsInput,
} from './header-actions'

const SIGNED_OUT = [
  { label: 'Sign in', to: '/vendor/login', emphasis: 'secondary' },
  { label: 'Open store', to: '/onboarding', emphasis: 'primary' },
]
const CONTINUE_SETUP = [{ label: 'Continue setup', to: '/onboarding', emphasis: 'primary' }]
const CHECK_STATUS = [{ label: 'Check status', to: '/onboarding', emphasis: 'primary' }]
const OPEN_STORE = [{ label: 'Open store', to: '/onboarding', emphasis: 'primary' }]
const STORE = { label: 'Store', to: '/stores/sk-organic-store', emphasis: 'secondary' }

function ready(
  vendorStatus: string,
  approvalStatus: string,
  nextStep: number,
  storeIdentifier: string | null = 'sk-organic-store',
): HeaderAccountRead {
  return {
    status: 'ready',
    state: {
      context: {
        vendorStatus,
        approvalStatus,
        storeIdentifier,
        onboarding: { status: nextStep === 11 ? 'COMPLETED' : 'IN_PROGRESS', description: null, nextStep },
      },
    },
  }
}

const SETTING_UP = ready('SETTING_UP', 'PENDING', 5, null)
const SUBMITTED_APPROVED = ready('ACTIVE', 'APPROVED', 11)
const SUBMITTED_PENDING = ready('ACTIVE', 'PENDING', 11)

function live(overrides: Partial<HeaderActionsInput> = {}): HeaderActionsInput {
  return {
    user: { roles: ['vendor'], vendorId: '91' },
    live: true,
    account: SUBMITTED_APPROVED,
    submission: null,
    pathname: '/',
    ...overrides,
  }
}

describe('resolveHeaderActions', () => {
  describe('signed out or customer only', () => {
    it('offers vendor login and onboarding when nobody is signed in', () => {
      expect(resolveHeaderActions(live({ user: null }))).toEqual(SIGNED_OUT)
    })

    // Their own account menu sits beside the actions, so a vendor Sign in would be a second login.
    it('offers a signed-in customer Open store only', () => {
      expect(resolveHeaderActions(live({ user: { roles: ['customer'], vendorId: undefined } }))).toEqual(
        OPEN_STORE,
      )
    })

    it('does not read the account for a customer who has no vendor role', () => {
      expect(
        resolveHeaderActions(
          live({ user: { roles: ['customer'], vendorId: undefined }, account: { status: 'loading' } }),
        ),
      ).toEqual(OPEN_STORE)
    })
  })

  describe('live vendor', () => {
    // The account menu offers Dashboard meanwhile, so the vendor is never left without a way in.
    it('offers nothing while the account read is in flight', () => {
      expect(resolveHeaderActions(live({ account: { status: 'loading' } }))).toEqual([])
    })

    // The account menu owns Dashboard; the actions never repeat it.
    it('never offers Dashboard among the actions', () => {
      for (const account of [SETTING_UP, SUBMITTED_PENDING, SUBMITTED_APPROVED, { status: 'loading' } as const]) {
        const labels = resolveHeaderActions(live({ account })).map((a) => a.label)
        expect(labels).not.toContain('Dashboard')
      }
    })

    // The account menu beside these actions owns Sign out for every signed-in vendor.
    it('never offers Sign out among the actions', () => {
      for (const account of [SETTING_UP, SUBMITTED_PENDING, SUBMITTED_APPROVED, { status: 'failed' } as const]) {
        const labels = resolveHeaderActions(live({ account })).map((a) => a.label)
        expect(labels).not.toContain('Sign out')
      }
    })

    it('falls back to Continue setup when the account read failed', () => {
      expect(resolveHeaderActions(live({ account: { status: 'failed' } }))).toEqual(CONTINUE_SETUP)
    })

    it('shows Continue setup, without reading, when no store has been chosen', () => {
      expect(
        resolveHeaderActions(
          live({ user: { roles: ['vendor'], vendorId: undefined }, account: { status: 'loading' } }),
        ),
      ).toEqual(CONTINUE_SETUP)
    })

    it('shows Continue setup while setup has not been submitted', () => {
      expect(resolveHeaderActions(live({ account: SETTING_UP }))).toEqual(CONTINUE_SETUP)
    })

    it('shows Store once the store is submitted and approved', () => {
      expect(resolveHeaderActions(live())).toEqual([STORE])
    })

    it('accepts ACTIVE as an approved value, as the wizard does', () => {
      expect(resolveHeaderActions(live({ account: ready('ACTIVE', 'ACTIVE', 11) }))).toEqual([STORE])
    })

    it('offers nothing when the approved account has no store identifier', () => {
      expect(
        resolveHeaderActions(live({ account: ready('ACTIVE', 'APPROVED', 11, null) })),
      ).toEqual([])
    })

    it('shows Check status for a submitted store that is still pending', () => {
      expect(resolveHeaderActions(live({ account: SUBMITTED_PENDING }))).toEqual(CHECK_STATUS)
    })

    it.each(['REJECTED', 'SUSPENDED', 'SOMETHING_NEW'])(
      'shows Check status for a submitted store whose approval is %s',
      (approval) => {
        expect(resolveHeaderActions(live({ account: ready('ACTIVE', approval, 11) }))).toEqual(
          CHECK_STATUS,
        )
      },
    )

    it('does not treat a pending store as approved', () => {
      const labels = resolveHeaderActions(live({ account: SUBMITTED_PENDING })).map((a) => a.label)
      expect(labels).not.toContain('Store')
    })
  })

  describe('on /onboarding', () => {
    const onboarding = { pathname: '/onboarding' }

    it('offers nothing while the account read is in flight', () => {
      expect(resolveHeaderActions(live({ ...onboarding, account: { status: 'loading' } }))).toEqual([])
    })

    it('hides Continue setup, which would link to the current page', () => {
      expect(resolveHeaderActions(live({ ...onboarding, account: SETTING_UP }))).toEqual([])
    })

    it('hides Continue setup after a failed read', () => {
      expect(resolveHeaderActions(live({ ...onboarding, account: { status: 'failed' } }))).toEqual([])
    })

    it('treats a trailing slash as the same page', () => {
      expect(resolveHeaderActions(live({ pathname: '/onboarding/', account: SETTING_UP }))).toEqual([])
    })

    it('hides Check status once the store is submitted', () => {
      expect(resolveHeaderActions(live({ ...onboarding, account: SUBMITTED_PENDING }))).toEqual([])
    })

    it('still shows Store', () => {
      expect(resolveHeaderActions(live(onboarding))).toEqual([STORE])
    })

    it('still offers vendor login to a signed-out visitor', () => {
      expect(resolveHeaderActions(live({ ...onboarding, user: null }))).toEqual(SIGNED_OUT)
    })

    it('follows the wizard at once when the vendor submits', () => {
      // The account read predates go-live and still says setup is unfinished.
      const before = live({ ...onboarding, account: SETTING_UP })
      const justSubmitted = { storeIdentifier: null, approvalStatus: null, vendorStatus: null }
      const approved = {
        storeIdentifier: 'sk-organic-store',
        approvalStatus: 'APPROVED',
        vendorStatus: 'ACTIVE',
      }

      expect(resolveHeaderActions(before)).toEqual([])
      // Submitted, approval not read back yet: Check status is hidden on this page.
      expect(resolveHeaderActions({ ...before, submission: justSubmitted })).toEqual([])
      expect(resolveHeaderActions({ ...before, submission: approved })).toEqual([STORE])
    })

    it('trusts the wizard over a stale account read that said approved', () => {
      expect(
        resolveHeaderActions(
          live({
            ...onboarding,
            account: SUBMITTED_APPROVED,
            submission: { storeIdentifier: null, approvalStatus: 'PENDING', vendorStatus: 'ACTIVE' },
          }),
        ),
      ).toEqual([])
    })

    it('shows the wizard result without waiting for the account read', () => {
      expect(
        resolveHeaderActions(
          live({
            ...onboarding,
            account: { status: 'loading' },
            submission: {
              storeIdentifier: 'sk-organic-store',
              approvalStatus: 'APPROVED',
              vendorStatus: 'ACTIVE',
            },
          }),
        ),
      ).toEqual([STORE])
    })
  })

  describe('the wizard submission off /onboarding', () => {
    it('is ignored in live mode, where it may belong to an earlier session', () => {
      expect(
        resolveHeaderActions(
          live({
            account: SETTING_UP,
            submission: {
              storeIdentifier: 'sk-organic-store',
              approvalStatus: 'APPROVED',
              vendorStatus: 'ACTIVE',
            },
          }),
        ),
      ).toEqual(CONTINUE_SETUP)
    })
  })

  describe('demo mode', () => {
    const demo = (overrides: Partial<HeaderActionsInput> = {}) =>
      live({ live: false, account: { status: 'loading' }, ...overrides })

    it('shows Continue setup before anything has been submitted', () => {
      expect(resolveHeaderActions(demo())).toEqual(CONTINUE_SETUP)
    })

    it('shows Check status for a submission, which carries no approval', () => {
      expect(
        resolveHeaderActions(
          demo({ submission: { storeIdentifier: null, approvalStatus: null, vendorStatus: null } }),
        ),
      ).toEqual(CHECK_STATUS)
    })

    it('hides Continue setup and Check status on /onboarding', () => {
      expect(resolveHeaderActions(demo({ pathname: '/onboarding' }))).toEqual([])
      expect(
        resolveHeaderActions(
          demo({
            pathname: '/onboarding',
            submission: { storeIdentifier: null, approvalStatus: null, vendorStatus: null },
          }),
        ),
      ).toEqual([])
    })

    it('shows Continue setup even for a vendor with no vendorId', () => {
      expect(
        resolveHeaderActions(demo({ user: { roles: ['vendor'], vendorId: undefined } })),
      ).toEqual(CONTINUE_SETUP)
    })

    it('still offers vendor login when signed out', () => {
      expect(resolveHeaderActions(demo({ user: null }))).toEqual(SIGNED_OUT)
    })
  })
})
