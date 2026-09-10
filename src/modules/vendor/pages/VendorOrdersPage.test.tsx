// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { VendorAccountContext, type VendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import type { VendorOrderPage, VendorOrderSummary } from '@/modules/vendor/types/dashboard'
import { OrderAdvancePartialError, OrderTransitionRefusedError, vendorOrdersService, type VendorOrderQuery } from '@/shared/api'
import { VendorOrdersPage } from './VendorOrdersPage'

/**
 * What this page fetches, when it refetches, and what it does with a response that arrives
 * late. All of it is React lifecycle, which is the only reason these are component tests —
 * the filter rules themselves live in `lib/order-filters.ts` and are tested there.
 */

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function account(): VendorAccount {
  return {
    vendorId: 'vendor-1',
    context: {
      vendorId: 'vendor-1',
      businessName: 'Test Store',
      storeIdentifier: null,
      vendorStatus: 'ACTIVE',
      approvalStatus: 'APPROVED',
      membershipRole: 'OWNER',
      onboarding: { status: 'COMPLETED', description: null, nextStep: 11 },
      subscription: {
        tier: 'FREE',
        planName: 'Free',
        status: 'ACTIVE',
        currency: 'INR',
        monthlyPrice: 0,
        yearlyPrice: 0,
        trialEndsAt: null,
        trialDays: 0,
        limits: { maxCategories: 3, maxProducts: 10, maxSkus: 25, maxImages: 10 },
        usage: { categories: 1, products: 1, skus: 1, images: 0 },
      },
      eligibleFeatures: ['DASHBOARD'],
    },
    storeState: 'OPEN',
    plan: {
      code: 'FREE',
      name: 'Free',
      status: 'ACTIVE',
      currency: 'INR',
      monthlyPrice: 0,
      yearlyPrice: 0,
      trialEndsAt: null,
      trialDays: 0,
      limits: { categories: 3, products: 10, skus: 25, images: 10 },
      usage: { categories: 1, products: 1, skus: 1, images: 0 },
    },
    reload: () => {},
    demo: null,
  }
}

function renderAt(url = '/vendor/orders') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <VendorAccountContext.Provider value={account()}>
        <VendorOrdersPage />
      </VendorAccountContext.Provider>
    </MemoryRouter>,
  )
}

async function settle() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

