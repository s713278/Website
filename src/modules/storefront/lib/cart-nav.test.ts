import { describe, expect, it } from 'vitest'
import { customerLoginLink } from './cart-nav'

describe('customerLoginLink', () => {
  it('sends the shop name and logo so login is not the platform mark', () => {
    expect(
      customerLoginLink('/stores/273/cart', {
        name: 'SRK Traditional Foods',
        logoUrl: 'https://cdn.example.com/logo.png',
      }),
    ).toEqual({
      to: '/login',
      state: {
        from: '/stores/273/cart',
        shopName: 'SRK Traditional Foods',
        shopLogoUrl: 'https://cdn.example.com/logo.png',
      },
    })
  })

  it('omits empty shop fields', () => {
    expect(customerLoginLink('/stores/273', { name: '  ', logoUrl: '' })).toEqual({
      to: '/login',
      state: { from: '/stores/273' },
    })
  })
})
