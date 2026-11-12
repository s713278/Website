import { describe, expect, it } from 'vitest'
import { createEmptyOnboardingDraft } from '../data/onboarding-defaults'
import type { DraftCategory, DraftSku, SelectedProduct, VendorOnboardingDraftV1 } from '../types/onboarding'
import {
  DRAFT_FIELDS,
  editedStepsOf,
  mergeAccountFields,
  mergeTabDraft,
  pruneOrphans,
  RESOURCE_FIELDS,
  stepFields,
  trackEdits,
  withSavedValues,
  withUnknownEdits,
  type FieldEdits,
} from './onboarding-draft-merge'

const empty = createEmptyOnboardingDraft()
const draftWith = (patch: Partial<VendorOnboardingDraftV1>): VendorOnboardingDraftV1 => ({ ...empty, ...patch })
const withDelivery = (patch: Partial<VendorOnboardingDraftV1['delivery']>) => draftWith({ delivery: { ...empty.delivery, ...patch } })
const withStorefront = (patch: Partial<VendorOnboardingDraftV1['storefront']>) => draftWith({ storefront: { ...empty.storefront, ...patch } })
const shipping = (charge: number) => ({ charge, freeDeliveryThreshold: 0 })

const category = (id: number, name = `Category ${id}`): DraftCategory => ({
  id, name, businessTypeId: 7, description: null, imageUrl: null, displayOrder: null,
})
const product = (id: number, categoryId: number): SelectedProduct => ({
  id, categoryId, name: `Product ${id}`, description: null, imageUrl: null, measurementId: null, measurementName: null,
})
const size = (id: string, productId: number, salePrice = 90): DraftSku => ({
  id, productId, name: '', description: '', skuType: 'ITEM', measurementType: 'COUNT', unit: 'pc',
  quantity: 1, listPrice: 100, salePrice, active: true, homeDelivery: true, storePickup: true,
})

function merge(local: VendorOnboardingDraftV1, account: VendorOnboardingDraftV1, fields: readonly (typeof DRAFT_FIELDS)[number][], edits: FieldEdits, options: { submitted?: boolean; accountEmpty?: boolean } = {}) {
  return mergeAccountFields({ local, account, fields, edits, submitted: options.submitted ?? false, accountEmpty: options.accountEmpty })
}

describe('the fields a draft tracks', () => {
  it('never include a private payment or contact value', () => {
    expect(DRAFT_FIELDS.some((field) => /payment(?!s$)|whatsapp|phone/i.test(field))).toBe(false)
    expect(DRAFT_FIELDS).toContain('payments')
  })

  it('lists what each account read can tell, Step 9 only in part before approval', () => {
    expect(RESOURCE_FIELDS.profile).toEqual(['businessName', 'storefront.storeName'])
    expect(RESOURCE_FIELDS.storefront).toEqual(stepFields(9))
    expect(RESOURCE_FIELDS.checkout).toEqual([...stepFields(7), 'payments'])
  })
})

