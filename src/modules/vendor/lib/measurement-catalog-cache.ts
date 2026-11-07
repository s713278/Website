import type { MeasurementCatalog } from '@/shared/api'

/**
 * One platform measurement catalog per session.
 *
 * The catalog is platform reference data — the same for every vendor, and untouched by
 * anything a vendor saves — but reading it costs a list request plus one detail request per
 * measurement. Without this, every wizard entry re-read it, and each saved step invalidates
 * the account snapshot, so it was fetched again on every return to setup.
 *
 * A leaf module like `vendor-context-cache`: the caller supplies the read, so sign-out
 * cleanup can clear it without pulling `@/shared/api` into the initial bundle.
 *
 * Only a successful read is retained. A failure is dropped so the next caller retries.
 */
type Entry = { promise: Promise<MeasurementCatalog>; resolved: MeasurementCatalog | null }

let entry: Entry | null = null

/** The already-resolved catalog, or `null`. Never fetches. */
export function peekMeasurementCatalog(): MeasurementCatalog | null {
  return entry?.resolved ?? null
}

export function loadMeasurementCatalog(
  read: () => Promise<MeasurementCatalog>,
): Promise<MeasurementCatalog> {
  if (entry) return entry.promise

  const current: Entry = { resolved: null, promise: read() }
  entry = current

  // Chained after the entry is stored so a late result never writes over a cleared cache.
  current.promise = current.promise
    .then((catalog) => {
      if (entry === current) current.resolved = catalog
      return catalog
    })
    .catch((error: unknown) => {
      if (entry === current) entry = null
      throw error
    })

  return current.promise
}

/** Drop the catalog so the next read hits the platform. Used on sign-out. */
export function invalidateMeasurementCatalog(): void {
  entry = null
}
