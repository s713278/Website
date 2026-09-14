import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getHttp, vendorOnboardingService, type VendorSkuRef } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import type { User } from '@/shared/types'
import { createEmptyOnboardingDraft } from '../data/onboarding-defaults'
import { useOnboardingStore } from '../store/onboarding-store'
import type {
  DraftCategory,
  DraftSku,
  SelectedProduct,
  VendorOnboardingDraftV1,
} from '../types/onboarding'
import { PENDING_ID_BASE } from './onboarding-pending-id'
import {
  applyCreatedEntry,
  categoriesToAssign,
  planCatalogCreates,
  planSkuWrites,
  persistProducts,
  persistSkus,
} from './onboarding-sync'

/** platform product id -> vendor product id */
const productIds = new Map([[31, 900], [32, 901]])

function product(id: number): SelectedProduct {
  return { id, name: `Product ${id}`, description: null, imageUrl: null, measurementId: null, measurementName: null, categoryId: 10 }
}

/** The wizard shows product 31 only, unless a test says otherwise. */
const shown = (skus: DraftSku[], products = [product(31)]) => ({ products, skus })

function draft(overrides: Partial<DraftSku> & Pick<DraftSku, 'id' | 'productId'>): DraftSku {
  return {
    name: 'Orange Juice',
    description: 'Cold pressed',
    skuType: 'ITEM',
    measurementType: 'VOLUME',
    unit: 'L',
    quantity: 1,
    listPrice: 180,
    salePrice: 160,
    active: true,
    homeDelivery: true,
    storePickup: true,
    ...overrides,
  }
}

function account(overrides: Partial<VendorSkuRef> & Pick<VendorSkuRef, 'skuId'>): VendorSkuRef {
  return {
    vendorProductId: 900,
    priceId: 8021,
    name: 'Orange Juice-1 L',
    size: '1 L',
    displayName: 'Orange Juice',
    description: 'Cold pressed',
    isActive: true,
    listPrice: 180,
    salePrice: 160,
    quantity: 1,
    unit: 'L',
    ...overrides,
  }
}

describe('planSkuWrites', () => {
  it('creates a locally added SKU', () => {
    const plan = planSkuWrites(shown([draft({ id: 'draft-sku-31-1', productId: 31 })]), [], productIds)
    expect(plan.creates).toHaveLength(1)
    expect(plan.deletes).toEqual([])
  })

  it('leaves an untouched account SKU alone', () => {
    const plan = planSkuWrites(
      shown([draft({ id: 'sku-4021', productId: 31 })]),
      [account({ skuId: 4021 })],
      productIds,
    )
    expect(plan.creates).toEqual([])
    expect(plan.deletes).toEqual([])
  })

  it('deletes an account SKU the vendor removed, even when it was the last one', () => {
    // The whole point: without this the next resume hands the SKU straight back.
    const plan = planSkuWrites(shown([]), [account({ skuId: 4021 })], productIds)
    expect(plan.deletes).toEqual([4021])
    expect(plan.creates).toEqual([])
  })

  it('deletes only the SKU that was removed, keeping its siblings', () => {
    const plan = planSkuWrites(
      shown([draft({ id: 'sku-4021', productId: 31 })]),
      [account({ skuId: 4021 }), account({ skuId: 4022, displayName: 'Orange Juice', quantity: 500, unit: 'ml', size: '500 ml', name: 'Orange Juice-500 ml' })],
      productIds,
    )
    expect(plan.deletes).toEqual([4022])
    expect(plan.creates).toEqual([])
  })

  it('updates a price without replacing the account SKU', () => {
    const plan = planSkuWrites(
      shown([draft({ id: 'sku-4021', productId: 31, salePrice: 140 })]),
      [account({ skuId: 4021 })],
      productIds,
    )
    expect(plan.deletes).toEqual([])
    expect(plan.creates).toEqual([])
    expect(plan.updates).toMatchObject([{ sku: { salePrice: 140 }, existing: { skuId: 4021, priceId: 8021 } }])
  })

  it('updates quantity, unit and availability in place', () => {
    for (const change of [{ quantity: 2 }, { unit: 'ml' }, { active: false }]) {
      const plan = planSkuWrites(
        shown([draft({ id: 'sku-4021', productId: 31, ...change })]),
        [account({ skuId: 4021 })],
        productIds,
      )
      expect(plan.deletes, JSON.stringify(change)).toEqual([])
      expect(plan.creates, JSON.stringify(change)).toEqual([])
      expect(plan.updates, JSON.stringify(change)).toHaveLength(1)
    }
  })

  it('ignores stale product-derived names and descriptions in old drafts', () => {
    const plan = planSkuWrites(
      shown([draft({ id: 'sku-4021', productId: 31, name: 'Old name', description: '' })]),
      [account({ skuId: 4021 })],
      productIds,
    )

    expect(plan).toEqual({ creates: [], updates: [], deletes: [] })
  })

  it('recognises an already-saved local size on a repeated Continue or retry', () => {
    const plan = planSkuWrites(
      shown([draft({ id: 'draft-sku-31-1', productId: 31, name: 'Old name', description: '' })]),
      [account({ skuId: 4021 })],
      productIds,
    )

    expect(plan).toEqual({ creates: [], updates: [], deletes: [] })
  })

  it('refuses to replace an unclaimed saved size with a conflicting new draft', () => {
    expect(() => planSkuWrites(
      shown([draft({ id: 'draft-sku-31-1', productId: 31, salePrice: 99 })]),
      [account({ skuId: 4021 })], productIds,
    )).toThrow(/already saved/)
  })

  it('leaves SKUs of a product the wizard is not showing untouched', () => {
    // A vendor cannot unassign a product, so this is the account holding something the
    // draft does not. Deleting its rows would destroy data nobody asked to lose.
    const plan = planSkuWrites(
      shown([draft({ id: 'sku-4021', productId: 31 })]),
      [account({ skuId: 4021 }), account({ skuId: 5000, vendorProductId: 901 })],
      productIds,
    )
    expect(plan.deletes).toEqual([])
  })

  it('skips a draft SKU that has no prices yet', () => {
    const plan = planSkuWrites(
      shown([draft({ id: 'draft-sku-31-1', productId: 31, listPrice: null, salePrice: null })]),
      [],
      productIds,
    )
    expect(plan.creates).toEqual([])
  })

  it('refuses to write a SKU whose product is not assigned', () => {
    expect(() => planSkuWrites(shown([draft({ id: 'draft-sku-99-1', productId: 99 })], [product(99)]), [], productIds))
      .toThrow(/not in your store yet/)
  })
})

