import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CartLine } from '@/modules/storefront/types'

vi.mock('../mode', () => ({ isLiveApi: vi.fn(() => true) }))

vi.mock('@mithra/api-client', async () => {
  const actual = await vi.importActual<typeof import('@mithra/api-client')>('@mithra/api-client')
  return {
    ...actual,
    apiGet: (...args: unknown[]) => apiGet(...args),
    apiPatch: (...args: unknown[]) => apiPatch(...args),
    apiPost: (...args: unknown[]) => apiPost(...args),
  }
})

vi.mock('@/shared/lib/customer-location', () => ({
  reverseGeocode: vi.fn(),
}))

const apiGet = vi.fn()
const apiPatch = vi.fn()
const apiPost = vi.fn()

const { isLiveApi } = await import('../mode')
const { ordersService } = await import('./orders.service')

const line: CartLine = {
  itemId: '4153',
  storeId: '273',
  storeName: 'SRK Traditional Foods and Pickles',
  name: 'Amla Pickle',
  price: 245,
  qty: 1,
}

function placedOrder() {
  return {
    success: true,
    data: {
      order_id: 1972,
      vendor_id: 273,
      store_name: 'SRK Traditional Foods and Pickles',
      order_status: 'SCHEDULED',
      order_amount: { amount: 345 },
    },
  }
}

beforeEach(() => {
  vi.mocked(isLiveApi).mockReturnValue(true)
  apiGet.mockReset()
  apiPatch.mockReset()
  apiPost.mockReset()
  apiPost.mockResolvedValue(placedOrder())
})

describe('placeOrder address', () => {
  it('saves the confirmed pin before from-cart instead of reusing an older address id', async () => {
    apiPatch.mockResolvedValue({ success: true, data: { address_id: 2700 } })

    await ordersService.placeOrder({
      storeId: '273',
      storeName: 'SRK Traditional Foods and Pickles',
      address: 'Akota, Vadodara, Gujarat 390001, India',
      phone: '9898989898',
      lines: [line],
      deliveryFee: 100,
      total: 345,
      userId: '14752',
      addressId: 2562,
      lat: 22.3,
      lng: 73.18,
      city: 'Vadodara',
      state: 'Gujarat',
      zipCode: '390001',
      country: 'India',
    })

    expect(apiPatch).toHaveBeenCalledWith(
      '/v1/users/14752',
      {
        address: expect.objectContaining({
          address1: 'Akota, Vadodara, Gujarat 390001, India',
          city: 'Vadodara',
          state: 'Gujarat',
          zipCode: '390001',
          latitude: '22.3',
          longitude: '73.18',
        }),
      },
      { params: { setAsDefault: true } },
    )
    expect(apiGet).not.toHaveBeenCalled()
    expect(apiPost).toHaveBeenCalledWith(
      '/v1/orders/from-cart',
      expect.objectContaining({ address_id: 2700, vendor_id: 273 }),
    )
  })
})
