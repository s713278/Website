import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyOnboardingDraft } from '../data/onboarding-defaults'
import type {
  DraftCategory,
  OnboardingRuntimeState,
  SelectedProduct,
  VendorOnboardingDraftV1,
} from '../types/onboarding'
import { PENDING_ID_BASE } from './onboarding-pending-id'
import { applyCreatedEntry, type CreatedCatalogEntry } from './onboarding-sync'

/**
 * The write machinery for authored catalog entries. These prove the one ordering the whole
 * feature turns on: a create's returned id is recorded into the draft BEFORE the assign that
 * follows, so a create-then-failed-assign leaves one entry a retry adopts, never a duplicate.
 */

const service = vi.hoisted(() => ({
  createCategory: vi.fn(),
  createProduct: vi.fn(),
  getCategories: vi.fn(),
  getVendorCategories: vi.fn(),
  saveCategories: vi.fn(),
  getVendorProducts: vi.fn(),
  assignProducts: vi.fn(),
}))

vi.mock('@/shared/api', () => ({
  isLiveApi: () => true,
  getErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  isApiError: (error: unknown): error is { status: number } =>
    typeof error === 'object' && error !== null && 'status' in error,
  vendorProductIdByPlatformId: () => new Map(),
  vendorOnboardingService: service,
}))

// Imported after the mock is registered so it binds to the mocked service.
const { persistStep } = await import('./onboarding-sync')

const runtime = {} as OnboardingRuntimeState

function pendingCategory(id: number, overrides: Partial<DraftCategory> = {}): DraftCategory {
  return { id, name: 'Bakery', businessTypeId: 7, description: 'Fresh', imageUrl: null, displayOrder: null, pending: true, ...overrides }
}

function pendingProduct(id: number, categoryId: number, overrides: Partial<SelectedProduct> = {}): SelectedProduct {
  return { id, name: 'Sourdough', description: null, imageUrl: null, measurementId: 3, measurementName: 'Loaf', categoryId, pending: true, ...overrides }
}

/**
 * A tiny stand-in for the store: `recordCreatedEntry` applies the same pure remap the real
 * store does, so a retry reads the draft as the store would have left it.
 */
