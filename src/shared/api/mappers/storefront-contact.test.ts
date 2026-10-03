import { describe, expect, it } from 'vitest'
import { hasStoreContactContent, mapStorefrontContact } from './storefront-contact'

const sample = {
  vendor_id: 273,
  store_identifier: 'srk_store',
  business_name: 'SRK Traditional Foods and Pickles',
  owner_name: 'SRK Patel',
  contact_number: '919111111111',
  main_address: {
    city: 'Hyderabad',
    state: 'Telangana',
    country: 'India',
    zipCode: '500049',
    address1: 'MIG 3-973/L',
    address2: 'Raod No-27F,Mayurinagar',
    district: 'Ranga Reddy',
    latitude: '17.510041',
    locality: 'Miyapur',
    longitude: '78.365615',
  },
  addresses: [],
  social_links: [
    {
      id: 2,
      platform: 'YOUTUBE',
      url: 'https://www.youtube.com/@MithraDirect',
      display_order: 2,
    },
    {
      id: 1,
      platform: 'INSTAGRAM',
      url: 'https://www.instagram.com/mithradirect/',
      display_order: 1,
    },
  ],
}

describe('mapStorefrontContact', () => {
  it('keeps the contact-us fields', () => {
    expect(mapStorefrontContact(sample)).toEqual({
      businessName: 'SRK Traditional Foods and Pickles',
      storeIdentifier: 'srk_store',
      ownerName: 'SRK Patel',
      contactNumber: '919111111111',
      mainAddress: {
        address1: 'MIG 3-973/L',
        address2: 'Raod No-27F,Mayurinagar',
        locality: 'Miyapur',
        district: 'Ranga Reddy',
        city: 'Hyderabad',
        state: 'Telangana',
        country: 'India',
        zipCode: '500049',
        latitude: '17.510041',
        longitude: '78.365615',
      },
      addresses: [],
      socialLinks: [
        { id: '1', platform: 'INSTAGRAM', url: 'https://www.instagram.com/mithradirect/' },
        { id: '2', platform: 'YOUTUBE', url: 'https://www.youtube.com/@MithraDirect' },
      ],
    })
  })

  it('keeps extra addresses and drops unsafe social urls', () => {
    const contact = mapStorefrontContact({
      business_name: 'Shop',
      addresses: [{ address1: '12 Market Road', city: 'Pune', latitude: '18.52', longitude: '73.85' }],
      social_links: [{ id: 9, platform: 'INSTAGRAM', url: 'javascript:alert(1)', display_order: 1 }],
    })
    expect(contact?.addresses[0]).toMatchObject({ address1: '12 Market Road', city: 'Pune' })
    expect(contact?.socialLinks).toEqual([])
    expect(hasStoreContactContent(contact)).toBe(true)
  })

  it('is empty when the payload has no contact facts', () => {
    expect(hasStoreContactContent(mapStorefrontContact({ business_name: 'Shop' }))).toBe(false)
  })
})
