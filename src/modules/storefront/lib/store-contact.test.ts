import { describe, expect, it } from 'vitest'
import type { Store } from '@/modules/storefront/types'
import {
  findUsAddress,
  hasStoreContactFacts,
  mapsEmbedUrl,
  mapsSearchUrl,
  orderWhatsappNumber,
  storeContactHeaderProps,
  supportHelpMessage,
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
  it('opens the coordinates and leaves the address off the map link', () => {
    expect(
      mapsSearchUrl({
        label: 'MIG 3-973/L, Miyapur, Hyderabad, Telangana, 500049, India',
        latitude: '17.510041',
        longitude: '78.365615',
      }),
    ).toBe('https://www.google.com/maps/search/?api=1&query=17.510041%2C78.365615')
  })

  it('searches the address when coordinates are missing', () => {
    expect(mapsSearchUrl({ label: '12 MG Road, Hyderabad' })).toBe(
      'https://www.google.com/maps/search/?api=1&query=12%20MG%20Road%2C%20Hyderabad',
    )
  })
})

describe('mapsEmbedUrl', () => {
  it('embeds the coordinates and leaves the address off the map link', () => {
    expect(
      mapsEmbedUrl({
        label: 'MIG 3-973/L, Miyapur, Hyderabad, Telangana, 500049, India',
        latitude: '17.510041',
        longitude: '78.365615',
      }),
    ).toBe('https://maps.google.com/maps?q=17.510041%2C78.365615&z=17&output=embed')
  })

  it('embeds an address search when coordinates are missing', () => {
    expect(mapsEmbedUrl({ label: '12 MG Road, Hyderabad' })).toBe(
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

  it('prefills a help message', () => {
    expect(supportHelpMessage("Geeta's Kitchen")).toBe("Hi, I need help from Geeta's Kitchen")
  })
})

describe('order WhatsApp', () => {
  it('prefers order_whatsapp_number for Chat with Owner / place-order', () => {
    expect(
      orderWhatsappNumber(shop({ supportWhatsapp: '+919900000000', phone: '+919912149049' })),
    ).toBe('+919912149049')
  })

  it('falls back to support WhatsApp when order number is missing', () => {
    expect(orderWhatsappNumber(shop({ supportWhatsapp: '+919900000000' }))).toBe('+919900000000')
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
