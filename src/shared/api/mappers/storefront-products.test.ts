import { describe, expect, it } from 'vitest'
import { mapStorefrontProductDetail, mapStorefrontProductPage } from './storefront-products'

const amlaProduct = {
  success: true,
  status: '200',
  vendor_product_id: 418,
  product_name: 'Amla Pickle',
  category_id: 152,
  category_name: 'Pickles',
  product_image_path: 'https://cdn.example.com/Original_Amla_Pickle.webp',
  product_description: 'Tangy amla',
  active: true,
  min_sale_price: 245,
  max_sale_price: 450,
  starting_at: 245,
  default_sku_id: 4153,
  variants_count: 3,
  variants: [
    {
      sku_id: 4153,
      quantity_value: 500,
      unit: 'gr',
      sku_type: 'ITEM',
      active: true,
      price_id: 962,
      list_price: 250,
      sale_price: 245,
      discount: 5,
      on_sale: true,
    },
    {
      sku_id: 4152,
      quantity_value: 1,
      unit: 'KG',
      active: true,
      list_price: 500,
      sale_price: 450,
      on_sale: false,
    },
    {
      sku_id: 9999,
      quantity_value: 5,
      unit: 'KG',
      active: false,
      sale_price: 900,
    },
  ],
}

describe('mapStorefrontProductDetail', () => {
  it('maps one product and its active variants, with the default sku priced', () => {
    const product = mapStorefrontProductDetail(amlaProduct)

    expect(product).toMatchObject({
      id: '418',
      name: 'Amla Pickle',
      description: 'Tangy amla',
      category: 'Pickles',
      categoryId: 152,
      imageUrl: 'https://cdn.example.com/Original_Amla_Pickle.webp',
      price: 245,
      minPrice: 245,
      maxPrice: 450,
      startingAt: 245,
      defaultVariantId: '4153',
      variantsCount: 3,
    })
    expect(product?.variants?.map((variant) => [variant.id, variant.unit])).toEqual([
      ['4153', '500 gr'],
      ['4152', '1 KG'],
    ])
    expect(product?.variants?.[0]).toMatchObject({
      price: 245,
      listPrice: 250,
      onSale: true,
      discount: 5,
    })
  })

  it('reads the same product when it is nested under data', () => {
    const product = mapStorefrontProductDetail({ success: true, data: amlaProduct })
    expect(product?.id).toBe('418')
    expect(product?.variants).toHaveLength(2)
  })

  it('does not treat a paginated listing as one product', () => {
    expect(
      mapStorefrontProductDetail({
        result: [amlaProduct],
        page_number: 0,
        page_size: 10,
      }),
    ).toBeNull()
  })

  it('is unavailable when every variant is inactive', () => {
    expect(
      mapStorefrontProductDetail({
        ...amlaProduct,
        variants: amlaProduct.variants.map((variant) => ({ ...variant, active: false })),
      }),
    ).toBeNull()
  })
})

describe('mapStorefrontProductPage SKU search rows', () => {
  it('maps live Amla pickle 1 KG and 2 KG as different SKUs', () => {
    const page = mapStorefrontProductPage({
      result: [
        {
          vendor_product_id: 418,
          product_name: 'Amla Pickle',
          default_sku_id: 4153,
          variants_count: 3,
          variants: [
            {
              sku_id: 4153,
              quantity_value: 500,
              unit: 'gr',
              sale_price: 245,
              list_price: 250,
              active: true,
            },
            {
              sku_id: 4152,
              quantity_value: 1,
              unit: 'KG',
              sale_price: 450,
              list_price: 500,
              active: true,
            },
            {
              sku_id: 4453,
              quantity_value: 2,
              unit: 'KG',
              sale_price: 450,
              list_price: 500,
              active: true,
            },
          ],
        },
      ],
    })

    const variants = page.items[0]?.variants ?? []
    expect(variants.map((variant) => [variant.id, variant.unit])).toEqual([
      ['4153', '500 gr'],
      ['4152', '1 KG'],
      ['4453', '2 KG'],
    ])
    expect(variants[0]).toMatchObject({ price: 245, listPrice: 250, onSale: false })
    expect(variants[1]).toMatchObject({ price: 450, listPrice: 500 })
  })

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

  it('keeps 1 kg and 2 kg distinct when quantity_value is repeated', () => {
    const page = mapStorefrontProductPage({
      result: [
        {
          vendor_product_id: 88,
          sku_id: 201,
          product_name: 'Amla Pickle',
          sku_size: '1 kg',
          quantity_value: 1,
          unit: 'kg',
          sale_price: 240,
        },
        {
          vendor_product_id: 88,
          sku_id: 202,
          product_name: 'Amla Pickle',
          sku_size: '2 kg',
          quantity_value: 1,
          unit: 'kg',
          sale_price: 450,
        },
      ],
    })

    expect(page.items).toHaveLength(1)
    expect(page.items[0]?.variants?.map((variant) => variant.unit)).toEqual(['1 kg', '2 kg'])
  })

  it('reads a full size from unit when quantity_value is missing', () => {
    const page = mapStorefrontProductPage({
      result: [
        {
          vendor_product_id: 88,
          sku_id: 202,
          product_name: 'Amla Pickle',
          unit: '2 kg',
          sale_price: 450,
        },
      ],
    })

    expect(page.items[0]?.variants?.[0]?.unit).toBe('2 kg')
  })

  it('merges two SKU rows of the same product so Add cannot hit the wrong size', () => {
    const page = mapStorefrontProductPage({
      result: [
        {
          vendor_product_id: 12,
          sku_id: 101,
          product_name: 'Mango Pickle',
          sku_size: '250 g',
          quantity_value: 250,
          unit: 'g',
          sale_price: 180,
        },
        {
          vendor_product_id: 12,
          sku_id: 102,
          product_name: 'Mango Pickle',
          sku_size: '500 g',
          quantity_value: 500,
          unit: 'g',
          sale_price: 320,
        },
      ],
    })

    expect(page.items).toHaveLength(1)
    expect(page.items[0]?.id).toBe('12')
    expect(page.items[0]?.variants?.map((variant) => variant.id)).toEqual(['101', '102'])
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
