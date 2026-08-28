import type { MeasurementCatalog, MeasurementCatalogEntry } from '@/shared/api'
import type { MeasurementType } from '../types/onboarding'

export type { MeasurementCatalog, MeasurementCatalogEntry }

/**
 * How a product is measured, and the units and quantity suggestions that follow from it —
 * sourced from the backend measurement catalog (`GET /v1/measurements/`), not a table baked
 * into the frontend.
 *
 * The catalog's identifiers are not contiguous (there is no 6) and nothing here indexes the
 * list positionally: a product's measurement is resolved by looking its id up in the fetched
 * catalog, and the units are whatever that entry carries. Every function takes the fetched
 * catalog as an argument so the mapping from what a vendor chose to what they are then
 * offered stays testable, which the step component is not.
 */
/** Split the backend's comma-separated `unit` into trimmed, non-empty units. */
export function parseMeasurementUnits(unit: string): string[] {
  return unit
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}

/** The catalog entry a measurement id names, or null when the catalog does not hold it. */
export function measurementEntryById(
  catalog: MeasurementCatalog,
  id: number | null,
): MeasurementCatalogEntry | null {
  if (id == null) return null
  return catalog.find((entry) => entry.id === id) ?? null
}

/** The catalog entry for a measurement type, or null when the catalog does not offer it. */
export function measurementEntryByType(
  catalog: MeasurementCatalog,
  type: MeasurementType,
): MeasurementCatalogEntry | null {
  return catalog.find((entry) => entry.type === type) ?? null
}

/**
 * The measurement a product is priced in.
 *
 * Resolved from the product's own measurement id looked up in the fetched catalog, then from
 * its measurement name (the sample catalog carries a name and no id), and failing both from
 * the first measurement the catalog offers — so a product the catalog cannot place still
 * lands on a real, offerable measurement rather than an empty unit list. An empty catalog
 * (nothing fetched yet) is the only case that falls back to `COUNT`.
 */
export function measurementFromProduct(
  measurementId: number | null,
  measurementName: string | null,
  catalog: MeasurementCatalog,
): MeasurementType {
  const byId = measurementEntryById(catalog, measurementId)
  if (byId) return byId.type
  const name = measurementName?.trim().toUpperCase()
  const byName = name ? catalog.find((entry) => entry.type === name) : undefined
  if (byName) return byName.type
  return catalog[0]?.type ?? 'COUNT'
}

/** The units a size may be priced in, for a product measured this way. */
export function unitsForMeasurement(
  type: MeasurementType,
  catalog: MeasurementCatalog,
): string[] {
  return measurementEntryByType(catalog, type)?.units ?? []
}

/** The unit a newly created size opens with — the first the catalog offers for this type. */
export function defaultUnitForMeasurement(
  type: MeasurementType,
  catalog: MeasurementCatalog,
): string {
  return unitsForMeasurement(type, catalog)[0] ?? ''
}

/** The quantity suggestions to prefill at Step 6 for a product measured this way. */
export function unitOptionsForMeasurement(
  type: MeasurementType,
  catalog: MeasurementCatalog,
): number[] {
  return measurementEntryByType(catalog, type)?.unitOptions ?? []
}

const MEASUREMENT_LABELS: Record<MeasurementType, string> = {
  WEIGHT: 'Weight',
  VOLUME: 'Volume',
  COUNT: 'Count',
  AREA: 'Area',
  SERVICE_UNIT: 'Service unit',
  DURATION: 'Duration',
  PER_PERSON: 'Per person',
  SLOT: 'Slot',
}

/** A human label for a measurement type in the Step 6 unit picker and the authoring form. */
export function measurementLabel(type: MeasurementType): string {
  return MEASUREMENT_LABELS[type] ?? type
}
