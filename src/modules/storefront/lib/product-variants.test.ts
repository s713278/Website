import { describe, expect, it } from 'vitest'
import {
  cartLineProductId,
  cartSkuId,
  parseCartLineId,
  resolveOwnedVariant,
  variantIdFromCartLine,
} from '@/modules/storefront/lib/product-variants'
import type { Product, ProductVariant } from '@/modules/storefront/types'

const mixedVeg: Product = {
  id: '432',
  name: 'Mixed Vegetable Pickle',
  description: '',
  price: 210,
  veg: true,
  defaultVariantId: '4602',
  variants: [{ id: '4602', unit: '500 gr', price: 210, onSale: false, skuType: 'ITEM' }],
}

const amla1kg: ProductVariant = {
  id: '4152',
  unit: '1 KG',
  price: 450,
  onSale: false,
  skuType: 'ITEM',
}

describe('parseCartLineId', () => {
  it('splits product and sku from one place', () => {
    expect(parseCartLineId('12:101')).toEqual({ productId: '12', skuId: '101', composite: true })
    expect(cartLineProductId('12:101')).toBe('12')
    expect(variantIdFromCartLine('12:101')).toBe('101')
  })

  it('treats a bare id as the product and default sku', () => {
    expect(parseCartLineId('12')).toEqual({ productId: '12', skuId: 'default', composite: false })
    expect(variantIdFromCartLine('12')).toBe('default')
  })
})

describe('resolveOwnedVariant', () => {
  it('ignores another product SKU so Mixed Vegetable cannot add Amla 1 kg', () => {
    const owned = resolveOwnedVariant(mixedVeg, amla1kg)
    expect(owned.id).toBe('4602')
    expect(cartSkuId(mixedVeg, amla1kg)).toBe('4602')
  })

  it('keeps a size that belongs to the product', () => {
    const own = mixedVeg.variants![0]!
    expect(cartSkuId(mixedVeg, own)).toBe('4602')
  })
})
