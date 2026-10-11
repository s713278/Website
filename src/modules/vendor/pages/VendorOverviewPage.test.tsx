// @vitest-environment jsdom

import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { VendorAccountContext, type VendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import type {
  StoreState,
  VendorInsights,
  VendorOrderPage,
  VendorOrderSummary,
  VendorSize,
} from '@/modules/vendor/types/dashboard'
import { WORK_QUEUE_STATUSES } from '@/modules/vendor/lib/work-queue'
import { vendorOrdersService, vendorProductsService, vendorService } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { VendorOverviewPage } from './VendorOverviewPage'

/**
 * The clock is fixed so the queue window can be asserted against literal dates rather than
 * against the same helper the page uses. Only `Date` is faked: faking timers as well would
 * stall the promises these tests settle by hand.
 */
const TODAY = new Date(2026, 8, 6, 9, 0, 0)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(TODAY)
  vi.spyOn(vendorProductsService, 'listSizes').mockResolvedValue([])
  // Insights are keyed on the user id, so the page needs a session. Applied through the
  // store's own action rather than by writing state, which is a path production never takes.
  useAuthStore.getState().applySession({
    token: 'test-token',
    refreshToken: null,
    user: {
      id: 'user-1',
      name: 'Test Vendor',
      email: 'vendor@example.test',
      role: 'vendor',
      roles: ['vendor'],
      vendors: [{ vendorId: 'vendor-1' }],
      vendorId: 'vendor-1',
    },
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
  useAuthStore.getState().clearSession()
})

function accountFor(storeState: StoreState): VendorAccount {
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
    storeState,
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
    contextStale: false,
    refreshContext: async () => { throw new Error('Context refresh is outside this test.') },
  }
}

function renderFor(storeState: StoreState = 'OPEN', strict = false) {
  const page = (
    <MemoryRouter>
      <VendorAccountContext.Provider value={accountFor(storeState)}>
        <VendorOverviewPage />
      </VendorAccountContext.Provider>
    </MemoryRouter>
  )
  return render(strict ? <StrictMode>{page}</StrictMode> : page)
}

/**
 * Lets the page's reads start and their answers land. Each read begins one tick after its
 * component mounts, and the product tile mounts only once the counts arrive — two rounds.
 */
async function settle() {
  for (let round = 0; round < 2; round += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
      await Promise.resolve()
      await Promise.resolve()
    })
  }
}

function order(
  id: string,
  deliveryStatus: VendorOrderSummary['deliveryStatus'],
  deliveryDate: string | null,
): VendorOrderSummary {
  return {
    id,
    customerName: null,
    customerMobile: '9000000001',
    total: 320,
    deliveryStatus,
    paymentStatus: 'DUE',
    deliveryDate,
  }
}

function pageOf(orders: VendorOrderSummary[], lastPage = true): VendorOrderPage {
  return { orders, page: 0, totalPages: lastPage ? 1 : 2, totalElements: orders.length, lastPage }
}

function insights(ordersByStatus: VendorInsights['ordersByStatus']): VendorInsights {
  return { totalCustomers: null, ordersByStatus }
}

function stubQueue(orders: VendorOrderSummary[], lastPage = true) {
  return vi.spyOn(vendorOrdersService, 'list').mockResolvedValue(pageOf(orders, lastPage))
}

function stubInsights(ordersByStatus: VendorInsights['ordersByStatus']) {
  return vi.spyOn(vendorService, 'getInsights').mockResolvedValue(insights(ordersByStatus))
}

