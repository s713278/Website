import type { MeasurementType } from '../types/onboarding'

/**
 * How a product is measured, and the units that follow from it.
 *
 * A product carries its measurement as a name rather than an identifier — the sample
 * catalog writes one and the account catalog reads one back. Step 6 turns that name into
 * the units a size is priced in, and the first unit of the list is the one a new size
 * opens with.
 *
 * This is the whole of that rule. It lives here rather than in the step so that the
 * mapping from what a vendor chose to what they are then offered is testable, which the
 * step component is not.
 */
export const MEASUREMENT_UNITS: Record<MeasurementType, string[]> = {
  WEIGHT: ['g', 'kg'],
  VOLUME: ['ml', 'l'],
  COUNT: ['piece', 'pack', 'dozen'],
}

export const UNIT_LABELS: Record<string, string> = {
  g: 'Gram (g)',
  kg: 'Kilogram (kg)',
  ml: 'Millilitre (ml)',
  l: 'Litre (l)',
  piece: 'Piece',
  pack: 'Pack',
  dozen: 'Dozen',
}

/**
 * The measurement behind a product's stored measurement name.
 *
 * Anything unrecognised — including a product the backend gave no measurement at all —
 * falls back to `COUNT`, which is the one measurement that suits any product badly rather
 * than suiting some products wrongly.
 */
export function measurementFromProduct(value: string | null): MeasurementType {
  const normalized = value?.toUpperCase()
  return normalized === 'WEIGHT' || normalized === 'VOLUME' || normalized === 'COUNT'
    ? normalized
    : 'COUNT'
}

/** The unit a newly created size opens with, for a product measured this way. */
export function defaultUnitForProduct(measurementName: string | null): string {
  return MEASUREMENT_UNITS[measurementFromProduct(measurementName)][0]
}
