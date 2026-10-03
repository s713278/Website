import { describe, expect, it, vi } from 'vitest'
import { canShopAsCustomer } from '@/app/router/role-home'
import type { User } from '@/shared/types'
import { cartNavTarget, customerLoginLink, visibleCartCount } from './cart-nav'

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

describe('cartNavTarget', () => {
  it('sends a vendor session to customer login', () => {
    expect(cartNavTarget(signedInVendor, '273')).toEqual({
      pathname: '/login',
      state: { from: '/stores/273/cart' },
    })
    expect(visibleCartCount(signedInVendor, 2)).toBe(0)
  })

  it('sends a logged-out visitor to login and hides the badge', () => {
    expect(cartNavTarget(null, '273')).toEqual({
      pathname: '/login',
      state: { from: '/stores/273/cart' },
    })
    expect(visibleCartCount(null, 2)).toBe(0)
  })
})
