import { afterEach, describe, expect, it, vi } from 'vitest'
import { mapVendorContext, vendorOnboardingService, type VendorContext, type VendorProfile } from '@/shared/api'
import { clearVendorHeaderHint, readVendorHeaderHint } from '../store/vendor-header-hint-store'
import { SAMPLE_MEASUREMENT_CATALOG } from '../data/onboarding-measurement-sample'
import { loadMeasurementCatalog, peekMeasurementCatalog } from './measurement-catalog-cache'
import { loadStepResources, loadVendorAccountContext, loadVendorOnboardingState } from './onboarding-server-state'
import { invalidateMeasurementCatalog } from './measurement-catalog-cache'
import { loadOnboardingResource } from './onboarding-resource-cache'
import { invalidateVendorOnboardingState, writeEntry } from './onboarding-state-cache'
import { loadServerOnboardingState, type ServerOnboardingState } from './onboarding-resume'
import { loadVendorContext, peekVendorContext } from './vendor-context-cache'

const VENDOR_ID = '96'

afterEach(() => {
  invalidateVendorOnboardingState()
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

describe('loadVendorOnboardingState reads only what the resume step needs', () => {
  function contextAtStep(nextStep: number): VendorContext {
    return mapVendorContext({
      data: {
        vendor_id: VENDOR_ID,
        vendor_status: 'SETTING_UP',
        approval_status: 'PENDING',
        onboarding: { status: 'IN_PROGRESS', next_step: nextStep },
      },
    })
  }

  function answerReads(context: VendorContext, businessType: string | null) {
    const spies = {
      getVendorContext: vi.spyOn(vendorOnboardingService, 'getVendorContext').mockResolvedValue(context),
      getVendorProfile: vi.spyOn(vendorOnboardingService, 'getVendorProfile').mockResolvedValue({
        businessName: 'Green Bowl Grocers', businessType, ownerName: '', contactPerson: '', contactNumber: '',
      }),
      getBusinessTypes: vi.spyOn(vendorOnboardingService, 'getBusinessTypes').mockResolvedValue({
        items: [], pageNumber: 0, pageSize: 100, totalElements: 0, totalPages: 0, lastPage: true,
      }),
      getVendorCategories: vi.spyOn(vendorOnboardingService, 'getVendorCategories').mockResolvedValue([]),
      getVendorProducts: vi.spyOn(vendorOnboardingService, 'getVendorProducts').mockResolvedValue([]),
      getVendorSkus: vi.spyOn(vendorOnboardingService, 'getVendorSkus').mockResolvedValue([]),
      getCheckoutOptions: vi.spyOn(vendorOnboardingService, 'getCheckoutOptions').mockResolvedValue(null),
      getMeasurements: vi.spyOn(vendorOnboardingService, 'getMeasurements').mockResolvedValue(SAMPLE_MEASUREMENT_CATALOG),
    }
    return spies
  }

  function calledReads(spies: Record<string, { mock: { calls: unknown[] } }>) {
    return Object.entries(spies).filter(([, spy]) => spy.mock.calls.length > 0).map(([name]) => name)
  }

  it('gives a new vendor on Step 3 their context and profile only', async () => {
    const spies = answerReads(contextAtStep(3), null)

    await loadVendorOnboardingState(VENDOR_ID)

    expect(calledReads(spies)).toEqual(['getVendorContext', 'getVendorProfile'])
  })

  it('reads the business-type catalog only to match a type the vendor already saved', async () => {
    const spies = answerReads(contextAtStep(4), 'Grocery')

    await loadVendorOnboardingState(VENDOR_ID)

    expect(calledReads(spies)).toEqual(['getVendorContext', 'getVendorProfile', 'getBusinessTypes', 'getVendorCategories'])
  })

  it('reads measurements from Step 5 on, and only once per session', async () => {
    const spies = answerReads(contextAtStep(5), 'Grocery')

    const first = await loadVendorOnboardingState(VENDOR_ID)
    // A saved step drops the vendor's snapshot; the platform catalog is not theirs to drop.
    invalidateVendorOnboardingState(VENDOR_ID)
    const second = await loadVendorOnboardingState(VENDOR_ID)

    expect(spies.getMeasurements).toHaveBeenCalledTimes(1)
    expect(spies.getVendorContext).toHaveBeenCalledTimes(2)
    expect(second.productMeasurementCatalog).toBe(first.productMeasurementCatalog)
    expect(peekMeasurementCatalog()).toBe(first.measurements)
  })

  it('reuses a catalog the session already read even on a step that does not ask for it', async () => {
    const catalog = await loadMeasurementCatalog(async () => SAMPLE_MEASUREMENT_CATALOG)
    const spies = answerReads(contextAtStep(3), null)

    const state = await loadVendorOnboardingState(VENDOR_ID)

    expect(spies.getMeasurements).not.toHaveBeenCalled()
    expect(state.productMeasurementCatalog).toBe(catalog)
  })

  it('drops the catalog on sign-out', async () => {
    await loadMeasurementCatalog(async () => SAMPLE_MEASUREMENT_CATALOG)

    invalidateVendorOnboardingState()

    expect(peekMeasurementCatalog()).toBeNull()
  })

  it('reuses resources a previous snapshot already read', async () => {
    const spies = answerReads(contextAtStep(5), 'Grocery')

    await loadServerOnboardingState(VENDOR_ID)
    await loadServerOnboardingState(VENDOR_ID)

    expect(spies.getVendorContext).toHaveBeenCalledTimes(2)
    expect(spies.getVendorProfile).toHaveBeenCalledTimes(1)
    expect(spies.getBusinessTypes).toHaveBeenCalledTimes(1)
    expect(spies.getVendorCategories).toHaveBeenCalledTimes(1)
    expect(spies.getVendorProducts).toHaveBeenCalledTimes(1)
  })

  it('reads the resources again after the vendor’s state is invalidated', async () => {
    const spies = answerReads(contextAtStep(4), 'Grocery')

    await loadVendorOnboardingState(VENDOR_ID)
    invalidateVendorOnboardingState(VENDOR_ID)
    await loadVendorOnboardingState(VENDOR_ID)

    expect(spies.getVendorProfile).toHaveBeenCalledTimes(2)
    expect(spies.getVendorCategories).toHaveBeenCalledTimes(2)
  })

  it('retries a failed resource on the next snapshot, still reading it as empty', async () => {
    const spies = answerReads(contextAtStep(4), 'Grocery')
    spies.getVendorCategories.mockRejectedValueOnce(new Error('offline'))

    const first = await loadServerOnboardingState(VENDOR_ID)
    const second = await loadServerOnboardingState(VENDOR_ID)

    expect(first.categories).toEqual([])
    expect(second.categories).toEqual([])
    expect(spies.getVendorCategories).toHaveBeenCalledTimes(2)
    expect(spies.getVendorProfile).toHaveBeenCalledTimes(1)
  })

  it('skips business types after a failed profile read', async () => {
    const spies = answerReads(contextAtStep(4), 'Grocery')
    spies.getVendorProfile.mockRejectedValueOnce(new Error('offline'))

    const state = await loadServerOnboardingState(VENDOR_ID)

    expect(state.profile).toBeNull()
    expect(spies.getBusinessTypes).not.toHaveBeenCalled()
  })

  it('does not keep a failed catalog read, so the next caller asks again', async () => {
    const read = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(SAMPLE_MEASUREMENT_CATALOG)

    await expect(loadMeasurementCatalog(read)).rejects.toThrow('offline')
    await expect(loadMeasurementCatalog(read)).resolves.toBe(SAMPLE_MEASUREMENT_CATALOG)
    expect(read).toHaveBeenCalledTimes(2)
  })
})

describe('loadVendorOnboardingState remembers the header hint', () => {
  function contextWith(vendorStatus: string, nextStep: number): VendorContext {
    return mapVendorContext({
      data: {
        vendor_id: VENDOR_ID,
        vendor_status: vendorStatus,
        approval_status: 'PENDING',
        onboarding: { status: 'IN_PROGRESS', next_step: nextStep },
      },
    })
  }

  function answerProfile() {
    vi.spyOn(vendorOnboardingService, 'getVendorProfile').mockResolvedValue({
      businessName: 'Green Bowl Grocers', businessType: null, ownerName: '', contactPerson: '', contactNumber: '',
    })
  }

  it('from an accepted read', async () => {
    vi.spyOn(vendorOnboardingService, 'getVendorContext').mockResolvedValue(contextWith('SETTING_UP', 3))
    answerProfile()

    await loadVendorOnboardingState(VENDOR_ID)

    expect(readVendorHeaderHint(VENDOR_ID)).toMatchObject({
      vendorId: VENDOR_ID, vendorStatus: 'SETTING_UP', onboarding: { nextStep: 3 },
    })
  })

  it('not from a read a forced reload replaced, even when it lands last', async () => {
    let resolveOld!: (value: VendorContext) => void
    vi.spyOn(vendorOnboardingService, 'getVendorContext')
      .mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve }))
      .mockResolvedValueOnce(contextWith('SETTING_UP', 3))
    answerProfile()

    const oldRead = loadVendorOnboardingState(VENDOR_ID)
    await loadVendorOnboardingState(VENDOR_ID, { force: true })
    resolveOld(contextWith('INACTIVE', 1))
    await oldRead

    expect(readVendorHeaderHint(VENDOR_ID)).toMatchObject({ vendorStatus: 'SETTING_UP', onboarding: { nextStep: 3 } })
  })

  it('not from a read that a sign-out dropped', async () => {
    let resolveOld!: (value: VendorContext) => void
    vi.spyOn(vendorOnboardingService, 'getVendorContext')
      .mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve }))
    answerProfile()

    const oldRead = loadVendorOnboardingState(VENDOR_ID)
    invalidateVendorOnboardingState()
    resolveOld(contextWith('SETTING_UP', 3))
    await oldRead

    expect(readVendorHeaderHint(VENDOR_ID)).toBeNull()
  })
})