describe('merging an account read with unsaved fields', () => {
  it('takes the account value for a field with no unsaved edit', () => {
    const result = merge(withDelivery({ shipping: shipping(45) }), withDelivery({ shipping: shipping(30) }), ['delivery.shipping'], {})
    expect(result.draft.delivery.shipping).toEqual(shipping(30))
    expect(result.edits).toEqual({})
  })

  it('keeps an edit while the account still holds the value it started from', () => {
    const edits = { 'delivery.shipping': { at: 5, saved: shipping(30) } }
    const result = merge(withDelivery({ shipping: shipping(45) }), withDelivery({ shipping: shipping(30) }), ['delivery.shipping'], edits)
    expect(result.draft.delivery.shipping).toEqual(shipping(45))
    expect(result.edits).toEqual(edits)
  })

  it('lets the account win once it has moved past the value the edit started from', () => {
    const result = merge(withDelivery({ shipping: shipping(45) }), withDelivery({ shipping: shipping(30) }), ['delivery.shipping'],
      { 'delivery.shipping': { at: 5, saved: shipping(20) } })
    expect(result.draft.delivery.shipping).toEqual(shipping(30))
    expect(result.edits).toEqual({})
  })

  it('judges each field alone, keeping non-conflicting edits', () => {
    const local = withDelivery({ shipping: shipping(45), fulfillmentType: 'BOTH', consentTitle: 'Mine' })
    const account = withDelivery({ shipping: shipping(30), fulfillmentType: 'HOME_DELIVERY', consentTitle: 'Theirs' })
    const result = merge(local, account, RESOURCE_FIELDS.checkout, {
      'delivery.shipping': { at: 1, saved: shipping(30) },
      'delivery.fulfillmentType': { at: 1, saved: 'STORE_PICKUP' },
    })
    expect(result.draft.delivery).toMatchObject({ shipping: shipping(45), fulfillmentType: 'HOME_DELIVERY', consentTitle: 'Theirs' })
    expect(Object.keys(result.edits)).toEqual(['delivery.shipping'])
  })

  it('compares saved values whatever their key order', () => {
    const result = merge(withDelivery({ shipping: shipping(45) }), withDelivery({ shipping: shipping(30) }), ['delivery.shipping'],
      { 'delivery.shipping': { at: 1, saved: { freeDeliveryThreshold: 0, charge: 30 } } })
    expect(result.draft.delivery.shipping).toEqual(shipping(45))
  })

  it('drops an edit that the account has since saved itself', () => {
    const result = merge(withDelivery({ shipping: shipping(45) }), withDelivery({ shipping: shipping(45) }), ['delivery.shipping'],
      { 'delivery.shipping': { at: 1, saved: shipping(30) } })
    expect(result.edits).toEqual({})
  })

  it('lets the account win everything once the store is submitted', () => {
    const result = merge(withDelivery({ shipping: shipping(45) }), withDelivery({ shipping: shipping(30) }), ['delivery.shipping'],
      { 'delivery.shipping': { at: 1, saved: shipping(30) } }, { submitted: true })
    expect(result.draft.delivery.shipping).toEqual(shipping(30))
    expect(result.edits).toEqual({})
  })

  it('leaves fields the read cannot tell untouched', () => {
    const local = withStorefront({ storeName: 'Old name', tagline: 'Mine' })
    const account = withStorefront({ storeName: 'Saved name', tagline: 'Mine' })
    const edits = { 'storefront.tagline': { at: 1, saved: '' } }
    const result = merge(local, account, RESOURCE_FIELDS.profile, edits)
    expect(result.draft.storefront).toMatchObject({ storeName: 'Saved name', tagline: 'Mine' })
    expect(result.edits).toEqual(edits)
  })

  describe('an old-format edit, with no saved value recorded', () => {
    it('loses to a value the account holds', () => {
      const result = merge(withDelivery({ shipping: shipping(45) }), withDelivery({ shipping: shipping(30) }), ['delivery.shipping'], { 'delivery.shipping': { at: 0 } })
      expect(result.draft.delivery.shipping).toEqual(shipping(30))
      expect(result.edits).toEqual({})
    })

    it('fills a field the account holds nothing for, and is then measured against it', () => {
      const result = merge(withStorefront({ storeName: 'Mine' }), withStorefront({ storeName: '' }), ['storefront.storeName'], { 'storefront.storeName': { at: 0 } })
      expect(result.draft.storefront.storeName).toBe('Mine')
      expect(result.edits).toEqual({ 'storefront.storeName': { at: 0, saved: '' } })
    })

    it('fills a section the account has not saved at all', () => {
      const result = merge(withDelivery({ shipping: shipping(45) }), withDelivery({ shipping: shipping(0) }), ['delivery.shipping'],
        { 'delivery.shipping': { at: 0 } }, { accountEmpty: true })
      expect(result.draft.delivery.shipping).toEqual(shipping(45))
    })
  })
})

