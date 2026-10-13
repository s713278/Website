import { describe, expect, it, vi } from 'vitest'
import { canShopAsCustomer } from '@/app/router/role-home'
import type { User } from '@/shared/types'
import { canHoldCart, customerLoginLink, visibleCartCount } from './cart-nav'

vi.mock('@/shared/api', () => ({
  isLiveApi: () => true,
}))

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

const signedInVendor = {
  id: 'u-1',
  role: 'vendor',
  roles: ['vendor'],
} as User

describe('canShopAsCustomer', () => {
  it('does not treat a vendor login as a customer session, even when the phone has both roles', () => {
    const dual = { role: 'vendor', roles: ['vendor', 'customer'] } as User
    expect(canShopAsCustomer(dual)).toBe(false)
    expect(canShopAsCustomer({ role: 'customer', roles: ['customer', 'vendor'] } as User)).toBe(true)
    expect(canShopAsCustomer(null)).toBe(false)
  })
})

describe('canHoldCart in live mode', () => {
  it('lets only a customer session hold a cart', () => {
    expect(canHoldCart({ role: 'customer', roles: ['customer'] } as User)).toBe(true)
  })

  it('hides the cart and its badge from a vendor session', () => {
    expect(canHoldCart(signedInVendor)).toBe(false)
    expect(visibleCartCount(signedInVendor, 2)).toBe(0)
  })

  it('hides the cart and its badge from a signed-out visitor', () => {
    expect(canHoldCart(null)).toBe(false)
    expect(visibleCartCount(null, 2)).toBe(0)
  })
})
