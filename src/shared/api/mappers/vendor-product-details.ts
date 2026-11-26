import { unwrapData } from '@mithra/api-client'
import type { ProductFeature, VendorProductDetails } from '@/modules/vendor/types/dashboard'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Features hold free JSON; a non-string detail is shown as its JSON text rather than dropped. */
function detailText(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value) ?? ''
}

/**
 * `GET /v1/vendors/{vendor_id}/products/{product_id}`. A `map` becomes rows in key order; a
 * `list` becomes rows with no label, which the vendor must label before saving. Missing
 * features become no rows.
 */
export function mapVendorProductDetails(payload: unknown): VendorProductDetails {
  const data: unknown = unwrapData(payload)
  if (!isRecord(data)) throw new Error('Could not read this product. Please try again.')

  let features: ProductFeature[] = []
  if (data.features_type === 'list' && Array.isArray(data.features_list)) {
    features = data.features_list.map((item) => ({ label: '', detail: detailText(item) }))
  } else if (isRecord(data.features_map)) {
    features = Object.entries(data.features_map).map(([label, detail]) => ({ label, detail: detailText(detail) }))
  }

  return { description: typeof data.description === 'string' ? data.description : '', features }
}

/**
 * Features are always written as an object, Label → Detail, in row order. No rows gives `{}`,
 * which resets the product to the catalog default features.
 */
export function vendorProductFeaturesToWire(features: ProductFeature[]): Record<string, string> {
  return Object.fromEntries(features.map(({ label, detail }) => [label, detail]))
}
