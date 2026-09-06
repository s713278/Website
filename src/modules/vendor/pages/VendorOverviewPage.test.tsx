// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { VendorAccountContext, type VendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import type {
  StoreState,
  VendorInsights,
  VendorOrderPage,
  VendorOrderSummary,
} from '@/modules/vendor/types/dashboard'
import { vendorOrdersService, vendorService } from '@/shared/api'
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
    demo: null,
  }
}

function renderFor(storeState: StoreState = 'OPEN') {
  return render(
    <MemoryRouter>
      <VendorAccountContext.Provider value={accountFor(storeState)}>
        <VendorOverviewPage />
      </VendorAccountContext.Provider>
    </MemoryRouter>,
  )
}

async function settle() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
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
  return { orders, page: 0, totalPages: 1, totalElements: orders.length, lastPage }
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

    expect(screen.getByText('Order #4021')).toBeTruthy()
    expect(screen.queryByText('Order #4010')).toBeNull()
    expect(screen.queryByText('Order #4009')).toBeNull()
  })

  it('marks an overdue order so it cannot read like one due tomorrow', async () => {
    stubQueue([order('4001', 'IN_PROCESS', '2026-09-04'), order('4002', 'PENDING', '2026-09-07')])
    stubInsights({})

    renderFor()
    await settle()

    expect(screen.getByText('Overdue')).toBeTruthy()
    expect(screen.getByText('Overdue — delivery date 2026-09-04')).toBeTruthy()
    expect(screen.getByText('Delivery date 2026-09-07')).toBeTruthy()
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
    // Zero-valued keys are omitted from the response entirely, so three of these four have
    // no key at all. Rendering them blank would read as missing data, not as "none".
    stubQueue([])
    stubInsights({ PENDING: 2 })

    renderFor()
    await settle()

    expect(screen.getByRole('link', { name: '2 New' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '0 Scheduled' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '0 Being prepared' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '0 On the way' })).toBeTruthy()
  })

  it('links each count into Orders with that filter already applied', async () => {
    stubQueue([])
    stubInsights({ SCHEDULED: 3 })

    renderFor()
    await settle()

    expect(screen.getByRole('link', { name: '3 Scheduled' }).getAttribute('href')).toBe(
      '/vendor/orders?status=SCHEDULED',
    )
  })

  it('does not present counts as zero while they are still loading', async () => {
    stubQueue([])
    vi.spyOn(vendorService, 'getInsights').mockReturnValue(new Promise(() => {}))

    renderFor()
    await settle()

    expect(screen.queryByRole('link', { name: '0 Scheduled' })).toBeNull()
    expect(screen.getByText('Loading your order counts…')).toBeTruthy()
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
