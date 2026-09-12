// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { VendorAccountContext, type VendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import type {
  SubscriptionStatus,
  VendorSubscription,
  VendorSubscriptionPage,
} from '@/modules/vendor/types/dashboard'
import { vendorSubscriptionsService } from '@/shared/api'
import { VendorSubscriptionsPage } from './VendorSubscriptionsPage'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function accountFor(vendorId: string): VendorAccount {
  return {
    vendorId,
    context: {
      vendorId,
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

function LocationReading() {
  const location = useLocation()
  return <output aria-label="Current URL">{location.pathname + location.search}</output>
}

function renderAt(vendorId = 'vendor-1', url = '/vendor/orders/subscriptions') {
  const view = render(
    <MemoryRouter initialEntries={[url]}>
      <VendorAccountContext.Provider value={accountFor(vendorId)}>
        <VendorSubscriptionsPage />
        <LocationReading />
      </VendorAccountContext.Provider>
    </MemoryRouter>,
  )

  return {
    ...view,
    rerenderFor(nextVendorId: string) {
      view.rerender(
        <MemoryRouter initialEntries={[url]}>
          <VendorAccountContext.Provider value={accountFor(nextVendorId)}>
            <VendorSubscriptionsPage />
            <LocationReading />
          </VendorAccountContext.Provider>
        </MemoryRouter>,
      )
    },
  }
}

async function settle() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function subscription(id: string, status: SubscriptionStatus = 'ACTIVE'): VendorSubscription {
  return {
    id,
    mobile: '9000000001',
    customerId: '17001',
    skuName: `Subscription ${id}`,
    quantity: 2,
    frequency: 'WEEKLY',
    deliveryMode: 'HOME_DELIVERY',
    paymentType: 'CASH',
    startDate: '2026-09-01',
    nextDelivery: '2026-09-15',
    status,
  }
}

function pageOf(subscriptions: VendorSubscription[]): VendorSubscriptionPage {
  return {
    subscriptions,
    page: 0,
    totalPages: 1,
    totalElements: subscriptions.length,
    lastPage: true,
  }
}

describe('VendorSubscriptionsPage', () => {
  it('ignores a response that arrives after the signed-in vendor changes', async () => {
    const stale = deferred<VendorSubscriptionPage>()
    const fresh = deferred<VendorSubscriptionPage>()
    vi.spyOn(vendorSubscriptionsService, 'list')
      .mockReturnValueOnce(stale.promise)
      .mockReturnValueOnce(fresh.promise)

    const view = renderAt('vendor-1')
    view.rerenderFor('vendor-2')

    await act(async () => {
      fresh.resolve(pageOf([subscription('Fresh')]))
      stale.resolve(pageOf([subscription('Stale')]))
      await Promise.resolve()
    })

    expect(screen.getByText('Subscription Fresh')).toBeTruthy()
    expect(screen.queryByText('Subscription Stale')).toBeNull()
  })

  it('ignores a response that arrives after the status filter changes', async () => {
    const stale = deferred<VendorSubscriptionPage>()
    const fresh = deferred<VendorSubscriptionPage>()
    vi.spyOn(vendorSubscriptionsService, 'list')
      .mockReturnValueOnce(stale.promise)
      .mockReturnValueOnce(fresh.promise)

    renderAt('vendor-1', '/vendor/orders/subscriptions?status=PENDING')
    fireEvent.click(screen.getByRole('button', { name: 'Active' }))

    await act(async () => {
      fresh.resolve(pageOf([subscription('Active', 'ACTIVE')]))
      stale.resolve(pageOf([subscription('Pending', 'PENDING')]))
      await Promise.resolve()
    })

    expect(screen.getByText('Subscription Active')).toBeTruthy()
    expect(screen.queryByText('Subscription Pending')).toBeNull()
    expect(screen.getByLabelText('Current URL').textContent).toBe(
      '/vendor/orders/subscriptions?status=ACTIVE',
    )
  })

  it('shows a failed request separately from an empty result and retries it', async () => {
    const list = vi
      .spyOn(vendorSubscriptionsService, 'list')
      .mockRejectedValueOnce(new Error('Network down'))
      .mockResolvedValueOnce(pageOf([]))

    renderAt()
    await settle()

    expect(screen.getByText('This is a failed request, not an empty list.')).toBeTruthy()
    expect(screen.queryByText('No subscriptions yet')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await settle()

    expect(list).toHaveBeenCalledTimes(2)
    expect(screen.getByText('No subscriptions yet')).toBeTruthy()
    expect(screen.queryByText('This is a failed request, not an empty list.')).toBeNull()
  })

  it('renders the complete row without making it a detail link', async () => {
    vi.spyOn(vendorSubscriptionsService, 'list').mockResolvedValue(
      pageOf([subscription('5101')]),
    )

    renderAt()
    await settle()

    expect(screen.getByText('Subscription #5101')).toBeTruthy()
    expect(screen.getByText('9000000001')).toBeTruthy()
    expect(screen.getByText('Customer #17001')).toBeTruthy()
    expect(screen.getByText('Subscription 5101')).toBeTruthy()
    expect(screen.getByText('Quantity')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.getByText('Weekly')).toBeTruthy()
    expect(screen.getByText('Home delivery')).toBeTruthy()
    expect(screen.getByText('Cash')).toBeTruthy()
    expect(screen.getByText('Start date')).toBeTruthy()
    expect(screen.getByText('2026-09-01')).toBeTruthy()
    expect(screen.getByText('Next delivery')).toBeTruthy()
    expect(screen.getByText('2026-09-15')).toBeTruthy()
    const row = screen.getByText('Subscription #5101').closest('article')
    expect(row).not.toBeNull()
    expect(within(row as HTMLElement).getByText('Active')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Subscription #5101' })).toBeNull()
  })
})
