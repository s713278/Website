import type { ServerOnboardingState } from './onboarding-resume'

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
 * Drop cached state so the next read hits the account.
 *
 * Call after any write that changes what a resume would produce — every persisted step
 * and go-live — and on sign-out, where one vendor's store details must not outlive their
 * session.
 */
export function invalidateVendorOnboardingState(vendorId?: string): void {
  if (vendorId) entries.delete(vendorId)
  else entries.clear()
}
