import { describe, expect, it } from 'vitest'
import {
  cartLineSkuId,
  findVendorCartLine,
  isSameCartSku,
  lineMatchesVariant,
} from './cart-line-match'
import type { CartLine } from '@/modules/storefront/types'

function line(overrides: Partial<CartLine> & Pick<CartLine, 'itemId' | 'skuId'>): CartLine {
  return {
    storeId: '91',
    storeName: 'Shop',
    name: 'Pickle',
    price: 180,
    qty: 1,
    productId: '12',
    ...overrides,
  }
}

describe('isSameCartSku', () => {
  it('keeps two SKUs of the same product apart', () => {
    const small = line({ itemId: '12:101', skuId: '101' })
    const large = line({ itemId: '12:102', skuId: '102' })
    expect(isSameCartSku(small, large)).toBe(false)
  })

  it('uses stored sku_id before parsing itemId', () => {
    expect(cartLineSkuId(line({ itemId: '12:101', skuId: '101' }))).toBe('101')
    expect(cartLineSkuId({ itemId: '12', skuId: undefined })).toBe('12')
  })

  it('matches the same SKU after API remaps itemId to sku_id', () => {
    const local = line({ itemId: '12:101', skuId: '101' })
    const fromApi = line({ itemId: '101', skuId: '101' })
    expect(isSameCartSku(local, fromApi)).toBe(true)
  })
})

describe('findVendorCartLine', () => {
  const small = line({ itemId: '12:101', skuId: '101', cartItemId: 'c1' })
  const large = line({ itemId: '12:102', skuId: '102', cartItemId: 'c2' })

  it('finds a composite product:sku id without grabbing the other size', () => {
    expect(findVendorCartLine([small, large], '91', '12:102')?.skuId).toBe('102')
  })

  it('finds by cart item id', () => {
    expect(findVendorCartLine([small, large], '91', 'c1')?.skuId).toBe('101')
  })
})

describe('lineMatchesVariant', () => {
  it('does not treat a sibling SKU as the selected size', () => {
    const large = line({ itemId: '12:102', skuId: '102' })
    expect(lineMatchesVariant(large, '91', '12', '101')).toBe(false)
    expect(lineMatchesVariant(large, '91', '12', '102')).toBe(true)
  })
})
