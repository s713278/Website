import type { MeasurementCatalog } from '../lib/onboarding-measurement'

/**
 * A stand-in for `GET /v1/measurements/`, mirroring the shape and values verified against the
 * development backend on 2026-08-28. It backs Step 6 in demo mode — where no backend answers —
 * and is the fallback when the live fetch fails, so a size always opens with real, offerable
 * units rather than an empty dropdown.
 *
 * The identifiers are deliberately non-contiguous (there is no 6), matching the backend, so
 * anything that assumes `1/2/3` or indexes the list positionally breaks here first.
 */
export const SAMPLE_MEASUREMENT_CATALOG: MeasurementCatalog = [
  { id: 1, type: 'WEIGHT', units: ['kg', 'gr'], unitOptions: [0.5, 1, 2, 5] },
  { id: 2, type: 'VOLUME', units: ['L', 'ml'], unitOptions: [0.5, 1, 2, 5] },
  { id: 3, type: 'COUNT', units: ['pcs', 'dozen'], unitOptions: [1, 5, 10, 20] },
  { id: 4, type: 'AREA', units: ['Acre', 'sqft'], unitOptions: [50, 100, 500, 1000] },
  { id: 5, type: 'SERVICE_UNIT', units: ['Per Wash', 'Per Visit'], unitOptions: [] },
  { id: 7, type: 'SLOT', units: ['Time Slot'], unitOptions: [] },
]
