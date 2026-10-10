import { afterEach, describe, expect, it, vi } from 'vitest'
import { mapVendorContext, vendorOnboardingService, type VendorContext, type VendorProfile } from '@/shared/api'
import { clearVendorHeaderHint, readVendorHeaderHint } from '../store/vendor-header-hint-store'
import { SAMPLE_MEASUREMENT_CATALOG } from '../data/onboarding-measurement-sample'
import { loadStepResources, loadVendorAccountContext, prefetchOnboardingLanding } from './onboarding-server-state'
import { invalidateMeasurementCatalog } from './measurement-catalog-cache'
import { invalidateOnboardingResources, loadOnboardingResource } from './onboarding-resource-cache'
import { invalidateVendorContext, peekVendorContext } from './vendor-context-cache'

const VENDOR_ID = '96'

function invalidateAll() {
  invalidateOnboardingResources()
  invalidateVendorContext()
  invalidateMeasurementCatalog()
}

afterEach(() => {
  invalidateAll()
  clearVendorHeaderHint()
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

describe('loadStepResources', () => {
  afterEach(() => invalidateMeasurementCatalog())

  function stubReads(profileType = 'Beverages') {
    return {
      profile: vi.spyOn(vendorOnboardingService, 'getVendorProfile').mockResolvedValue({
        businessName: 'Store', businessType: profileType, ownerName: '', contactPerson: '', contactNumber: '',
      }),
      businessTypes: vi.spyOn(vendorOnboardingService, 'getBusinessTypes').mockResolvedValue({
        items: [], pageNumber: 0, pageSize: 100, totalPages: 0, totalElements: 0, lastPage: true,
      }),
      categories: vi.spyOn(vendorOnboardingService, 'getVendorCategories').mockResolvedValue([]),
      products: vi.spyOn(vendorOnboardingService, 'getVendorProducts').mockResolvedValue([]),
      skus: vi.spyOn(vendorOnboardingService, 'getVendorSkus').mockResolvedValue([]),
      checkout: vi.spyOn(vendorOnboardingService, 'getCheckoutOptions').mockResolvedValue(null),
      units: vi.spyOn(vendorOnboardingService, 'getMeasurements').mockResolvedValue(SAMPLE_MEASUREMENT_CATALOG),
    }
  }

  const settled = (reads: Partial<Record<string, Promise<unknown>>>) => Promise.allSettled(Object.values(reads))
  const called = (spies: ReturnType<typeof stubReads>) =>
    Object.entries(spies).filter(([, spy]) => spy.mock.calls.length).map(([name]) => name)

  it('starts only what each step lists', async () => {
    const spies = stubReads()
    await settled(loadStepResources(VENDOR_ID, 7, { submitted: false, approved: false, withUnits: true }))
    expect(called(spies)).toEqual(['checkout'])

    invalidateAll()
    vi.clearAllMocks()
    await settled(loadStepResources(VENDOR_ID, 10, { submitted: true, approved: true, withUnits: true }))
    expect(called(spies)).toEqual(['profile'])

    invalidateAll()
    vi.clearAllMocks()
    await settled(loadStepResources(VENDOR_ID, 10, { submitted: true, approved: false, withUnits: true }))
    expect(called(spies)).toEqual(['profile', 'businessTypes', 'categories', 'products', 'skus', 'units'])

    invalidateAll()
    vi.clearAllMocks()
    await settled(loadStepResources(VENDOR_ID, 10, { submitted: false, approved: false, withUnits: true }))
    expect(called(spies)).toEqual(['profile', 'businessTypes', 'categories', 'products', 'skus', 'checkout', 'units'])
  })

  it('leaves the units out without withUnits', async () => {
    const spies = stubReads()
    const reads = loadStepResources(VENDOR_ID, 6, { submitted: false, approved: false, withUnits: false })
    await settled(reads)
    expect(reads.units).toBeUndefined()
    expect(spies.units).not.toHaveBeenCalled()
  })

  it('reads business types only after the profile shows a saved type', async () => {
    const spies = stubReads('Others')
    const reads = loadStepResources(VENDOR_ID, 3, { submitted: false, approved: false, withUnits: true })
    await expect(reads.businessTypes).resolves.toEqual([])
    expect(spies.businessTypes).not.toHaveBeenCalled()

    invalidateAll()
    let answer!: (profile: VendorProfile) => void
    spies.profile.mockReturnValue(new Promise((resolve) => { answer = resolve }))
    const pending = loadStepResources(VENDOR_ID, 3, { submitted: false, approved: false, withUnits: true })
    await Promise.resolve()
    expect(spies.businessTypes).not.toHaveBeenCalled()
    answer({ businessName: 'Store', businessType: null, ownerName: '', contactPerson: '', contactNumber: '' })
    await settled(pending)
    expect(spies.businessTypes).not.toHaveBeenCalled()
  })

  it('joins a read in flight, omits a resolved one and honours skip', async () => {
    const spies = stubReads()
    const inFlight = loadOnboardingResource(VENDOR_ID, 'checkout', () => vendorOnboardingService.getCheckoutOptions(VENDOR_ID))
    const reads = loadStepResources(VENDOR_ID, 7, { submitted: false, approved: false, withUnits: true })
    await settled(reads)
    await inFlight
    expect(spies.checkout).toHaveBeenCalledTimes(1)

    expect(loadStepResources(VENDOR_ID, 7, { submitted: false, approved: false, withUnits: true })).toEqual({})
    const skipped = loadStepResources(VENDOR_ID, 5, { submitted: false, approved: false, withUnits: true, skip: ['categories', 'units'] })
    expect(Object.keys(skipped).sort()).toEqual(['businessTypes', 'products', 'profile'])
    await settled(skipped)
  })

  it('settles each resource on its own', async () => {
    const spies = stubReads()
    spies.categories.mockRejectedValue(new Error('down'))
    const reads = loadStepResources(VENDOR_ID, 4, { submitted: false, approved: false, withUnits: true })
    await expect(reads.categories).rejects.toThrow('down')
    await expect(reads.profile).resolves.toMatchObject({ businessName: 'Store' })
    await expect(reads.businessTypes).resolves.toEqual([])
  })
})

describe('prefetchOnboardingLanding', () => {
  function contextAtStep(nextStep: number | null): VendorContext {
    return mapVendorContext({
      data: {
        vendor_id: VENDOR_ID,
        vendor_status: 'SETTING_UP',
        approval_status: 'PENDING',
        onboarding: { status: 'IN_PROGRESS', next_step: nextStep },
      },
    })
  }

  function stubReads(context: VendorContext, businessType: string | null = 'Beverages') {
    return {
      context: vi.spyOn(vendorOnboardingService, 'getVendorContext').mockResolvedValue(context),
      profile: vi.spyOn(vendorOnboardingService, 'getVendorProfile').mockResolvedValue({
        businessName: 'Store', businessType, ownerName: '', contactPerson: '', contactNumber: '',
      }),
      businessTypes: vi.spyOn(vendorOnboardingService, 'getBusinessTypes').mockResolvedValue({
        items: [], pageNumber: 0, pageSize: 100, totalPages: 0, totalElements: 0, lastPage: true,
      }),
      categories: vi.spyOn(vendorOnboardingService, 'getVendorCategories').mockResolvedValue([]),
      products: vi.spyOn(vendorOnboardingService, 'getVendorProducts').mockResolvedValue([]),
      skus: vi.spyOn(vendorOnboardingService, 'getVendorSkus').mockResolvedValue([]),
      checkout: vi.spyOn(vendorOnboardingService, 'getCheckoutOptions').mockResolvedValue(null),
      units: vi.spyOn(vendorOnboardingService, 'getMeasurements').mockResolvedValue(SAMPLE_MEASUREMENT_CATALOG),
    }
  }

  /** The prefetch is never awaited by its callers, so the test lets its chain run out. */
  const drain = () => new Promise((resolve) => setTimeout(resolve, 0))
  const called = (spies: ReturnType<typeof stubReads>) =>
    Object.entries(spies).filter(([, spy]) => spy.mock.calls.length).map(([name]) => name)

  it.each([
    [7, ['context', 'profile', 'checkout']],
    [4, ['context', 'profile', 'businessTypes', 'categories']],
    [12, ['context', 'profile', 'businessTypes', 'categories', 'products', 'skus', 'checkout']],
    [1, ['context', 'profile', 'businessTypes']],
  ])('lands on sign-in’s next_step %i, clamped like the wizard, without units', async (nextStep, expected) => {
    const spies = stubReads(contextAtStep(null))

    expect(prefetchOnboardingLanding(VENDOR_ID, { nextStep })).toBeUndefined()
    await drain()

    expect(called(spies)).toEqual(expected)
    for (const spy of Object.values(spies)) expect(spy.mock.calls.length).toBeLessThanOrEqual(1)
  })

  it('reads business types on Step 4 only when the profile shows a saved type', async () => {
    const spies = stubReads(contextAtStep(null), null)

    prefetchOnboardingLanding(VENDOR_ID, { nextStep: 4 })
    await drain()

    expect(called(spies)).toEqual(['context', 'profile', 'categories'])
  })

  it('takes the landing step from the context once it resolves when sign-in has no usable pointer', async () => {
    let answer!: (context: VendorContext) => void
    const spies = stubReads(contextAtStep(7))
    spies.context.mockReturnValue(new Promise((resolve) => { answer = resolve }))

    prefetchOnboardingLanding(VENDOR_ID, { nextStep: null })
    await drain()
    expect(called(spies)).toEqual(['context', 'profile'])

    answer(contextAtStep(7))
    await drain()
    expect(called(spies)).toEqual(['context', 'profile', 'checkout'])
  })

  it('starts only the context and profile with no usable pointer anywhere', async () => {
    const spies = stubReads(contextAtStep(null))

    prefetchOnboardingLanding(VENDOR_ID, {})
    await drain()

    expect(called(spies)).toEqual(['context', 'profile'])
  })

  it('uses a context the caller already read, without a request', async () => {
    const spies = stubReads(contextAtStep(null))

    prefetchOnboardingLanding(VENDOR_ID, { context: contextAtStep(5) })
    await drain()

    expect(called(spies)).toEqual(['profile', 'businessTypes', 'categories', 'products'])
  })

  it('writes the header hint once the context resolves', async () => {
    stubReads(contextAtStep(null))

    prefetchOnboardingLanding(VENDOR_ID, { nextStep: 3 })
    expect(readVendorHeaderHint(VENDOR_ID)).toBeNull()
    await drain()

    expect(readVendorHeaderHint(VENDOR_ID)).toMatchObject({ vendorId: VENDOR_ID, vendorStatus: 'SETTING_UP' })
  })

  it('ends silently when its reads fail', async () => {
    const spies = stubReads(contextAtStep(null))
    for (const spy of Object.values(spies)) spy.mockRejectedValue(new Error('offline'))
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)

    prefetchOnboardingLanding(VENDOR_ID, { nextStep: 10 })
    prefetchOnboardingLanding('97', {})
    await drain()
    await drain()
    process.off('unhandledRejection', unhandled)

    expect(unhandled).not.toHaveBeenCalled()
  })
})
