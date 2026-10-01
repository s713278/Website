import { describe, expect, it } from 'vitest'
import {
  isStoreContactPath,
  isStoreHomePath,
  storeBackFallback,
  storeContactPath,
} from './store-paths'

describe('storeContactPath', () => {
  it('points at the shop Contact us page', () => {
    expect(storeContactPath('91')).toBe('/stores/91/contact')
  })

  it('matches only the contact page', () => {
    expect(isStoreContactPath('/stores/91/contact')).toBe(true)
    expect(isStoreContactPath('/stores/91')).toBe(false)
    expect(isStoreContactPath('/stores/91/orders')).toBe(false)
  })
})

describe('storeBackFallback', () => {
  it('is hidden on the shop home', () => {
    expect(isStoreHomePath('/stores/273')).toBe(true)
    expect(isStoreHomePath('/stores/273?search=1')).toBe(true)
    expect(storeBackFallback('/stores/273')).toBeNull()
  })

  it('returns one step up on nested shop pages', () => {
    expect(storeBackFallback('/stores/273/products/423?sku=4404')).toBe('/stores/273')
    expect(storeBackFallback('/stores/273/contact')).toBe('/stores/273')
    expect(storeBackFallback('/stores/273/cart')).toBe('/stores/273')
    expect(storeBackFallback('/stores/273/checkout')).toBe('/stores/273/cart')
    expect(storeBackFallback('/stores/273/orders')).toBe('/stores/273')
    expect(storeBackFallback('/stores/273/orders/1941')).toBe('/stores/273/orders')
    expect(storeBackFallback('/stores/273/orders/1941/success')).toBe('/stores/273/orders/1941')
    expect(storeBackFallback('/stores/273/location?from=/stores/273/checkout')).toBe(
      '/stores/273/checkout',
    )
  })
})
