import { describe, expect, it } from 'vitest'
import { buildWhatsAppOrderMessage, whatsappHref, whatsappSendHref } from '@/modules/storefront/lib/whatsapp-order'
import type { CartLine } from '@/modules/storefront/types'

const line: CartLine = {
  itemId: 'sku-1',
  skuId: '4153',
  storeId: '273',
  storeName: 'SRK Traditional Foods',
  name: 'Amla Pickle (500 gr)',
  price: 245,
  qty: 2,
  lineTotal: 490,
}

describe('buildWhatsAppOrderMessage', () => {
  it('organizes items, payment, address, and phone for the vendor', () => {
    const message = buildWhatsAppOrderMessage({
      orderId: 'ORD-91',
      storeName: 'SRK Traditional Foods',
      customerName: 'Aneri',
      phone: '9876543210',
      location: 'Road No 27F, Miyapur, Hyderabad, Ranga Reddy, Telangana 500049',
      address1: 'Road No 27F',
      address2: 'Miyapur',
      city: 'Hyderabad',
      district: 'Ranga Reddy',
      state: 'Telangana',
      zipCode: '500049',
      lines: [line],
      subtotal: 490,
      deliveryFee: 30,
      packagingFee: 0,
      total: 520,
      paymentLabel: 'Cash on Delivery',
    })

    expect(message).toContain('*Order ID:* ORD-91')
    expect(message).toContain('Name: Aneri')
    expect(message).toContain('Phone: +91 9876543210')
    expect(message).toContain('Address: Road No 27F')
    expect(message).toContain('Locality: Miyapur')
    expect(message).toContain('City: Hyderabad')
    expect(message).toContain('District: Ranga Reddy')
    expect(message).toContain('State: Telangana')
    expect(message).toContain('ZIP: 500049')
    expect(message).toContain('1. Amla Pickle')
    expect(message).toContain('Variant: 500 gr')
    expect(message).toContain('SKU: 4153')
    expect(message).toContain('Qty: 2')
    expect(message).toContain('Price: ₹245')
    expect(message).toContain('Amount: ₹490')
    expect(message).toContain('Method: Cash on Delivery')
    expect(message).toContain('Delivery: ₹30')
    expect(message).toContain('*Total: ₹520*')
  })

  it('includes the selected delivery slot for the vendor', () => {
    const message = buildWhatsAppOrderMessage({
      orderId: 'ORD-5',
      storeName: 'Shop',
      phone: '9876543210',
      location: 'Miyapur',
      lines: [{ ...line, qty: 1, lineTotal: 245 }],
      subtotal: 245,
      deliveryFee: 30,
      packagingFee: 0,
      total: 275,
      paymentLabel: 'UPI',
      deliveryMethodLabel: 'Home delivery',
      deliverySlotLabel: 'Morning',
      deliveryDateLabel: '6–8 Oct',
    })

    expect(message).toContain('Method: Home delivery · Slot: Morning · Date: 6–8 Oct')
  })

  it('keeps a map pin when the address has not been split into fields', () => {
    const message = buildWhatsAppOrderMessage({
      orderId: 'ORD-2',
      storeName: 'Shop',
      phone: '919876543210',
      location: 'Miyapur, Hyderabad',
      lines: [{ ...line, name: 'Pickle', skuId: undefined, qty: 1, lineTotal: undefined }],
      subtotal: 245,
      deliveryFee: 0,
      packagingFee: 0,
      total: 245,
      paymentLabel: 'UPI',
    })

    expect(message).toContain('Phone: +91 9876543210')
    expect(message).toContain('Miyapur, Hyderabad')
    expect(message).not.toContain('Address:')
    expect(message).toContain('Method: UPI')
    expect(message).not.toContain('Delivery:')
  })

  it('sends the full map address when only city and ZIP are stored as fields', () => {
    const message = buildWhatsAppOrderMessage({
      orderId: 'ORD-3',
      storeName: 'Shop',
      phone: '9876543210',
      location: 'Akota, Vadodara, Gujarat 390001, India',
      city: 'Vadodara',
      zipCode: '390001',
      lines: [{ ...line, qty: 1, lineTotal: 245 }],
      subtotal: 245,
      deliveryFee: 0,
      packagingFee: 0,
      total: 245,
      paymentLabel: 'Cash on Delivery',
    })

    expect(message).toContain('*Delivery address*\nAkota, Vadodara, Gujarat 390001, India')
    expect(message).not.toContain('City: Vadodara')
    expect(message).not.toContain('ZIP: 390001')
  })

  it('keeps a ZIP that the map label left out', () => {
    const message = buildWhatsAppOrderMessage({
      orderId: 'ORD-4',
      storeName: 'Shop',
      phone: '9876543210',
      location: 'Akota, Vadodara, Gujarat, India',
      city: 'Vadodara',
      state: 'Gujarat',
      zipCode: '390001',
      lines: [{ ...line, qty: 1, lineTotal: 245 }],
      subtotal: 245,
      deliveryFee: 0,
      packagingFee: 0,
      total: 245,
      paymentLabel: 'Cash on Delivery',
    })

    expect(message).toContain('Akota, Vadodara, Gujarat, India')
    expect(message).toContain('ZIP: 390001')
    expect(message).not.toContain('City: Vadodara')
    expect(message).not.toContain('State: Gujarat')
  })
})

describe('whatsappHref', () => {
  it('opens the vendor chat with the message', () => {
    const href = whatsappHref('91 91111 11111', 'Hello')
    expect(href.startsWith('https://wa.me/919111111111?text=')).toBe(true)
    expect(new URL(href).searchParams.get('text')).toBe('Hello')
  })
})

describe('whatsappSendHref', () => {
  it('opens WhatsApp Web on desktop instead of the api.whatsapp.com redirect', () => {
    const href = whatsappSendHref('919111111111', 'Order 91')
    const url = new URL(href)
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    expect(url.origin + url.pathname).toBe(
      mobile ? 'https://api.whatsapp.com/send' : 'https://web.whatsapp.com/send',
    )
    expect(url.searchParams.get('phone')).toBe('919111111111')
    expect(url.searchParams.get('text')).toBe('Order 91')
  })
})
