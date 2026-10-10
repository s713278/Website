import type { VendorContext } from '@/shared/api'
import type { ServerOnboardingState } from './onboarding-resume'
import { invalidateMeasurementCatalog } from './measurement-catalog-cache'
import { invalidateOnboardingResources } from './onboarding-resource-cache'
import { invalidateVendorContext, peekVendorContext } from './vendor-context-cache'

/**
 * The cache itself, with no runtime dependency on what fills it.
 *
 * Kept as a leaf module for the same reason as `onboarding-draft-keys`: app-level wiring
 * (sign-out cleanup in `AppProviders`) needs `invalidateVendorOnboardingState`, and
 * importing it from `onboarding-server-state` dragged `onboarding-resume` — and through
 * it `@/shared/api` and the onboarding defaults — into the initial bundle for every
 * marketing and storefront visitor, defeating the `lazy()` split on the vendor routes.
 *
 * The import above is `import type`, so it is erased at build time and nothing here
 * reaches the runtime graph.
 */
export type CacheEntry = {
  promise: Promise<ServerOnboardingState>
  resolved: ServerOnboardingState | null
}

const entries = new Map<string, CacheEntry>()

export function readEntry(vendorId: string): CacheEntry | undefined {
  return entries.get(vendorId)
}

export function writeEntry(vendorId: string, entry: CacheEntry): void {
  entries.set(vendorId, entry)
}

/** True while `entry` is still the entry stored for `vendorId` — an identity check. */
export function isCurrentEntry(vendorId: string, entry: CacheEntry): boolean {
  return entries.get(vendorId) === entry
}

/** The already-resolved state, or `null` if it has not arrived yet. Never fetches. */
export function peekVendorOnboardingState(vendorId: string): ServerOnboardingState | null {
  return entries.get(vendorId)?.resolved ?? null
}

/**
 * The vendor context from whichever account read has already resolved, in the order the
 * dashboard prefers: its own narrower cache, then the wizard's. Never fetches.
 */
export function peekVendorAccountContext(vendorId: string): VendorContext | null {
  return peekVendorContext(vendorId) ?? peekVendorOnboardingState(vendorId)?.context ?? null
}

/**
 * Drop only the vendor's combined snapshot, leaving its resource entries and context alone.
 * A save or go-live calls this beside its own scoped resource and context drops, so no
 * stale snapshot outlives the write.
 */
export function dropVendorOnboardingSnapshot(vendorId: string): void {
  entries.delete(vendorId)
}

/**
 * Drop both account snapshots, and the account resources they are built from, so the next
 * wizard or dashboard read hits the account.
 *
 * Used on sign-out, where one vendor's store details must not outlive their session, and
 * for test cleanup; a save or go-live drops only what it changed. The platform measurement
 * catalog is no vendor's data and no write changes it, so only the sign-out form (no
 * `vendorId`) drops it.
 */
export function invalidateVendorOnboardingState(vendorId?: string): void {
  if (vendorId) entries.delete(vendorId)
  else {
    entries.clear()
    invalidateMeasurementCatalog()
  }
  invalidateOnboardingResources(vendorId)
  invalidateVendorContext(vendorId)
}
