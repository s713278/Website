import { homePathForRole, loginPathForRole, VENDOR_ONBOARDING_HREF } from '@/app/router/role-home'
import { isApprovalGranted, isStoreSubmitted } from '@/modules/vendor/lib/onboarding-account-status'
import type { ServerOnboardingState } from '@/modules/vendor/lib/onboarding-resume'
import type { StoreSubmission } from '@/modules/vendor/types/onboarding'
import type { User } from '@/shared/types'

/**
 * What the marketing header's right-hand section offers, decided from the vendor's account.
 *
 * Pure on purpose, and a leaf: the header is in the initial bundle of every visitor, so
 * this imports only erased types and the account-status predicates, never the resume,
 * API or onboarding-store graph.
 */
export type HeaderAction =
  | {
      label: 'Log in' | 'Get started' | 'Continue setup' | 'Check status' | 'Store' | 'Dashboard'
      to: string
      emphasis: 'secondary' | 'primary'
    }
  // Ends the session rather than navigating, so it has no destination.
  | { label: 'Log out'; emphasis: 'secondary' }

/** The part of the account read this decision needs. */
type AccountSnapshot = {
  context: Pick<
    ServerOnboardingState['context'],
    'vendorStatus' | 'approvalStatus' | 'storeIdentifier' | 'onboarding'
  >
}

export type HeaderAccountRead =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; state: AccountSnapshot }

export type HeaderActionsInput = {
  user: Pick<User, 'roles' | 'vendorId'> | null
  live: boolean
  /** Only consulted for a live vendor with a `vendorId`. */
  account: HeaderAccountRead
  /** The onboarding wizard's in-memory submission, or `null` before one exists. */
  submission: StoreSubmission | null
  pathname: string
}

const VENDOR_LOGIN_HREF = loginPathForRole('vendor')
const VENDOR_HOME_HREF = homePathForRole('vendor')

const LOG_OUT: HeaderAction = { label: 'Log out', emphasis: 'secondary' }

const SIGNED_OUT: HeaderAction[] = [
  { label: 'Log in', to: VENDOR_LOGIN_HREF, emphasis: 'secondary' },
  { label: 'Get started', to: VENDOR_ONBOARDING_HREF, emphasis: 'primary' },
]

/** React Router matches `/onboarding/` too, so a trailing slash is still this page. */
function isOnboardingPath(pathname: string): boolean {
  return pathname.replace(/\/+$/, '') === VENDOR_ONBOARDING_HREF
}

/** `null` means "not submitted"; `undefined` means "not known yet". */
function submittedStore(input: HeaderActionsInput): StoreSubmission | null | undefined {
  const { user, live, account, submission } = input

  // Demo has no account to read. The wizard's own submission is all there is.
  if (!live) return submission
  // A vendor with several stores who has not chosen one has no account to read yet.
  if (!user?.vendorId) return null

  // The wizard's submission is account-confirmed and newer than any cached read, but it
  // is only owned by this session while the wizard is mounted: it is not cleared on
  // involuntary sign-out, so anywhere else it could belong to a previous vendor.
  if (submission && isOnboardingPath(input.pathname)) return submission

  if (account.status === 'loading') return undefined
  if (account.status === 'failed') return null
  const { state } = account
  if (!isStoreSubmitted(state)) return null
  return {
    storeIdentifier: state.context.storeIdentifier,
    approvalStatus: state.context.approvalStatus,
    vendorStatus: state.context.vendorStatus,
  }
}

export function resolveHeaderActions(input: HeaderActionsInput): HeaderAction[] {
  if (!input.user?.roles.includes('vendor')) return SIGNED_OUT

  const store = submittedStore(input)
  if (store === undefined) return []

  // These two link to the wizard, which is where the vendor already is on /onboarding.
  const onOnboarding = isOnboardingPath(input.pathname)
  const toOnboarding = (label: 'Continue setup' | 'Check status'): HeaderAction[] =>
    onOnboarding ? [] : [{ label, to: VENDOR_ONBOARDING_HREF, emphasis: 'primary' }]

  // Only a vendor with unfinished setup is offered a way out here. A submitted store has
  // its dashboard, which owns Log out, and nothing half-built to walk away from.
  if (!store) return [LOG_OUT, ...toOnboarding('Continue setup')]
  // Raw approval, not `deriveStoreState`: the header must not coerce a pending store
  // into an approved one the way the dashboard does.
  if (!isApprovalGranted(store.approvalStatus)) return toOnboarding('Check status')

  const actions: HeaderAction[] = []
  if (store.storeIdentifier) {
    actions.push({ label: 'Store', to: `/stores/${store.storeIdentifier}`, emphasis: 'secondary' })
  }
  actions.push({ label: 'Dashboard', to: VENDOR_HOME_HREF, emphasis: 'primary' })
  return actions
}
