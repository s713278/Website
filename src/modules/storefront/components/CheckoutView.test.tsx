// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CheckoutView } from '@/modules/storefront/components/CheckoutView'
import type { CartLine, Store } from '@/modules/storefront/types'
import { ordersService, type StorefrontCheckoutOptions } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { useDeliveryAddressStore } from '@/shared/store/delivery-address-store'
import type { User } from '@/shared/types'

const store = {
  id: '273',
  name: 'SRK Traditional Foods',
  category: 'Food',
  rating: 0,
  etaMins: 0,
  distanceKm: 0,
  image: '',
  products: [],
  phone: '919111111111',
} as Store

const line: CartLine = {
  itemId: 'sku-1',
  storeId: '273',
  storeName: store.name,
  name: 'Pickle',
  price: 120,
  qty: 1,
}

const checkoutOptions = {
  deliveryMethods: ['HOME_DELIVERY'],
  deliverySlots: [],
  paymentOptions: [
    { id: 'cod', label: 'Cash on Delivery', type: 'CASH_ON_DELIVERY', isDefault: true },
    { id: 'upi', label: 'UPI', type: 'PRE_PAID' },
  ],
  availableDeliveryDates: ['2026-10-06', '2026-10-08'],
  schedulingStrategy: 'FIXED_WINDOW',
  shippingStrategyType: 'ORDER_AMOUNT_THRESHOLD',
  shipping: { deliveryCharge: 30, freeDeliveryThreshold: 0 },
  consentTitle: null,
  consentText: null,
  fulfillmentType: 'HOME_DELIVERY',
  orderAcceptancePolicy: null,
} as StorefrontCheckoutOptions

const customer = {
  id: '42',
  name: 'Aneri',
  email: 'aneri@example.com',
  phone: '9876543210',
  role: 'customer',
  roles: ['customer'],
  vendors: [],
} as User

function renderCheckout(
  lines: CartLine[] = [line],
  options: StorefrontCheckoutOptions = checkoutOptions,
) {
  return render(
    <MemoryRouter>
      <CheckoutView
        store={store}
        lines={lines}
        cartCount={lines.length}
        checkoutOptions={options}
        onBack={() => undefined}
      />
    </MemoryRouter>,
  )
}

function reservedWindow() {
  return {
    closed: false,
    opener: window,
    close: vi.fn(),
    location: { href: '' },
  }
}

