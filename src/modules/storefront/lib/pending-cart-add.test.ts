import { describe, expect, it } from 'vitest'
import { parsePendingCartAdd } from './pending-cart-add'

describe('parsePendingCartAdd', () => {
  const valid = {
    vendorId: '91',
    storeName: 'SVADA',
    productId: '12',
    skuId: '101',
    qty: 2,
    name: 'Mango Pickle',
    label: '500 g',
    price: 180,
    returnTo: '/stores/91/cart',
  }

  it('accepts a valid pending payload', () => {
    expect(parsePendingCartAdd(valid)).toEqual(valid)
  })

  it('rejects external returnTo', () => {
    expect(parsePendingCartAdd({ ...valid, returnTo: 'https://evil.test' })).toBeNull()
  })

  it('rejects missing skuId', () => {
    expect(parsePendingCartAdd({ ...valid, skuId: '' })).toBeNull()
  })
})