describe('VendorOverviewPage work queue', () => {
  it('does not declare the queue empty when later pages remain', async () => {
    stubQueue([
      order('4010', 'DELIVERED', '2026-09-02'),
      order('4009', 'CANCELLED', '2026-08-31'),
    ], false)
    stubInsights({})

    renderFor()
    await settle()

    expect(screen.queryByText('Nothing waiting')).toBeNull()
    expect(screen.getByText('More orders to check')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Next' })).toBeTruthy()
  })

  it('declares the queue empty when the complete window has no open orders', async () => {
    stubQueue([order('4010', 'DELIVERED', '2026-09-02')])
    stubInsights({})

    renderFor()
    await settle()

    expect(screen.getByText('Nothing waiting')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull()
  })

  it('asks for a window that reaches a week back and two days forward', async () => {
    // The lookback is the whole reason the queue is date-ranged. Narrowing it to today
    // hides an order that went past its delivery date while still unfinished, which is
    // exactly the order a vendor must not lose. This test fails if that window shrinks.
    const list = stubQueue([])
    stubInsights({})

    renderFor()
    await settle()

    expect(list).toHaveBeenCalledTimes(1)
    expect(list).toHaveBeenCalledWith('vendor-1', {
      page: 0,
      startDate: '2026-08-30',
      endDate: '2026-09-08',
    })
  })

  it('asks over the delivery date only, never a status, because the filter is single-valued', async () => {
    const list = stubQueue([])
    stubInsights({})

    renderFor()
    await settle()

    expect(list.mock.calls[0][1]).not.toHaveProperty('status')
  })

  it('drops finished orders the server filter could not exclude', async () => {
    stubQueue([
      order('4021', 'PENDING', '2026-09-06'),
      order('4010', 'DELIVERED', '2026-09-02'),
      order('4009', 'CANCELLED', '2026-08-31'),
    ])
    stubInsights({})

    renderFor()
    await settle()

    expect(screen.getByRole('link', { name: 'Order #4021' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Order #4010' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Order #4009' })).toBeNull()
  })

  it('marks an overdue order so it cannot read like one due tomorrow', async () => {
    stubQueue([order('4001', 'IN_PROCESS', '2026-09-04'), order('4002', 'PENDING', '2026-09-07')])
    stubInsights({})

    renderFor()
    await settle()

    // The late row leads with the word, keeps its date underneath, and is the only one that
    // does; the row due tomorrow is named, not dated.
    expect(screen.getByText('Overdue')).toBeTruthy()
    expect(screen.getByText('Fri 4 Sep')).toBeTruthy()
    expect(screen.getByText('Tomorrow')).toBeTruthy()
    // Every one of those readings sits under a column that says which date it is.
    expect(screen.getAllByText('Delivery date').length).toBeGreaterThan(0)
  })

  it('shows no money figure anywhere on the screen', async () => {
    // The console's one money figure belongs on Orders, beside the range it describes. A
    // total here would describe a window the vendor never chose.
    stubQueue([order('4021', 'PENDING', '2026-09-06')])
    stubInsights({ PENDING: 1 })

    const view = renderFor()
    await settle()

    expect(view.container.textContent).not.toContain('₹')
  })

  it('says a request failed rather than reporting an empty queue', async () => {
    vi.spyOn(vendorOrdersService, 'list').mockRejectedValue(new Error('Network down'))
    stubInsights({})

    renderFor()
    await settle()

    expect(screen.getByText('This is a failed request, not an empty queue.')).toBeTruthy()
    expect(screen.queryByText('Nothing waiting')).toBeNull()
  })
})

describe('VendorOverviewPage status counts', () => {
  it('renders an explicit 0 for a status the backend omitted', async () => {
    // Zero-valued keys are omitted from the response entirely, so the other buckets have
    // no key at all. Rendering them blank would read as missing data, not as "none".
    stubQueue([])
    stubInsights({ PENDING: 2 })

    renderFor()
    await settle()

    expect(screen.getByRole('link', { name: 'New 2' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Confirmed 0' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Out for delivery 0' })).toBeTruthy()
  })

  it('links each count into Orders with that filter already applied', async () => {
    stubQueue([])
    stubInsights({ PENDING: 2, SCHEDULED: 3 })

    renderFor()
    await settle()

    expect(screen.getByRole('link', { name: 'New 5' }).getAttribute('href')).toBe(
      '/vendor/orders?status=SCHEDULED',
    )
  })

  it('does not present counts as zero while they are still loading', async () => {
    stubQueue([])
    vi.spyOn(vendorService, 'getInsights').mockReturnValue(new Promise(() => {}))

    renderFor()
    await settle()

    expect(screen.queryByRole('link', { name: 'New 0' })).toBeNull()
    expect(screen.getByText('Loading your order counts…')).toBeTruthy()
  })
})

describe('VendorOverviewPage loading layout', () => {
  const productsLink = () => screen.getByRole('link', { name: /^Products/ })
  const gridOf = () => productsLink().parentElement as HTMLElement
  const placeholders = () => Array.from(gridOf().querySelectorAll('[aria-hidden="true"]'))

  it('reads the catalog while the counts are still pending', async () => {
    stubQueue([])
    const getInsights = vi.spyOn(vendorService, 'getInsights').mockReturnValue(new Promise(() => {}))
    const listSizes = vi.spyOn(vendorProductsService, 'listSizes').mockResolvedValue([
      size('1', 'p1'), size('2', 'p2'),
    ])

    renderFor()
    await settle()

    expect(getInsights).toHaveBeenCalledTimes(1)
    expect(listSizes).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status').textContent).toBe('Loading your order counts…')
    expect(screen.getByRole('link', { name: 'Products 2' })).toBeTruthy()
  })

  it('holds one placeholder per queue status, with Products in the last cell', async () => {
    stubQueue([])
    vi.spyOn(vendorService, 'getInsights').mockReturnValue(new Promise(() => {}))

    renderFor()
    await settle()

    const grid = gridOf()
    expect(placeholders()).toHaveLength(WORK_QUEUE_STATUSES.length)
    expect(grid.children).toHaveLength(WORK_QUEUE_STATUSES.length + 1)
    expect(grid.lastElementChild).toBe(productsLink())
    expect(grid.querySelectorAll('a')).toHaveLength(1)
  })

  it('shows the error and the Products tile alone when the counts fail', async () => {
    stubQueue([])
    vi.spyOn(vendorService, 'getInsights').mockRejectedValue(new Error('Insights are down'))

    renderFor()
    await settle()

    expect(screen.getByText('Insights are down')).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
    expect(placeholders()).toHaveLength(0)
    expect(gridOf().children).toHaveLength(1)
    expect(screen.queryByRole('link', { name: /^New/ })).toBeNull()
    expect(productsLink()).toBeTruthy()
  })

  it('shows only the Products tile when there are no insights', async () => {
    stubQueue([])
    vi.spyOn(vendorService, 'getInsights').mockResolvedValue(null as unknown as VendorInsights)

    renderFor()
    await settle()

    expect(screen.queryByRole('status')).toBeNull()
    expect(placeholders()).toHaveLength(0)
    expect(gridOf().children).toHaveLength(1)
    expect(productsLink()).toBeTruthy()
  })

  it('swaps the placeholders for the status tiles in order, Products last', async () => {
    stubQueue([])
    stubInsights({ PENDING: 1, SCHEDULED: 1, IN_PROCESS: 3, SHIPPED: 4 })

    renderFor()
    await settle()

    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByText('Loading your order counts…')).toBeNull()
    expect(placeholders()).toHaveLength(0)
    const names = Array.from(gridOf().querySelectorAll('a')).map((a) => a.textContent)
    expect(names).toEqual(['New 2', 'Confirmed 3', 'Out for delivery 4', 'Products 0'])
  })
})

function size(skuId: string, productId: string | null): VendorSize {
  return { skuId, productId, priceId: null, name: `Product ${productId ?? skuId}`, size: null, listPrice: null, salePrice: null, active: true, imagePath: null }
}

describe('VendorOverviewPage product count', () => {
  it('counts products from the catalog, grouping sizes as the Products page does', async () => {
    stubQueue([])
    stubInsights({})
    const listSizes = vi.spyOn(vendorProductsService, 'listSizes').mockResolvedValue([
      size('1', 'p1'), size('2', 'p1'), size('3', 'p2'), size('4', null),
    ])

    renderFor()
    await settle()

    expect(listSizes).toHaveBeenCalledWith('vendor-1', expect.any(AbortSignal))
    expect(screen.getByRole('link', { name: 'Products 3' }).getAttribute('href')).toBe('/vendor/products')
  })

  it('shows a dash rather than zero when the catalog read fails', async () => {
    stubQueue([])
    stubInsights({})
    vi.spyOn(vendorProductsService, 'listSizes').mockRejectedValue(new Error('Could not load all your products.'))

    renderFor()
    await settle()

    expect(screen.getByRole('link', { name: 'Products —' })).toBeTruthy()
  })
})

describe('VendorOverviewPage store state', () => {
  it('shows the parameterised status screen instead of a queue when the store is not open', async () => {
    const list = stubQueue([])
    const getInsights = stubInsights({ PENDING: 4 })

    renderFor('UNDER_REVIEW')
    await settle()

    expect(screen.getByText('Awaiting approval')).toBeTruthy()
    // No request is made at all: a store that cannot receive orders has no queue, and empty
    // counts on this screen would read as "no orders yet" rather than "not open".
    expect(list).not.toHaveBeenCalled()
    expect(getInsights).not.toHaveBeenCalled()
  })

  it('offers a suspended store no action it cannot perform', async () => {
    stubQueue([])
    stubInsights({})

    renderFor('SUSPENDED')
    await settle()

    expect(screen.getByText('Store suspended')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })
})

describe('VendorOverviewPage under StrictMode', () => {
  // Development mounts, unmounts and remounts every component once. Each read must still
  // reach the network once, not once per mount.
  it('asks for counts, the queue and the catalog once each', async () => {
    const list = stubQueue([])
    const getInsights = stubInsights({ SCHEDULED: 1 })
    const listSizes = vi.spyOn(vendorProductsService, 'listSizes').mockResolvedValue([])

    renderFor('OPEN', true)
    await settle()

    expect(getInsights).toHaveBeenCalledTimes(1)
    expect(list).toHaveBeenCalledTimes(1)
    expect(listSizes).toHaveBeenCalledTimes(1)
    expect(listSizes.mock.calls[0][1]?.aborted).toBe(false)
  })
})
