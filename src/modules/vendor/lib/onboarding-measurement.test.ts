import { describe, expect, it } from 'vitest'
import {
  MEASUREMENT_UNITS,
  defaultUnitForProduct,
  measurementFromProduct,
} from './onboarding-measurement'

/**
 * The measurement a product carries is a name, not an identifier, and it arrives from two
 * places that disagree about case and completeness: the sample catalog writes one, and the
 * account read returns whatever the backend holds — including nothing at all. Step 6 turns
 * that name into the units a size is priced in, so every shape it can arrive in has to
 * land somewhere sensible rather than leaving a size with no unit.
 */
describe('measurementFromProduct', () => {
  it.each(['WEIGHT', 'VOLUME', 'COUNT'] as const)('recognises %s', (measurement) => {
    expect(measurementFromProduct(measurement)).toBe(measurement)
  })

  it('reads a measurement whatever case the backend sends it in', () => {
    expect(measurementFromProduct('weight')).toBe('WEIGHT')
    expect(measurementFromProduct('Volume')).toBe('VOLUME')
  })

  /**
   * `COUNT` is the fallback because it is the one measurement that suits any product
   * badly rather than suiting some products wrongly — a vendor sees a unit they must
   * change, not a plausible-looking gram price on a product sold by the piece.
   */
  it('falls back to COUNT for a product the backend gave no measurement', () => {
    expect(measurementFromProduct(null)).toBe('COUNT')
  })

  it('falls back to COUNT for a measurement it does not know', () => {
    expect(measurementFromProduct('LENGTH')).toBe('COUNT')
    expect(measurementFromProduct('')).toBe('COUNT')
  })
})

describe('defaultUnitForProduct', () => {
  it.each([
    { measurement: 'WEIGHT', unit: 'g' },
    { measurement: 'VOLUME', unit: 'ml' },
    { measurement: 'COUNT', unit: 'piece' },
  ])('opens a $measurement product with $unit', ({ measurement, unit }) => {
    expect(defaultUnitForProduct(measurement)).toBe(unit)
  })

  it('opens an unmeasured product with the COUNT default', () => {
    expect(defaultUnitForProduct(null)).toBe('piece')
  })

  /**
   * Step 6 offers `MEASUREMENT_UNITS[measurementType]` in the unit dropdown and opens a new
   * size on this function's answer. If the two ever disagreed, a new size would show a unit
   * that is not in its own list.
   */
  it('always returns a unit the sizes step actually offers', () => {
    for (const measurement of ['WEIGHT', 'VOLUME', 'COUNT'] as const) {
      const unit = defaultUnitForProduct(measurement)
      expect(MEASUREMENT_UNITS[measurement]).toContain(unit)
    }
  })
})
