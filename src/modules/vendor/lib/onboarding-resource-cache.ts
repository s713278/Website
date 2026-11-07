import type {
  BusinessTypeReference,
  CheckoutOptionsSnapshot,
  VendorCategoryRef,
  VendorProductRef,
  VendorProfile,
  VendorSkuRef,
} from '@/shared/api'
import type { OnboardingResource } from './onboarding-resume'

/**
 * One in-flight, then one resolved, read per vendor and account resource.
 *
 * A leaf module, like `vendor-context-cache`: sign-out cleanup reaches it from app-level
 * wiring, so it must not pull `@/shared/api` or the resume graph into the initial bundle.
 * Every import above is `import type`; the reads themselves are supplied by the caller.
 *
 * Only successful reads are retained. A failure is dropped so the next caller retries. A
 * late result for an entry that was invalidated meanwhile still reaches its own caller but
 * is never stored, judged by entry identity as in `vendor-context-cache`.
 */
export type OnboardingResourceData = {
  profile: VendorProfile | null
  businessTypes: BusinessTypeReference[]
  categories: VendorCategoryRef[]
  products: VendorProductRef[]
  skus: VendorSkuRef[]
  /** `null` is a first-time vendor's 404, which the service maps; it is a real answer. */
  checkout: CheckoutOptionsSnapshot | null
}

type Entry<R extends OnboardingResource> = {
  promise: Promise<OnboardingResourceData[R]>
  /** Wrapped so a resolved `null` checkout differs from "not resolved yet". */
  resolved: { value: OnboardingResourceData[R] } | null
}

const entries = new Map<string, Map<OnboardingResource, Entry<OnboardingResource>>>()

function readEntry<R extends OnboardingResource>(vendorId: string, resource: R): Entry<R> | undefined {
  return entries.get(vendorId)?.get(resource) as Entry<R> | undefined
}

export function loadOnboardingResource<R extends OnboardingResource>(
  vendorId: string,
  resource: R,
  read: () => Promise<OnboardingResourceData[R]>,
): Promise<OnboardingResourceData[R]> {
  const existing = readEntry(vendorId, resource)
  if (existing) return existing.promise

  const entry: Entry<R> = { resolved: null, promise: read() }
  let vendorEntries = entries.get(vendorId)
  if (!vendorEntries) {
    vendorEntries = new Map()
    entries.set(vendorId, vendorEntries)
  }
  vendorEntries.set(resource, entry as Entry<OnboardingResource>)

  // Chained after the entry is stored so these callbacks can compare by identity.
  entry.promise = entry.promise
    .then((value) => {
      if (readEntry(vendorId, resource) === entry) entry.resolved = { value }
      return value
    })
    .catch((error: unknown) => {
      if (readEntry(vendorId, resource) === entry) entries.get(vendorId)?.delete(resource)
      throw error
    })

  return entry.promise
}

/** The resolved value, or `null` while not loaded or still in flight. Never fetches. */
export function peekOnboardingResource<R extends OnboardingResource>(
  vendorId: string,
  resource: R,
): { value: OnboardingResourceData[R] } | null {
  return readEntry(vendorId, resource)?.resolved ?? null
}

/** No vendorId: every vendor. No resources: every resource for the vendor(s). */
export function invalidateOnboardingResources(
  vendorId?: string,
  resources?: readonly OnboardingResource[],
): void {
  const vendors = vendorId ? [vendorId] : [...entries.keys()]
  for (const id of vendors) {
    const vendorEntries = entries.get(id)
    if (!vendorEntries) continue
    if (resources) for (const resource of resources) vendorEntries.delete(resource)
    else entries.delete(id)
  }
}
