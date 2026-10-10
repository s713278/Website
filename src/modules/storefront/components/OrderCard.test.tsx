// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { CustomerOrder } from '@/shared/api'
import { OrderCard } from './OrderCard'

afterEach(() => cleanup())

const baseOrder: CustomerOrder = {
  id: '1983',
  storeId: '273',
  storeName: 'SRK Foods',
  total: 520,
  status: 'SCHEDULED',
  placedAt: '2026-10-09T00:00:00.000Z',
  items: [
    { name: 'Amla Pickle (500 gr)', qty: 2, size: '500 gr' },
    { name: 'Garlic Pickle', qty: 1 },
  ],
}

function renderCard(order: CustomerOrder = baseOrder) {
  return render(
    <MemoryRouter>
      <OrderCard
        order={order}
        storeId="273"
        store={{ name: 'SRK Foods', supportWhatsapp: '919111111111', phone: '9888888888' }}
      />
    </MemoryRouter>,
  )
}

describe('OrderCard', () => {
  it('shows scannable list fields and Chat with Owner for open orders', () => {
    renderCard()
    expect(screen.getByText('Order #1983')).toBeTruthy()
    expect(screen.getByText('Scheduled')).toBeTruthy()
    expect(screen.getByText('Amla Pickle')).toBeTruthy()
    expect(screen.getByText(/500 gr · Qty 3 · \+1 more/)).toBeTruthy()
    expect(screen.getByText('View details')).toBeTruthy()
    const chat = screen.getByRole('link', { name: /Chat with Owner/i })
    expect(chat.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/9888888888\?text=/)
    expect(decodeURIComponent(chat.getAttribute('href')!.split('text=')[1]!)).toContain(
      'Order #1983 from SRK Foods',
    )
  })

  it('hides Chat with Owner when delivered or cancelled', () => {
    renderCard({ ...baseOrder, status: 'DELIVERED' })
    expect(screen.queryByRole('link', { name: /Chat with Owner/i })).toBeNull()
    expect(screen.getByText('View details')).toBeTruthy()

    cleanup()
    renderCard({ ...baseOrder, status: 'CANCELLED' })
    expect(screen.queryByRole('link', { name: /Chat with Owner/i })).toBeNull()
  })
})
