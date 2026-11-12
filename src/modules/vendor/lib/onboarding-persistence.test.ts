import { describe, expect, it } from 'vitest'
import { createEmptyOnboardingDraft } from '../data/onboarding-defaults'
import {
  ONBOARDING_DRAFT_VERSION,
  type DraftCategory,
  type DraftSku,
  type SelectedProduct,
  type VendorOnboardingDraftV1,
} from '../types/onboarding'
import { hydratePersistedDraft, parsePersistedEnvelope, restoredEditedSteps, toPersistedDraft, toPersistedEdits } from './onboarding-persistence'
import { PENDING_ID_BASE } from './onboarding-pending-id'

const businessType = { id: 7, name: 'Grocery', icon: null, displayOrder: 1 }

const accountCategory: DraftCategory = {
  id: 10,
  name: 'Juices',
  businessTypeId: 7,
  description: null,
  imageUrl: null,
  displayOrder: 1,
}

const pendingCategory: DraftCategory = {
  id: PENDING_ID_BASE,
  name: 'Smoothies',
  businessTypeId: 7,
  description: null,
  imageUrl: null,
  displayOrder: null,
  pending: true,
}

const accountProduct: SelectedProduct = {
  id: 31,
  name: 'Orange Juice',
  description: null,
  imageUrl: null,
  measurementId: null,
  measurementName: null,
  categoryId: 10,
}

// A pending product sitting under a pending category: the draft-internal reference works
// because both hold pending-band ids.
const pendingProduct: SelectedProduct = {
  id: PENDING_ID_BASE - 1,
  name: 'Mango Smoothie',
  description: null,
  imageUrl: null,
  measurementId: null,
  measurementName: null,
  categoryId: PENDING_ID_BASE,
  pending: true,
}

const sku: DraftSku = {
  id: 'draft-sku-31-1',
  productId: 31,
  name: 'Orange Juice',
  description: '',
  skuType: 'ITEM',
  measurementType: 'VOLUME',
  unit: 'L',
  quantity: 1,
  listPrice: 180,
  salePrice: 160,
  active: true,
  homeDelivery: true,
  storePickup: false,
}

function accountDraft(overrides: Partial<VendorOnboardingDraftV1> = {}): VendorOnboardingDraftV1 {
  return {
    ...createEmptyOnboardingDraft(),
    catalogSource: 'account',
    business: { businessType, businessName: '' },
    categories: [accountCategory, pendingCategory],
    products: [accountProduct, pendingProduct],
    skus: [sku],
    ...overrides,
  }
}

function envelope(draft: VendorOnboardingDraftV1, version: number = ONBOARDING_DRAFT_VERSION) {
  // JSON round-trip mirrors going through localStorage, so an undefined `pending` is dropped
  // exactly as it would be on read.
  return JSON.parse(
    JSON.stringify({
      version,
      revision: 1,
      updatedAt: new Date().toISOString(),
      ownerId: '91',
      furthestVisitedStep: 5,
      editedSteps: [5],
      draft: toPersistedDraft(draft),
      previewSnapshot: null,
    }),
  )
}

