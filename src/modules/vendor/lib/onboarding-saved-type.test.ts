import { describe, expect, it } from 'vitest'
import { resolveSavedType, savedTypeState, type SavedTypeEvidence } from './onboarding-saved-type'

const dairy = { id: 1, name: 'Dairy & Farm Fresh', icon: null, displayOrder: 1 }
const bakery = { id: 4, name: 'Bakery & Snacks', icon: null, displayOrder: 4 }
const others = { id: 30, name: 'Others', icon: null, displayOrder: 30 }
const OTHERS_LIST = { type: others, categoryIds: [301] }
const recordOthers = { id: 30, name: 'Others', icon: null, displayOrder: null }
const recordDairy = { id: 1, name: 'Dairy & Farm Fresh', icon: null, displayOrder: null }

/** A locked account by default: categories saved, the record saying Others. */
function evidence(overrides: Partial<SavedTypeEvidence> = {}): SavedTypeEvidence {
  return { confirmed: null, stepSaved: true, categoriesSaved: true, profileTypeName: 'Others', profileTypeId: 30, ...overrides }
}

/** An account that has saved Step 3 but holds no category. */
function unlocked(overrides: Partial<SavedTypeEvidence> = {}): SavedTypeEvidence {
  return evidence({ categoriesSaved: false, assignedCategoryIds: [], ...overrides })
}

describe('resolveSavedType', () => {
  it('leaves the type open before Step 3 is saved, with the record’s named type as current', () => {
    expect(resolveSavedType(evidence({ stepSaved: false, categoriesSaved: false }))).toEqual({ kind: 'open', current: null })
    expect(resolveSavedType(evidence({ stepSaved: false, categoriesSaved: false, profileTypeName: 'Dairy & Farm Fresh', profileTypeId: 1 })))
      .toEqual({ kind: 'open', current: recordDairy })
  })

  it('reads the assigned categories once Step 3 is saved but the account may hold none', () => {
    expect(resolveSavedType(evidence({ categoriesSaved: false }))).toEqual({ kind: 'needs', read: 'categories' })
    expect(resolveSavedType(evidence({ categoriesSaved: false, profileTypeName: 'Dairy & Farm Fresh', profileTypeId: 1 })))
      .toEqual({ kind: 'needs', read: 'categories' })
  })

  it('stays open with the record’s type, Others included, while Step 3 is saved and no category is', () => {
    expect(resolveSavedType(unlocked())).toEqual({ kind: 'open', current: recordOthers })
    expect(resolveSavedType(unlocked({ profileTypeName: 'Dairy & Farm Fresh', profileTypeId: 1 })))
      .toEqual({ kind: 'open', current: recordDairy })
  })

  it('ignores this browser’s record while the type is open', () => {
    expect(resolveSavedType(unlocked({ confirmed: bakery, profileTypeName: 'Dairy & Farm Fresh', profileTypeId: 1 })))
      .toEqual({ kind: 'open', current: recordDairy })
    expect(resolveSavedType(evidence({ confirmed: bakery, stepSaved: false, categoriesSaved: false })))
      .toEqual({ kind: 'open', current: null })
  })

  it('locks once the context says categories are saved, or the account holds one', () => {
    const named = { profileTypeName: 'Dairy & Farm Fresh', profileTypeId: 1 }
    expect(resolveSavedType(evidence(named))).toEqual({ kind: 'locked', type: recordDairy, source: 'profile' })
    expect(resolveSavedType(unlocked({ ...named, assignedCategoryIds: [101] })))
      .toEqual({ kind: 'locked', type: recordDairy, source: 'profile' })
  })

  it('takes the record’s named type over this browser’s record once locked', () => {
    expect(resolveSavedType(evidence({ confirmed: bakery, profileTypeName: 'Dairy & Farm Fresh', profileTypeId: 1 })))
      .toEqual({ kind: 'locked', type: recordDairy, source: 'profile' })
  })

  it('takes this browser’s record for a locked Others only when the ids match, or the record has none', () => {
    expect(resolveSavedType(evidence({ confirmed: others }))).toEqual({ kind: 'locked', type: others, source: 'record' })
    expect(resolveSavedType(evidence({ confirmed: bakery, profileTypeName: null, profileTypeId: null })))
      .toEqual({ kind: 'locked', type: bakery, source: 'record' })
    expect(resolveSavedType(evidence({ confirmed: bakery }))).toEqual({ kind: 'needs', read: 'categories' })
  })

  it('builds a named type from the record’s id and name, with no list', () => {
    expect(resolveSavedType(evidence({ profileTypeName: ' Dairy (old name) ', profileTypeId: 1 }))).toEqual({
      kind: 'locked',
      type: { id: 1, name: 'Dairy (old name)', icon: null, displayOrder: null },
      source: 'profile',
    })
    expect(resolveSavedType(evidence({ profileTypeName: 'Pet Supplies', profileTypeId: 108 }))).toEqual({
      kind: 'locked',
      type: { id: 108, name: 'Pet Supplies', icon: null, displayOrder: null },
      source: 'profile',
    })
  })

  it.each([
    ['Dairy', null],
    ['Others', null],
    [null, null],
    [null, 108],
    ['  ', 5],
  ])('leaves a record naming %j with id %j unresolved when locked and open with nothing current when not', (name, id) => {
    expect(resolveSavedType(evidence({ profileTypeName: name, profileTypeId: id }))).toEqual({ kind: 'unresolved' })
    expect(resolveSavedType(evidence({ profileTypeName: name, profileTypeId: id, assignedCategoryIds: [301] })))
      .toEqual({ kind: 'unresolved' })
    expect(resolveSavedType(evidence({ profileTypeName: name, profileTypeId: id, stepSaved: false, categoriesSaved: false })))
      .toEqual({ kind: 'open', current: null })
  })

  it('reads the assigned categories first for a locked record saying Others', () => {
    expect(resolveSavedType(evidence())).toEqual({ kind: 'needs', read: 'categories' })
  })

  it('asks for the Others list by the record’s id', () => {
    expect(resolveSavedType(evidence({ assignedCategoryIds: [301] }))).toEqual({
      kind: 'needs',
      read: 'others-categories',
      others: recordOthers,
    })
  })

  it('locks Others when its list holds every assigned category', () => {
    expect(resolveSavedType(evidence({ assignedCategoryIds: [301], othersCategories: OTHERS_LIST })))
      .toEqual({ kind: 'locked', type: others, source: 'categories' })
  })

  it('stays unresolved when one assigned category is outside Others’ list', () => {
    expect(resolveSavedType(evidence({ assignedCategoryIds: [301, 117], othersCategories: OTHERS_LIST })))
      .toEqual({ kind: 'unresolved' })
  })

  it('a locked Others with no assigned categories is unresolved', () => {
    expect(resolveSavedType(evidence({ assignedCategoryIds: [] }))).toEqual({ kind: 'unresolved' })
  })
})

describe('savedTypeState', () => {
  it('locks a locked type and says whether a fresh check already failed', () => {
    expect(savedTypeState({ kind: 'locked', type: dairy, source: 'profile' }, false)).toEqual({ status: 'locked', type: dairy })
    expect(savedTypeState({ kind: 'open', current: dairy }, false)).toEqual({ status: 'open' })
    expect(savedTypeState({ kind: 'unresolved' }, true)).toEqual({ status: 'unresolved', retried: true })
  })
})