describe('CheckoutView', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: customer })
    useDeliveryAddressStore.setState({
      selectedId: 'addr-1',
      addresses: [
        {
          id: 'addr-1',
          location: 'Road No 27F, Miyapur, Hyderabad, Telangana 500049, India',
          lat: 17.49,
          lng: 78.39,
          city: 'Hyderabad',
          country: 'India',
          zipCode: '500049',
        },
      ],
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    useAuthStore.setState({ user: null })
    useDeliveryAddressStore.setState({ addresses: [], selectedId: null })
  })

  it('charges ₹100 below ₹500 and shows free delivery at ₹500', () => {
    const options: StorefrontCheckoutOptions = {
      ...checkoutOptions,
      shipping: { deliveryCharge: 100, freeDeliveryThreshold: 500 },
    }

    const under = renderCheckout([{ ...line, price: 245, qty: 1, lineTotal: 245 }], options)
    expect(screen.getByText('Delivery').closest('div')?.textContent).toContain('₹100')
    expect(screen.getAllByText('₹345').length).toBeGreaterThan(0)
    under.unmount()

    renderCheckout([{ ...line, price: 500, qty: 1, lineTotal: 500 }], options)
    expect(screen.getByText('Delivery').closest('div')?.textContent).toContain('Free')
    expect(screen.getAllByText('₹500').length).toBeGreaterThan(0)
  })

  it('edits the delivery address as a form and hides estimated delivery', () => {
    renderCheckout()

    expect(screen.getByText('Check address and items for delivery to the following address.')).toBeTruthy()
    expect(screen.queryByText('Estimated delivery')).toBeNull()
    expect(screen.queryByText(/we’ll send this order to the shop on WhatsApp/)).toBeNull()
    expect(screen.getByText('Pay SRK Traditional Foods when you receive your order.')).toBeTruthy()
    expect(
      screen.getByText('Pay SRK Traditional Foods directly using any UPI app, like PhonePe, Google Pay, etc.'),
    ).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /Create Order & Send On WhatsApp/ }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Create order' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Edit address' }))

    expect((screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement).value).toBe('Aneri')
    expect((screen.getByRole('textbox', { name: 'Contact number' }) as HTMLInputElement).value).toBe(
      '9876543210',
    )
    expect((screen.getByRole('textbox', { name: 'Address 1 / street' }) as HTMLInputElement).value).toBe(
      'Road No 27F',
    )
    expect((screen.getByRole('textbox', { name: 'City' }) as HTMLInputElement).value).toBe('Hyderabad')
    expect((screen.getByRole('textbox', { name: 'ZIP code / pincode' }) as HTMLInputElement).value).toBe(
      '500049',
    )

    fireEvent.change(screen.getByRole('textbox', { name: 'District' }), {
      target: { value: 'Ranga Reddy' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save address' }))

    expect(screen.getByText('Aneri')).toBeTruthy()
    expect(screen.getByText('+91 9876543210')).toBeTruthy()
    expect(
      screen.getByText('Road No 27F, Miyapur, Hyderabad, Ranga Reddy, Telangana 500049'),
    ).toBeTruthy()
  })

  it('creates the order, then opens WhatsApp with the vendor message', async () => {
    useDeliveryAddressStore.setState({
      selectedId: 'addr-1',
      addresses: [
        {
          id: 'addr-1',
          location: 'Road No 27F, Miyapur, Hyderabad, Ranga Reddy, Telangana 500049',
          lat: 17.49,
          lng: 78.39,
          city: 'Hyderabad',
          country: 'India',
          zipCode: '500049',
          state: 'Telangana',
          district: 'Ranga Reddy',
          address1: 'Road No 27F',
          address2: 'Miyapur',
          recipientName: 'Aneri',
          contactNumber: '9876543210',
        },
      ],
    })
    const place = vi.spyOn(ordersService, 'placeOrder').mockResolvedValue({
      id: 'ORD-91',
      storeId: '273',
      storeName: store.name,
      total: 520,
      status: 'placed',
      placedAt: '2026-10-04T00:00:00.000Z',
      items: [],
    })
    const pending = reservedWindow()
    vi.spyOn(window, 'open').mockReturnValue(pending as unknown as Window)

    renderCheckout([
      { ...line, name: 'Amla Pickle (500 gr)', skuId: '4153', price: 245, qty: 2, lineTotal: 490 },
    ])

    fireEvent.click(screen.getAllByRole('button', { name: /Create Order & Send On WhatsApp/ })[0]!)

    await waitFor(() => expect(place).toHaveBeenCalled())
    expect(place).toHaveBeenCalledWith(
      expect.objectContaining({
        address1: 'Road No 27F',
        paymentTypeId: 'cod',
        phone: '9876543210',
      }),
    )
    await waitFor(() => expect(pending.location.href).toContain('https://web.whatsapp.com/send?'))
    const opened = new URL(pending.location.href)
    expect(opened.searchParams.get('phone')).toBe('919111111111')
    const text = opened.searchParams.get('text') ?? ''
    expect(text).toContain('ORD-91')
    expect(text).toContain('Amla Pickle')
    expect(text).toContain('SKU: 4153')
    expect(text).toContain('Method: Cash on Delivery')
    expect(text).toContain('Phone: +91 9876543210')
    expect(text).toContain('Address: Road No 27F')
    expect(text).toContain('Locality: Miyapur')
    expect(text).toContain('City: Hyderabad')
    expect(text).toContain('District: Ranga Reddy')
    expect(text).toContain('State: Telangana')
    expect(text).toContain('ZIP: 500049')
  })

  it('closes the reserved WhatsApp tab when the order API fails', async () => {
    vi.spyOn(ordersService, 'placeOrder').mockRejectedValue(new Error('Shop is closed'))
    const pending = reservedWindow()
    vi.spyOn(window, 'open').mockReturnValue(pending as unknown as Window)

    renderCheckout()
    fireEvent.click(screen.getAllByRole('button', { name: /Create Order & Send On WhatsApp/ })[0]!)

    await waitFor(() => expect(pending.close).toHaveBeenCalled())
    expect(pending.location.href).toBe('')
    expect(screen.getAllByRole('button', { name: /Create Order & Send On WhatsApp/ }).length).toBeGreaterThan(0)
  })
})