describe('explicit fulfillment edits on a resumed SKU', () => {
  // No SKU read returns home_delivery / store_pickup, so a resume seeds both to true.
  // They were once left out of the fingerprints entirely, which meant a vendor could turn
  // one off, press Continue, be told it saved, and have nothing written.
  const resumed = () => draft({ id: 'sku-4021', productId: 31 })
  const onAccount = [account({ skuId: 4021 })]

  it('writes nothing when the vendor did not touch them', () => {
    const plan = planSkuWrites(shown([resumed()]), onAccount, productIds)

    expect(plan.creates).toEqual([])
    expect(plan.deletes).toEqual([])
  })

  it('replaces the row when home delivery is turned off', () => {
    const edited = { ...resumed(), homeDelivery: false }
    const plan = planSkuWrites(shown([edited]), onAccount, productIds)

    expect(plan.deletes).toEqual([4021])
    expect(plan.creates).toHaveLength(1)
    expect(plan.creates[0].sku.homeDelivery).toBe(false)
  })

  it('replaces the row when store pickup is turned off', () => {
    const edited = { ...resumed(), storePickup: false }
    const plan = planSkuWrites(shown([edited]), onAccount, productIds)

    expect(plan.deletes).toEqual([4021])
    expect(plan.creates).toHaveLength(1)
    expect(plan.creates[0].sku.storePickup).toBe(false)
  })
})

describe('a replaced SKU is recognised despite the stale draft id', () => {
  // An edit is delete-then-create, so the account row gets a new id while the draft keeps
  // the old `sku-<id>`. `createSkus` cannot return the new id — the response is untyped —
  // so reconciliation falls back to the backend's own uniqueness key. Without that, every
  // later Continue deleted the replacement and created another.
  const stale = () => draft({ id: 'sku-4021', productId: 31 })

  it('schedules nothing when only the server id moved', () => {
    const plan = planSkuWrites(shown([stale()]), [account({ skuId: 4055 })], productIds)

    expect(plan.creates).toEqual([])
    expect(plan.deletes).toEqual([])
  })

  it('does not delete the replacement row', () => {
    const plan = planSkuWrites(shown([stale()]), [account({ skuId: 4055 })], productIds)

    expect(plan.deletes).not.toContain(4055)
  })

  it('updates the replacement when the vendor changes its price', () => {
    const edited = { ...stale(), salePrice: 140 }
    const plan = planSkuWrites(shown([edited]), [account({ skuId: 4055 })], productIds)

    expect(plan.deletes).toEqual([])
    expect(plan.creates).toEqual([])
    expect(plan.updates).toMatchObject([{ sku: { salePrice: 140 }, existing: { skuId: 4055 } }])
  })

  it('does not attach two draft rows to the same account row', () => {
    const plan = planSkuWrites(
      shown([stale(), draft({ id: 'draft-sku-31-2', productId: 31 })]),
      [account({ skuId: 4055 })],
      productIds,
    )

    // One keeps the account row; the other is a genuine create, not a second claim on it.
    expect(plan.creates).toHaveLength(1)
    expect(plan.deletes).toEqual([])
  })
})

