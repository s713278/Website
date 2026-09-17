import { describe, expect, it } from 'vitest'
import { mapPdpSkuDetail } from './storefront-products'

describe('SKU detail measurements', () => {
  it('keeps sibling quantities distinguishable when the API returns separate fields', () => {
    const details = [0.5, 1].map((quantity, index) => mapPdpSkuDetail({
      vendor_product_id: 900, sku_id: 4021 + index, sku_name: 'Milk',
      quantity_value: quantity, unit: 'L', sale_price: 55,
    }))

    expect(details.map((detail) => detail?.variants?.[0].unit)).toEqual(['0.5 L', '1 L'])
  })

  it('preserves legacy size labels used by existing responses', () => {
    expect(mapPdpSkuDetail({
      vendor_product_id: 900, sku_id: 4021, sku_name: 'Milk', sku_size: '500 ml', sale_price: 55,
    })?.variants?.[0].unit).toBe('500 ml')
  })
})
