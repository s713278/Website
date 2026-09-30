import { describe, expect, it } from 'vitest'
import { isStoreOrdersPath } from './store-paths'

describe('isStoreOrdersPath', () => {
  it('matches history, detail, and success', () => {
    expect(isStoreOrdersPath('/stores/273/orders')).toBe(true)
    expect(isStoreOrdersPath('/stores/273/orders/1941')).toBe(true)
    expect(isStoreOrdersPath('/stores/273/orders/1941/success')).toBe(true)
  })

  it('does not match shop, cart, or catalog', () => {
    expect(isStoreOrdersPath('/stores/273')).toBe(false)
    expect(isStoreOrdersPath('/stores/273/cart')).toBe(false)
    expect(isStoreOrdersPath('/stores/273/products/418')).toBe(false)
  })
})
