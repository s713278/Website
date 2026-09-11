import { describe, expect, it } from 'vitest'
import { enrichCartLinesWithCatalog, findProductForCartLine } from '@/modules/storefront/lib/cart-utils'
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
