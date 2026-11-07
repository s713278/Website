import { describe, expect, it } from 'vitest'
import { createEmptyOnboardingDraft } from '../data/onboarding-defaults'
import type { DraftCategory, SelectedProduct, VendorOnboardingDraftV1 } from '../types/onboarding'
import { isPendingId, nextPendingId, PENDING_ID_BASE } from './onboarding-pending-id'

function pendingCategory(id: number): DraftCategory {
  return { id, name: 'Authored', businessTypeId: 7, description: null, imageUrl: null, displayOrder: null, pending: true }
}

function pendingProduct(id: number, categoryId: number): SelectedProduct {
  return { id, name: 'Authored', description: null, imageUrl: null, measurementId: null, measurementName: null, categoryId, pending: true }
}

function draftWith(
  overrides: Partial<Pick<VendorOnboardingDraftV1, 'categories' | 'products'>>,
): VendorOnboardingDraftV1 {
  return { ...createEmptyOnboardingDraft(), ...overrides }
}

describe('isPendingId', () => {
  it('accepts the band base and anything below it', () => {
    expect(isPendingId(PENDING_ID_BASE)).toBe(true)
    expect(isPendingId(PENDING_ID_BASE - 1)).toBe(true)
    expect(isPendingId(PENDING_ID_BASE - 5000)).toBe(true)
  })

  it('rejects everything above the band, including every sample fixture', () => {
    expect(isPendingId(PENDING_ID_BASE + 1)).toBe(false)
    expect(isPendingId(-392)).toBe(false)
    expect(isPendingId(-101)).toBe(false)
    expect(isPendingId(0)).toBe(false)
    expect(isPendingId(10)).toBe(false)
  })

  it('rejects a non-integer id', () => {
    expect(isPendingId(-1_000_000.5)).toBe(false)
    expect(isPendingId(Number.NaN)).toBe(false)
  })
})

describe('nextPendingId', () => {
  it('starts a fresh draft at the band base', () => {
    expect(nextPendingId(draftWith({}))).toBe(PENDING_ID_BASE)
  })

  it('descends one step below the lowest pending id already held', () => {
    const draft = draftWith({ categories: [pendingCategory(PENDING_ID_BASE)] })
    expect(nextPendingId(draft)).toBe(PENDING_ID_BASE - 1)
  })

  it('shares one descending sequence across categories and products', () => {
    // A pending category at the base and a pending product one below must not let the next
    // mint collide with either — the sequence spans both arrays.
    const draft = draftWith({
      categories: [pendingCategory(PENDING_ID_BASE)],
      products: [pendingProduct(PENDING_ID_BASE - 1, PENDING_ID_BASE)],
    })
    expect(nextPendingId(draft)).toBe(PENDING_ID_BASE - 2)
  })

  it('ignores account and sample ids when choosing the next id', () => {
    const draft = draftWith({
      categories: [
        { id: 10, name: 'Account', businessTypeId: 7, description: null, imageUrl: null, displayOrder: 1 },
        pendingCategory(PENDING_ID_BASE),
      ],
      // A sample-band product (-301), not a pending one: it must not shift the sequence.
      products: [{ id: -301, name: 'Sample', description: null, imageUrl: null, measurementId: null, measurementName: null, categoryId: 10 }],
    })
    expect(nextPendingId(draft)).toBe(PENDING_ID_BASE - 1)
  })
})
