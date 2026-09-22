import { describe, expect, it } from 'vitest'
import { mapStorefrontProductPage } from './storefront-products'

describe('mapStorefrontProductPage SKU search rows', () => {
  it('uses sku_name so search hits do not render as Item', () => {
    const page = mapStorefrontProductPage({
      result: [
        {
          sku_id: 661,
          vendor_product_id: 12,
          sku_name: 'Chicken Biryani',
          sku_type: 'ITEM',
          sale_price: 180,
          list_price: 200,
          image_path: 'https://cdn.example.com/biryani.jpg',
        },
      ],
    })

    expect(page.items).toHaveLength(1)
    expect(page.items[0]?.name).toBe('Chicken Biryani')
    expect(page.items[0]?.id).toBe('12')
    expect(page.items[0]?.price).toBe(180)
    expect(page.items[0]?.imageUrl).toBe('https://cdn.example.com/biryani.jpg')
  })

  it('does not treat sku_type ITEM as the product title', () => {
    const page = mapStorefrontProductPage({
      result: [
        {
          sku_id: 7,
          name: 'ITEM',
          sku_name: 'Hyderabadi Biryani',
          sale_price: 220,
        },
      ],
    })

    expect(page.items[0]?.name).toBe('Hyderabadi Biryani')
  })
})
