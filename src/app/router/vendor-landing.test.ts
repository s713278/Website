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
import { landingPathIfKnown, resolveLandingPath } from './vendor-landing'

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
