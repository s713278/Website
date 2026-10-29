import type { VendorOnboardingDraftV1 } from '../types/onboarding'

/**
 * Pending-entry identity inside the wizard draft.
 *
 * A draft category or product has one of exactly two origins, and the difference decides
 * what the write path does with it:
 *
 * - **Reference** — read back from a catalog the vendor did not author (their account, or the
 *   sample fixtures). It already exists and must never be created.
 * - **Pending** (`pending: true`, id in the band below) — authored in this browser and not
 *   yet on the platform catalog. Step 4/5 creates it, then records the returned positive id.
 *
 * A pending id is a negative integer in a reserved band far below every sample fixture.
 * Sample fixtures occupy `-101 … -392` (see `onboarding-sample.ts`); the pending band is
 * `PENDING_ID_BASE` (`-1_000_000`) and downward, so the two can never be confused and a later
 * sample fixture cannot grow into it. The negative id lets draft-internal references keep
 * working unchanged — `product.categoryId` pointing at a pending category, `sku.productId` at
 * a pending product — until the create replaces it with the server's positive id.
 *
 * One descending sequence serves categories and products together, so a pending product can
 * never collide with a pending category. Anything outside the band is not from this producer
 * and is not a pending entry.
 */
export const PENDING_ID_BASE = -1_000_000

/** True only for an id minted into the pending band, never for a sample or account id. */
export function isPendingId(id: number): boolean {
  return Number.isSafeInteger(id) && id <= PENDING_ID_BASE
}

/**
 * The next pending id for a draft — one below the lowest pending id it already holds, or
 * `PENDING_ID_BASE` for a draft with none. Categories and products share the sequence, so
 * two pending entries can never receive the same id.
 */
export function nextPendingId(
  draft: Pick<VendorOnboardingDraftV1, 'categories' | 'products'>,
): number {
  const used = [...draft.categories, ...draft.products]
    .map((entry) => entry.id)
    .filter(isPendingId)
  return Math.min(PENDING_ID_BASE + 1, ...used) - 1
}
