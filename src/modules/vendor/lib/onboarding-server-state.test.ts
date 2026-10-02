import { afterEach, describe, expect, it, vi } from 'vitest'
import { mapVendorContext, vendorOnboardingService, type VendorContext } from '@/shared/api'
import { loadVendorAccountContext } from './onboarding-server-state'
import { invalidateVendorOnboardingState, writeEntry } from './onboarding-state-cache'
import type { ServerOnboardingState } from './onboarding-resume'
import { peekVendorContext } from './vendor-context-cache'

const VENDOR_ID = '96'

afterEach(() => {
  invalidateVendorOnboardingState()
  vi.restoreAllMocks()
})

function contextFor(vendorId: string): VendorContext {
  return mapVendorContext({
    data: {
      vendor_id: vendorId,
      vendor_status: 'ACTIVE',
      approval_status: 'APPROVED',
      store_identifier: 'sk-organic-store',
      onboarding: { status: 'COMPLETED', next_step: 11 },
    },
  })
}

/** Every other read the wizard's resume makes. A call to any of them fails the test loudly. */
function forbidSetupReads() {
  const names = [
    'getVendorProfile',
    'getBusinessTypes',
    'getVendorCategories',
    'getVendorProducts',
    'getVendorSkus',
    'getCheckoutOptions',
    'getMeasurements',
  ] as const
  return names.map((name) => vi.spyOn(vendorOnboardingService, name).mockRejectedValue(new Error(`unexpected ${name}`)))
}

describe('loadVendorAccountContext', () => {
  it('asks for the vendor context and nothing else', async () => {
    const context = contextFor(VENDOR_ID)
    const getContext = vi.spyOn(vendorOnboardingService, 'getVendorContext').mockResolvedValue(context)
    const setupReads = forbidSetupReads()

    await expect(loadVendorAccountContext(VENDOR_ID)).resolves.toEqual({ context })

    expect(getContext).toHaveBeenCalledTimes(1)
    for (const read of setupReads) expect(read).not.toHaveBeenCalled()
  })

  it('files the context where the dashboard looks, so opening it next costs no read', async () => {
    const context = contextFor(VENDOR_ID)
    const getContext = vi.spyOn(vendorOnboardingService, 'getVendorContext').mockResolvedValue(context)

    await loadVendorAccountContext(VENDOR_ID)

    expect(peekVendorContext(VENDOR_ID)).toBe(context)
    await loadVendorAccountContext(VENDOR_ID)
    expect(getContext).toHaveBeenCalledTimes(1)
  })

  it('shares one request between callers that ask at the same time', async () => {
    const getContext = vi
      .spyOn(vendorOnboardingService, 'getVendorContext')
      .mockResolvedValue(contextFor(VENDOR_ID))

    await Promise.all([loadVendorAccountContext(VENDOR_ID), loadVendorAccountContext(VENDOR_ID)])

    expect(getContext).toHaveBeenCalledTimes(1)
  })

  it('reuses a context the wizard’s read already resolved, without a request', async () => {
    const context = contextFor(VENDOR_ID)
    const resolved: ServerOnboardingState = {
      context,
      profile: null,
      categories: [],
      products: [],
      skus: [],
      checkout: null,
      businessTypes: [],
      measurements: [],
      productMeasurementCatalog: [],
    }
    writeEntry(VENDOR_ID, { promise: Promise.resolve(resolved), resolved })
    const getContext = vi.spyOn(vendorOnboardingService, 'getVendorContext').mockRejectedValue(new Error('unexpected read'))

    await expect(loadVendorAccountContext(VENDOR_ID)).resolves.toEqual({ context })

    expect(getContext).not.toHaveBeenCalled()
  })

  it('does not keep a failed read, so the next caller asks again', async () => {
    const context = contextFor(VENDOR_ID)
    const getContext = vi
      .spyOn(vendorOnboardingService, 'getVendorContext')
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(context)

    await expect(loadVendorAccountContext(VENDOR_ID)).rejects.toThrow('offline')
    await expect(loadVendorAccountContext(VENDOR_ID)).resolves.toEqual({ context })

    expect(getContext).toHaveBeenCalledTimes(2)
  })
})
