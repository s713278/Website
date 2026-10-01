import { describe, expect, it } from 'vitest'
import {
  resolveHeaderActions,
  type HeaderAccountRead,
  type HeaderActionsInput,
} from './header-actions'

const SIGNED_OUT = [
  { label: 'Log in', to: '/vendor/login', emphasis: 'secondary' },
  { label: 'Get started', to: '/onboarding', emphasis: 'primary' },
]
const LOG_OUT = { label: 'Log out', emphasis: 'secondary' }
// A vendor whose setup is unfinished can always leave, so Log out rides with Continue setup.
const CONTINUE_SETUP = [LOG_OUT, { label: 'Continue setup', to: '/onboarding', emphasis: 'primary' }]
const CHECK_STATUS = [{ label: 'Check status', to: '/onboarding', emphasis: 'primary' }]
const DASHBOARD = { label: 'Dashboard', to: '/vendor', emphasis: 'primary' }
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

    it('treats a customer-only session like a signed-out visitor', () => {
      expect(resolveHeaderActions(live({ user: { roles: ['customer'], vendorId: undefined } }))).toEqual(
        SIGNED_OUT,
      )
    })

    it('does not read the account for a customer who has no vendor role', () => {
      expect(
        resolveHeaderActions(
          live({ user: { roles: ['customer'], vendorId: undefined }, account: { status: 'loading' } }),
        ),
      ).toEqual(SIGNED_OUT)
    })
  })

  describe('live vendor', () => {
    it('shows nothing while the account read is in flight', () => {
      expect(resolveHeaderActions(live({ account: { status: 'loading' } }))).toEqual([])
    })

    it('offers no Log out to a vendor whose store is submitted', () => {
      for (const account of [SUBMITTED_PENDING, SUBMITTED_APPROVED]) {
        const labels = resolveHeaderActions(live({ account })).map((a) => a.label)
        expect(labels).not.toContain('Log out')
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

    it('shows Store and Dashboard once the store is submitted and approved', () => {
      expect(resolveHeaderActions(live())).toEqual([STORE, DASHBOARD])
    })

    it('accepts ACTIVE as an approved value, as the wizard does', () => {
      expect(resolveHeaderActions(live({ account: ready('ACTIVE', 'ACTIVE', 11) }))).toEqual([
        STORE,
        DASHBOARD,
      ])
    })

    it('omits Store when the approved account has no store identifier', () => {
      expect(
        resolveHeaderActions(live({ account: ready('ACTIVE', 'APPROVED', 11, null) })),
      ).toEqual([DASHBOARD])
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
      expect(labels).not.toContain('Dashboard')
    })
  })

  describe('on /onboarding', () => {
    const onboarding = { pathname: '/onboarding' }

    it('hides Continue setup, which would link to the current page, but keeps Log out', () => {
      expect(resolveHeaderActions(live({ ...onboarding, account: SETTING_UP }))).toEqual([LOG_OUT])
    })

    it('hides Continue setup after a failed read, but keeps Log out', () => {
      expect(resolveHeaderActions(live({ ...onboarding, account: { status: 'failed' } }))).toEqual([
        LOG_OUT,
      ])
    })

    it('treats a trailing slash as the same page', () => {
      expect(resolveHeaderActions(live({ pathname: '/onboarding/', account: SETTING_UP }))).toEqual([
        LOG_OUT,
      ])
    })

    it('hides Check status and offers no Log out once the store is submitted', () => {
      expect(resolveHeaderActions(live({ ...onboarding, account: SUBMITTED_PENDING }))).toEqual([])
    })

    it('still shows Store and Dashboard', () => {
      expect(resolveHeaderActions(live(onboarding))).toEqual([STORE, DASHBOARD])
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

      expect(resolveHeaderActions(before)).toEqual([LOG_OUT])
      // Submitted, approval not read back yet: Check status is hidden on this page, and a
      // submitted store has nothing left to abandon.
      expect(resolveHeaderActions({ ...before, submission: justSubmitted })).toEqual([])
      expect(resolveHeaderActions({ ...before, submission: approved })).toEqual([STORE, DASHBOARD])
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
      ).toEqual([STORE, DASHBOARD])
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
      expect(resolveHeaderActions(demo({ pathname: '/onboarding' }))).toEqual([LOG_OUT])
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