describe('persisted draft — version 4, catalog source and pending entries', () => {
  it('accepts an account draft mixing positive and pending-band entries', () => {
    // The relaxed band, the pending marker, the businessTypeId rule and both orphan rules all
    // pass together on a well-formed draft.
    expect(parsePersistedEnvelope(envelope(accountDraft()))).not.toBeNull()
  })

  it('accepts an account draft with only positive ids', () => {
    const positiveOnly = accountDraft({
      categories: [accountCategory],
      products: [accountProduct],
      skus: [sku],
    })
    expect(parsePersistedEnvelope(envelope(positiveOnly))).not.toBeNull()
  })

  it('keeps catalog icons on selected categories and products', () => {
    const categoryIcon = 'https://cdn.example.test/categories/icon.svg'
    const productIcon = 'https://cdn.example.test/products/icon.svg'
    const withIcons = accountDraft({
      categories: [{ ...accountCategory, icon: categoryIcon }],
      products: [{ ...accountProduct, icon: productIcon }],
    })

    const parsed = parsePersistedEnvelope(envelope(withIcons))
    expect(parsed?.draft.categories[0].icon).toBe(categoryIcon)
    expect(parsed?.draft.products[0].icon).toBe(productIcon)
  })

  it('rejects a version-3 envelope, exactly as it rejects an unreadable one', () => {
    expect(parsePersistedEnvelope(envelope(accountDraft(), 3))).toBeNull()
  })

  it('rejects a pending-band id that is not marked pending', () => {
    const unmarked = accountDraft({
      categories: [accountCategory, { ...pendingCategory, pending: undefined }],
    })
    expect(parsePersistedEnvelope(envelope(unmarked))).toBeNull()
  })

  it('rejects a pending category whose businessTypeId is not the selected business type', () => {
    const wrongType = accountDraft({
      categories: [accountCategory, { ...pendingCategory, businessTypeId: 8 }],
    })
    expect(parsePersistedEnvelope(envelope(wrongType))).toBeNull()
  })

  it('accepts a saved category that keeps another business type after a type change', () => {
    const changedType = accountDraft({
      business: { businessType: { ...businessType, id: 8 }, businessName: '' },
      categories: [accountCategory],
      products: [accountProduct],
      skus: [sku],
    })
    expect(parsePersistedEnvelope(envelope(changedType))).not.toBeNull()
  })

  it('rejects a product whose categoryId is not a selected category', () => {
    const orphanProduct = accountDraft({
      products: [{ ...accountProduct, categoryId: 999 }, pendingProduct],
    })
    expect(parsePersistedEnvelope(envelope(orphanProduct))).toBeNull()
  })

  it('rejects a sku whose productId is not a selected product', () => {
    const orphanSku = accountDraft({ skus: [{ ...sku, productId: 888 }] })
    expect(parsePersistedEnvelope(envelope(orphanSku))).toBeNull()
  })

  it('loads a draft saved while setup still offered an acceptance policy', () => {
    // Setup no longer asks and nothing reads the value, but a draft written by an earlier
    // build still carries the key. The validator rejects any key it does not know, so
    // dropping this one from the allowed set would discard a vendor's whole draft.
    const legacy = envelope(accountDraft())
    legacy.draft.delivery.orderAcceptancePolicy = 'MANUAL_APPROVAL'

    expect(parsePersistedEnvelope(legacy)).not.toBeNull()
  })

  it('loads a draft saved while Step 9 still asked for owner and contact names', () => {
    const legacy = envelope(accountDraft())
    Object.assign(legacy.draft.business, { ownerName: 'Test Owner', contactPerson: 'Test Contact' })

    const parsed = parsePersistedEnvelope(legacy)
    expect(parsed).not.toBeNull()
    expect(hydratePersistedDraft(parsed!.draft).business).not.toHaveProperty('ownerName')
  })
})

describe('the sample rule is unchanged', () => {
  const sampleBusinessType = { id: -101, name: 'Grocery', icon: null, displayOrder: 1 }
  const sampleCategory: DraftCategory = {
    id: -201,
    name: 'Fresh produce',
    businessTypeId: -101,
    description: null,
    imageUrl: null,
    displayOrder: 1,
  }
  const sampleProduct: SelectedProduct = {
    id: -301,
    name: 'Tomatoes',
    description: null,
    imageUrl: null,
    measurementId: null,
    measurementName: null,
    categoryId: -201,
  }

  function sampleDraft(overrides: Partial<VendorOnboardingDraftV1> = {}): VendorOnboardingDraftV1 {
    return {
      ...createEmptyOnboardingDraft(),
      catalogSource: 'sample',
      business: { businessType: sampleBusinessType, businessName: '' },
      categories: [sampleCategory],
      products: [sampleProduct],
      skus: [],
      ...overrides,
    }
  }

  it('accepts a sample draft whose selected ids are all negative', () => {
    expect(parsePersistedEnvelope(envelope(sampleDraft()))).not.toBeNull()
  })

  it('rejects a sample draft that carries a positive id', () => {
    const withPositive = sampleDraft({ products: [{ ...sampleProduct, id: 301 }] })
    expect(parsePersistedEnvelope(envelope(withPositive))).toBeNull()
  })

  it('rejects a sample category whose businessTypeId is not the selected business type', () => {
    const wrongType = sampleDraft({ categories: [{ ...sampleCategory, businessTypeId: -102 }] })
    expect(parsePersistedEnvelope(envelope(wrongType))).toBeNull()
  })
})

describe('persisted edited steps', () => {
  function withFields(fields: Record<string, unknown>) {
    const value = envelope(accountDraft())
    delete value.editedSteps
    return { ...value, ...fields }
  }

  it('round-trips the edited steps', () => {
    const parsed = parsePersistedEnvelope(withFields({ editedSteps: [4, 7, 8] }))

    expect(parsed?.editedSteps).toEqual([4, 7, 8])
    expect(parsed && restoredEditedSteps(parsed)).toEqual([4, 7, 8])
  })

  it('normalises what it restores', () => {
    const parsed = parsePersistedEnvelope(withFields({ editedSteps: [8, 2, 4, 8, 10] }))

    expect(parsed && restoredEditedSteps(parsed)).toEqual([4, 8])
  })

  it('rejects edited steps that are not a list of steps', () => {
    expect(parsePersistedEnvelope(withFields({ editedSteps: 5 }))).toBeNull()
    expect(parsePersistedEnvelope(withFields({ editedSteps: [5, 11] }))).toBeNull()
    expect(parsePersistedEnvelope(withFields({ editedSteps: ['5'] }))).toBeNull()
  })

  it('no longer reads the legacy flag in the current format', () => {
    expect(parsePersistedEnvelope(withFields({ hasLocalEdits: true }))).toBeNull()
  })
})

