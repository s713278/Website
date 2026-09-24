import { describe, expect, it } from 'vitest'
import {
  extractAddressId,
  mapCreateOrderFromCartBody,
  mapCustomerOrder,
  mapCustomerOrderDetail,
  mapCustomerOrderHistory,
  mapNameAndAddressRequest,
  mapPlacedOrder,
} from './storefront-order'

describe('mapCreateOrderFromCartBody', () => {
  it('builds the documented HOME_DELIVERY from-cart body', () => {
    expect(
      mapCreateOrderFromCartBody({
        vendorId: '1',
        deliveryMethod: 'HOME_DELIVERY',
        addressId: 100,
        deliveryDate: '2026-09-19',
        orderTimingType: 'FIXED_WINDOW',
        paymentTypeId: '76',
        notes: 'Slot: Sat, 19 Sep · Cash on delivery',
      }),
    ).toEqual({
      vendor_id: 1,
      delivery_method: 'HOME_DELIVERY',
      address_id: 100,
      delivery_date: '2026-09-19',
      order_timing_type: 'FIXED_WINDOW',
      payment_type_id: 76,
      notes: 'Slot: Sat, 19 Sep · Cash on delivery',
      clear_cart: true,
      order_source: 'APP',
    })
  })

  it('reads a date from a date chip id and skips non-numeric payment ids', () => {
    const body = mapCreateOrderFromCartBody({
      vendorId: '1',
      deliveryDate: 'date-2026-09-21',
      paymentTypeId: 'cod',
    })
    expect(body.delivery_date).toBe('2026-09-21')
    expect(body.payment_type_id).toBeUndefined()
    expect(body.delivery_method).toBe('HOME_DELIVERY')
  })

  it('uses pickup fields for store pickup', () => {
    expect(
      mapCreateOrderFromCartBody({
        vendorId: '91',
        deliveryMethod: 'STORE_PICKUP',
        pickupSlot: 'MORNING',
      }),
    ).toEqual({
      vendor_id: 91,
      delivery_method: 'STORE_PICKUP',
      pickup_address_id: 91,
      pickup_slot: 'Morning',
      clear_cart: true,
      order_source: 'APP',
    })
  })

  it('rejects a non-numeric vendor id', () => {
    expect(() => mapCreateOrderFromCartBody({ vendorId: 'r1' })).toThrow(
      'This store cannot accept an order right now.',
    )
  })
})

describe('mapNameAndAddressRequest', () => {
  it('maps a pin onto the live add-address keys including lat/lng/zip', () => {
    expect(
      mapNameAndAddressRequest({
        name: 'Aneri',
        location: 'Road No 27F, Miyapur, Hyderabad, Telangana 500049, India',
        lat: 17.49,
        lng: 78.39,
      }),
    ).toEqual({
      name: 'Aneri',
      address: {
        address1: 'Road No 27F, Miyapur, Hyderabad, Telangana 500049, India',
        city: 'Hyderabad',
        state: 'Telangana',
        zipCode: '500049',
        country: 'India',
        latitude: '17.49',
        longitude: '78.39',
      },
    })
  })

  it('rejects a pin that is missing city, pincode, or coordinates', () => {
    expect(() =>
      mapNameAndAddressRequest({
        name: 'Aneri',
        location: 'Hyderabad',
        lat: 17.38,
        lng: 78.48,
      }),
    ).toThrow(/pincode/)
  })
})

describe('extractAddressId', () => {
  it('reads address_id from an add-address envelope', () => {
    expect(extractAddressId({ success: true, data: { address_id: 100 } })).toBe(100)
    expect(extractAddressId({ data: { addresses: [{ id: 12 }, { id: 44 }] } })).toBe(44)
    expect(extractAddressId({ data: { id: 100, city: 'Hyderabad' } })).toBe(100)
  })

  it('prefers the default AddressDTO on a user profile', () => {
    expect(
      extractAddressId({
        data: {
          id: 14752,
          addresses: [
            { id: 12, type: 'Home', default_one: false },
            { id: 88, type: 'Home', defaultOne: true },
          ],
        },
      }),
    ).toBe(88)
  })

  it('does not treat a user profile id as an address id', () => {
    expect(extractAddressId({ data: { id: 12552, name: 'Aneri', email: 'a@b.com' } })).toBeNull()
  })
})

describe('mapPlacedOrder', () => {
  it('maps OrderDTO fields from from-cart', () => {
    expect(
      mapPlacedOrder(
        {
          data: {
            order_id: 4021,
            vendor_id: 1,
            store_name: 'Anitha Homemade Pickles',
            order_status: 'SCHEDULED',
            order_date: '2026-09-19T10:00:00',
            order_amount: { amount: 952 },
          },
        },
        { storeId: '1', storeName: 'Store', total: 0 },
      ),
    ).toEqual({
      id: '4021',
      storeId: '1',
      storeName: 'Anitha Homemade Pickles',
      total: 952,
      status: 'SCHEDULED',
      placedAt: '2026-09-19T10:00:00',
    })
  })
})

describe('mapCustomerOrder', () => {
  it('maps a customer order-detail payload', () => {
    expect(
      mapCustomerOrderDetail({
        data: {
          order_id: 1720,
          vendor_id: 91,
          store_name: 'FreshMart',
          order_status: 'PENDING',
          created_at: '2026-04-18T09:30:00',
          order_amount: { amount: 59.97 },
          order_items: [
            { sku_id: 1452, sku_name: 'Organic Milk', size: '1L', quantity: 2, image_path: '/a.jpg' },
          ],
        },
      }),
    ).toEqual({
      id: '1720',
      storeId: '91',
      storeName: 'FreshMart',
      total: 59.97,
      status: 'PENDING',
      placedAt: '2026-04-18T09:30:00',
      items: [{ name: 'Organic Milk (1L)', qty: 2, itemId: '1452', imageUrl: '/a.jpg' }],
    })
  })

  it('maps history rows from result or a flat list', () => {
    expect(
      mapCustomerOrderHistory({
        data: {
          result: [{ order_id: 9, vendor_name: 'Shop', amount: 30, order_status: 'DELIVERED' }],
        },
      }),
    ).toEqual([
      expect.objectContaining({ id: '9', storeName: 'Shop', total: 30, status: 'DELIVERED' }),
    ])
    expect(mapCustomerOrder({ id: 3, vendor_name: 'Shop' })?.id).toBe('3')
  })
})
