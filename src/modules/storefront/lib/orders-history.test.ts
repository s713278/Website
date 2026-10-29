import { describe, expect, it } from 'vitest'
import type { CustomerOrder } from '@/shared/api'
import {
  collectStoreOrdersFromPages,
  mergeOrderPages,
  orderBelongsToStore,
} from './orders-history'

function order(id: string, storeId?: string): CustomerOrder {
  return {
    id,
    storeId,
    storeName: 'Shop',
    total: 10,
    status: 'SCHEDULED',
    placedAt: '2026-09-25T00:00:00.000Z',
    items: [{ name: 'Item', qty: 1 }],
  }
}

describe('orderBelongsToStore', () => {
  it('keeps this shop and rows with no vendor id', () => {
    expect(orderBelongsToStore(order('1', '273'), '273')).toBe(true)
    expect(orderBelongsToStore(order('2'), '273')).toBe(true)
    expect(orderBelongsToStore(order('3', '91'), '273')).toBe(false)
  })
})

describe('mergeOrderPages', () => {
  it('appends new ids and skips duplicates', () => {
    expect(mergeOrderPages([order('1')], [order('1'), order('2')]).map((row) => row.id)).toEqual([
      '1',
      '2',
    ])
  })
})

describe('collectStoreOrdersFromPages', () => {
  it('skips pages that belong to other shops until this shop or last_page', async () => {
    const fetchPage = async (page: number) => {
      if (page === 0) {
        return { orders: [order('8', '91')], pageNumber: 0, lastPage: false }
      }
      return { orders: [order('9', '273')], pageNumber: 1, lastPage: true }
    }

    await expect(
      collectStoreOrdersFromPages({ storeId: '273', startPage: 0, fetchPage }),
    ).resolves.toEqual({
      orders: [expect.objectContaining({ id: '9', storeId: '273' })],
      pageNumber: 1,
      lastPage: true,
    })
  })

  it('stops when the first page already has this shop', async () => {
    let calls = 0
    const snap = await collectStoreOrdersFromPages({
      storeId: '273',
      startPage: 0,
      fetchPage: async (page) => {
        calls += 1
        return { orders: [order(String(page), '273')], pageNumber: page, lastPage: false }
      },
    })
    expect(calls).toBe(1)
    expect(snap.orders).toHaveLength(1)
    expect(snap.lastPage).toBe(false)
  })
})
