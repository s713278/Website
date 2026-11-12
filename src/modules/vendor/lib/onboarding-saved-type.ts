import type { BusinessTypeReference, CategoryReference, ReferencePage } from '@/shared/api'

/**
 * Which business type a vendor's account has saved, and so whether Step 3 is still a choice.
 *
 * The first confirmed Step 3 save fixes the type: after it, another type is refused until
 * support changes it. The account cannot say which type it saved reliably, so the answer is
 * built from evidence, strongest first, and never guessed:
 *
 * 1. this browser's record of a confirmed Step 3 save for the vendor (permanent);
 * 2. the vendor record's `business_type` name, unless it is `"Others"`, matched to a known type;
 * 3. the assigned categories, when every one sits in exactly one type's category list;
 * 4. otherwise unresolved: the vendor retries, then contacts support.
 *
 * TEMP(onboarding-saved-type): steps 2-4 stand in for an account read that names the saved
 * type. The vendor record returns only the type's name, defaults a never-configured vendor
 * to `"Others"`, and can stay stale for about 30 minutes after the business-type PATCH
 * (`docs/API_GAPS.md#saved-business-type-is-not-readable-or-enforced`). Remove them once that read
 * reliably returns the saved type (ideally its id) immediately after a save and no longer
 * defaults to `"Others"`.
 */

/** Both a real business type and what the vendor record reports for a vendor without one. */
export const AMBIGUOUS_BUSINESS_TYPE = 'Others'

export type SavedTypeEvidence = {
  /** This browser's confirmed Step 3 save for the signed-in vendor. */
  confirmed: BusinessTypeReference | null
  /** The account counts Step 3 as saved: a fresh context's `next_step` is past it. */
  stepSaved: boolean
  /** The vendor record's `business_type`. */
  profileTypeName: string | null
  /** The platform's business types, to match the record's name against. */
  businessTypes: readonly BusinessTypeReference[]
  /** The account's assigned categories, as platform category ids; absent until read. */
  assignedCategoryIds?: readonly number[]
  /**
   * Every business type with the category ids it lists; absent until read. Or `"Others"` alone
   * when it lists every assigned category (`readTypeCategories`): no other list can.
   */
  typeCategories?: readonly TypeCategories[]
}

export type TypeCategories = {
  type: BusinessTypeReference
  categoryIds: readonly number[]
  /** The list's first page as read, which Step 4 can show without reading it again. */
  firstPage?: ReferencePage<CategoryReference>
}

export type SavedTypeResolution =
  /** Step 3 is not saved yet: the type is still a choice. `preselect` is the record's match. */
  | { kind: 'open'; preselect: BusinessTypeReference | null }
  | { kind: 'saved'; type: BusinessTypeReference; source: 'record' | 'profile' | 'categories' }
  /** The answer depends on a read not made yet. */
  | { kind: 'needs'; read: 'categories' | 'type-categories' }
  /** Step 3 is saved but which type cannot be told. */
  | { kind: 'unresolved' }

/** The known type the vendor record names, other than the ambiguous `"Others"`. */
function namedType(evidence: SavedTypeEvidence): BusinessTypeReference | null {
  const name = evidence.profileTypeName?.trim()
  if (!name || name === AMBIGUOUS_BUSINESS_TYPE) return null
  return evidence.businessTypes.find((type) => type.name === name) ?? null
}

export function resolveSavedType(evidence: SavedTypeEvidence): SavedTypeResolution {
  if (evidence.confirmed) return { kind: 'saved', type: evidence.confirmed, source: 'record' }
  const named = namedType(evidence)
  if (!evidence.stepSaved) return { kind: 'open', preselect: named }
  if (named) return { kind: 'saved', type: named, source: 'profile' }

  const assigned = evidence.assignedCategoryIds
  if (!assigned) return { kind: 'needs', read: 'categories' }
  if (!assigned.length) return { kind: 'unresolved' }
  if (!evidence.typeCategories) return { kind: 'needs', read: 'type-categories' }
  const matches = evidence.typeCategories.filter(({ categoryIds }) => {
    const listed = new Set(categoryIds)
    return assigned.every((id) => listed.has(id))
  })
  return matches.length === 1
    ? { kind: 'saved', type: matches[0].type, source: 'categories' }
    : { kind: 'unresolved' }
}

/** Where the saved business type stands in this wizard visit. */
export type SavedTypeState =
  /** Not worked out yet, or not needed by the steps opened so far. */
  | { status: 'unknown' }
  /** Reading the evidence. */
  | { status: 'checking' }
  /** Nothing saved yet: the vendor may choose. */
  | { status: 'open' }
  /** Saved and locked. */
  | { status: 'saved'; type: BusinessTypeReference }
  /** Saved, type unknown. `retried` once a fresh check also failed: then support is the way on. */
  | { status: 'unresolved'; retried: boolean }

/** The resolved answer as the wizard holds it. */
export function savedTypeState(resolution: Exclude<SavedTypeResolution, { kind: 'needs' }>, retried: boolean): SavedTypeState {
  if (resolution.kind === 'open') return { status: 'open' }
  if (resolution.kind === 'saved') return { status: 'saved', type: resolution.type }
  return { status: 'unresolved', retried }
}

export const BUSINESS_TYPE_LOCKED_MESSAGE = 'Business type cannot be changed now. Contact support to change it.'

export function unresolvedTypeMessage(retried: boolean): string {
  return retried
    ? 'We still couldn’t confirm your saved business type. Try again later, or contact support to continue.'
    : 'We couldn’t confirm your saved business type. Try again.'
}
