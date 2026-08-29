import { describe, expect, it } from 'vitest'
import type { MeasurementCatalog } from './onboarding-measurement'
import {
  defaultUnitForMeasurement,
  measurementFromProduct,
  parseMeasurementUnits,
  reconcileSkuToProductMeasurement,
  reconcileUnitForMeasurement,
  unitOptionsForMeasurement,
  unitsForMeasurement,
} from './onboarding-measurement'

/**
 * The units a size is priced in come from the backend measurement catalog, not a table baked
 * into the frontend. These pure functions turn what a vendor's product carries — a measurement
 * id, or a name — into the units Step 6 offers. Everything here takes the fetched catalog as an
 * argument, so the mapping is testable where the step component is not. The catalog's ids are
 * deliberately non-contiguous (there is no 6), matching the backend; nothing may assume 1/2/3 or
 * index the list positionally.
 */
const CATALOG: MeasurementCatalog = [
  { id: 1, type: 'WEIGHT', units: ['kg', 'gr'], unitOptions: [0.5, 1, 2, 5] },
  { id: 2, type: 'VOLUME', units: ['L', 'ml'], unitOptions: [0.5, 1, 2, 5] },
  { id: 3, type: 'COUNT', units: ['pcs', 'dozen'], unitOptions: [1, 5, 10, 20] },
  // A gap where 6 would be, then 7, so anything positional or contiguous breaks here.
  { id: 7, type: 'SLOT', units: ['Time Slot'], unitOptions: [] },
]

describe('parseMeasurementUnits', () => {
  it('splits the comma-separated backend unit string', () => {
    expect(parseMeasurementUnits('kg,gr')).toEqual(['kg', 'gr'])
  })

  it('trims whitespace and drops empty segments', () => {
    expect(parseMeasurementUnits(' Per Wash , Per Visit ')).toEqual(['Per Wash', 'Per Visit'])
    expect(parseMeasurementUnits('L,,ml,')).toEqual(['L', 'ml'])
  })

  it('returns an empty list for an empty string', () => {
    expect(parseMeasurementUnits('')).toEqual([])
  })
})

describe('measurementFromProduct', () => {
  it('resolves a measurement by its id looked up in the catalog, never positionally', () => {
    // id 7 is the fourth entry: a positional map (1/2/3/4) would answer wrong here.
    expect(measurementFromProduct(7, null, CATALOG)).toBe('SLOT')
    expect(measurementFromProduct(2, null, CATALOG)).toBe('VOLUME')
  })

  it('falls back to the measurement name when the product carries no id', () => {
    // The sample catalog gives products a name and no id.
    expect(measurementFromProduct(null, 'WEIGHT', CATALOG)).toBe('WEIGHT')
    expect(measurementFromProduct(null, 'volume', CATALOG)).toBe('VOLUME')
  })

  it('lands on the first offered measurement for one the catalog has never seen', () => {
    // An id the catalog does not hold and an unknown name — still a real, offerable answer.
    expect(measurementFromProduct(999, 'LENGTH', CATALOG)).toBe('WEIGHT')
    expect(measurementFromProduct(null, null, CATALOG)).toBe('WEIGHT')
  })

  it('falls back to COUNT only when the catalog is empty', () => {
    expect(measurementFromProduct(1, 'WEIGHT', [])).toBe('COUNT')
  })
})

describe('units and defaults follow the catalog', () => {
  it('offers the catalog units for a measurement type', () => {
    expect(unitsForMeasurement('WEIGHT', CATALOG)).toEqual(['kg', 'gr'])
    expect(unitsForMeasurement('SLOT', CATALOG)).toEqual(['Time Slot'])
  })

  it('opens a new size on the first unit the catalog offers', () => {
    expect(defaultUnitForMeasurement('VOLUME', CATALOG)).toBe('L')
    expect(defaultUnitForMeasurement('COUNT', CATALOG)).toBe('pcs')
  })

  it('offers nothing for a type the catalog does not carry', () => {
    expect(unitsForMeasurement('AREA', CATALOG)).toEqual([])
    expect(defaultUnitForMeasurement('AREA', CATALOG)).toBe('')
  })
})

