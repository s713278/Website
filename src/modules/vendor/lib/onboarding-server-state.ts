import { loadServerOnboardingState, type ServerOnboardingState } from './onboarding-resume'
import {
  invalidateVendorOnboardingState,
  isCurrentEntry,
  readEntry,
  writeEntry,
  type CacheEntry,
} from './onboarding-state-cache'

/**
 * One read of the vendor's account, shared by everything that needs it.
 *
 * `loadServerOnboardingState` reads one step-sized account snapshot. Sign-in needs the result
 * to decide where to send the vendor, and the wizard needs the same result to hydrate —
 * without the cache, that read set would fan out twice, and the wizard would paint an
 * interactive Step 3 while the second set was still in flight.
 *
 * Only successful reads are retained. A failure is dropped so the next caller retries
 * rather than inheriting an error nobody can clear.
 *
 * The cache lives in `onboarding-state-cache` so that sign-out cleanup can invalidate it
 * without pulling this module — and the whole resume/API graph — into the initial bundle.
 */
export { peekVendorOnboardingState } from './onboarding-state-cache'
export { invalidateVendorOnboardingState }

export function loadVendorOnboardingState(
  vendorId: string,
  options: { force?: boolean } = {},
): Promise<ServerOnboardingState> {
  const existing = readEntry(vendorId)
  if (existing && !options.force) return existing.promise

  const entry: CacheEntry = { resolved: null, promise: loadServerOnboardingState(vendorId) }
  writeEntry(vendorId, entry)

  // Chained after the entry exists so the callbacks can compare against it by identity:
  // a sign-out or a forced reload replaces the entry, and a late resolution must never
  // write back over whatever replaced it.
  entry.promise = entry.promise
    .then((state) => {
      if (isCurrentEntry(vendorId, entry)) entry.resolved = state
      return state
    })
    .catch((error: unknown) => {
      if (isCurrentEntry(vendorId, entry)) invalidateVendorOnboardingState(vendorId)
      throw error
    })

  return entry.promise
}
