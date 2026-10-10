import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import * as serverState from '@/modules/vendor/lib/onboarding-server-state'
import { invalidateMeasurementCatalog } from '@/modules/vendor/lib/measurement-catalog-cache'
import { invalidateOnboardingResources } from '@/modules/vendor/lib/onboarding-resource-cache'
import { invalidateVendorContext, loadVendorContext } from '@/modules/vendor/lib/vendor-context-cache'
import * as liveBilling from '@/modules/vendor/store/live-billing'
import {
  configureApiClient,
  mapVendorContext,
  vendorOnboardingService,
  type VendorContext,
  type VendorSignInMembership,
} from '@/shared/api'
import type { User } from '@/shared/types'
import { preloadVendorDashboard } from './vendor-dashboard-chunks'
import { resumePathAfterLogin } from './role-home'
import { landingPathIfKnown, resolveLandingPath } from './vendor-landing'

vi.mock('./vendor-dashboard-chunks', () => ({ preloadVendorDashboard: vi.fn() }))

const VENDOR_ID = 'test-vendor'

const vendor: User = {
  id: 'test-user', name: 'Test Vendor', email: 'vendor@example.test',
  role: 'vendor', roles: ['vendor'],
  vendors: [{ vendorId: VENDOR_ID }], vendorId: VENDOR_ID,
}

function vendorContext(vendorStatus: string, nextStep: number): VendorContext {
  return mapVendorContext({
    data: {
      vendor_id: VENDOR_ID,
      vendor_status: vendorStatus,
      approval_status: 'APPROVED',
      store_identifier: 'sk-organic-store',
      onboarding: { status: nextStep === 11 ? 'COMPLETED' : 'IN_PROGRESS', next_step: nextStep },
    },
  })
}

const SUBMITTED = vendorContext('ACTIVE', 11)
const SETTING_UP = vendorContext('SETTING_UP', 5)

/** A read that never answers, which is what a slow backend looks like from sign-in. */
const neverSettles = () => new Promise<never>(() => {})

const SETUP_READS = [
  'getVendorProfile',
  'getBusinessTypes',
  'getVendorCategories',
  'getVendorProducts',
  'getVendorSkus',
  'getCheckoutOptions',
  'getMeasurements',
] as const

/** The wizard's resume reads other than the context, held open. */
function holdSetupReads() {
  return SETUP_READS.map((name) => vi.spyOn(vendorOnboardingService, name).mockReturnValue(neverSettles()))
}

function invalidateAll() {
  invalidateOnboardingResources()
  invalidateVendorContext()
  invalidateMeasurementCatalog()
}

beforeEach(() => {
  vi.mocked(preloadVendorDashboard).mockClear()
  vi.stubEnv('VITE_USE_API', 'true')
  configureApiClient({ useApi: true })
  invalidateAll()
})

