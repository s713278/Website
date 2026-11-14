import { describe, expect, it } from 'vitest'
import { resolveSavedType, savedTypeState, type SavedTypeEvidence } from './onboarding-saved-type'

const dairy = { id: 1, name: 'Dairy & Farm Fresh', icon: null, displayOrder: 1 }
const bakery = { id: 4, name: 'Bakery & Snacks', icon: null, displayOrder: 4 }
const others = { id: 30, name: 'Others', icon: null, displayOrder: 30 }
const TYPES = [dairy, bakery, others]
const LISTS = [
  { type: dairy, categoryIds: [117, 118] },
  { type: bakery, categoryIds: [201, 202] },
  { type: others, categoryIds: [301] },
]

function evidence(overrides: Partial<SavedTypeEvidence> = {}): SavedTypeEvidence {
  return { confirmed: null, stepSaved: true, profileTypeName: 'Others', businessTypes: TYPES, ...overrides }
}

describe('resolveSavedType', () => {
  it('takes this browser’s confirmed save over every account read', () => {
    expect(resolveSavedType(evidence({ confirmed: bakery, profileTypeName: 'Dairy & Farm Fresh', stepSaved: false })))
      .toEqual({ kind: 'saved', type: bakery, source: 'record' })
  })

  it('leaves the type open while the account has not saved Step 3, preselecting a named type', () => {
    expect(resolveSavedType(evidence({ stepSaved: false }))).toEqual({ kind: 'open', preselect: null })
    expect(resolveSavedType(evidence({ stepSaved: false, profileTypeName: 'Dairy & Farm Fresh' })))
      .toEqual({ kind: 'open', preselect: dairy })
  })

  it('takes a known type the vendor record names, other than Others', () => {
    expect(resolveSavedType(evidence({ profileTypeName: ' Dairy & Farm Fresh ' })))
      .toEqual({ kind: 'saved', type: dairy, source: 'profile' })
  })

  it.each([['Others'], [null], ['A type no longer listed']])('reads the assigned categories when the record names %j', (name) => {
    expect(resolveSavedType(evidence({ profileTypeName: name }))).toEqual({ kind: 'needs', read: 'categories' })
    expect(resolveSavedType(evidence({ profileTypeName: name, assignedCategoryIds: [301] })))
      .toEqual({ kind: 'needs', read: 'type-categories' })
  })

  it('takes the one type whose list holds every assigned category, Others included', () => {
    expect(resolveSavedType(evidence({ assignedCategoryIds: [301], typeCategories: LISTS })))
      .toEqual({ kind: 'saved', type: others, source: 'categories' })
    expect(resolveSavedType(evidence({ assignedCategoryIds: [118, 117], typeCategories: LISTS })))
      .toEqual({ kind: 'saved', type: dairy, source: 'categories' })
  })

  it('never guesses: no categories, a mixed catalog or a category two types list stays unresolved', () => {
    expect(resolveSavedType(evidence({ assignedCategoryIds: [] }))).toEqual({ kind: 'unresolved' })
    expect(resolveSavedType(evidence({ assignedCategoryIds: [117, 201], typeCategories: LISTS }))).toEqual({ kind: 'unresolved' })
    expect(resolveSavedType(evidence({ assignedCategoryIds: [999], typeCategories: LISTS }))).toEqual({ kind: 'unresolved' })
    const shared = [...LISTS, { type: { id: 5, name: 'Bakery', icon: null, displayOrder: 5 }, categoryIds: [201] }]
    expect(resolveSavedType(evidence({ assignedCategoryIds: [201], typeCategories: shared }))).toEqual({ kind: 'unresolved' })
  })
})

describe('savedTypeState', () => {
  it('locks a saved type and says whether a fresh check already failed', () => {
    expect(savedTypeState({ kind: 'saved', type: dairy, source: 'profile' }, false)).toEqual({ status: 'saved', type: dairy })
    expect(savedTypeState({ kind: 'open', preselect: dairy }, false)).toEqual({ status: 'open' })
    expect(savedTypeState({ kind: 'unresolved' }, true)).toEqual({ status: 'unresolved', retried: true })
  })
})
