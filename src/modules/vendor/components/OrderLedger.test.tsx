// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { VendorOrderSummary } from '@/modules/vendor/types/dashboard'
import { formatCurrency } from '@/shared/lib/utils'
import { OrderLedger } from './OrderLedger'

/**
 * TEMP(vendor-orders-minimal-rows): the row at the switch's real value — order, customer and
 * amount, and nothing about status or delivery date. Drop this file when the switch reverts.
 */

afterEach(cleanup)

function order(overrides: Partial<VendorOrderSummary> = {}): VendorOrderSummary {
  return {
    id: '4021',
    customerName: 'hemesh thakur',
    customerMobile: '9000000001',
    total: 320,
    deliveryStatus: 'SHIPPED',
    paymentStatus: 'DUE',
    deliveryDate: '2026-09-09',
    itemCount: 7,
    ...overrides,
  }
}

function renderLedger(orders: VendorOrderSummary[], showAmount = false) {
  return render(
    <MemoryRouter>
      <OrderLedger orders={orders} todayIso="2026-09-06" caption="Orders" showAmount={showAmount} />
    </MemoryRouter>,
  )
}

describe('OrderLedger minimal rows', () => {
  it.each([false, true])('shows the order, customer and amount only (showAmount %s)', (showAmount) => {
    renderLedger([order()], showAmount)

    const row = screen.getAllByRole('row')[1]
    const link = within(row).getByRole('link', { name: 'Order #4021' })
    expect(link.getAttribute('href')).toBe('/vendor/orders/4021')
    expect(within(row).getByText('7 items')).toBeTruthy()
    expect(within(row).getByText('Hemesh T.')).toBeTruthy()
    expect(within(row).getByText('90000 00001')).toBeTruthy()
    expect(within(row).getByRole('link', { name: 'Call' }).getAttribute('href')).toBe('tel:+919000000001')
    expect(within(row).getByRole('link', { name: 'WhatsApp' }).getAttribute('href')).toBe('https://wa.me/919000000001')
    expect(within(row).getByText(formatCurrency(320))).toBeTruthy()

    // Status and delivery date are hidden, in the rows and in the heads.
    expect(screen.queryByText('Shipped')).toBeNull()
    expect(screen.queryByText('Out for delivery')).toBeNull()
    expect(screen.queryByText(/Delivery date/i)).toBeNull()
    expect(screen.queryByText('Status')).toBeNull()
    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Order',
      'Customer',
      'Amount',
    ])
  })

  it('says one item in the singular and omits an unknown count', () => {
    renderLedger([order({ id: '1', itemCount: 1 }), order({ id: '2', itemCount: null })])

    const [, first, second] = screen.getAllByRole('row')
    expect(within(first).getByText('1 item')).toBeTruthy()
    expect(within(second).queryByText(/\bitems?\b/)).toBeNull()
  })

  it('puts the number first when there is no name, and says when the amount is unknown', () => {
    renderLedger([order({ customerName: null, total: null })])

    const row = screen.getAllByRole('row')[1]
    expect(within(row).getByText('90000 00001')).toBeTruthy()
    expect(within(row).getByText('Amount not available')).toBeTruthy()
    expect(within(row).getByRole('link', { name: 'Call' })).toBeTruthy()
  })
})