afterEach(() => {
  invalidateAll()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('resolveLandingPath', () => {
  it('sends a submitted store to the dashboard on the context alone', async () => {
    const getContext = vi.spyOn(vendorOnboardingService, 'getVendorContext').mockResolvedValue(SUBMITTED)
    const setupReads = holdSetupReads()

    await expect(resolveLandingPath(vendor)).resolves.toBe('/vendor')

    expect(getContext).toHaveBeenCalledTimes(1)
    for (const read of setupReads) expect(read).not.toHaveBeenCalled()
  })

  it('sends an unfinished store to setup without waiting on the wizard’s reads', async () => {
    vi.spyOn(vendorOnboardingService, 'getVendorContext').mockResolvedValue(SETTING_UP)
    holdSetupReads()

    await expect(resolveLandingPath(vendor)).resolves.toBe('/onboarding')
  })

  it('starts the landing step’s reads for an unfinished store, reusing the context it already has', async () => {
    const getContext = vi.spyOn(vendorOnboardingService, 'getVendorContext').mockResolvedValue(SETTING_UP)
    const [getProfile, getBusinessTypes, getCategories, getProducts, getSkus, getCheckout, getMeasurements] = holdSetupReads()
    getProfile.mockResolvedValue({
      businessName: 'Store', businessType: 'Beverages', ownerName: '', contactPerson: '', contactNumber: '',
    })

    await resolveLandingPath(vendor)
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Pointer 5: profile, business types, categories and products; no sizes, checkout or units.
    for (const read of [getProfile, getBusinessTypes, getCategories, getProducts]) expect(read).toHaveBeenCalledTimes(1)
    for (const read of [getSkus, getCheckout, getMeasurements]) expect(read).not.toHaveBeenCalled()
    expect(getContext).toHaveBeenCalledTimes(1)
  })

  it('does not start the wizard’s reads when the session is heading elsewhere', async () => {
    vi.spyOn(vendorOnboardingService, 'getVendorContext').mockResolvedValue(SETTING_UP)
    const setupReads = holdSetupReads()
    const dual: User = { ...vendor, role: 'customer', roles: ['customer', 'vendor'] }

    await expect(resolveLandingPath(dual, '/checkout')).resolves.toBe('/checkout')

    for (const read of setupReads) expect(read).not.toHaveBeenCalled()
  })

  it('uses a context the dashboard or header already read, without a request', async () => {
    await loadVendorContext(VENDOR_ID, async () => SUBMITTED)
    const getContext = vi.spyOn(vendorOnboardingService, 'getVendorContext').mockRejectedValue(new Error('unexpected read'))

    expect(landingPathIfKnown(vendor)).toBe('/vendor')
    await expect(resolveLandingPath(vendor)).resolves.toBe('/vendor')
    expect(getContext).not.toHaveBeenCalled()
  })

  it('falls back to setup when the context cannot be read', async () => {
    vi.spyOn(vendorOnboardingService, 'getVendorContext').mockRejectedValue(new Error('offline'))
    const setupReads = holdSetupReads()

    await expect(resolveLandingPath(vendor)).resolves.toBe('/onboarding')
    for (const read of setupReads) expect(read).not.toHaveBeenCalled()
  })

  it('reads nothing for a vendor with no single store to read', async () => {
    const getContext = vi.spyOn(vendorOnboardingService, 'getVendorContext').mockRejectedValue(new Error('unexpected read'))
    const noStore: User = { ...vendor, vendors: [], vendorId: undefined }

    expect(landingPathIfKnown(noStore)).toBe('/onboarding')
    await expect(resolveLandingPath(noStore)).resolves.toBe('/onboarding')
    expect(getContext).not.toHaveBeenCalled()
  })
})

describe('resolveLandingPath dashboard preload', () => {
  it('starts the dashboard chunks before the vendor context answers', async () => {
    let answer!: (context: VendorContext) => void
    vi.spyOn(vendorOnboardingService, 'getVendorContext').mockReturnValue(
      new Promise<VendorContext>((resolve) => { answer = resolve }),
    )

    const landing = resolveLandingPath(vendor)

    // Synchronous with the call: the context promise has not been given its answer yet.
    expect(preloadVendorDashboard).toHaveBeenCalledTimes(1)
    answer(SUBMITTED)
    await expect(landing).resolves.toBe('/vendor')
    expect(preloadVendorDashboard).toHaveBeenCalledTimes(1)
  })

  it('still preloads when the context read fails', async () => {
    vi.spyOn(vendorOnboardingService, 'getVendorContext').mockRejectedValue(new Error('offline'))

    await expect(resolveLandingPath(vendor)).resolves.toBe('/onboarding')
    expect(preloadVendorDashboard).toHaveBeenCalledTimes(1)
  })

  it('does not preload for a customer', async () => {
    const customer: User = { ...vendor, role: 'customer', roles: ['customer'], vendors: [], vendorId: undefined }

    await expect(resolveLandingPath(customer)).resolves.toBe('/')
    expect(preloadVendorDashboard).not.toHaveBeenCalled()
  })

  it('does not preload in demo mode', async () => {
    vi.stubEnv('VITE_USE_API', 'false')
    configureApiClient({ useApi: false })
    const getContext = vi.spyOn(vendorOnboardingService, 'getVendorContext').mockRejectedValue(new Error('unexpected read'))

    await resolveLandingPath(vendor)

    expect(getContext).not.toHaveBeenCalled()
    expect(preloadVendorDashboard).not.toHaveBeenCalled()
  })

  it('does not preload when a cached context already decides the destination', async () => {
    await loadVendorContext(VENDOR_ID, async () => SUBMITTED)

    await expect(resolveLandingPath(vendor)).resolves.toBe('/vendor')
    expect(preloadVendorDashboard).not.toHaveBeenCalled()
  })

  it('does not preload when the caller already has a destination', async () => {
    await loadVendorContext(VENDOR_ID, async () => SETTING_UP)
    const dual: User = { ...vendor, role: 'customer', roles: ['customer', 'vendor'] }

    await expect(resolveLandingPath(dual, '/checkout')).resolves.toBe('/checkout')
    expect(preloadVendorDashboard).not.toHaveBeenCalled()
  })

  it('does not preload for a vendor with no single store', async () => {
    const noStore: User = { ...vendor, vendors: [], vendorId: undefined }

    await resolveLandingPath(noStore)
    expect(preloadVendorDashboard).not.toHaveBeenCalled()
  })
})

describe('resolveLandingPath from the sign-in snapshot', () => {
  const never = Symbol('still waiting')
  /** The landing path, or `never` when it is still undecided after the given time. */
  const settled = (landing: Promise<string>, ms = 30) =>
    Promise.race([landing, new Promise<typeof never>((resolve) => setTimeout(() => resolve(never), ms))])

  /** Lets the sign-in kick-offs' dynamic imports (already loaded here) run to their calls. */
  const flush = async () => {
    await import('@/modules/vendor/lib/onboarding-server-state')
    await import('@/modules/vendor/store/live-billing')
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  const member = (
    status: string | null,
    nextStep: number | null,
    onboardingStatus: VendorSignInMembership['onboarding']['status'] = nextStep === 11 ? 'COMPLETED' : 'IN_PROGRESS',
  ): VendorSignInMembership => ({
    vendorId: VENDOR_ID, name: undefined, status,
    onboarding: { status: onboardingStatus, description: null, nextStep },
  })

  let accountContext: MockInstance<typeof serverState.loadVendorAccountContext>
  let landingPrefetch: MockInstance<typeof serverState.prefetchOnboardingLanding>
  let billing: MockInstance<typeof liveBilling.readLiveBilling>
  let getContext: MockInstance<typeof vendorOnboardingService.getVendorContext>

  beforeEach(() => {
    // Nothing reaches the network: the context call is never answered, and the kick-offs are spies.
    getContext = vi.spyOn(vendorOnboardingService, 'getVendorContext').mockReturnValue(neverSettles())
    accountContext = vi.spyOn(serverState, 'loadVendorAccountContext').mockReturnValue(neverSettles())
    landingPrefetch = vi.spyOn(serverState, 'prefetchOnboardingLanding').mockReturnValue(undefined)
    billing = vi.spyOn(liveBilling, 'readLiveBilling').mockResolvedValue(undefined)
  })

  afterEach(flush)

  it('lands a submitted store on the dashboard without waiting on the context', async () => {
    await expect(settled(resolveLandingPath(vendor, null, [member('ACTIVE', 11)]))).resolves.toBe('/vendor')
    await flush()

    expect(preloadVendorDashboard).toHaveBeenCalledTimes(1)
    // The same reads the dashboard will join are started, not awaited.
    expect(accountContext).toHaveBeenCalledWith(VENDOR_ID)
    expect(billing).toHaveBeenCalledWith(VENDOR_ID)
    expect(getContext).not.toHaveBeenCalled()
  })

  it.each([
    ['an unfinished step', member('ACTIVE', 3)],
    ['a completed status on an inactive store', member('INACTIVE', null, 'COMPLETED')],
  ])('lands %s in setup without waiting on the context', async (_label, membership) => {
    await expect(settled(resolveLandingPath(vendor, null, [membership]))).resolves.toBe('/onboarding')
  })

  it.each([
    ['no status', member(null, 11)],
    ['an unknown status and no step', member('ACTIVE', null, 'UNKNOWN')],
    ['an unknown status and an out-of-range step', member('ACTIVE', 12, 'UNKNOWN')],
    ['an unknown status and a zero step', member('ACTIVE', 0, 'UNKNOWN')],
  ])('falls back to the context for %s', async (_label, membership) => {
    let answer!: (value: { context: VendorContext }) => void
    accountContext.mockReturnValue(new Promise((resolve) => { answer = resolve }))

    const landing = resolveLandingPath(vendor, null, [membership])
    await expect(settled(landing)).resolves.toBe(never)

    answer({ context: SUBMITTED })
    await expect(landing).resolves.toBe('/vendor')
    await flush()
    // A destination read from the context starts nothing beyond the context itself.
    expect(billing).not.toHaveBeenCalled()
  })

  it('falls back when the snapshot has no entry for the signed-in store', async () => {
    const other = { ...member('ACTIVE', 11), vendorId: 'another-store' }

    await expect(settled(resolveLandingPath(vendor, null, [other]))).resolves.toBe(never)
  })

  it('routes a multi-store identity by role only and starts no reads', async () => {
    const choosing: User = { ...vendor, vendors: [{ vendorId: VENDOR_ID }, { vendorId: 'second' }], vendorId: undefined }

    await expect(settled(resolveLandingPath(choosing, null, [member('ACTIVE', 11), { ...member('ACTIVE', 11), vendorId: 'second' }])))
      .resolves.toBe('/onboarding')
    await flush()

    expect(preloadVendorDashboard).not.toHaveBeenCalled()
    expect(accountContext).not.toHaveBeenCalled()
    expect(landingPrefetch).not.toHaveBeenCalled()
    expect(billing).not.toHaveBeenCalled()
    expect(getContext).not.toHaveBeenCalled()
  })

  it('trusts a context already read over a contradicting snapshot', async () => {
    await loadVendorContext(VENDOR_ID, async () => SETTING_UP)

    await expect(settled(resolveLandingPath(vendor, null, [member('ACTIVE', 11)]))).resolves.toBe('/onboarding')
    await flush()
    expect(accountContext).not.toHaveBeenCalled()
    expect(billing).not.toHaveBeenCalled()
    expect(landingPrefetch).not.toHaveBeenCalled()
    expect(preloadVendorDashboard).not.toHaveBeenCalled()
  })

  it('trusts a submitted cached context over a snapshot that says setup', async () => {
    await loadVendorContext(VENDOR_ID, async () => SUBMITTED)

    await expect(settled(resolveLandingPath(vendor, null, [member('ACTIVE', 3)]))).resolves.toBe('/vendor')
    await flush()
    expect(billing).not.toHaveBeenCalled()
    expect(accountContext).not.toHaveBeenCalled()
  })

  it('keeps honouring `from` for a shopper, starting nothing for a destination other than the dashboard', async () => {
    const dual: User = { ...vendor, role: 'customer', roles: ['customer', 'vendor'] }

    await expect(settled(resolveLandingPath(dual, '/checkout', [member('ACTIVE', 11)]))).resolves.toBe('/checkout')
    await expect(settled(resolveLandingPath(dual, '//evil.example', [member('ACTIVE', 11)]))).resolves.toBe(
      resumePathAfterLogin(dual, '//evil.example'),
    )
    // A vendor session ignores `from`, as it always has.
    await expect(settled(resolveLandingPath(vendor, '/checkout', [member('ACTIVE', 11)]))).resolves.toBe('/vendor')
    await flush()

    expect(billing).toHaveBeenCalledTimes(1)
  })

  it('starts billing for the dashboard only', async () => {
    await resolveLandingPath(vendor, null, [member('ACTIVE', 3)])
    await flush()
    expect(billing).not.toHaveBeenCalled()
    expect(accountContext).not.toHaveBeenCalled()
    expect(preloadVendorDashboard).not.toHaveBeenCalled()

    await resolveLandingPath(vendor, null, [member('ACTIVE', 11)])
    await flush()
    expect(billing).toHaveBeenCalledTimes(1)
  })

  it('starts the landing step’s reads from the snapshot’s pointer when sign-in heads to setup', async () => {
    await resolveLandingPath(vendor, null, [member('ACTIVE', 7)])
    await flush()

    expect(landingPrefetch).toHaveBeenCalledTimes(1)
    expect(landingPrefetch).toHaveBeenCalledWith(VENDOR_ID, { nextStep: 7 })
  })

  it('passes no pointer when the snapshot decides setup without one', async () => {
    await resolveLandingPath(vendor, null, [member('INACTIVE', null, 'COMPLETED')])
    await flush()

    expect(landingPrefetch).toHaveBeenCalledWith(VENDOR_ID, { nextStep: null })
  })

  it('starts the landing step’s reads from a context-decided setup landing', async () => {
    accountContext.mockResolvedValue({ context: SETTING_UP })

    await expect(resolveLandingPath(vendor)).resolves.toBe('/onboarding')

    expect(landingPrefetch).toHaveBeenCalledWith(VENDOR_ID, { context: SETTING_UP })
  })

  it('does not reject when the background reads fail', async () => {
    accountContext.mockRejectedValue(new Error('offline'))
    billing.mockRejectedValue(new Error('offline'))
    landingPrefetch.mockImplementation(() => { throw new Error('offline') })
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)

    await expect(resolveLandingPath(vendor, null, [member('ACTIVE', 11)])).resolves.toBe('/vendor')
    await expect(resolveLandingPath(vendor, null, [member('ACTIVE', 3)])).resolves.toBe('/onboarding')
    await flush()
    await flush()
    process.off('unhandledRejection', unhandled)

    expect(billing).toHaveBeenCalled()
    expect(landingPrefetch).toHaveBeenCalled()
    expect(unhandled).not.toHaveBeenCalled()
  })

  it('still waits on the context when no snapshot is given, as a later landing does', async () => {
    let answer!: (value: { context: VendorContext }) => void
    accountContext.mockReturnValue(new Promise((resolve) => { answer = resolve }))

    const landing = resolveLandingPath(vendor)
    await expect(settled(landing)).resolves.toBe(never)

    answer({ context: SUBMITTED })
    await expect(landing).resolves.toBe('/vendor')
    await flush()
    expect(billing).not.toHaveBeenCalled()
  })
})
