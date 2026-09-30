import { describe, expect, it } from 'vitest'
import { lineMrpTotal, orderMrpTotal } from './order-display'
import type { CustomerOrder } from '@/shared/api/services/orders.service'

const pickle = {
  name: 'Mixed Vegetable Pickle',
  qty: 3,
  unitPrice: 210,
  listPrice: 220,
  lineTotal: 630,
}

describe('order MRP', () => {
  it('uses order_amount.gross_amount when it is higher than the paid total', () => {
    const order = {
      id: '1941',
      storeName: 'Shop',
      total: 630,
      status: 'SCHEDULED',
      placedAt: '2026-09-27',
      items: [pickle],
      bill: {
        itemsCount: 3,
        grossAmount: 660,
        discount: 30,
        deliveryCharges: 0,
        serviceCharge: 0,
        taxAmount: 0,
        amount: 630,
      },
    } satisfies CustomerOrder
    expect(orderMrpTotal(order)).toBe(660)
    expect(lineMrpTotal(pickle)).toBe(660)
  })

  it('hides strikethrough when list and sale are the same', () => {
    const item = { name: 'Masala', qty: 1, unitPrice: 30, listPrice: 30, lineTotal: 30 }
    expect(lineMrpTotal(item)).toBeUndefined()
  })
})