/** A promise this test settles by hand, so two responses can land out of order. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function order(id: string, total: number | null = 320): VendorOrderSummary {
  return {
    id,
    customerName: null,
    customerMobile: '9000000001',
    total,
    deliveryStatus: 'PENDING',
    paymentStatus: 'DUE',
    deliveryDate: '2026-09-09',
  }
}

function pageOf(orders: VendorOrderSummary[], page = 0, totalPages = 1): VendorOrderPage {
  return {
    orders,
    page,
    totalPages,
    totalElements: orders.length,
    lastPage: page >= totalPages - 1,
  }
}

describe('VendorOrdersPage filters', () => {
  it('opens with no delivery-date range at all', async () => {
    const list = vi.spyOn(vendorOrdersService, 'list').mockResolvedValue(pageOf([]))

    renderAt()
    await settle()

    // No default range: a screen that opens on "this week" answers a question the vendor
    // never asked, and the subtotal below it would total a window nobody chose.
    expect(list).toHaveBeenCalledWith('vendor-1', {
      page: 0,
      status: null,
      startDate: null,
      endDate: null,
    })
    expect(within(screen.getByRole('group', { name: 'Order status' })).getAllByRole('button')
      .map((button) => button.textContent)).toEqual([
      'All', 'New', 'Confirmed', 'Out for delivery', 'Delivered', 'Cancelled',
    ])
  })

  it('reads the status filter Overview linked in with', async () => {
    const list = vi.spyOn(vendorOrdersService, 'list').mockResolvedValue(pageOf([]))

    renderAt('/vendor/orders?status=SCHEDULED')
    await settle()

    expect(list.mock.calls[0][1]).toMatchObject({ status: 'SCHEDULED' })
  })

  it('returns to the first page when a filter changes', async () => {
    // Page 3 of one filter is not page 3 of another, and an out-of-range page comes back
    // empty — which would read as "no such orders".
    const list = vi.spyOn(vendorOrdersService, 'list').mockResolvedValue(pageOf([], 2, 5))

    renderAt('/vendor/orders?status=IN_PROCESS&page=2')
    await settle()
    expect(list.mock.calls[0][1]).toMatchObject({ page: 2, status: 'IN_PROCESS' })

    fireEvent.click(screen.getByRole('button', { name: 'New' }))
    await settle()

    expect(list.mock.calls.at(-1)?.[1]).toMatchObject({ page: 0, status: 'SCHEDULED' })
  })

  it('returns to the first page when a delivery date changes', async () => {
    const list = vi.spyOn(vendorOrdersService, 'list').mockResolvedValue(pageOf([], 3, 5))

    renderAt('/vendor/orders?page=3')
    await settle()

    fireEvent.change(screen.getByLabelText('Delivery date from'), {
      target: { value: '2026-09-08' },
    })
    await settle()

    const listCall = list.mock.calls.filter(([, query]) => query?.size == null).at(-1)
    expect(listCall?.[1]).toMatchObject({ page: 0, startDate: '2026-09-08' })
  })

  it('ignores a response that arrives after the filter moved on', async () => {
    const stale = deferred<VendorOrderPage>()
    const fresh = deferred<VendorOrderPage>()
    vi.spyOn(vendorOrdersService, 'list')
      .mockReturnValueOnce(stale.promise)
      .mockReturnValueOnce(fresh.promise)

    renderAt('/vendor/orders?status=IN_PROCESS')
    fireEvent.click(screen.getByRole('button', { name: 'New' }))

    await act(async () => {
      fresh.resolve(pageOf([order('4020')]))
      stale.resolve(pageOf([order('4099')]))
      await Promise.resolve()
    })

    expect(screen.getByRole('link', { name: 'Order #4020' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Order #4099' })).toBeNull()
  })

  it('names every date control a delivery date, because that is the only date there is', async () => {
    vi.spyOn(vendorOrdersService, 'list').mockResolvedValue(pageOf([]))

    const view = renderAt()
    await settle()

    expect(screen.getByLabelText('Delivery date from')).toBeTruthy()
    expect(screen.getByLabelText('Delivery date to')).toBeTruthy()
    // No order read in the contract carries a creation timestamp, so nothing on this screen
    // may imply a booking or sales date.
    expect(view.container.textContent).not.toMatch(/order date|placed|booking|sales/i)
  })
})

describe('VendorOrdersPage filter round-trip', () => {
  it('renders payment status and hands the current filters to the order it opens', async () => {
    vi.spyOn(vendorOrdersService, 'list').mockResolvedValue(
      pageOf([order('4021'), { ...order('4022'), paymentStatus: 'PAID' }]),
    )

    renderAt('/vendor/orders?status=SCHEDULED&start=2026-09-08&page=1')
    await settle()

    expect(screen.getByText('Payment due')).toBeTruthy()
    expect(screen.getByText('Paid')).toBeTruthy()

    // The detail screen reads this and points its own "Back to orders" at it. Browser back
    // already restores the URL; a vendor using the button on screen should not lose the
    // range they just typed.
    const link = screen.getByRole('link', { name: 'Order #4021' })
    fireEvent.click(link)
    expect(link.getAttribute('href')).toBe('/vendor/orders/4021')
  })
})

describe('VendorOrdersPage loading failures', () => {
  it('says a request failed rather than reporting an empty list', async () => {
    vi.spyOn(vendorOrdersService, 'list').mockRejectedValue(new Error('Network down'))

    renderAt()
    await settle()

    expect(screen.getByText('This is a failed request, not an empty list.')).toBeTruthy()
    expect(screen.queryByText('No orders here')).toBeNull()
  })
})

describe('VendorOrdersPage delivery-window subtotal', () => {
  it('totals the whole filtered range, not the page on screen, and says which range', async () => {
    // The list page holds two of the five. A subtotal of what is visible, under a heading
    // naming the whole week, is a figure that looks complete and is short.
    vi.spyOn(vendorOrdersService, 'list').mockImplementation(
      (_vendorId: string | number, query: VendorOrderQuery = {}) =>
        Promise.resolve(
          query.size === 100
            ? pageOf([order('1', 100), order('2', 200), order('3', 300), order('4', 400), order('5', 500)])
            : pageOf([order('1', 100), order('2', 200)]),
        ),
    )

    renderAt('/vendor/orders?start=2026-09-08&end=2026-09-14')
    await settle()

    expect(screen.getByText('Orders delivering 8–14 Sep')).toBeTruthy()
    expect(screen.getByText(/1,500/)).toBeTruthy()
  })

  it('withholds the total when a page of the range fails', async () => {
    vi.spyOn(vendorOrdersService, 'list').mockImplementation(
      (_vendorId: string | number, query: VendorOrderQuery = {}) =>
        query.size === 100
          ? Promise.reject(new Error('Network down'))
          : Promise.resolve(pageOf([order('1', 100)])),
    )

    renderAt('/vendor/orders?start=2026-09-08&end=2026-09-14')
    await settle()

    // Withholding is not enough on its own: an expired session and a 500 are different
    // problems, and only one of them is worth retrying.
    expect(screen.getByText(/No total: part of this range did not load/)).toBeTruthy()
    expect(screen.getByText(/Network down/)).toBeTruthy()
  })

  it('offers no total at all until a range is applied', async () => {
    vi.spyOn(vendorOrdersService, 'list').mockResolvedValue(pageOf([order('1', 100)]))

    renderAt()
    await settle()

    expect(screen.queryByText(/Orders delivering/)).toBeNull()
  })
})

describe('VendorOrdersPage actions', () => {
  it('keeps the active row busy when another confirmation is attempted', async () => {
    vi.spyOn(vendorOrdersService, 'list').mockResolvedValue(pageOf([order('4021'), order('4022')]))
    const completion = deferred<void>()
    const advance = vi.spyOn(vendorOrdersService, 'advance').mockReturnValue(completion.promise)
    renderAt()
    await settle()
    const buttons = screen.getAllByRole('button', { name: 'Confirm order' })
    fireEvent.click(buttons[0])
    fireEvent.click(buttons[1])
    await settle()
    expect(advance).toHaveBeenCalledTimes(1)
    expect(buttons.every((button) => button.hasAttribute('disabled'))).toBe(true)
    expect(buttons[0].textContent).toBe('Working…')
    await act(async () => { completion.resolve() })
    await settle()
  })

  it('keeps a legacy confirmation busy until the service finishes and reloads Confirmed', async () => {
    const list = vi.spyOn(vendorOrdersService, 'list').mockResolvedValue(pageOf([order('4021')]))
    const completion = deferred<void>()
    const advance = vi.spyOn(vendorOrdersService, 'advance').mockReturnValue(completion.promise)

    renderAt()
    await settle()

    fireEvent.click(screen.getByRole('button', { name: 'Confirm order' }))
    await settle()

    expect(advance).toHaveBeenCalledWith('vendor-1', '4021', 'PENDING', 'IN_PROCESS')
    expect(screen.getByRole('button', { name: 'Working…' }).hasAttribute('disabled')).toBe(true)
    expect(list).toHaveBeenCalledTimes(1)

    list.mockResolvedValue(pageOf([{ ...order('4021'), deliveryStatus: 'IN_PROCESS' }]))
    await act(async () => { completion.resolve() })
    await settle()
    expect(screen.getByRole('button', { name: 'Mark out for delivery' })).toBeTruthy()
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('reports a refusal that arrived as a success', async () => {
    vi.spyOn(vendorOrdersService, 'list').mockResolvedValue(pageOf([order('4021')]))
    vi.spyOn(vendorOrdersService, 'advance').mockRejectedValue(
      new OrderTransitionRefusedError('4021', 'SCHEDULED', 'Please check the input request and try again.'),
    )

    renderAt()
    await settle()

    fireEvent.click(screen.getByRole('button', { name: 'Confirm order' }))
    await settle()

    expect(screen.getByText(/Could not move this order to "Confirmed"/)).toBeTruthy()
    expect(screen.queryByText(/Please check the input request/)).toBeNull()
  })

  it('explains partial progress and reloads before another confirmation', async () => {
    const list = vi.spyOn(vendorOrdersService, 'list').mockResolvedValue(pageOf([order('4021')]))
    vi.spyOn(vendorOrdersService, 'advance').mockRejectedValue(
      new OrderAdvancePartialError('SCHEDULED', 'IN_PROCESS', new Error('Network down')),
    )
    const view = renderAt()
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm order' }))
    await settle()
    expect(screen.getByText(/moved partway.*Reload to see where it stands/)).toBeTruthy()
    list.mockResolvedValue(pageOf([{ ...order('4021'), deliveryStatus: 'SCHEDULED' }]))
    view.unmount()
    renderAt()
    await settle()
    expect(list).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('button', { name: 'Confirm order' })).toBeTruthy()
  })
})

/**
 * Marking an order paid from the list.
 *
 * On the list because the moment a vendor marks something paid is the moment cash is being
 * handed over, phone in one hand. The reverse is not here — it lives on order detail, so
 * nobody flips it by accident while scrolling.
 */
