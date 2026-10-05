import { afterEach, describe, expect, it, vi } from 'vitest'
import { mapVendorContext, vendorOnboardingService, type VendorContext } from '@/shared/api'
import { clearVendorHeaderHint, readVendorHeaderHint } from '../store/vendor-header-hint-store'
import { SAMPLE_MEASUREMENT_CATALOG } from '../data/onboarding-measurement-sample'
import { loadMeasurementCatalog, peekMeasurementCatalog } from './measurement-catalog-cache'
import { loadVendorAccountContext, loadVendorOnboardingState } from './onboarding-server-state'
import { invalidateVendorOnboardingState, writeEntry } from './onboarding-state-cache'
import type { ServerOnboardingState } from './onboarding-resume'
import { peekVendorContext } from './vendor-context-cache'

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