function fakeStore(initial: VendorOnboardingDraftV1) {
  let draft = initial
  return {
    get draft() {
      return draft
    },
    record(entry: CreatedCatalogEntry) {
      draft = applyCreatedEntry(draft, entry)
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('persistStep step 4 — authoring categories', () => {
  it('records the created id before assigning', async () => {
    const order: string[] = []
    service.createCategory.mockImplementation(async () => {
      order.push('create')
      return 5001
    })
    service.getVendorCategories.mockResolvedValue([])
    service.saveCategories.mockImplementation(async () => {
      order.push('assign')
    })
    const store = fakeStore({
      ...createEmptyOnboardingDraft(),
      categories: [pendingCategory(PENDING_ID_BASE)],
    })

    await persistStep(4, 'v1', store.draft, runtime, () => {}, (entry) => {
      order.push('record')
      store.record(entry)
    })

    expect(service.createCategory).toHaveBeenCalledWith({ businessTypeId: 7, name: 'Bakery', description: 'Fresh' })
    // The ordering the feature turns on: recorded before it is assigned.
    expect(order).toEqual(['create', 'record', 'assign'])
    expect(service.saveCategories).toHaveBeenCalledWith('v1', [5001])
    expect(store.draft.categories[0]).toMatchObject({ id: 5001 })
    expect(store.draft.categories[0].pending).toBeUndefined()
  })

  it('a create that lands then a failed assign leaves one entry and never re-mints on retry', async () => {
    service.createCategory.mockResolvedValue(5001)
    service.getVendorCategories.mockResolvedValue([])
    service.saveCategories.mockRejectedValueOnce(new Error('assign failed'))
    const store = fakeStore({
      ...createEmptyOnboardingDraft(),
      categories: [pendingCategory(PENDING_ID_BASE)],
    })
    const record = (entry: CreatedCatalogEntry) => store.record(entry)

    // First Continue: create succeeds, assign fails.
    await expect(persistStep(4, 'v1', store.draft, runtime, () => {}, record)).rejects.toThrow('assign failed')
    expect(service.createCategory).toHaveBeenCalledTimes(1)
    expect(store.draft.categories).toHaveLength(1)
    expect(store.draft.categories[0].id).toBe(5001)
    expect(store.draft.categories[0].pending).toBeUndefined()

    // Retry: the entry is no longer pending, so it is assigned — never minted a second time.
    service.saveCategories.mockResolvedValue(undefined)
    await persistStep(4, 'v1', store.draft, runtime, () => {}, record)
    expect(service.createCategory).toHaveBeenCalledTimes(1)
    expect(store.draft.categories).toHaveLength(1)
    expect(service.saveCategories).toHaveBeenLastCalledWith('v1', [5001])
  })

  it('recovers from a 409 by adopting the existing platform category', async () => {
    service.createCategory.mockRejectedValue({ status: 409 })
    service.getCategories.mockResolvedValue({ items: [{ id: 7777, name: 'Bakery' }] })
    service.getVendorCategories.mockResolvedValue([])
    service.saveCategories.mockResolvedValue(undefined)
    const store = fakeStore({
      ...createEmptyOnboardingDraft(),
      categories: [pendingCategory(PENDING_ID_BASE)],
    })

    await persistStep(4, 'v1', store.draft, runtime, () => {}, (entry) => store.record(entry))

    expect(service.getCategories).toHaveBeenCalledWith({ business_type_id: 7, pageSize: 200 })
    expect(store.draft.categories[0].id).toBe(7777)
    expect(service.saveCategories).toHaveBeenCalledWith('v1', [7777])
  })

  it('propagates a 409 that resolves to no existing category', async () => {
    service.createCategory.mockRejectedValue({ status: 409 })
    service.getCategories.mockResolvedValue({ items: [] })
    const store = fakeStore({
      ...createEmptyOnboardingDraft(),
      categories: [pendingCategory(PENDING_ID_BASE)],
    })

    await expect(
      persistStep(4, 'v1', store.draft, runtime, () => {}, (entry) => store.record(entry)),
    ).rejects.toBeTruthy()
    expect(service.saveCategories).not.toHaveBeenCalled()
  })
})

describe('persistStep step 5 — authoring products', () => {
  it('creates a pending product under its platform category and assigns the returned id', async () => {
    service.createProduct.mockResolvedValue(6001)
    service.getVendorProducts.mockResolvedValue([])
    service.assignProducts.mockResolvedValue(undefined)
    const store = fakeStore({
      ...createEmptyOnboardingDraft(),
      products: [pendingProduct(PENDING_ID_BASE, 5001)],
    })

    await persistStep(5, 'v1', store.draft, runtime, () => {}, (entry) => store.record(entry))

    expect(service.createProduct).toHaveBeenCalledWith(5001, { name: 'Sourdough', measurementUnitId: 3, description: null })
    expect(store.draft.products[0].id).toBe(6001)
    expect(store.draft.products[0].pending).toBeUndefined()
    expect(service.assignProducts).toHaveBeenCalledWith('v1', 5001, [6001])
  })

  it('refuses a pending product with no measurement unit rather than sending a bad create', async () => {
    const store = fakeStore({
      ...createEmptyOnboardingDraft(),
      products: [pendingProduct(PENDING_ID_BASE, 5001, { measurementId: null })],
    })

    await expect(
      persistStep(5, 'v1', store.draft, runtime, () => {}, (entry) => store.record(entry)),
    ).rejects.toThrow(/measurement unit/)
    expect(service.createProduct).not.toHaveBeenCalled()
  })
})
