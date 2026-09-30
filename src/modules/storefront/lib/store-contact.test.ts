import { describe, expect, it } from 'vitest'
import type { Store } from '@/modules/storefront/types'
import {
  findUsAddress,
  hasStoreContactFacts,
  mapsEmbedUrl,
  mapsSearchUrl,
  orderWhatsappHref,
  storeContactHeaderProps,
  supportHelpMessage,
  supportWhatsappHref,
  supportWhatsappNumber,
} from './store-contact'

function shop(overrides: Partial<Store> = {}): Store {
  return {
    id: '91',
    name: "Geeta's Kitchen",
    category: 'Home food',
    rating: 4.8,
    etaMins: 30,
    distanceKm: 1,
    image: 'linear-gradient(#059669,#047857)',
    products: [],
    ...overrides,
  }
}

describe('findUsAddress', () => {
  it('uses business_location', () => {
    expect(findUsAddress(shop({ location: 'Bhopal' }))).toBe('Bhopal')
  })

  it('is empty when business_location is missing', () => {
    expect(findUsAddress(shop())).toBeUndefined()
  })
})

describe('mapsSearchUrl', () => {
  it('builds a Google Maps search for the shop address', () => {
    expect(mapsSearchUrl('12 MG Road, Hyderabad')).toBe(
      'https://www.google.com/maps/search/?api=1&query=12%20MG%20Road%2C%20Hyderabad',
    )
  })
})

describe('mapsEmbedUrl', () => {
  it('embeds a Google Maps search for the same shop address', () => {
    expect(mapsEmbedUrl('12 MG Road, Hyderabad')).toBe(
      'https://maps.google.com/maps?q=12%20MG%20Road%2C%20Hyderabad&z=15&output=embed',
    )
  })
})

describe('support WhatsApp', () => {
  it('uses support_whatsapp_number when present', () => {
    expect(
      supportWhatsappNumber(shop({ supportWhatsapp: '+919900000000', phone: '+919912149049' })),
    ).toBe('+919900000000')
  })

  it('falls back to order_whatsapp_number', () => {
    expect(supportWhatsappNumber(shop({ phone: '+919912149049' }))).toBe('+919912149049')
  })

  it('prefills a help message, not an order message', () => {
    const message = supportHelpMessage("Geeta's Kitchen")
    expect(message).toBe("Hi, I need help from Geeta's Kitchen")
    expect(supportWhatsappHref(shop({ phone: '+919912149049' }))).toBe(
      `https://wa.me/919912149049?text=${encodeURIComponent(message)}`,
    )
  })
})

describe('order WhatsApp', () => {
  it('opens an order message on the order number', () => {
    expect(orderWhatsappHref(shop({ phone: '+919912149049' }))).toBe(
      `https://wa.me/919912149049?text=${encodeURIComponent("Hi, I would like to order from Geeta's Kitchen")}`,
    )
  })

  it('does not use the support number for the header order link', () => {
    expect(orderWhatsappHref(shop({ supportWhatsapp: '+919900000000' }))).toBeUndefined()
  })
})

describe('hasStoreContactFacts', () => {
  it('is false when the shop has nothing to show', () => {
    expect(hasStoreContactFacts(shop())).toBe(false)
    expect(storeContactHeaderProps(shop()).contactHref).toBeUndefined()
  })

  it('is true for address or support WhatsApp only', () => {
    expect(hasStoreContactFacts(shop({ location: 'Hyderabad' }))).toBe(true)
    expect(hasStoreContactFacts(shop({ phone: '+919912149049' }))).toBe(true)
    expect(storeContactHeaderProps(shop({ phone: '+919912149049' })).contactHref).toBe(
      '/stores/91/contact',
    )
  })
})
