import { describe, expect, it } from 'vitest'
import type { VendorSkuRef } from '@/shared/api'
import type { DraftSku, SelectedProduct } from '../types/onboarding'
import { planSkuWrites } from './onboarding-sync'

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