describe('merging lists entry by entry', () => {
  it('keeps the account’s categories and products, and local additions', () => {
    const local = draftWith({ categories: [category(10), category(11)] })
    const account = draftWith({ categories: [category(10), category(12)] })
    const result = merge(local, account, ['categories'], { categories: { at: 1, saved: [category(10)] } })
    expect(result.draft.categories.map(({ id }) => id)).toEqual([10, 11, 12])
    expect(result.edits.categories?.saved).toEqual(account.categories)
  })

  it('never drops a category or product the account holds, even one the draft lacks', () => {
    const result = merge(draftWith({ categories: [] }), draftWith({ categories: [category(10)] }), ['categories'],
      { categories: { at: 1, saved: [category(10)] } })
    expect(result.draft.categories.map(({ id }) => id)).toEqual([10])
    expect(result.edits).toEqual({})
  })

  it('keeps a size edit while the account’s copy is the one it started from, and takes a changed one', () => {
    const local = draftWith({ skus: [size('sku-1', 1, 80), size('sku-2', 1, 80)] })
    const account = draftWith({ skus: [size('sku-1', 1, 90), size('sku-2', 1, 95)] })
    const result = merge(local, account, ['skus'], { skus: { at: 1, saved: [size('sku-1', 1, 90), size('sku-2', 1, 90)] } })
    expect(result.draft.skus.map(({ salePrice }) => salePrice)).toEqual([80, 95])
  })

  it('keeps a removed size removed while the account holds it unchanged', () => {
    const result = merge(draftWith({ skus: [] }), draftWith({ skus: [size('sku-1', 1)] }), ['skus'], { skus: { at: 1, saved: [size('sku-1', 1)] } })
    expect(result.draft.skus).toEqual([])
    expect(result.edits.skus?.saved).toEqual([size('sku-1', 1)])
  })

  it('drops a saved entry the account no longer holds', () => {
    const result = merge(draftWith({ skus: [size('sku-1', 1)] }), draftWith({ skus: [] }), ['skus'], { skus: { at: 1, saved: [size('sku-1', 1)] } })
    expect(result.draft.skus).toEqual([])
  })

  it('reads an old-format list as the account’s entries plus local additions', () => {
    const local = draftWith({ skus: [size('sku-1', 1, 80), size('draft-sku-1-1', 1)] })
    const account = draftWith({ skus: [size('sku-1', 1, 90), size('sku-2', 1)] })
    const result = merge(local, account, ['skus'], { skus: { at: 0 } })
    expect(result.draft.skus.map(({ id, salePrice }) => [id, salePrice])).toEqual([['sku-1', 90], ['draft-sku-1-1', 90], ['sku-2', 90]])
  })

  it('removes local children whose parent left the draft, only where the parent was judged', () => {
    const draft = draftWith({ categories: [category(10)], products: [product(1, 10), product(2, 20)], skus: [size('a', 1), size('b', 2)] })
    expect(pruneOrphans(draft, { products: false, skus: false })).toBe(draft)
    const pruned = pruneOrphans(draft)
    expect(pruned.products.map(({ id }) => id)).toEqual([1])
    expect(pruned.skus.map(({ id }) => id)).toEqual(['a'])
  })
})

describe('Step 9 details no read can tell', () => {
  it('measure pending edits against their recorded saved values', () => {
    const draft = withStorefront({ welcomeMessage: 'Hello', tagline: 'Same' })
    const saved = withSavedValues(draft, { 'storefront.welcomeMessage': { at: 1, saved: 'Hi' } }, stepFields(9))
    expect(saved?.storefront).toMatchObject({ welcomeMessage: 'Hi', tagline: 'Same' })
  })

  it('have no known saved values while an old-format edit records none, so the step stays pending', () => {
    expect(withSavedValues(withStorefront({ tagline: 'Old' }), { 'storefront.tagline': { at: 0 } }, stepFields(9))).toBeNull()
  })
})

describe('tracking edits as the vendor types', () => {
  const before = withDelivery({ shipping: shipping(30) })

  it('records the saved value an edit started from, and forgets it when changed back', () => {
    const edited = trackEdits({}, before, withDelivery({ shipping: shipping(45) }), [7], { 7: { delivery: before.delivery } }, 10)
    expect(edited).toEqual({ 'delivery.shipping': { at: 10, saved: shipping(30) } })
    expect(trackEdits(edited, withDelivery({ shipping: shipping(45) }), before, [], { 7: { delivery: before.delivery } }, 11)).toEqual({})
  })

  it('keeps a recorded saved value while this visit does not know one, updating the edit time', () => {
    const edits = { 'delivery.shipping': { at: 1, saved: shipping(30) } }
    expect(trackEdits(edits, withDelivery({ shipping: shipping(45) }), withDelivery({ shipping: shipping(50) }), [7], {}, 9))
      .toEqual({ 'delivery.shipping': { at: 9, saved: shipping(30) } })
    expect(trackEdits({}, before, withDelivery({ shipping: shipping(50) }), [7], {}, 9)).toEqual({ 'delivery.shipping': { at: 9 } })
  })

  it('returns the same record when nothing tracked changed', () => {
    const edits = { 'delivery.shipping': { at: 1, saved: shipping(30) } }
    expect(trackEdits(edits, before, before, [7], {}, 2)).toBe(edits)
  })

  it('gives an edited step without fields of its own every field, with no saved value', () => {
    const edits = withUnknownEdits({ 'delivery.shipping': { at: 1 } }, [7, 9])
    expect(editedStepsOf(edits)).toEqual([7, 9])
    expect(Object.keys(edits)).toHaveLength(1 + stepFields(9).length)
    expect(edits['storefront.tagline']).toEqual({ at: 0 })
  })
})