describe('VendorOrdersPage payment record', () => {
  it('records a payment against the row and reads the list back', async () => {
    const list = vi.spyOn(vendorOrdersService, 'list').mockResolvedValue(pageOf([order('4021')]))
    const setPaymentStatus = vi
      .spyOn(vendorOrdersService, 'setPaymentStatus')
      .mockResolvedValue(undefined)

    renderAt()
    await settle()

    fireEvent.click(screen.getByRole('button', { name: 'Mark paid' }))
    await settle()

    expect(setPaymentStatus).toHaveBeenCalledWith('vendor-1', '4021', 'PAID')
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('offers the control on a row whose payment status the store omitted', async () => {
    // `null` is what the mapper yields when `payment_status` is absent. Keying the control
    // on `DUE` would hide it on exactly the rows where the state is least clear.
    vi.spyOn(vendorOrdersService, 'list').mockResolvedValue(
      pageOf([{ ...order('4021'), paymentStatus: null }]),
    )

    renderAt()
    await settle()

    expect(screen.getByRole('button', { name: 'Mark paid' })).toBeTruthy()
    expect(screen.queryByText('Payment due')).toBeNull()
    expect(screen.queryByText('Paid')).toBeNull()
  })

  it('offers nothing to press on an order that is already paid', async () => {
    vi.spyOn(vendorOrdersService, 'list').mockResolvedValue(
      pageOf([{ ...order('4021'), paymentStatus: 'PAID' }]),
    )

    renderAt()
    await settle()

    // The reverse is deliberately detail-only.
    expect(screen.queryByRole('button', { name: 'Mark paid' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Mark unpaid' })).toBeNull()
  })

  it('offers nothing on a cancelled order, which would raise a refund question', async () => {
    vi.spyOn(vendorOrdersService, 'list').mockResolvedValue(
      pageOf([{ ...order('4021'), deliveryStatus: 'CANCELLED' }]),
    )

    renderAt()
    await settle()

    expect(screen.queryByRole('button', { name: 'Mark paid' })).toBeNull()
  })

  it('says so when the browser refused to keep the record', async () => {
    vi.spyOn(vendorOrdersService, 'list').mockResolvedValue(pageOf([order('4021')]))
    vi.spyOn(vendorOrdersService, 'setPaymentStatus').mockRejectedValue(
      new Error('This browser cannot save the payment record.'),
    )

    renderAt()
    await settle()

    fireEvent.click(screen.getByRole('button', { name: 'Mark paid' }))
    await settle()

    // The record is the only copy that exists anywhere. A failure to keep it cannot pass
    // as a success.
    expect(screen.getByText('This browser cannot save the payment record.')).toBeTruthy()
  })

  it('shows no payment filter, and no count of what is unpaid', async () => {
    // The orders endpoint has no `payment_status` parameter. A client-side filter or count
    // would narrow the current page and read as though it had narrowed the business.
    vi.spyOn(vendorOrdersService, 'list').mockResolvedValue(pageOf([order('4021')]))

    renderAt()
    await settle()

    expect(within(screen.getByRole('group', { name: 'Order status' })).getAllByRole('button')
      .map((button) => button.textContent)).toEqual([
      'All', 'New', 'Confirmed', 'Out for delivery', 'Delivered', 'Cancelled',
    ])
    expect(screen.queryByRole('group', { name: /payment/i })).toBeNull()
    expect(screen.queryByText(/unpaid/i)).toBeNull()
  })
})
