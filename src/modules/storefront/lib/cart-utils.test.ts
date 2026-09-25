import { describe, expect, it } from 'vitest'
import {
  cartSkuIdsForProduct,
  enrichCartLinesWithCatalog,
  findProductForCartLine,
} from '@/modules/storefront/lib/cart-utils'
import type { CartLine, Product } from '@/modules/storefront/types'

const butterCookies: Product = {
  id: '171',
  name: 'Butter Cookies',
  description: '',
  price: 225,
  veg: true,
  defaultVariantId: '1895',
  variants: [
    {
      id: '1895',
      unit: '150g',
      price: 225,
      onSale: false,
      skuType: 'ITEM',
    },
  ],
}

describe('enrichCartLinesWithCatalog', () => {
  it('prefers catalog product_name over wrong API sku_name', () => {
    const apiLine: CartLine = {
      itemId: '1895',
      storeId: '117',
      storeName: 'Parth',
      name: 'Jowar Cookies - 150g',
      price: 225,
      qty: 1,
      lineTotal: 225,
      cartItemId: '20000004',
      skuId: '1895',
    }

    const [enriched] = enrichCartLinesWithCatalog([apiLine], [butterCookies], [])
    expect(enriched?.name).toBe('Butter Cookies (150g)')
    expect(enriched?.productId).toBe('171')
    expect(enriched?.skuId).toBe('1895')
    expect(enriched?.price).toBe(225)
    expect(enriched?.lineTotal).toBe(225)
  })

  it('lists each in-cart SKU separately', () => {
    const product: Product = {
      ...butterCookies,
      variants: [
        ...butterCookies.variants!,
        { id: '1896', unit: '300g', price: 400, onSale: false, skuType: 'ITEM' },
      ],
    }
    const lines: CartLine[] = [
      {
        itemId: '171:1895',
        storeId: '117',
        storeName: 'Parth',
        name: 'Butter Cookies (150g)',
        price: 225,
        qty: 1,
        productId: '171',
        skuId: '1895',
      },
      {
        itemId: '171:1896',
        storeId: '117',
        storeName: 'Parth',
        name: 'Butter Cookies (300g)',
        price: 400,
        qty: 2,
        productId: '171',
        skuId: '1896',
      },
    ]
    expect(cartSkuIdsForProduct(lines, '117', product)).toEqual(['1895', '1896'])
  })

  it('does not keep leftover Garlic name on a Biryani line after login sync', () => {
    const biryani: Product = {
      id: '423',
      name: 'Biryani Masala',
      description: '',
      price: 30,
      veg: true,
      defaultVariantId: '4404',
      variants: [{ id: '4404', unit: '1 pcs', price: 30, onSale: false, skuType: 'ITEM' }],
    }
    const garlic: Product = {
      id: '419',
      name: 'Garlic Pickle',
      description: '',
      price: 150,
      veg: true,
      defaultVariantId: '4407',
      variants: [{ id: '4407', unit: '500 gr', price: 150, onSale: false, skuType: 'ITEM' }],
    }
    const previous: CartLine[] = [
      {
        itemId: '423:4404',
        storeId: '273',
        storeName: 'Shop',
        name: 'Garlic Pickle (500 gr)',
        price: 30,
        qty: 2,
        productId: '423',
        skuId: '4404',
      },
    ]
    const [enriched] = enrichCartLinesWithCatalog(
      [
        {
          itemId: '4404',
          storeId: '273',
          storeName: 'Shop',
          name: 'Biryani Masala',
          price: 30,
          qty: 2,
          skuId: '4404',
        },
      ],
      [garlic, biryani],
      previous,
    )
    expect(enriched?.name).toBe('Biryani Masala (1 pcs)')
    expect(enriched?.skuId).toBe('4404')
    expect(enriched?.price).toBe(30)
  })

  it('does not turn Mixed Vegetable into leftover Amla 1 kg', () => {
    const amla: Product = {
      id: '418',
      name: 'Amla Pickle',
      description: '',
      price: 450,
      veg: true,
      defaultVariantId: '4153',
      variants: [
        { id: '4153', unit: '500 gr', price: 245, onSale: false, skuType: 'ITEM' },
        { id: '4152', unit: '1 KG', price: 450, onSale: false, skuType: 'ITEM' },
        { id: '4453', unit: '2 KG', price: 450, onSale: false, skuType: 'ITEM' },
      ],
    }
    const mixed: Product = {
      id: '432',
      name: 'Mixed Vegetable Pickle',
      description: '',
      price: 210,
      veg: true,
      defaultVariantId: '4602',
      variants: [{ id: '4602', unit: '500 gr', price: 210, onSale: false, skuType: 'ITEM' }],
    }
    const previous: CartLine[] = [
      {
        itemId: '418:4152',
        storeId: '273',
        storeName: 'Shop',
        name: 'Amla Pickle (1 KG)',
        price: 450,
        qty: 2,
        productId: '418',
        skuId: '4152',
      },
    ]
    const apiLines: CartLine[] = [
      ...previous,
      {
        itemId: '4602',
        storeId: '273',
        storeName: 'Shop',
        name: 'Item',
        price: 210,
        qty: 1,
        skuId: '4602',
      },
    ]

    const enriched = enrichCartLinesWithCatalog(apiLines, [amla, mixed], previous, {
      '4602': 'Mixed Vegetable Pickle (500 gr)',
    })
    expect(enriched.map((line) => ({ skuId: line.skuId, name: line.name, qty: line.qty }))).toEqual([
      { skuId: '4152', name: 'Amla Pickle (1 KG)', qty: 2 },
      { skuId: '4602', name: 'Mixed Vegetable Pickle (500 gr)', qty: 1 },
    ])
  })

  it('does not relabel another product as the one just added', () => {
    const milk: Product = {
      id: '1',
      name: 'Milk',
      description: '',
      price: 50,
      veg: true,
      defaultVariantId: '11',
      variants: [{ id: '11', unit: '1 L', price: 50, onSale: false, skuType: 'ITEM' }],
    }
    const cookieLine: CartLine = {
      itemId: '1895',
      storeId: '117',
      storeName: 'Parth',
      name: 'Jowar Cookies - 150g',
      price: 225,
      qty: 1,
      skuId: '1895',
    }
    const [enriched] = enrichCartLinesWithCatalog([cookieLine], [milk], [])
    expect(enriched?.name).toBe('Jowar Cookies - 150g')
    expect(enriched?.productId).not.toBe('1')
  })

  it('keeps 1 kg and 2 kg cart lines on the same product', () => {
    const pickle: Product = {
      id: '88',
      name: 'Amla Pickle',
      description: '',
      price: 240,
      veg: true,
      defaultVariantId: '201',
      variants: [
        { id: '201', unit: '1 kg', price: 240, onSale: false, skuType: 'ITEM' },
        { id: '202', unit: '2 kg', price: 450, onSale: false, skuType: 'ITEM' },
      ],
    }
    const lines: CartLine[] = [
      {
        itemId: '201',
        storeId: '117',
        storeName: 'Shop',
        name: 'Amla Pickle',
        price: 240,
        qty: 2,
        skuId: '201',
      },
      {
        itemId: '202',
        storeId: '117',
        storeName: 'Shop',
        name: 'Amla Pickle',
        price: 450,
        qty: 2,
        skuId: '202',
      },
    ]

    const enriched = enrichCartLinesWithCatalog(lines, [pickle], [])
    expect(enriched.map((line) => line.name)).toEqual([
      'Amla Pickle (1 kg)',
      'Amla Pickle (2 kg)',
    ])
  })

  it('keeps the tapped 2 kg label when catalog units collide', () => {
    const pickle: Product = {
      id: '88',
      name: 'Amla Pickle',
      description: '',
      price: 240,
      veg: true,
      defaultVariantId: '201',
      variants: [
        { id: '201', unit: '1 kg', price: 240, onSale: false, skuType: 'ITEM' },
        { id: '202', unit: '1 kg', price: 450, onSale: false, skuType: 'ITEM' },
      ],
    }
    const [enriched] = enrichCartLinesWithCatalog(
      [
        {
          itemId: '202',
          storeId: '117',
          storeName: 'Shop',
          name: 'Amla Pickle',
          price: 450,
          qty: 2,
          skuId: '202',
        },
      ],
      [pickle],
      [],
      { '202': 'Amla Pickle (2 kg)' },
    )
    expect(enriched?.name).toBe('Amla Pickle (2 kg)')
  })

  it('keeps an API size that the catalog would overwrite', () => {
    const pickle: Product = {
      id: '88',
      name: 'Amla Pickle',
      description: '',
      price: 240,
      veg: true,
      defaultVariantId: '202',
      variants: [{ id: '202', unit: '1 kg', price: 450, onSale: false, skuType: 'ITEM' }],
    }
    const [enriched] = enrichCartLinesWithCatalog(
      [
        {
          itemId: '202',
          storeId: '117',
          storeName: 'Shop',
          name: 'Amla Pickle - 2kg',
          price: 450,
          qty: 2,
          skuId: '202',
        },
      ],
      [pickle],
      [],
    )
    expect(enriched?.name).toBe('Amla Pickle - 2kg')
  })

  it('does not treat a vendor_product_id as a sku match', () => {
    const product: Product = {
      id: '1895',
      name: 'Wrong product',
      description: '',
      price: 10,
      veg: true,
      defaultVariantId: '9',
      variants: [{ id: '9', unit: '1 kg', price: 10, onSale: false, skuType: 'ITEM' }],
    }
    expect(
      findProductForCartLine([product], {
        itemId: '1895',
        storeId: '117',
        storeName: 'Parth',
        name: 'Cookies',
        price: 225,
        qty: 1,
        skuId: '1895',
      }),
    ).toBeUndefined()
  })

  it('finds product by sku when itemId is only sku_id', () => {
    const product = findProductForCartLine([butterCookies], {
      itemId: '1895',
      storeId: '117',
      storeName: 'Parth',
      name: 'x',
      price: 225,
      qty: 1,
      skuId: '1895',
    })
    expect(product?.name).toBe('Butter Cookies')
  })
})