describe('the identity fallback is limited to rows that were on the account', () => {
  // The fallback exists for a row whose server id moved during a replacement. Letting a
  // brand-new `draft-sku-*` row use it is order-dependent data loss: listed before the
  // resumed row it adopts the account SKU, schedules its deletion, and the resumed row
  // then matches by id and is "kept" — but the delete is already queued, so the vendor's
  // existing SKU is destroyed and never recreated.
  const resumed = () => draft({ id: 'sku-4021', productId: 31 })
  const colliding = () => draft({ id: 'draft-sku-31-9', productId: 31, salePrice: 99 })

  it('keeps the resumed row when a new colliding row is listed first', () => {
    const plan = planSkuWrites(
      shown([colliding(), resumed()]),
      [account({ skuId: 4021 })],
      productIds,
    )

    expect(plan.deletes).toEqual([])
    expect(plan.creates.map((entry) => entry.sku.id)).toEqual(['draft-sku-31-9'])
  })

  it('gives the same answer with the order reversed', () => {
    const plan = planSkuWrites(
      shown([resumed(), colliding()]),
      [account({ skuId: 4021 })],
      productIds,
    )

    expect(plan.deletes).toEqual([])
    expect(plan.creates.map((entry) => entry.sku.id)).toEqual(['draft-sku-31-9'])
  })
})

describe('categoriesToAssign', () => {
  it('keeps only draft categories the account does not already hold', () => {
    expect(categoriesToAssign([10, 11, 12], [11])).toEqual([10, 12])
  })

  it('returns nothing when every draft category is already assigned', () => {
    expect(categoriesToAssign([10, 11], [10, 11, 99])).toEqual([])
  })

  it('assigns everything when the account holds no categories yet', () => {
    expect(categoriesToAssign([10, 11], [])).toEqual([10, 11])
  })

  it('preserves the draft order of the categories it keeps', () => {
    expect(categoriesToAssign([12, 10, 11], [10])).toEqual([12, 11])
  })
})

function pendingCategory(id: number, overrides: Partial<DraftCategory> = {}): DraftCategory {
  return { id, name: 'Authored', businessTypeId: 7, description: null, imageUrl: null, displayOrder: null, pending: true, ...overrides }
}

function sampleCategory(id: number): DraftCategory {
  return { id, name: 'Sample', businessTypeId: 7, description: null, imageUrl: null, displayOrder: null }
}

function pendingProduct(id: number, categoryId: number, overrides: Partial<SelectedProduct> = {}): SelectedProduct {
  return { id, name: 'Authored', description: null, imageUrl: null, measurementId: 3, measurementName: 'Litre', categoryId, pending: true, ...overrides }
}

function draftWith(overrides: Partial<VendorOnboardingDraftV1>): VendorOnboardingDraftV1 {
  return { ...createEmptyOnboardingDraft(), ...overrides }
}

function vendorUser(vendorId: string, vendorIds = [vendorId]): User {
  return {
    id: 'user-1',
    name: 'Vendor',
    email: '',
    role: 'vendor',
    roles: ['vendor'],
    vendors: vendorIds.map((id) => ({ vendorId: id })),
    vendorId,
  }
}

function applyVendorSession(vendorId: string, vendorIds = [vendorId]): void {
  useAuthStore.getState().applySession({
    user: vendorUser(vendorId, vendorIds),
    token: 'test-access-token',
    refreshToken: 'test-refresh-token',
  })
}

