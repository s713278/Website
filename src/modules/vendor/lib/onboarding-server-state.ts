import { vendorOnboardingService, type MeasurementCatalog, type VendorContext } from '@/shared/api'
import type { OnboardingStep } from '../types/onboarding'
import { peekMeasurementCatalog } from './measurement-catalog-cache'
import { peekOnboardingResource, type OnboardingResourceData } from './onboarding-resource-cache'
import {
  backendResumeStep,
  clampResumePointer,
  loadAccountResource,
  loadPlatformMeasurements,
  savedBusinessType,
  stepResources,
  type OnboardingResource,
} from './onboarding-resume'
import { loadVendorContext, peekVendorContext } from './vendor-context-cache'

/**
 * The vendor context alone: status, approval, store identifier and setup progress.
 *
 * For a caller that only needs to know where the store stands, like the marketing header or
 * sign-in. One request, filed in the dashboard's context cache so that opening the dashboard
 * or the wizard next finds it already loaded. A context an earlier read already resolved is
 * returned without a request.
 */
export async function loadVendorAccountContext(vendorId: string): Promise<{ context: VendorContext }> {
  const known = peekVendorContext(vendorId)
  if (known) return { context: known }

  const context = await loadVendorContext(vendorId, (id) => vendorOnboardingService.getVendorContext(id))
  return { context }
}

/**
 * Sign-in's head start for a vendor headed into setup: the context, the profile and the
 * landing step's account resources, without the units. Every read goes through the caches
 * the wizard reads from, so the wizard joins these requests instead of repeating them.
 *
 * The landing step is `nextStep` (`verify-otp`'s pointer) under the wizard's own clamp when
 * usable, otherwise the context's pointer once it resolves; with neither, only the context
 * and profile start, and the wizard owns the fallback. `context` is one the caller has just
 * read, reused instead of requested again. Only reached for an unsubmitted store.
 *
 * Never awaited and never rejects: a failed read is dropped from its cache and the wizard
 * retries it.
 */
export function prefetchOnboardingLanding(
  vendorId: string,
  options: { nextStep?: number | null; context?: VendorContext } = {},
): void {
  const contextRead = options.context
    ? Promise.resolve(options.context)
    : loadVendorContext(vendorId, (id) => vendorOnboardingService.getVendorContext(id))
  contextRead.catch(() => {})
  loadAccountResource(vendorId, 'profile').catch(() => {})

  const fromSignIn = clampResumePointer(options.nextStep)
  const landing = fromSignIn !== null ? Promise.resolve(fromSignIn) : contextRead.then(backendResumeStep)
  landing
    .then((step) => {
      if (step !== null) loadStepResources(vendorId, step, { submitted: false, approved: false, withUnits: false })
    })
    .catch(() => {})
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
  options: { submitted: boolean; approved: boolean; withUnits: boolean; skip?: Iterable<OnboardingResource | 'units'> },
): StepResourceReads {
  const skip = new Set(options.skip ?? [])
  const needs = stepResources(step, options)
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
