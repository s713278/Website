import { homePathForRole, loginPathForRole, VENDOR_ONBOARDING_HREF } from '@/app/router/role-home'
import { isApprovalGranted, isStoreSubmitted } from '@/modules/vendor/lib/onboarding-account-status'
import type { StoreSubmission } from '@/modules/vendor/types/onboarding'
import type { VendorContext } from '@/shared/api'
import type { User } from '@/shared/types'

/**
 * What the marketing header's right-hand section offers, decided from the vendor's account.
 *
 * Pure on purpose, and a leaf: the header is in the initial bundle of every visitor, so
 * this imports only erased types and the account-status predicates, never the resume,
 * API or onboarding-store graph.
 */
export type HeaderAction = {
  label: 'Sign in' | 'Open store' | 'Continue setup' | 'Check status' | 'Dashboard'
  to: string
  emphasis: 'secondary' | 'primary'
}

/** The part of the account read this decision needs. */
type AccountSnapshot = {
  context: Pick<VendorContext, 'vendorStatus' | 'approvalStatus' | 'storeIdentifier' | 'onboarding'>
}

export type HeaderAccountRead =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; state: AccountSnapshot }

export type HeaderActionsInput = {
  user: Pick<User, 'role' | 'vendorId'> | null
  live: boolean
  /** Only consulted for a live vendor with a `vendorId`. */
  account: HeaderAccountRead
  /** The onboarding wizard's in-memory submission, or `null` before one exists. */
  submission: StoreSubmission | null
  pathname: string
}

const VENDOR_LOGIN_HREF = loginPathForRole('vendor')

const DASHBOARD: HeaderAction = { label: 'Dashboard', to: homePathForRole('vendor'), emphasis: 'primary' }

const OPEN_STORE: HeaderAction = { label: 'Open store', to: VENDOR_ONBOARDING_HREF, emphasis: 'primary' }

const SIGNED_OUT: HeaderAction[] = [
  { label: 'Sign in', to: VENDOR_LOGIN_HREF, emphasis: 'secondary' },
  OPEN_STORE,
]

/** React Router matches `/onboarding/` too, so a trailing slash is still this page. */
export function isOnboardingPath(pathname: string): boolean {
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
  if (!input.user) return SIGNED_OUT
  // A signed-in customer's own account menu sits beside these, so no vendor Sign in. The
  // active role decides, as it does for the account menu: a customer session on a phone
  // that is also a vendor has not entered the vendor side (docs/SESSION.md).
  if (input.user.role !== 'vendor') return [OPEN_STORE]

  const store = submittedStore(input)
  const onOnboarding = isOnboardingPath(input.pathname)

  // The account has not answered yet. Nothing is offered until it does: the account menu
  // beside these actions offers Dashboard until then, so a vendor is never left with no way in.
  if (store === undefined) return []

  // These two link to the wizard, which is where the vendor already is on /onboarding.
  const toOnboarding = (label: 'Continue setup' | 'Check status'): HeaderAction[] =>
    onOnboarding ? [] : [{ label, to: VENDOR_ONBOARDING_HREF, emphasis: 'primary' }]

  // Sign out is not an action here: the header's account menu offers it to every vendor.
  if (!store) return toOnboarding('Continue setup')
  // Raw approval, not `deriveStoreState`: the header must not coerce a pending store
  // into an approved one the way the dashboard does.
  if (!isApprovalGranted(store.approvalStatus)) return toOnboarding('Check status')

  // A live store's vendor works from the dashboard, so it takes the bar and the storefront
  // moves to the account menu (`resolveMenuStoreHref`). Without a storefront to swap in, the
  // menu keeps Dashboard and it is never offered twice.
  return store.storeIdentifier ? [DASHBOARD] : []
}

/**
 * The storefront the account menu offers in place of Dashboard, once Dashboard is in the bar.
 * `null` leaves the menu offering Dashboard.
 */
export function resolveMenuStoreHref(input: HeaderActionsInput): string | null {
  if (input.user?.role !== 'vendor') return null
  const store = submittedStore(input)
  if (!store || !isApprovalGranted(store.approvalStatus) || !store.storeIdentifier) return null
  return `/stores/${store.storeIdentifier}`
}
