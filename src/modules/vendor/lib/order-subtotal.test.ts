import { describe, expect, it, vi } from 'vitest'
import type { VendorOrderPage, VendorOrderSummary } from '@/modules/vendor/types/dashboard'
import { SUBTOTAL_PAGE_CAP, SUBTOTAL_PAGE_SIZE, sumDeliveryWindow } from './order-subtotal'

function order(total: number | null): VendorOrderSummary {
  return {
    id: `o-${Math.random()}`,
    customerName: null,
    customerMobile: null,
    total,
    deliveryStatus: 'SCHEDULED',
    paymentStatus: 'DUE',
    deliveryDate: '2026-09-09',
  }
}

function pageOf(orders: VendorOrderSummary[], page: number, totalPages: number): VendorOrderPage {
  return {
    orders,
    page,
    totalPages,
    totalElements: orders.length * totalPages,
    lastPage: page >= totalPages - 1,
  }
}

describe('sumDeliveryWindow', () => {
  it('totals the whole filtered set, not the page the vendor happens to be looking at', () => {
    // The mutation this exists to catch: summing only the visible page produces a figure
    // labelled with the full range that is short by every page after the first.
    const pages = [
      pageOf([order(100), order(200)], 0, 3),
      pageOf([order(300)], 1, 3),
      pageOf([order(400)], 2, 3),
    ]

    return expect(sumDeliveryWindow((page) => Promise.resolve(pages[page]))).resolves.toEqual({
      kind: 'total',
      amount: 1000,
      orders: 4,
    })
  })

  it('stops asking once the last page is in hand', async () => {
    const fetchPage = vi.fn((page: number) => Promise.resolve(pageOf([order(50)], page, 2)))

    await sumDeliveryWindow(fetchPage)

    expect(fetchPage).toHaveBeenCalledTimes(2)
    expect(fetchPage).toHaveBeenNthCalledWith(1, 0)
    expect(fetchPage).toHaveBeenNthCalledWith(2, 1)
  })

  it('counts a genuinely free order without treating it as unknown', async () => {
    await expect(sumDeliveryWindow(() => Promise.resolve(pageOf([order(0)], 0, 1)))).resolves.toEqual(
      { kind: 'total', amount: 0, orders: 1 },
    )
  })

  it('totals an empty range as zero rather than withholding it', async () => {
    await expect(sumDeliveryWindow(() => Promise.resolve(pageOf([], 0, 1)))).resolves.toEqual({
      kind: 'total',
      amount: 0,
      orders: 0,
    })
  })

  it('refuses to total a range too large to walk, without fetching all of it', async () => {
    const fetchPage = vi.fn((page: number) =>
      Promise.resolve(pageOf([order(10)], page, SUBTOTAL_PAGE_CAP + 5)),
    )

    await expect(sumDeliveryWindow(fetchPage)).resolves.toEqual({ kind: 'too-large' })
    // The first response already declares the page count, so nothing is gained by walking.
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })

  it('refuses to total when the walk hits the cap without reaching the end', async () => {
    // A response that under-reports its page count still must not produce a partial figure.
    const fetchPage = vi.fn((page: number) =>
      Promise.resolve({
        orders: [order(10)],
        page,
        totalPages: 1,
        totalElements: 1,
        lastPage: false,
      }),
    )

    await expect(sumDeliveryWindow(fetchPage)).resolves.toEqual({ kind: 'too-large' })
    expect(fetchPage).toHaveBeenCalledTimes(SUBTOTAL_PAGE_CAP)
  })

  it('does not stop on a full page that claims to be the last one', async () => {
    // `mapVendorOrderPage` reads `lastPage` as `last_page !== false`, so a response that
    // omits the field claims to be last. Believing it on a *full* page turns the walk into
    // the page-0-only sum this module exists to prevent.
    const full = Array.from({ length: SUBTOTAL_PAGE_SIZE }, () => order(1))
    const pages = [
      { orders: full, page: 0, totalPages: 2, totalElements: 101, lastPage: true },
      { orders: [order(7)], page: 1, totalPages: 2, totalElements: 101, lastPage: true },
    ]

    await expect(sumDeliveryWindow((page) => Promise.resolve(pages[page]))).resolves.toEqual({
      kind: 'total',
      amount: SUBTOTAL_PAGE_SIZE + 7,
      orders: SUBTOTAL_PAGE_SIZE + 1,
    })
  })

  it('withholds the total entirely when a page fails', async () => {
    // A sum over the pages that did arrive, labelled with the full range, is worse than
    // no sum: it is wrong and looks complete.
    const fetchPage = (page: number) =>
      page === 0
        ? Promise.resolve(pageOf([order(100)], 0, 3))
        : Promise.reject(new Error('Network down'))

    await expect(sumDeliveryWindow(fetchPage)).resolves.toMatchObject({
      kind: 'withheld',
      reason: 'failed',
      // Carried, not swallowed: an expired session and a 500 are different problems.
      error: expect.objectContaining({ message: 'Network down' }),
    })
  })

  it('withholds the total when any row has no amount, wherever that row sits', async () => {
    const pages = [pageOf([order(100)], 0, 2), pageOf([order(200), order(null)], 1, 2)]

    await expect(sumDeliveryWindow((page) => Promise.resolve(pages[page]))).resolves.toEqual({
      kind: 'withheld',
      reason: 'missing-amount',
    })
  })
})
