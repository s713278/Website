import { describe, expect, it } from 'vitest'
import { mapCartPayload } from './cart'

describe('mapCartPayload', () => {
  it('maps OpenAPI cart data into storefront lines + summary', () => {
    const snap = mapCartPayload(
      {
        cart_id: 123,
        vendor_id: 10,
        items: [
          {
            cart_item_id: 99,
            sku_id: 101,
            sku_name: 'Fresh Milk - 1L',
            image_path: 'https://cdn.example.com/images/milk.jpg',
            quantity: 2,
            unit_price: 4.99,
          },
        ],
        cart_summary: {
          items_total: 9.98,
          delivery_charges: 0,
          discount: 0,
          service_charge: 0,
          grand_total: 9.98,
          items_count: 1,
          total_quantity: 2,
        },
        expires_at: '2026-09-09T20:59:36Z',
      },
      'Parth Store',
    )

    expect(snap.cartId).toBe('123')
    expect(snap.vendorId).toBe('10')
    expect(snap.lines).toEqual([
      {
        itemId: '101',
        storeId: '10',
        storeName: 'Parth Store',
        name: 'Fresh Milk - 1L',
        price: 4.99,
        qty: 2,
        lineTotal: 9.98,
        discount: 0,
        cartItemId: '99',
        skuId: '101',
        imageUrl: 'https://cdn.example.com/images/milk.jpg',
      },
    ])
    expect(snap.summary.grandTotal).toBe(9.98)
    expect(snap.summary.totalQuantity).toBe(2)
  })

  it('keeps list_price as MRP when it is higher than unit_price', () => {
    const snap = mapCartPayload(
      {
        cart_id: 1,
        vendor_id: 273,
        items: [
          {
            cart_item_id: 10,
            sku_id: 4153,
            sku_name: 'Mixed Vegetable Pickle',
            quantity: 3,
            unit_price: 245,
            list_price: 250,
            line_total: 735,
            discount: 5,
          },
        ],
        cart_summary: {
          items_total: 735,
          delivery_charges: 0,
          discount: 15,
          service_charge: 0,
          grand_total: 720,
          items_count: 1,
          total_quantity: 3,
        },
      },
      'Shop',
    )

    expect(snap.lines[0]).toMatchObject({
      price: 245,
      listPrice: 250,
      qty: 3,
      lineTotal: 735,
    })
  })
})