describe('persistProducts assignment callbacks', () => {
  const products = [
    { ...product(31), categoryId: 10 },
    { ...product(32), categoryId: 11 },
  ]

  afterEach(() => {
    useAuthStore.getState().clearSession()
    useOnboardingStore.getState().setAccountCatalog({ categoryIds: [], productIds: [] })
  })

  it("does not write the previous vendor's remaining assignment into the next vendor's account catalog", async () => {
    applyVendorSession('vendor-a', ['vendor-a', 'vendor-b'])
    useOnboardingStore.getState().setAccountCatalog({ categoryIds: [], productIds: [] })
    let assignmentBatch = 0

    await persistProducts(
      'vendor-a',
      draftWith({ products }),
      useOnboardingStore.getState().recordAssignment,
      () => undefined,
      {
        getVendorProducts: async () => [],
        assignProducts: async () => {
          assignmentBatch += 1
          if (assignmentBatch !== 2) return
          useAuthStore.getState().selectVendor('vendor-b')
          useOnboardingStore.getState().setAccountCatalog({ categoryIds: [], productIds: [] })
        },
      },
    )

    expect(assignmentBatch).toBe(2)
    expect(useOnboardingStore.getState().accountCatalog.productIds).toEqual([])
  })

  it('records every picked product while the initiating vendor remains active', async () => {
    applyVendorSession('vendor-a')
    useOnboardingStore.getState().setAccountCatalog({ categoryIds: [], productIds: [] })

    await persistProducts(
      'vendor-a',
      draftWith({ products }),
      useOnboardingStore.getState().recordAssignment,
      () => undefined,
      {
        getVendorProducts: async () => [],
        assignProducts: async () => undefined,
      },
    )

    expect(useOnboardingStore.getState().accountCatalog.productIds).toEqual([31, 32])
  })
})

describe('persistSkus reports the account SKU identity', () => {
  beforeEach(() => applyVendorSession('v1'))
  const vendorProduct = {
    vendorProductId: 900,
    platformProductId: 31,
    platformCategoryId: 10,
    name: 'Orange Juice',
    measurementId: null,
  }

  afterEach(() => {
    useAuthStore.getState().clearSession()
    useOnboardingStore.getState().setAccountCatalog({ categoryIds: [], productIds: [], skuIds: [] })
  })

  it('reports the current account SKU set after a create so capacity stays cumulative', async () => {
    // One size already on the account, one new local size added in the draft. After the
    // create, the account holds both — and that is what a later business-type switch must
    // count against, since the create clears the draft but not the account.
    let created = false
    const captured: number[][] = []

    await persistSkus(
      'v1',
      draftWith({
        products: [product(31)],
        skus: [draft({ id: 'sku-4001', productId: 31 }), draft({ id: 'draft-sku-31-1', productId: 31, name: 'Family', quantity: 2 })],
      }),
      (assignment) => {
        if (assignment.skuIds) captured.push(assignment.skuIds)
      },
      {
        getVendorProducts: async () => [vendorProduct],
        getVendorSkus: async () => (created ? [account({ skuId: 4001 }), account({ skuId: 4002, name: 'Orange Juice-2 L', size: '2 L', quantity: 2 })] : [account({ skuId: 4001 })]),
        createSkus: async () => {
          created = true
        },
        deleteSku: async () => undefined,
        updateSku: async () => undefined,
        updateSkuPrice: async () => undefined,
      },
    )

    expect(captured).toEqual([[4001, 4002]])
  })

  it('reports the unchanged set without a second read when nothing was written', async () => {
    let reads = 0
    let reported: number[] | null = null

    await persistSkus(
      'v1',
      draftWith({ products: [product(31)], skus: [draft({ id: 'sku-4001', productId: 31 })] }),
      (assignment) => {
        if (assignment.skuIds) reported = assignment.skuIds
      },
      {
        getVendorProducts: async () => [vendorProduct],
        getVendorSkus: async () => {
          reads += 1
          return [account({ skuId: 4001 })]
        },
        createSkus: async () => undefined,
        deleteSku: async () => undefined,
        updateSku: async () => undefined,
        updateSkuPrice: async () => undefined,
      },
    )

    // The entry read is reused; no extra read is issued when the plan is empty.
    expect(reads).toBe(1)
    expect(reported).toEqual([4001])
  })
})

