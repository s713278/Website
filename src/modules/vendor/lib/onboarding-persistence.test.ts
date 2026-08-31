import { describe, expect, it } from 'vitest'
import { createEmptyOnboardingDraft } from '../data/onboarding-defaults'
import {
  ONBOARDING_DRAFT_VERSION,
  type DraftCategory,
  type DraftSku,
  type SelectedProduct,
  type VendorOnboardingDraftV1,
} from '../types/onboarding'
import { parsePersistedEnvelope, toPersistedDraft } from './onboarding-persistence'
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
    business: { businessType, businessName: '', ownerName: '', contactPerson: '' },
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
      hasLocalEdits: true,
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

  it('rejects a version-3 envelope, exactly as it rejects an unreadable one', () => {
    expect(parsePersistedEnvelope(envelope(accountDraft(), 3))).toBeNull()
  })

  it('rejects a pending-band id that is not marked pending', () => {
    const unmarked = accountDraft({
      categories: [accountCategory, { ...pendingCategory, pending: undefined }],
    })
    expect(parsePersistedEnvelope(envelope(unmarked))).toBeNull()
  })

  it('rejects a category whose businessTypeId is not the selected business type', () => {
    const wrongType = accountDraft({
      categories: [{ ...accountCategory, businessTypeId: 8 }, pendingCategory],
    })
    expect(parsePersistedEnvelope(envelope(wrongType))).toBeNull()
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
      business: { businessType: sampleBusinessType, businessName: '', ownerName: '', contactPerson: '' },
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
})
