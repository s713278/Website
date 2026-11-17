import type { BusinessTypeReference, CategoryReference, ReferencePage } from '@/shared/api'

/**
 * Which business type a vendor's account holds, and so whether Step 3 is still a choice.
 *
 * The type locks once the account holds an assigned category or the store is submitted: after
 * that, another type is refused until support changes it. Before that the fresh vendor record
 * is the current type (`"Others"` included once Step 3 is saved), and Step 3 re-saves a change.
 * The account cannot say which type a locked account saved reliably, so the answer is built
 * from evidence, strongest first, and never guessed:
 *
 * 1. the vendor record's `business_type_id` and `business_type` name, unless the name is
 *    `"Others"`;
 * 2. this browser's record of the type the first category save was made under, when it
 *    matches the record's id or the record has none;
 * 3. for `"Others"` with an id, that type's category list holding every assigned category;
 * 4. otherwise unresolved: the vendor retries, then contacts support.
 *
 * TEMP(onboarding-saved-type): steps 1 and 2 are permanent evidence. Step 3 and the `"Others"`
 * exclusion stand in for a record that tells "not chosen" from `"Others"`: a never-configured
 * vendor still reports `"Others"` with its id
 * (`docs/API_GAPS.md#saved-business-type-is-not-readable-or-enforced`). Remove them once the
 * backend stops reporting unconfigured vendors as `"Others"`.
 */

/** Both a real business type and what the vendor record reports for a vendor without one. */
export const AMBIGUOUS_BUSINESS_TYPE = 'Others'

export type SavedTypeEvidence = {
  /** This browser's record of the first category save for the signed-in vendor; consulted only once locked. */
  confirmed: BusinessTypeReference | null
  /** The account counts Step 3 as saved: past it in a fresh context, submitted, or saved this visit. */
  stepSaved: boolean
  /** The account must hold a category: submitted, or a fresh context's `next_step` past Step 4. */
  categoriesSaved: boolean
  /** The vendor record's `business_type`. */
  profileTypeName: string | null
  /** The vendor record's `business_type_id`; null when the record omits it. */
  profileTypeId: number | null
  /** The account's assigned categories, as platform category ids; absent until read. */
  assignedCategoryIds?: readonly number[]
  /** TEMP: the Others list, read by the record's id; absent until read. */
  othersCategories?: TypeCategories
}

export type TypeCategories = {
  type: BusinessTypeReference
  categoryIds: readonly number[]
  /** The list's first page as read, which Step 4 can show without reading it again. */
  firstPage?: ReferencePage<CategoryReference>
}

export type SavedTypeResolution =
  /** No category is saved yet: the type is still a choice. `current` is the record's type. */
  | { kind: 'open'; current: BusinessTypeReference | null }
  | { kind: 'locked'; type: BusinessTypeReference; source: 'record' | 'profile' | 'categories' }
  /** The answer depends on a read not made yet. */
  | { kind: 'needs'; read: 'categories' }
  | { kind: 'needs'; read: 'others-categories'; others: BusinessTypeReference }
  /** Locked, but which type cannot be told. */
  | { kind: 'unresolved' }

/**
 * The type whose id and name the vendor record returns. The ambiguous `"Others"` counts only
 * with `others`: once Step 3 is saved and unlocked, the record's `"Others"` is what was saved.
 */
function recordType(evidence: SavedTypeEvidence, { others = false } = {}): BusinessTypeReference | null {
  const name = evidence.profileTypeName?.trim()
  const id = evidence.profileTypeId
  if (id == null || !name || (name === AMBIGUOUS_BUSINESS_TYPE && !others)) return null
  return { id, name, icon: null, displayOrder: null }
}

export function resolveSavedType(evidence: SavedTypeEvidence): SavedTypeResolution {
  const assigned = evidence.assignedCategoryIds
  if (!evidence.categoriesSaved && !assigned?.length) {
    // Nothing is assigned before a Step 3 save, so the categories are read only after one.
    if (!evidence.stepSaved) return { kind: 'open', current: recordType(evidence) }
    if (!assigned) return { kind: 'needs', read: 'categories' }
    return { kind: 'open', current: recordType(evidence, { others: true }) }
  }
  const named = recordType(evidence)
  if (named) return { kind: 'locked', type: named, source: 'profile' }
  const { confirmed } = evidence
  if (confirmed && (evidence.profileTypeId == null || confirmed.id === evidence.profileTypeId)) {
    return { kind: 'locked', type: confirmed, source: 'record' }
  }

  // TEMP(onboarding-saved-type): only a record saying "Others" with an id is checked further.
  const id = evidence.profileTypeId
  if (id == null || evidence.profileTypeName?.trim() !== AMBIGUOUS_BUSINESS_TYPE) return { kind: 'unresolved' }
  if (!assigned) return { kind: 'needs', read: 'categories' }
  if (!assigned.length) return { kind: 'unresolved' }
  const list = evidence.othersCategories
  if (!list) {
    return { kind: 'needs', read: 'others-categories', others: { id, name: AMBIGUOUS_BUSINESS_TYPE, icon: null, displayOrder: null } }
  }
  const listed = new Set(list.categoryIds)
  return assigned.every((categoryId) => listed.has(categoryId))
    ? { kind: 'locked', type: list.type, source: 'categories' }
    : { kind: 'unresolved' }
}

/** Where the business type's lock stands in this wizard visit. */
export type SavedTypeState =
  /** Not worked out yet, or not needed by the steps opened so far. */
  | { status: 'unknown' }
  /** Reading the evidence. */
  | { status: 'checking' }
  /** Not locked: the account holds no category, so the vendor may choose. */
  | { status: 'open' }
  /** Locked to `type`. */
  | { status: 'locked'; type: BusinessTypeReference }
  /** Locked, type unknown. `retried` once a fresh check also failed: then support is the way on. */
  | { status: 'unresolved'; retried: boolean }

/** The resolved answer as the wizard holds it. */
export function savedTypeState(resolution: Exclude<SavedTypeResolution, { kind: 'needs' }>, retried: boolean): SavedTypeState {
  if (resolution.kind === 'open') return { status: 'open' }
  if (resolution.kind === 'locked') return { status: 'locked', type: resolution.type }
  return { status: 'unresolved', retried }
}

export const BUSINESS_TYPE_LOCKED_MESSAGE = 'Business type cannot be changed now. Contact support to change it.'

export function unresolvedTypeMessage(retried: boolean): string {
  return retried
    ? 'We still couldn’t confirm your saved business type. Try again later, or contact support to continue.'
    : 'We couldn’t confirm your saved business type. Try again.'
}
