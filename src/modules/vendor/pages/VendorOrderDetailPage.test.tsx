// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { VendorAccountContext, type VendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import type { VendorOrderDetail } from '@/modules/vendor/types/dashboard'
import { OrderAdvancePartialError, vendorOrdersService } from '@/shared/api'
import { formatCurrency } from '@/shared/lib/utils'
import { VendorOrderDetailPage } from './VendorOrderDetailPage'

/**
 * TEMP(vendor-orders-read-only): the order-writes switch is off, which hides the action row,
 * the payment record and the payment badge. The tests that cover those stay, forced on here,
 * so turning the switch back on finds them still guarding the hidden code. `undefined` reads
 * the switch's real value, which is what the read-only tests use.
 */
const orderWrites = vi.hoisted(() => ({ forced: true as boolean | undefined }))

/**
 * TEMP(vendor-orders-minimal-rows): the order-details switch is off, which hides the status
 * and delivery date. The tests written against them stay, forced on here; `undefined` reads
 * the switch's real value, which is what the minimal-mode tests use.
 */
const orderDetails = vi.hoisted(() => ({ forced: true as boolean | undefined }))

vi.mock('@/modules/vendor/lib/order-actions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/vendor/lib/order-actions')>()
  return {
    ...actual,
    get VENDOR_ORDER_WRITES_ENABLED() {
      return orderWrites.forced ?? actual.VENDOR_ORDER_WRITES_ENABLED
    },
    get VENDOR_ORDER_DETAILS_SHOWN() {
      return orderDetails.forced ?? actual.VENDOR_ORDER_DETAILS_SHOWN
    },
  }
})

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
    contextStale: false,
    refreshContext: async () => { throw new Error('Context refresh is outside this test.') },
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
    itemCount: null,
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

    expect(screen.getByRole('alert').textContent).toContain('Something went wrong')
    expect(screen.queryByText('Order not found')).toBeNull()

    get.mockResolvedValue(detail())
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await settle()

    expect(get).toHaveBeenCalledTimes(2)
    // The order number is the console top bar's page title, which this render does not
    // mount; the bill appearing is what says the retried read landed.
    expect(screen.getByRole('heading', { name: 'Items' })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('holds the order layout under the back link while the first read is in flight', () => {
    vi.spyOn(vendorOrdersService, 'get').mockReturnValue(new Promise<VendorOrderDetail | null>(() => {}))

    const view = renderDetail()

    expect(screen.getByRole('status', { name: 'Loading order' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Back to orders' })).toBeTruthy()
    expect(view.container.querySelector('[data-slot="page-loader"]')).toBeNull()
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
      state: { from: '/vendor/orders?status=SCHEDULED&start=2026-09-08&page=1' },
    })
    await settle()

    expect(screen.getByRole('link', { name: 'Back to orders' }).getAttribute('href')).toBe(
      '/vendor/orders?status=SCHEDULED&start=2026-09-08&page=1',
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
    expect(advance).toHaveBeenCalledWith('vendor-1', '4021', 'SHIPPED', 'DELIVERED')
  })

  it('keeps a legacy confirmation busy until completion, then reads the confirmed order', async () => {
    const get = vi.spyOn(vendorOrdersService, 'get').mockResolvedValue(detail())
    let finish!: () => void
    const advance = vi.spyOn(vendorOrdersService, 'advance').mockReturnValue(
      new Promise<void>((resolve) => { finish = resolve }),
    )
    renderDetail()
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm order' }))
    await settle()
    expect(advance).toHaveBeenCalledWith('vendor-1', '4021', 'PENDING', 'IN_PROCESS')
    expect(screen.getByRole('button', { name: 'Working…' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Cancel order' }).hasAttribute('disabled')).toBe(true)
    expect(get).toHaveBeenCalledTimes(1)

    get.mockResolvedValue(detail({ deliveryStatus: 'IN_PROCESS' }))
    await act(async () => { finish() })
    await settle()
    expect(screen.getByText('Confirmed')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Mark out for delivery' })).toBeTruthy()
  })

  it('keeps the order on screen, dimmed, while it re-reads after an action', async () => {
    const get = vi.spyOn(vendorOrdersService, 'get').mockResolvedValue(detail())
    vi.spyOn(vendorOrdersService, 'advance').mockResolvedValue(undefined)
    let reread!: (value: VendorOrderDetail) => void
    renderDetail()
    await settle()

    get.mockReturnValue(new Promise<VendorOrderDetail>((resolve) => { reread = resolve }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm order' }))
    await settle()

    expect(get).toHaveBeenCalledTimes(2)
    expect(screen.getByText('New').closest('[aria-busy="true"]')).not.toBeNull()
    expect(screen.getByRole('status', { name: 'Updating order' })).toBeTruthy()
    expect(screen.queryByRole('status', { name: 'Loading order' })).toBeNull()
    // Nothing acts on a status that is about to change.
    expect(screen.getByRole('button', { name: 'Confirm order' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Mark paid' }).hasAttribute('disabled')).toBe(true)

    await act(async () => { reread(detail({ deliveryStatus: 'IN_PROCESS' })) })
    await settle()

    expect(screen.getByText('Confirmed').closest('[aria-busy]')).toBeNull()
    expect(screen.queryByRole('status', { name: 'Updating order' })).toBeNull()
  })

  it('never re-enables the forward action between the action and its re-read', async () => {
    const get = vi.spyOn(vendorOrdersService, 'get').mockResolvedValue(detail())
    vi.spyOn(vendorOrdersService, 'advance').mockResolvedValue(undefined)
    let reread!: (value: VendorOrderDetail) => void
    renderDetail()
    await settle()

    // Every change to the button's `disabled` attribute is recorded, including one that a
    // later commit in the same act would undo.
    const forward = screen.getByRole('button', { name: 'Confirm order' })
    const records: MutationRecord[] = []
    const observer = new MutationObserver((batch) => { records.push(...batch) })
    observer.observe(forward, { attributes: true, attributeFilter: ['disabled'], attributeOldValue: true })

    get.mockReturnValue(new Promise<VendorOrderDetail>((resolve) => { reread = resolve }))
    fireEvent.click(forward)
    await settle()

    records.push(...observer.takeRecords())
    observer.disconnect()
    expect(records.length).toBeGreaterThan(0)
    expect(forward.hasAttribute('disabled')).toBe(true)
    // A record with a non-null old value is the attribute being removed.
    expect(records.filter((record) => record.oldValue !== null)).toHaveLength(0)

    await act(async () => { reread(detail({ deliveryStatus: 'IN_PROCESS' })) })
    await settle()
    expect(screen.getByText('Confirmed')).toBeTruthy()
  })

  it('reports partial progress and reloads the intermediate state', async () => {
    const get = vi.spyOn(vendorOrdersService, 'get').mockResolvedValue(detail())
    vi.spyOn(vendorOrdersService, 'advance').mockRejectedValue(
      new OrderAdvancePartialError('SCHEDULED', 'IN_PROCESS', new Error('Network down')),
    )
    const view = renderDetail()
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm order' }))
    await settle()
    expect(screen.getByText(/moved partway.*Reload to see where it stands/)).toBeTruthy()
    get.mockResolvedValue(detail({ deliveryStatus: 'SCHEDULED' }))
    view.unmount()
    renderDetail()
    await settle()
    expect(get).toHaveBeenCalledTimes(2)
    expect(screen.getByText('New')).toBeTruthy()
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

/**
 * The payment record, which lives on this device and nowhere else.
 *
 * Detail carries both directions and the one line of copy that stops a vendor believing
 * their accounts synced. See
 * `docs/adr/0003-payment-status-is-a-device-local-vendor-record.md`.
 */
describe('VendorOrderDetailPage payment record', () => {
  it('records a payment and reads the order back', async () => {
    const get = vi.spyOn(vendorOrdersService, 'get').mockResolvedValue(detail())
    const setPaymentStatus = vi
      .spyOn(vendorOrdersService, 'setPaymentStatus')
      .mockResolvedValue(undefined)

    renderDetail()
    await settle()

    get.mockResolvedValue(detail({ paymentStatus: 'PAID' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mark paid' }))
    await settle()

    expect(setPaymentStatus).toHaveBeenCalledWith('vendor-1', '4021', 'PAID')
    expect(screen.getByText('Paid')).toBeTruthy()
  })

  it('takes the record back, which no other screen offers', async () => {
    vi.spyOn(vendorOrdersService, 'get').mockResolvedValue(detail({ paymentStatus: 'PAID' }))
    const setPaymentStatus = vi
      .spyOn(vendorOrdersService, 'setPaymentStatus')
      .mockResolvedValue(undefined)

    renderDetail()
    await settle()

    fireEvent.click(screen.getByRole('button', { name: 'Mark unpaid' }))
    await settle()

    expect(setPaymentStatus).toHaveBeenCalledWith('vendor-1', '4021', 'DUE')
  })

  it('states in one line that the record is kept on this device', async () => {
    vi.spyOn(vendorOrdersService, 'get').mockResolvedValue(detail())

    renderDetail()
    await settle()

    expect(screen.getByText(/saved on this device/i)).toBeTruthy()
  })

  it('offers the control before delivery, because prepayment is normal', async () => {
    vi.spyOn(vendorOrdersService, 'get').mockResolvedValue(detail({ deliveryStatus: 'SCHEDULED' }))

    renderDetail()
    await settle()

    expect(screen.getByRole('button', { name: 'Mark paid' })).toBeTruthy()
  })

  it('offers neither direction on a cancelled order', async () => {
    vi.spyOn(vendorOrdersService, 'get').mockResolvedValue(
      detail({ deliveryStatus: 'CANCELLED', paymentStatus: 'PAID' }),
    )

    renderDetail()
    await settle()

    // Marking a cancelled order paid raises a refund question v1 has no answer for, and
    // reversal follows it off the screen — so a record made before the cancellation is
    // stuck. It is at least labelled: the badge stays, and so does the sentence.
    expect(screen.queryByRole('button', { name: 'Mark paid' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Mark unpaid' })).toBeNull()
    expect(screen.getByText('Paid')).toBeTruthy()
    expect(screen.getByText(/saved on this device/i)).toBeTruthy()
  })

  it('says nothing about a device at all on a cancelled order with no record', async () => {
    vi.spyOn(vendorOrdersService, 'get').mockResolvedValue(
      detail({ deliveryStatus: 'CANCELLED' }),
    )

    renderDetail()
    await settle()

    expect(screen.queryByText(/saved on this device/i)).toBeNull()
  })

  it('says so when the browser refused to keep the record', async () => {
    vi.spyOn(vendorOrdersService, 'get').mockResolvedValue(detail())
    vi.spyOn(vendorOrdersService, 'setPaymentStatus').mockRejectedValue(
      new Error('This browser cannot save the payment record.'),
    )

    renderDetail()
    await settle()

    fireEvent.click(screen.getByRole('button', { name: 'Mark paid' }))
    await settle()

    expect(screen.getByText('This browser cannot save the payment record.')).toBeTruthy()
  })

  it('shows no dues figure and no payment method', async () => {
    // `payment_dues` sums every order regardless of status and only ever grows;
    // `payment_method` reads CASH_ON_DELIVERY on every order measured while the vendor may
    // be paid by UPI. Neither is mapped, and a payment control must not tempt either back.
    vi.spyOn(vendorOrdersService, 'get').mockResolvedValue(detail())

    renderDetail()
    await settle()

    expect(screen.queryByText(/dues/i)).toBeNull()
    expect(screen.queryByText(/cash on delivery/i)).toBeNull()
  })
})

describe('VendorOrderDetailPage read-only', () => {
  beforeEach(() => {
    orderWrites.forced = undefined
  })

  afterEach(() => {
    orderWrites.forced = true
  })

  /** What a read-only order still shows: its status, who it is for, and what it comes to. */
  function expectOrderFacts(status: string) {
    expect(screen.getByText(status)).toBeTruthy()
    expect(screen.getByText('Asha')).toBeTruthy()
    expect(screen.getByText('Total').parentElement?.textContent).toContain(formatCurrency(320))
  }

  it('offers no step, cancel or payment record on a new order', async () => {
    vi.spyOn(vendorOrdersService, 'get').mockResolvedValue(detail())

    renderDetail()
    await settle()

    expect(screen.queryByRole('button', { name: 'Confirm order' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cancel order' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Mark paid' })).toBeNull()
    expect(screen.queryByLabelText('Reason')).toBeNull()
    expect(screen.queryByText('Payment due')).toBeNull()
    expect(screen.queryByText(/saved on this device/i)).toBeNull()
    expectOrderFacts('New')
  })

  it('offers no step or cancel on an order out for delivery', async () => {
    vi.spyOn(vendorOrdersService, 'get').mockResolvedValue(detail({ deliveryStatus: 'SHIPPED' }))

    renderDetail()
    await settle()

    expect(screen.queryByRole('button', { name: 'Mark delivered' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cancel order' })).toBeNull()
    expectOrderFacts('Out for delivery')
  })

  it('shows no paid badge, no way back and no device sentence on a paid order', async () => {
    vi.spyOn(vendorOrdersService, 'get').mockResolvedValue(detail({ paymentStatus: 'PAID' }))

    renderDetail()
    await settle()

    expect(screen.queryByRole('button', { name: 'Mark unpaid' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Mark paid' })).toBeNull()
    expect(screen.queryByText('Paid')).toBeNull()
    expect(screen.queryByText(/saved on this device/i)).toBeNull()
    expectOrderFacts('New')
  })

  it('holds no place for the badge or the action row while the first read is in flight', () => {
    vi.spyOn(vendorOrdersService, 'get').mockReturnValue(new Promise<VendorOrderDetail | null>(() => {}))

    const view = renderDetail()

    // Only the status pill is pill-shaped; the badge and both action buttons are not drawn.
    const pills = view.container.querySelectorAll('[data-slot="skeleton"].rounded-full')
    expect(pills).toHaveLength(1)
  })
})

describe('VendorOrderDetailPage minimal rows', () => {
  beforeEach(() => {
    orderWrites.forced = undefined
    orderDetails.forced = undefined
  })

  afterEach(() => {
    orderWrites.forced = true
    orderDetails.forced = true
  })

  it('shows no delivery date, and still shows the status, address, contact and bill', async () => {
    vi.spyOn(vendorOrdersService, 'get').mockResolvedValue(detail())

    renderDetail()
    await settle()

    expect(screen.queryByText('Delivery date')).toBeNull()
    expect(screen.queryByText('2026-09-09')).toBeNull()
    expect(screen.getByText('New')).toBeTruthy()
    expect(screen.getByText('12 Market Road, Mirdoddi')).toBeTruthy()
    expect(screen.getByText('Asha')).toBeTruthy()
    expect(screen.getByText('Total').parentElement?.textContent).toContain(formatCurrency(320))
  })

  it('draws no empty details block for an order with no address', async () => {
    vi.spyOn(vendorOrdersService, 'get').mockResolvedValue(detail({ deliveryAddress: null }))

    const view = renderDetail()
    await settle()

    expect(screen.getByText('New')).toBeTruthy()
    expect(screen.queryByText('Delivering to')).toBeNull()
    // The bill's own list is the only one left.
    expect(view.container.querySelectorAll('dl')).toHaveLength(1)
  })
})
