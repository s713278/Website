// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { VendorAccountContext, type VendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import type { VendorOrderDetail } from '@/modules/vendor/types/dashboard'
import { vendorOrdersService } from '@/shared/api'
import { VendorOrderDetailPage } from './VendorOrderDetailPage'

/**
 * The three ways this screen can fail to show an order, which must not read alike.
 *
 * "Order not found" over a failed request tells a vendor their order is gone when the
 * network blinked. Only one of the three is worth a retry, and only one is final.
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

function renderDetail(entry: string | { pathname: string; state: unknown } = '/vendor/orders/4021') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <VendorAccountContext.Provider value={account()}>
        <Routes>
          <Route path="/vendor/orders/:orderId" element={<VendorOrderDetailPage />} />
        </Routes>
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

function detail(overrides: Partial<VendorOrderDetail> = {}): VendorOrderDetail {
  return {
    id: '4021',
    customerName: 'Asha',
    customerMobile: '9000000001',
    total: 320,
    deliveryStatus: 'PENDING',
    paymentStatus: 'DUE',
    deliveryDate: '2026-09-09',
    deliveryAddress: '12 Market Road, Mirdoddi',
    charges: { gross: 320, discount: 30, deliveryCharges: 30, serviceCharge: null, tax: null },
    lines: [
      { id: 'l1', name: 'Fresh Tomatoes', size: '1 kg', quantity: 2, unitPrice: 70, amount: 140 },
    ],
    ...overrides,
  }
}

describe('VendorOrderDetailPage states', () => {
  it('says an order does not exist when the store says so', async () => {
    vi.spyOn(vendorOrdersService, 'get').mockResolvedValue(null)

    renderDetail()
    await settle()

    expect(screen.getByText('Order not found')).toBeTruthy()
    // Final, so no retry is offered — retrying cannot conjure the order.
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('says a load failed, distinctly, and offers the retry that can fix it', async () => {
    const get = vi.spyOn(vendorOrdersService, 'get').mockRejectedValue(new Error('Network down'))

    renderDetail()
    await settle()

    expect(screen.getByText('This order could not be loaded. That is not the same as it not existing.')).toBeTruthy()
    expect(screen.queryByText('Order not found')).toBeNull()

    get.mockResolvedValue(detail())
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await settle()

    expect(get).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Order #4021')).toBeTruthy()
  })
})

describe('VendorOrderDetailPage charges', () => {
  it('shows the payment status and charges the store recorded', async () => {
    vi.spyOn(vendorOrdersService, 'get').mockResolvedValue(detail())

    renderDetail()
    await settle()

    expect(screen.getByText('Payment due')).toBeTruthy()
    expect(screen.getByText('Items before discount')).toBeTruthy()
    expect(screen.getByText('Discount')).toBeTruthy()
    expect(screen.getByText('Delivery')).toBeTruthy()
    expect(screen.queryByText('Service charge')).toBeNull()
    expect(screen.queryByText('Tax')).toBeNull()
  })

  it('says the charges do not add up rather than adding a line that makes them', async () => {
    // 320 − 30 = 290, against a 320 total. The gap is real and is not filled in.
    vi.spyOn(vendorOrdersService, 'get').mockResolvedValue(
      detail({
        charges: { gross: 320, discount: 30, deliveryCharges: null, serviceCharge: null, tax: null },
      }),
    )

    renderDetail()
    await settle()

    expect(screen.getByText(/nothing has been added to close the difference/i)).toBeTruthy()
    expect(screen.queryByText('Delivery')).toBeNull()
  })

  it('shows a paid status and stays quiet when the charges add up', async () => {
    vi.spyOn(vendorOrdersService, 'get').mockResolvedValue(detail({ paymentStatus: 'PAID' }))

    renderDetail()
    await settle()

    expect(screen.getByText('Paid')).toBeTruthy()
    expect(screen.queryByText(/nothing has been added to close the difference/i)).toBeNull()
  })
})

describe('VendorOrderDetailPage back link', () => {
  it('returns to the filtered list the vendor came from', async () => {
    vi.spyOn(vendorOrdersService, 'get').mockResolvedValue(detail())

    renderDetail({
      pathname: '/vendor/orders/4021',
      state: { from: '/vendor/orders?status=PENDING&start=2026-09-08&page=1' },
    })
    await settle()

    expect(screen.getByRole('link', { name: 'Back to orders' }).getAttribute('href')).toBe(
      '/vendor/orders?status=PENDING&start=2026-09-08&page=1',
    )
  })

  it('falls back to the plain list when opened directly', async () => {
    vi.spyOn(vendorOrdersService, 'get').mockResolvedValue(detail())

    renderDetail()
    await settle()

    expect(screen.getByRole('link', { name: 'Back to orders' }).getAttribute('href')).toBe(
      '/vendor/orders',
    )
  })
})

describe('VendorOrderDetailPage actions', () => {
  it('offers the one hop the backend accepts, and marks delivered from shipped', async () => {
    vi.spyOn(vendorOrdersService, 'get').mockResolvedValue(detail({ deliveryStatus: 'SHIPPED' }))
    const advance = vi.spyOn(vendorOrdersService, 'advance').mockResolvedValue(undefined)

    renderDetail()
    await settle()

    fireEvent.click(screen.getByRole('button', { name: 'Mark delivered' }))
    await settle()

    // The one untested edge in the transition graph. It now fails visibly if it fails.
    expect(advance).toHaveBeenCalledWith('vendor-1', '4021', 'DELIVERED')
  })

  it('keeps a typed cancellation reason after the cancel fails', async () => {
    vi.spyOn(vendorOrdersService, 'get').mockResolvedValue(detail())
    vi.spyOn(vendorOrdersService, 'cancel').mockRejectedValue(new Error('Network down'))

    renderDetail()
    await settle()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel order' }))
    const reason = screen.getByLabelText('Reason') as HTMLInputElement
    fireEvent.change(reason, { target: { value: 'Out of stock' } })

    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel order' }).at(-1)!)
    await settle()

    expect((screen.getByLabelText('Reason') as HTMLInputElement).value).toBe('Out of stock')
  })
})
