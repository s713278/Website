import { afterEach, describe, expect, it } from 'vitest'
import type { VendorSkuRef } from '@/shared/api'
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

  it('replaces an account SKU whose price changed, since it cannot be updated in place', () => {
    const plan = planSkuWrites(
      shown([draft({ id: 'sku-4021', productId: 31, salePrice: 140 })]),
      [account({ skuId: 4021 })],
      productIds,
    )
    expect(plan.deletes).toEqual([4021])
    expect(plan.creates).toHaveLength(1)
    expect(plan.creates[0].sku.salePrice).toBe(140)
  })

  it('replaces an account SKU that was renamed, resized or deactivated', () => {
    for (const change of [{ name: 'Fresh Juice' }, { quantity: 2 }, { unit: 'ml' }, { active: false }, { description: 'new' }]) {
      const plan = planSkuWrites(
        shown([draft({ id: 'sku-4021', productId: 31, ...change })]),
        [account({ skuId: 4021 })],
        productIds,
      )
      expect(plan.deletes, JSON.stringify(change)).toEqual([4021])
      expect(plan.creates, JSON.stringify(change)).toHaveLength(1)
    }
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
  // the old `sku-<id>`. `createSku` cannot return the new id — the response is untyped —
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

  it('still replaces when the vendor actually changed something', () => {
    const edited = { ...stale(), salePrice: 140 }
    const plan = planSkuWrites(shown([edited]), [account({ skuId: 4055 })], productIds)

    expect(plan.deletes).toEqual([4055])
    expect(plan.creates).toHaveLength(1)
    expect(plan.creates[0].sku.salePrice).toBe(140)
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