describe('another tab’s newer draft', () => {
  it('is adopted where this tab has nothing newer', () => {
    const result = mergeTabDraft({
      local: withStorefront({ tagline: 'Mine, written' }),
      localEdits: { 'storefront.tagline': { at: 5, saved: '' } },
      incoming: withStorefront({ tagline: 'Theirs' }),
      incomingEdits: { 'storefront.tagline': { at: 7, saved: '' } },
      writtenAt: 6,
    })
    expect(result.draft.storefront.tagline).toBe('Theirs')
    expect(result.kept).toBe(false)
  })

  it('takes a field the other tab saved over this tab’s edit it had already seen', () => {
    const result = mergeTabDraft({
      local: withStorefront({ tagline: 'Mine, written' }),
      localEdits: { 'storefront.tagline': { at: 5, saved: '' } },
      incoming: withStorefront({ tagline: 'Saved there' }),
      incomingEdits: {},
      writtenAt: 6,
    })
    expect(result.draft.storefront.tagline).toBe('Saved there')
    expect(result.edits).toEqual({})
  })

  it('keeps this tab’s edits made since its last write, unless the other tab edited the field later', () => {
    const result = mergeTabDraft({
      local: withStorefront({ tagline: 'Mine', welcomeMessage: 'Mine' }),
      localEdits: { 'storefront.tagline': { at: 10 }, 'storefront.welcomeMessage': { at: 10 } },
      incoming: withStorefront({ tagline: 'Theirs, later', welcomeMessage: 'Theirs, earlier', announcementBar: 'Theirs' }),
      incomingEdits: {
        'storefront.tagline': { at: 12 },
        'storefront.welcomeMessage': { at: 8 },
        'storefront.announcementBar': { at: 8 },
      },
      writtenAt: 6,
    })
    expect(result.draft.storefront).toMatchObject({ tagline: 'Theirs, later', welcomeMessage: 'Mine', announcementBar: 'Theirs' })
    expect(result.kept).toBe(true)
    expect(result.edits['storefront.welcomeMessage']).toEqual({ at: 10 })
  })

  it('keeps this tab’s own copy of a field neither tab edited, which may come from a fresher read', () => {
    const result = mergeTabDraft({
      local: withDelivery({ shipping: shipping(40) }),
      localEdits: {},
      incoming: withDelivery({ shipping: shipping(30) }),
      incomingEdits: {},
      writtenAt: 6,
    })
    expect(result.draft.delivery.shipping).toEqual(shipping(40))
  })

  it('keeps where this tab is and what it counts as done', () => {
    const result = mergeTabDraft({
      local: draftWith({ currentStep: 7, completedSteps: [1, 2, 3] }),
      localEdits: {},
      incoming: draftWith({ currentStep: 9, completedSteps: [1, 2, 3, 4, 5, 6, 7, 8] }),
      incomingEdits: {},
      writtenAt: 0,
    })
    expect(result.draft.currentStep).toBe(7)
    expect(result.draft.completedSteps).toEqual([1, 2, 3])
  })

  it('never leaves a product without its category', () => {
    const result = mergeTabDraft({
      local: draftWith({ categories: [category(10), category(11)], products: [product(1, 11)] }),
      localEdits: { products: { at: 10 } },
      // The other tab dropped category 11 later.
      incoming: draftWith({ categories: [category(10)], products: [] }),
      incomingEdits: { categories: { at: 12 } },
      writtenAt: 6,
    })
    expect(result.draft.products).toEqual([])
  })
})