describe('persistSkus saves', () => {
  beforeEach(() => applyVendorSession('v1'))
  afterEach(() => {
    useAuthStore.getState().clearSession()
    vi.restoreAllMocks()
  })
  function service() {
    return {
      getVendorProducts: vi.fn(async () => [{
        vendorProductId: 900, platformProductId: 31, platformCategoryId: 10,
        name: 'Orange Juice', measurementId: null,
      }]),
      getVendorSkus: vi.fn(async () => [account({ skuId: 4021 })]),
      createSkus: vi.fn(async () => undefined),
      deleteSku: vi.fn(async () => undefined),
      updateSku: vi.fn(async () => undefined),
      updateSkuPrice: vi.fn(async () => undefined),
    }
  }

  it('creates two sizes of one vendor product in one request and binds both saved IDs', async () => {
    const api = { ...service(), createSkus: vendorOnboardingService.createSkus }
    api.getVendorSkus.mockResolvedValueOnce([]).mockResolvedValueOnce([
      account({ skuId: 4022, quantity: 500, unit: 'gr', listPrice: 140, salePrice: 135 }),
      account({ skuId: 4021, quantity: 1, unit: 'kg', listPrice: 220, salePrice: 210 }),
    ])
    const request = vi.spyOn(getHttp(), 'post').mockResolvedValue({ data: { success: true } })
    const assigned = vi.fn()

    await persistSkus('v1', draftWith(shown([
      draft({ id: 'draft-sku-31-1', productId: 31, measurementType: 'WEIGHT', unit: 'kg', quantity: 1, listPrice: 220, salePrice: 210 }),
      draft({ id: 'draft-sku-31-2', productId: 31, measurementType: 'WEIGHT', unit: 'gr', quantity: 500, listPrice: 140, salePrice: 135 }),
    ])), assigned, api)

    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledWith('/v1/vendors/v1/skus', {
      product_id: 900, sku_type: 'ITEM', is_active: true,
      home_delivery: true, store_pickup: true,
      subscription_eligible: false, eligible_sub_plans: [],
      price_list: [
        { measurement_type: 'WEIGHT', unit: 'kg', quantity_value: 1, list_price: 220, sale_price: 210, shipping_price: 0, effective_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
        { measurement_type: 'WEIGHT', unit: 'gr', quantity_value: 500, list_price: 140, sale_price: 135, shipping_price: 0, effective_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
      ],
    }, expect.anything())
    expect(assigned).toHaveBeenCalledWith({
      skuIds: [4022, 4021], skuIdByDraftId: { 'draft-sku-31-1': 4021, 'draft-sku-31-2': 4022 },
    })
  })

  it('groups nonadjacent new sizes by vendor product and leaves saved sizes out of the POST', async () => {
    const api = { ...service(), createSkus: vendorOnboardingService.createSkus }
    api.getVendorProducts.mockResolvedValue([
      { vendorProductId: 900, platformProductId: 31, platformCategoryId: 10, name: 'Orange Juice', measurementId: null },
      { vendorProductId: 901, platformProductId: 32, platformCategoryId: 10, name: 'Milk', measurementId: null },
    ])
    const saved = [account({ skuId: 4021 }), account({ skuId: 4022, quantity: 2 }),
      account({ skuId: 4023, vendorProductId: 901 }), account({ skuId: 4024, quantity: 3 })]
    api.getVendorSkus.mockResolvedValueOnce([saved[0]]).mockResolvedValue(saved)
    const request = vi.spyOn(getHttp(), 'post').mockResolvedValue({ data: { success: true } })
    const edited = draftWith(shown([
      draft({ id: 'sku-4021', productId: 31 }),
      draft({ id: 'draft-sku-31-2', productId: 31, quantity: 2 }),
      draft({ id: 'draft-sku-32-1', productId: 32 }),
      draft({ id: 'draft-sku-31-3', productId: 31, quantity: 3 }),
    ], [product(31), product(32)]))

    await persistSkus('v1', edited, () => undefined, api)

    expect(request.mock.calls.map(([, body]) => body)).toEqual([
      expect.objectContaining({ product_id: 900, price_list: [
        expect.objectContaining({ quantity_value: 2 }), expect.objectContaining({ quantity_value: 3 }),
      ] }),
      expect.objectContaining({ product_id: 901, price_list: [expect.objectContaining({ quantity_value: 1 })] }),
    ])
    // A retry with the original local IDs must recognise every size the batches saved.
    await persistSkus('v1', edited, () => undefined, api)
    expect(request).toHaveBeenCalledTimes(2)
    expect(api.updateSku).not.toHaveBeenCalled()
    expect(api.updateSkuPrice).not.toHaveBeenCalled()
    expect(api.deleteSku).not.toHaveBeenCalled()
  })

  it.each([
    { field: 'availability', changed: { active: false }, flags: { is_active: false, home_delivery: true, store_pickup: true } },
    { field: 'delivery', changed: { homeDelivery: false }, flags: { is_active: true, home_delivery: false, store_pickup: true } },
    { field: 'pickup', changed: { storePickup: false }, flags: { is_active: true, home_delivery: true, store_pickup: false } },
  ])('keeps different $field settings in separate requests for the same product', async ({ changed, flags }) => {
    const api = { ...service(), createSkus: vendorOnboardingService.createSkus }
    api.getVendorSkus.mockResolvedValueOnce([]).mockResolvedValueOnce([
      account({ skuId: 4021 }), account({ skuId: 4022, quantity: 2, isActive: changed.active ?? true }),
      account({ skuId: 4023, quantity: 3 }),
    ])
    const request = vi.spyOn(getHttp(), 'post').mockResolvedValue({ data: { success: true } })

    await persistSkus('v1', draftWith(shown([
      draft({ id: 'draft-sku-31-1', productId: 31 }),
      draft({ id: 'draft-sku-31-2', productId: 31, quantity: 2, ...changed }),
      draft({ id: 'draft-sku-31-3', productId: 31, quantity: 3 }),
    ])), () => undefined, api)

    expect(request.mock.calls.map(([, body]) => body)).toEqual([
      expect.objectContaining({ product_id: 900, is_active: true, home_delivery: true, store_pickup: true, price_list: [
        expect.objectContaining({ quantity_value: 1 }), expect.objectContaining({ quantity_value: 3 }),
      ] }),
      expect.objectContaining({ product_id: 900, ...flags, price_list: [expect.objectContaining({ quantity_value: 2 })] }),
    ])
  })

  it('retries only missing sizes after a batch saves one size then fails', async () => {
    const api = { ...service(), createSkus: vendorOnboardingService.createSkus }
    api.getVendorSkus.mockResolvedValueOnce([])
      .mockResolvedValueOnce([account({ skuId: 4021 })])
      .mockResolvedValueOnce([account({ skuId: 4021 }), account({ skuId: 4022, quantity: 0.5 })])
    const request = vi.spyOn(getHttp(), 'post')
      .mockRejectedValueOnce(new Error('Batch failed'))
      .mockResolvedValueOnce({ data: { success: true } })
    const edited = draftWith(shown([
      draft({ id: 'draft-sku-31-1', productId: 31 }),
      draft({ id: 'draft-sku-31-2', productId: 31, quantity: 0.5 }),
    ]))
    const assigned = vi.fn()

    await expect(persistSkus('v1', edited, assigned, api)).rejects.toThrow('Batch failed')
    expect(assigned).not.toHaveBeenCalled()
    await persistSkus('v1', edited, assigned, api)

    expect(request.mock.calls.map(([, body]) => body)).toEqual([
      expect.objectContaining({ price_list: [expect.objectContaining({ quantity_value: 1 }), expect.objectContaining({ quantity_value: 0.5 })] }),
      expect.objectContaining({ price_list: [expect.objectContaining({ quantity_value: 0.5 })] }),
    ])
    expect(assigned).toHaveBeenCalledWith({
      skuIds: [4021, 4022], skuIdByDraftId: { 'draft-sku-31-1': 4021, 'draft-sku-31-2': 4022 },
    })
    expect(api.deleteSku).not.toHaveBeenCalled()
  })

  it('stops before the next batch when the active vendor changes during a create', async () => {
    const api = service()
    api.getVendorSkus.mockResolvedValue([])
    api.createSkus.mockImplementation(async () => { applyVendorSession('v2') })
    const assigned = vi.fn()

    await expect(persistSkus('v1', draftWith(shown([
      draft({ id: 'draft-sku-31-1', productId: 31 }),
      draft({ id: 'draft-sku-31-2', productId: 31, quantity: 2, active: false }),
    ])), assigned, api)).rejects.toThrow(/active store changed/)

    expect(api.createSkus).toHaveBeenCalledTimes(1)
    expect(api.getVendorSkus).toHaveBeenCalledTimes(1)
    expect(assigned).not.toHaveBeenCalled()
  })

  it('keeps the save incomplete if a successful batch response did not create every size', async () => {
    const api = service()
    api.getVendorSkus.mockResolvedValueOnce([]).mockResolvedValue([account({ skuId: 4021 })])
    const assigned = vi.fn()

    await expect(persistSkus('v1', draftWith(shown([
      draft({ id: 'draft-sku-31-1', productId: 31 }),
      draft({ id: 'draft-sku-31-2', productId: 31, quantity: 2 }),
    ])), assigned, api)).rejects.toThrow(/confirm.*size/i)
    expect(api.createSkus).toHaveBeenCalledTimes(1)
    expect(assigned).toHaveBeenCalledWith({ skuIds: [4021], skuIdByDraftId: { 'draft-sku-31-1': 4021 } })
  })

  it('sends only a price update when only the price changed', async () => {
    const api = service()
    await persistSkus('v1', draftWith(shown([draft({ id: 'sku-4021', productId: 31, salePrice: 140 })])), () => undefined, api)

    expect(api.updateSkuPrice).toHaveBeenCalledWith(4021, 8021, { listPrice: 180, salePrice: 140 })
    expect(api.updateSku).not.toHaveBeenCalled()
    expect(api.deleteSku).not.toHaveBeenCalled()
    expect(api.createSkus).not.toHaveBeenCalled()
  })

  it('updates size and availability together without touching price or subscriptions', async () => {
    const api = service()
    await persistSkus('v1', draftWith(shown([draft({ id: 'sku-4021', productId: 31, quantity: 0.5, active: false })])), () => undefined, api)

    expect(api.updateSku).toHaveBeenCalledWith('v1', 4021, { quantity: 0.5, unit: 'L', active: false })
    expect(api.updateSkuPrice).not.toHaveBeenCalled()
    expect(api.deleteSku).not.toHaveBeenCalled()
    expect(api.createSkus).not.toHaveBeenCalled()
  })

  it('keeps the SKU and reports an update failure instead of falling back to replacement', async () => {
    const api = service()
    api.updateSku.mockRejectedValue(new Error('Update failed'))
    const assigned = vi.fn()

    await expect(persistSkus('v1', draftWith(shown([draft({ id: 'sku-4021', productId: 31, quantity: 2 })])), assigned, api))
      .rejects.toThrow('Update failed')
    expect(api.deleteSku).not.toHaveBeenCalled()
    expect(api.createSkus).not.toHaveBeenCalled()
    expect(assigned).not.toHaveBeenCalled()
  })

  it('retries only the failed price write after a size update succeeds', async () => {
    const api = service()
    const edited = draftWith(shown([draft({ id: 'sku-4021', productId: 31, quantity: 2, salePrice: 140 })]))
    api.updateSkuPrice.mockRejectedValueOnce(new Error('Price update failed'))
    await expect(persistSkus('v1', edited, () => undefined, api)).rejects.toThrow('Price update failed')

    api.getVendorSkus.mockResolvedValue([account({ skuId: 4021, quantity: 2 })])
    await persistSkus('v1', edited, () => undefined, api)
    expect(api.updateSku).toHaveBeenCalledTimes(1)
    expect(api.updateSkuPrice).toHaveBeenCalledTimes(2)
    expect(api.createSkus).not.toHaveBeenCalled()
    expect(api.deleteSku).not.toHaveBeenCalled()
  })

  it('reports newly saved IDs so the next edit can update the same SKU', async () => {
    const api = service()
    api.getVendorSkus.mockResolvedValueOnce([]).mockResolvedValueOnce([account({ skuId: 4021 })])
    const assigned = vi.fn()
    await persistSkus('v1', draftWith(shown([draft({ id: 'draft-sku-31-1', productId: 31 })])), assigned, api)

    expect(assigned).toHaveBeenCalledWith({ skuIds: [4021], skuIdByDraftId: { 'draft-sku-31-1': 4021 } })
  })

  it('reuses a successfully created legacy size after a later create fails', async () => {
    const api = service()
    api.getVendorSkus.mockResolvedValueOnce([])
    api.createSkus.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Second create failed'))
    const edited = draftWith(shown([
      draft({ id: 'draft-sku-31-1', productId: 31, homeDelivery: false }),
      draft({ id: 'draft-sku-31-2', productId: 31, quantity: 2 }),
    ]))
    await expect(persistSkus('v1', edited, () => undefined, api)).rejects.toThrow('Second create failed')

    api.getVendorSkus.mockResolvedValueOnce([account({ skuId: 4021 })])
      .mockResolvedValueOnce([account({ skuId: 4021 }), account({ skuId: 4022, quantity: 2 })])
    await persistSkus('v1', edited, () => undefined, api)
    expect(api.createSkus).toHaveBeenCalledTimes(3)
    expect(api.deleteSku).not.toHaveBeenCalled()
  })

  it('stops pending saves and ID binding after the active vendor changes', async () => {
    const api = service()
    let finishRead!: (rows: VendorSkuRef[]) => void
    api.getVendorSkus.mockReturnValueOnce(new Promise((resolve) => { finishRead = resolve }))
    const assigned = vi.fn()
    const save = persistSkus('v1', draftWith(shown([draft({ id: 'sku-4021', productId: 31, salePrice: 140 })])), assigned, api)

    applyVendorSession('v2')
    finishRead([account({ skuId: 4021 })])
    await expect(save).rejects.toThrow(/active store changed/)
    expect(api.updateSkuPrice).not.toHaveBeenCalled()
    expect(assigned).not.toHaveBeenCalled()
  })

  it('stops the price write if the vendor changes while the size PATCH is pending', async () => {
    const api = service()
    api.updateSku.mockImplementation(async () => { applyVendorSession('v2') })
    const assigned = vi.fn()
    await expect(persistSkus('v1', draftWith(shown([draft({ id: 'sku-4021', productId: 31, quantity: 2, salePrice: 140 })])), assigned, api))
      .rejects.toThrow(/active store changed/)
    expect(api.updateSkuPrice).not.toHaveBeenCalled()
    expect(assigned).not.toHaveBeenCalled()
  })

  it('refuses repricing without a price record before performing other writes', async () => {
    const api = service()
    api.getVendorSkus.mockResolvedValue([account({ skuId: 4021, priceId: null }), account({ skuId: 4022, quantity: 2 })])

    await expect(persistSkus('v1', draftWith(shown([draft({ id: 'sku-4021', productId: 31, salePrice: 140 })])), () => undefined, api))
      .rejects.toThrow(/price record/i)
    expect(api.deleteSku).not.toHaveBeenCalled()
    expect(api.createSkus).not.toHaveBeenCalled()
    expect(api.updateSkuPrice).not.toHaveBeenCalled()
  })
})

describe('planCatalogCreates', () => {
  it('returns the pending categories on step 4 in an account draft', () => {
    const draft = draftWith({ categories: [pendingCategory(PENDING_ID_BASE), sampleCategory(-101)] })
    const plan = planCatalogCreates(draft, 4)
    expect(plan.categories.map((c) => c.id)).toEqual([PENDING_ID_BASE])
    expect(plan.products).toEqual([])
  })

  it('mints nothing on step 4 for a sample draft — its negative ids were never authored here', () => {
    const draft = draftWith({ catalogSource: 'sample', categories: [sampleCategory(-101), sampleCategory(-102)] })
    expect(planCatalogCreates(draft, 4).categories).toEqual([])
  })

  it('returns the pending products on step 5 in an account draft', () => {
    const draft = draftWith({
      categories: [pendingCategory(5001 as unknown as number)],
      products: [pendingProduct(PENDING_ID_BASE - 1, 5001), { ...pendingProduct(-201, 5001), pending: undefined } as SelectedProduct],
    })
    const plan = planCatalogCreates(draft, 5)
    expect(plan.products.map((p) => p.id)).toEqual([PENDING_ID_BASE - 1])
    expect(plan.categories).toEqual([])
  })

  it('mints nothing on step 5 for a sample draft', () => {
    const draft = draftWith({
      catalogSource: 'sample',
      products: [{ ...pendingProduct(-201, -101), pending: undefined } as SelectedProduct],
    })
    expect(planCatalogCreates(draft, 5).products).toEqual([])
  })

  it('mints nothing on a step that authors neither', () => {
    const draft = draftWith({
      categories: [pendingCategory(PENDING_ID_BASE)],
      products: [pendingProduct(PENDING_ID_BASE - 1, PENDING_ID_BASE)],
    })
    expect(planCatalogCreates(draft, 6)).toEqual({ categories: [], products: [] })
  })
})

describe('applyCreatedEntry', () => {
  it('swaps a category pending id for the platform id, drops pending, and follows its products', () => {
    const draft = draftWith({
      categories: [pendingCategory(PENDING_ID_BASE)],
      products: [pendingProduct(PENDING_ID_BASE - 1, PENDING_ID_BASE)],
    })
    const next = applyCreatedEntry(draft, { kind: 'category', pendingId: PENDING_ID_BASE, platformId: 5001 })
    expect(next.categories[0].id).toBe(5001)
    expect(next.categories[0].pending).toBeUndefined()
    // The product that pointed at the pending category now points at the platform id.
    expect(next.products[0].categoryId).toBe(5001)
    // Still pending itself — only its parent was created.
    expect(next.products[0].pending).toBe(true)
  })

  it('swaps a product pending id for the platform id, drops pending, and follows its SKUs', () => {
    const draft = draftWith({
      products: [pendingProduct(PENDING_ID_BASE, 5001)],
      skus: [{ id: 'draft-sku-1', productId: PENDING_ID_BASE, name: 'A', description: '', skuType: 'ITEM', measurementType: 'VOLUME', unit: 'L', quantity: 1, listPrice: 1, salePrice: 1, active: true, homeDelivery: true, storePickup: true }],
    })
    const next = applyCreatedEntry(draft, { kind: 'product', pendingId: PENDING_ID_BASE, platformId: 6001 })
    expect(next.products[0].id).toBe(6001)
    expect(next.products[0].pending).toBeUndefined()
    expect(next.skus[0].productId).toBe(6001)
  })

  it('leaves entries that do not match untouched', () => {
    const draft = draftWith({ categories: [pendingCategory(PENDING_ID_BASE), pendingCategory(PENDING_ID_BASE - 1)] })
    const next = applyCreatedEntry(draft, { kind: 'category', pendingId: PENDING_ID_BASE, platformId: 5001 })
    expect(next.categories.map((c) => c.id)).toEqual([5001, PENDING_ID_BASE - 1])
    expect(next.categories[1].pending).toBe(true)
  })
})
