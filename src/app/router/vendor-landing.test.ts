import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadVendorOnboardingState } from '@/modules/vendor/lib/onboarding-server-state'
import { invalidateVendorOnboardingState } from '@/modules/vendor/lib/onboarding-state-cache'
import { loadVendorContext } from '@/modules/vendor/lib/vendor-context-cache'
import {
  configureApiClient,
  mapVendorContext,
  vendorOnboardingService,
  type VendorContext,
} from '@/shared/api'
import type { User } from '@/shared/types'
import { preloadVendorDashboard } from './vendor-dashboard-chunks'
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

beforeEach(() => {
  vi.mocked(preloadVendorDashboard).mockClear()
  vi.stubEnv('VITE_USE_API', 'true')
  configureApiClient({ useApi: true })
  invalidateVendorOnboardingState()
})

afterEach(() => {
  invalidateVendorOnboardingState()
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

  it('starts the wizard’s reads for an unfinished store, reusing the context it already has', async () => {
    const getContext = vi.spyOn(vendorOnboardingService, 'getVendorContext').mockResolvedValue(SETTING_UP)
    const [getProfile] = holdSetupReads()

    await resolveLandingPath(vendor)

    expect(getProfile).toHaveBeenCalledTimes(1)
    void loadVendorOnboardingState(VENDOR_ID)
    expect(getProfile).toHaveBeenCalledTimes(1)
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
