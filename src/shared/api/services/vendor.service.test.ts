import { describe, expect, it, vi } from 'vitest'

/**
 * The dashboard reported zero open orders and zero revenue for a vendor who had orders.
 *
 * `GET /v1/vendors/{id}/orders/` returns a paginated container, not a bare array, and the
 * service tested `Array.isArray` on it — always false — so every order was dropped on the
 * floor. The sibling `/products` call *does* return a bare array, which is why the item
 * count looked right and hid the problem. Both shapes verified live on 2026-09-04.
 */

vi.mock('../mode', () => ({ isLiveApi: () => true }))

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }))
vi.mock('../client', async () => {
  const actual = await vi.importActual<typeof import('../client')>('../client')
  return { ...actual, apiGet }
})

const { getVendorDashboard } = await import('./vendor.service')

describe('getVendorDashboard', () => {
  it('counts orders from the paginated container the backend actually returns', async () => {
    apiGet.mockImplementation((url: string) => {
      if (url.endsWith('/orders/')) {
        return Promise.resolve({
          data: {
            // The live shape: rows under `result`, alongside page metadata.
            result: [
              { id: 1, status: 'PENDING', total: 150 },
              { id: 2, status: 'completed', total: 100 },
            ],
            page_number: 0,
            page_size: 20,
            total_elements: 2,
            total_pages: 1,
            last_page: true,
          },
        })
      }
      if (url.endsWith('/products')) {
        // A bare array — the other shape, which must keep working.
        return Promise.resolve({ data: [{ id: 9, available: true }, { id: 10, available: false }] })
      }
      return Promise.resolve({ data: { business_name: 'Probe Store', vendor_status: 'ONLINE' } })
    })

    const stats = await getVendorDashboard(260)

    expect(stats.openOrders).toBe(1) // the completed one does not count
    expect(stats.todayRevenue).toBe(250) // both orders contribute revenue
    expect(stats.availableItems).toBe(1)
    expect(stats.storeName).toBe('Probe Store')
    expect(stats.online).toBe(true)
  })

  it('still renders when orders come back in an unreadable shape', async () => {
    apiGet.mockImplementation((url: string) => {
      if (url.endsWith('/orders/')) return Promise.resolve({ data: { unexpected: true } })
      if (url.endsWith('/products')) return Promise.resolve({ data: [] })
      return Promise.resolve({ data: { business_name: 'Probe Store' } })
    })

    const stats = await getVendorDashboard(260)

    expect(stats.openOrders).toBe(0)
    expect(stats.storeName).toBe('Probe Store')
  })
})