describe('version-4 drafts, written before saved values were recorded', () => {
  function versionFour(fields: Record<string, unknown>) {
    const value = envelope(accountDraft(), 4)
    value.draft.version = 4
    delete value.editedSteps
    return { ...value, ...fields }
  }

  it('migrates to the current version, keeping the draft and its edited steps', () => {
    const parsed = parsePersistedEnvelope(versionFour({ editedSteps: [4, 7] }))

    expect(parsed?.version).toBe(ONBOARDING_DRAFT_VERSION)
    expect(parsed?.draft.version).toBe(ONBOARDING_DRAFT_VERSION)
    expect(parsed?.draft.categories.map(({ id }) => id)).toEqual(accountDraft().categories.map(({ id }) => id))
    expect(parsed?.editedSteps).toEqual([4, 7])
    // No saved values are known: the edited steps' fields only fill what the account lacks.
    expect(parsed?.edits).toBeUndefined()
  })

  // The oldest shape marked every step edited whatever changed, so Step 9 records only the
  // store name the account can show; its other details count as saved.
  const storeNameOnly = { businessName: { at: 0 }, 'storefront.storeName': { at: 0 } }

  it('reads a legacy envelope that holds unsaved edits as every step edited', () => {
    const parsed = parsePersistedEnvelope(versionFour({ hasLocalEdits: true }))
    expect(parsed?.editedSteps).toEqual([3, 4, 5, 6, 7, 8, 9])
    expect(parsed?.edits).toEqual(storeNameOnly)
  })

  it('reads a legacy envelope without either field as every step edited', () => {
    const parsed = parsePersistedEnvelope(versionFour({}))
    expect(parsed?.editedSteps).toEqual([3, 4, 5, 6, 7, 8, 9])
    expect(parsed?.edits).toEqual(storeNameOnly)
  })

  it('keeps every Step 9 detail unsaved when the envelope lists Step 9 itself', () => {
    expect(parsePersistedEnvelope(versionFour({ editedSteps: [9] }))?.edits).toBeUndefined()
  })

  it('reads a legacy envelope in sync with the account as nothing edited', () => {
    expect(parsePersistedEnvelope(versionFour({ hasLocalEdits: false }))?.editedSteps).toEqual([])
  })

  it('still rejects a non-boolean legacy flag, and a version-4 envelope carrying saved values', () => {
    expect(parsePersistedEnvelope(versionFour({ hasLocalEdits: 'yes' }))).toBeNull()
    expect(parsePersistedEnvelope(versionFour({ edits: {} }))).toBeNull()
  })

  it('rejects a draft whose version does not match its envelope', () => {
    expect(parsePersistedEnvelope({ ...versionFour({}), draft: toPersistedDraft(accountDraft()) })).toBeNull()
  })
})

describe('persisted unsaved fields', () => {
  const withEdits = (edits: unknown) => ({ ...envelope(accountDraft()), edits })

  it('round-trips each field’s edit time and the saved value it started from', () => {
    const edits = {
      'delivery.shipping': { at: 1_700_000_000_000, saved: { charge: 30, freeDeliveryThreshold: 0 } },
      'storefront.tagline': { at: 2, saved: '' },
      businessType: { at: 3, saved: null },
      categories: { at: 4, saved: [accountCategory] },
      skus: { at: 5 },
    }
    expect(parsePersistedEnvelope(withEdits(edits))?.edits).toEqual(edits)
  })

  it.each([
    ['an unknown field', { 'delivery.unknown': { at: 1 } }],
    ['a private payment detail', { paymentDetails: { at: 1, saved: {} } }],
    ['a WhatsApp number', { orderWhatsapp: { at: 1, saved: '9876543210' } }],
    ['a missing edit time', { 'storefront.tagline': { saved: '' } }],
    ['an extra key', { 'storefront.tagline': { at: 1, saved: '', by: 'tab' } }],
    ['a saved value of the wrong shape', { 'delivery.shipping': { at: 1, saved: { charge: '30' } } }],
    ['a saved list holding a damaged entry', { categories: { at: 1, saved: [{ id: 0, name: 'x' }] } }],
    ['a saved image that is a local file', { categories: { at: 1, saved: [{ ...accountCategory, imageUrl: 'blob:local' }] } }],
  ])('rejects %s', (_, edits) => {
    expect(parsePersistedEnvelope(withEdits(edits))).toBeNull()
  })

  it('stores saved catalog values with the draft’s asset rules', () => {
    const local = { ...accountCategory, imageUrl: 'blob:local-preview' }
    expect(toPersistedEdits({ categories: { at: 1, saved: [local] } })).toEqual({
      categories: { at: 1, saved: [{ ...accountCategory, imageUrl: null }] },
    })
    expect(toPersistedEdits({ skus: { at: 1 } })).toEqual({ skus: { at: 1 } })
  })
})