describe('loadVendorOnboardingState shares the vendor context read', () => {
  const context = contextFor(VENDOR_ID)

  /** Every read after the context. The profile read is answered; the rest are not reached at Step 11. */
  function answerRest() {
    vi.spyOn(vendorOnboardingService, 'getVendorProfile').mockResolvedValue({
      businessName: 'Green Bowl Grocers', businessType: null, ownerName: '', contactPerson: '', contactNumber: '',
    })
    vi.spyOn(vendorOnboardingService, 'getVendorCategories').mockResolvedValue([])
    vi.spyOn(vendorOnboardingService, 'getVendorProducts').mockResolvedValue([])
    vi.spyOn(vendorOnboardingService, 'getVendorSkus').mockResolvedValue([])
    vi.spyOn(vendorOnboardingService, 'getCheckoutOptions').mockResolvedValue(null)
    vi.spyOn(vendorOnboardingService, 'getMeasurements').mockResolvedValue(SAMPLE_MEASUREMENT_CATALOG)
  }

  it('makes no context request when the context cache already holds one', async () => {
    answerRest()
    const getContext = vi.spyOn(vendorOnboardingService, 'getVendorContext').mockResolvedValue(context)
    await loadVendorContext(VENDOR_ID, (id) => vendorOnboardingService.getVendorContext(id))
    getContext.mockClear()

    const state = await loadVendorOnboardingState(VENDOR_ID)

    expect(getContext).not.toHaveBeenCalled()
    expect(state.context).toBe(context)
  })

  it('makes no context request after loadVendorAccountContext filed one', async () => {
    answerRest()
    const getContext = vi.spyOn(vendorOnboardingService, 'getVendorContext').mockResolvedValue(context)
    await loadVendorAccountContext(VENDOR_ID)

    await loadVendorOnboardingState(VENDOR_ID)

    expect(getContext).toHaveBeenCalledTimes(1)
  })

  it('shares one request with an account-context load still in flight', async () => {
    answerRest()
    let resolveContext!: (value: VendorContext) => void
    const getContext = vi.spyOn(vendorOnboardingService, 'getVendorContext')
      .mockReturnValue(new Promise((resolve) => { resolveContext = resolve }))

    const accountRead = loadVendorAccountContext(VENDOR_ID)
    const stateRead = loadVendorOnboardingState(VENDOR_ID)
    // Asserted while the read is unsettled: once it lands, a duplicate would be invisible.
    expect(getContext).toHaveBeenCalledTimes(1)

    resolveContext(context)
    await expect(accountRead).resolves.toEqual({ context })
    await expect(stateRead).resolves.toMatchObject({ context })
    expect(getContext).toHaveBeenCalledTimes(1)
  })

  it('shares one request when the onboarding state is asked for first', async () => {
    answerRest()
    let resolveContext!: (value: VendorContext) => void
    const getContext = vi.spyOn(vendorOnboardingService, 'getVendorContext')
      .mockReturnValue(new Promise((resolve) => { resolveContext = resolve }))

    const stateRead = loadVendorOnboardingState(VENDOR_ID)
    const accountRead = loadVendorAccountContext(VENDOR_ID)
    expect(getContext).toHaveBeenCalledTimes(1)

    resolveContext(context)
    await Promise.all([stateRead, accountRead])
    expect(getContext).toHaveBeenCalledTimes(1)
  })

  it('asks again after the vendor’s snapshot is invalidated', async () => {
    answerRest()
    const getContext = vi.spyOn(vendorOnboardingService, 'getVendorContext').mockResolvedValue(context)
    await loadVendorOnboardingState(VENDOR_ID)

    invalidateVendorOnboardingState(VENDOR_ID)
    await loadVendorOnboardingState(VENDOR_ID)

    expect(getContext).toHaveBeenCalledTimes(2)
  })

  it('still rejects the snapshot when the context read fails', async () => {
    answerRest()
    vi.spyOn(vendorOnboardingService, 'getVendorContext').mockRejectedValue(new Error('offline'))

    await expect(loadVendorOnboardingState(VENDOR_ID)).rejects.toThrow('offline')
  })

  it('reads a fresh context when forced, even with one cached', async () => {
    answerRest()
    const getContext = vi.spyOn(vendorOnboardingService, 'getVendorContext').mockResolvedValue(context)
    await loadVendorOnboardingState(VENDOR_ID)

    await loadVendorOnboardingState(VENDOR_ID, { force: true })

    expect(getContext).toHaveBeenCalledTimes(2)
  })

  it('makes no context request when the caller supplies one', async () => {
    answerRest()
    const getContext = vi.spyOn(vendorOnboardingService, 'getVendorContext').mockRejectedValue(new Error('unexpected read'))

    const state = await loadVendorOnboardingState(VENDOR_ID, { context })

    expect(getContext).not.toHaveBeenCalled()
    expect(state.context).toBe(context)
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
    await settled(loadStepResources(VENDOR_ID, 7, { submitted: false, withUnits: true }))
    expect(called(spies)).toEqual(['checkout'])

    invalidateVendorOnboardingState()
    vi.clearAllMocks()
    await settled(loadStepResources(VENDOR_ID, 10, { submitted: true, withUnits: true }))
    expect(called(spies)).toEqual(['profile'])

    invalidateVendorOnboardingState()
    vi.clearAllMocks()
    await settled(loadStepResources(VENDOR_ID, 10, { submitted: false, withUnits: true }))
    expect(called(spies)).toEqual(['profile', 'businessTypes', 'categories', 'products', 'skus', 'checkout', 'units'])
  })

  it('leaves the units out without withUnits', async () => {
    const spies = stubReads()
    const reads = loadStepResources(VENDOR_ID, 6, { submitted: false, withUnits: false })
    await settled(reads)
    expect(reads.units).toBeUndefined()
    expect(spies.units).not.toHaveBeenCalled()
  })

  it('reads business types only after the profile shows a saved type', async () => {
    const spies = stubReads('Others')
    const reads = loadStepResources(VENDOR_ID, 3, { submitted: false, withUnits: true })
    await expect(reads.businessTypes).resolves.toEqual([])
    expect(spies.businessTypes).not.toHaveBeenCalled()

    invalidateVendorOnboardingState()
    let answer!: (profile: VendorProfile) => void
    spies.profile.mockReturnValue(new Promise((resolve) => { answer = resolve }))
    const pending = loadStepResources(VENDOR_ID, 3, { submitted: false, withUnits: true })
    await Promise.resolve()
    expect(spies.businessTypes).not.toHaveBeenCalled()
    answer({ businessName: 'Store', businessType: null, ownerName: '', contactPerson: '', contactNumber: '' })
    await settled(pending)
    expect(spies.businessTypes).not.toHaveBeenCalled()
  })

  it('joins a read in flight, omits a resolved one and honours skip', async () => {
    const spies = stubReads()
    const inFlight = loadOnboardingResource(VENDOR_ID, 'checkout', () => vendorOnboardingService.getCheckoutOptions(VENDOR_ID))
    const reads = loadStepResources(VENDOR_ID, 7, { submitted: false, withUnits: true })
    await settled(reads)
    await inFlight
    expect(spies.checkout).toHaveBeenCalledTimes(1)

    expect(loadStepResources(VENDOR_ID, 7, { submitted: false, withUnits: true })).toEqual({})
    const skipped = loadStepResources(VENDOR_ID, 5, { submitted: false, withUnits: true, skip: ['categories', 'units'] })
    expect(Object.keys(skipped).sort()).toEqual(['businessTypes', 'products', 'profile'])
    await settled(skipped)
  })

  it('settles each resource on its own', async () => {
    const spies = stubReads()
    spies.categories.mockRejectedValue(new Error('down'))
    const reads = loadStepResources(VENDOR_ID, 4, { submitted: false, withUnits: true })
    await expect(reads.categories).rejects.toThrow('down')
    await expect(reads.profile).resolves.toMatchObject({ businessName: 'Store' })
    await expect(reads.businessTypes).resolves.toEqual([])
  })
})
