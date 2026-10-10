import { vendorOnboardingService, type MeasurementCatalog, type VendorContext } from '@/shared/api'
import { rememberVendorHeaderHint } from '@/modules/vendor/store/vendor-header-hint-store'
import type { OnboardingStep } from '../types/onboarding'
import { peekMeasurementCatalog } from './measurement-catalog-cache'
import { peekOnboardingResource, type OnboardingResourceData } from './onboarding-resource-cache'
import {
  loadAccountResource,
  loadPlatformMeasurements,
  loadServerOnboardingState,
  savedBusinessType,
  stepResources,
  type OnboardingResource,
  type ServerOnboardingState,
} from './onboarding-resume'
import {
  invalidateVendorOnboardingState,
  isCurrentEntry,
  peekVendorAccountContext,
  readEntry,
  writeEntry,
  type CacheEntry,
} from './onboarding-state-cache'
import { invalidateVendorContext, loadVendorContext } from './vendor-context-cache'

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
export { invalidateVendorOnboardingState }

/**
 * `context` is a vendor context the caller has only just read, such as sign-in's; the
 * snapshot then reuses it instead of requesting it a second time. Without one, the context
 * comes through the dashboard's context cache, so a context the session already holds or is
 * reading is shared. `force` reads a fresh one.
 */
export function loadVendorOnboardingState(
  vendorId: string,
  options: { force?: boolean; context?: VendorContext } = {},
): Promise<ServerOnboardingState> {
  const existing = readEntry(vendorId)
  if (existing && !options.force) return existing.promise
  if (options.force && !options.context) invalidateVendorContext(vendorId)

  const entry: CacheEntry = {
    resolved: null,
    promise: loadServerOnboardingState(
      vendorId,
      {},
      options.context ?? loadVendorContext(vendorId, (id) => vendorOnboardingService.getVendorContext(id)),
    ),
  }
  writeEntry(vendorId, entry)

  // Chained after the entry exists so the callbacks can compare against it by identity:
  // a sign-out or a forced reload replaces the entry, and a late resolution must never
  // write back over whatever replaced it.
  entry.promise = entry.promise
    .then((state) => {
      if (isCurrentEntry(vendorId, entry)) {
        entry.resolved = state
        // TEMP(vendor-header-hint): see docs/SESSION.md for removal.
        rememberVendorHeaderHint(state.context)
      }
      return state
    })
    .catch((error: unknown) => {
      if (isCurrentEntry(vendorId, entry)) invalidateVendorOnboardingState(vendorId)
      throw error
    })

  return entry.promise
}

/**
 * The vendor context alone: status, approval, store identifier and setup progress.
 *
 * For a caller that only needs to know where the store stands, like the marketing header.
 * `loadVendorOnboardingState` settles when the slowest of its profile, catalog, checkout and
 * measurement reads does, which on dev is seconds after the context itself. This is one
 * request, filed in the dashboard's context cache so that opening the dashboard next finds it
 * already loaded. A context an earlier read already resolved is returned without a request.
 */
export async function loadVendorAccountContext(
  vendorId: string,
): Promise<Pick<ServerOnboardingState, 'context'>> {
  const known = peekVendorAccountContext(vendorId)
  if (known) return { context: known }

  const context = await loadVendorContext(vendorId, (id) => vendorOnboardingService.getVendorContext(id))
  return { context }
}

export type StepResourceReads = { [R in OnboardingResource]?: Promise<OnboardingResourceData[R]> } & {
  units?: Promise<MeasurementCatalog>
}

/**
 * Starts, or joins, each read a step needs that has not already resolved: the account
 * resources `stepResources` lists and, with `withUnits`, the platform units. A resolved
 * read is left out; peek its cache for the value. `skip` leaves out reads the caller
 * already holds or handles itself, such as resources it applied before a save dropped them
 * from the cache. Defaults to none.
 *
 * Business types are a dependent read: they start only once the profile shows a saved
 * type, and resolve to `[]` without a request when it shows none.
 *
 * Never rejects as a whole. Each promise settles on its own, and an unobserved failure is
 * not reported as unhandled: the cache has already dropped it so the next caller retries.
 */
export function loadStepResources(
  vendorId: string,
  step: OnboardingStep,
  options: { submitted: boolean; withUnits: boolean; skip?: Iterable<OnboardingResource | 'units'> },
): StepResourceReads {
  const skip = new Set(options.skip ?? [])
  const needs = stepResources(step, { submitted: options.submitted })
  const reads: StepResourceReads = {}
  const wanted = (resource: OnboardingResource) =>
    !skip.has(resource) && peekOnboardingResource(vendorId, resource) === null

  for (const resource of needs.account) {
    if (resource === 'businessTypes' || !wanted(resource)) continue
    Object.assign(reads, { [resource]: loadAccountResource(vendorId, resource) })
  }
  if (needs.account.includes('businessTypes') && wanted('businessTypes')) {
    const profile = peekOnboardingResource(vendorId, 'profile')
    reads.businessTypes = (profile ? Promise.resolve(profile.value) : loadAccountResource(vendorId, 'profile'))
      .then((value) => savedBusinessType(value) ? loadAccountResource(vendorId, 'businessTypes') : [])
  }
  if (options.withUnits && needs.units && !skip.has('units') && peekMeasurementCatalog() === null) {
    reads.units = loadPlatformMeasurements()
  }

  for (const read of Object.values(reads)) read.catch(() => {})
  return reads
}