describe('unitOptionsForMeasurement', () => {
  it('returns the backend quantity suggestions to prefill Step 6', () => {
    expect(unitOptionsForMeasurement('WEIGHT', CATALOG)).toEqual([0.5, 1, 2, 5])
    expect(unitOptionsForMeasurement('COUNT', CATALOG)).toEqual([1, 5, 10, 20])
  })

  it('returns an empty list for a measurement with no suggestions', () => {
    expect(unitOptionsForMeasurement('SLOT', CATALOG)).toEqual([])
  })
})

describe('reconcileUnitForMeasurement', () => {
  it('keeps a unit the catalog still offers for the measurement', () => {
    expect(reconcileUnitForMeasurement('WEIGHT', 'gr', CATALOG)).toBe('gr')
  })

  it('falls a unit no longer valid for the measurement back to its first unit', () => {
    // 'pcs' belongs to COUNT, not WEIGHT — it snaps to WEIGHT's first unit.
    expect(reconcileUnitForMeasurement('WEIGHT', 'pcs', CATALOG)).toBe('kg')
  })

  it('leaves the unit untouched for a measurement the catalog lists no units for', () => {
    // AREA is absent from this catalog, so there is nothing to fall back to.
    expect(reconcileUnitForMeasurement('AREA', 'sqft', CATALOG)).toBe('sqft')
  })
})

describe('reconcileSkuToProductMeasurement', () => {
  const baseSku = {
    id: 'sku-1',
    productId: 1,
    name: 'Regular',
    description: '',
    skuType: 'ITEM' as const,
    measurementType: 'WEIGHT' as const,
    unit: 'kg',
    quantity: 1,
    listPrice: 60,
    salePrice: 55,
    active: true,
    homeDelivery: true,
    storePickup: true,
  }

  it('snaps a size whose measurement drifted off its product back to the product measurement', () => {
    const drifted = { ...baseSku, measurementType: 'COUNT' as const, unit: 'pcs' }
    const product = { measurementId: 1, measurementName: null } // WEIGHT
    const reconciled = reconcileSkuToProductMeasurement(drifted, product, CATALOG)
    expect(reconciled.measurementType).toBe('WEIGHT')
    expect(reconciled.unit).toBe('kg')
  })

  it('resolves the product measurement by name when it carries no id', () => {
    const drifted = { ...baseSku, measurementType: 'WEIGHT' as const, unit: 'kg' }
    const product = { measurementId: null, measurementName: 'VOLUME' }
    const reconciled = reconcileSkuToProductMeasurement(drifted, product, CATALOG)
    expect(reconciled.measurementType).toBe('VOLUME')
    expect(reconciled.unit).toBe('L')
  })

  it('keeps a still-valid unit when only the measurement was already correct', () => {
    const sku = { ...baseSku, measurementType: 'WEIGHT' as const, unit: 'gr' }
    const product = { measurementId: 1, measurementName: null } // WEIGHT
    const reconciled = reconcileSkuToProductMeasurement(sku, product, CATALOG)
    expect(reconciled.measurementType).toBe('WEIGHT')
    expect(reconciled.unit).toBe('gr')
  })

  it('returns the same reference when nothing needs to change', () => {
    const sku = { ...baseSku, measurementType: 'WEIGHT' as const, unit: 'kg' }
    const product = { measurementId: 1, measurementName: null } // WEIGHT
    expect(reconcileSkuToProductMeasurement(sku, product, CATALOG)).toBe(sku)
  })

  it('leaves the size untouched when no catalog has loaded yet', () => {
    // An empty catalog would otherwise resolve every product to COUNT and wipe the unit.
    const sku = { ...baseSku, measurementType: 'WEIGHT' as const, unit: 'kg' }
    const product = { measurementId: 1, measurementName: null }
    expect(reconcileSkuToProductMeasurement(sku, product, [])).toBe(sku)
  })
})
