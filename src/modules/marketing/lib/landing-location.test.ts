import { describe, expect, it } from 'vitest'
import { toCustomerLocation } from './landing-location'

const indianAddressComponents = [
  { longText: 'Banjara Hills', shortText: 'Banjara Hills', types: ['sublocality'] },
  { longText: 'Hyderabad', shortText: 'Hyderabad', types: ['locality'] },
  { longText: '500034', shortText: '500034', types: ['postal_code'] },
  { longText: 'India', shortText: 'IN', types: ['country'] },
]

describe('landing location conversion', () => {
  it('converts a selected Google place into the exact confirmed delivery location', () => {
    expect(
      toCustomerLocation({
        source: 'selected-place',
        formattedAddress: 'Banjara Hills, Hyderabad, Telangana 500034, India',
        coordinates: { latitude: 17.4138277, longitude: 78.4397584 },
        addressComponents: indianAddressComponents,
      }),
    ).toEqual({
      serviceArea: '500034',
      latitude: 17.4138277,
      longitude: 78.4397584,
      label: 'Banjara Hills, Hyderabad, Telangana 500034, India',
    })
  })

  it('uses the browser coordinates for a reverse-geocoded Google result', () => {
    expect(
      toCustomerLocation({
        source: 'reverse-geocode',
        formattedAddress: 'Road No. 12, Banjara Hills, Hyderabad 500034, India',
        coordinates: { latitude: 17.4101, longitude: 78.4372 },
        addressComponents: indianAddressComponents,
      }),
    ).toEqual({
      serviceArea: '500034',
      latitude: 17.4101,
      longitude: 78.4372,
      label: 'Road No. 12, Banjara Hills, Hyderabad 500034, India',
    })
  })

  it('rejects a selected place without coordinates instead of borrowing fallback coordinates', () => {
    expect(() =>
      toCustomerLocation({
        source: 'selected-place',
        formattedAddress: 'Banjara Hills, Hyderabad 500034, India',
        addressComponents: indianAddressComponents,
      }),
    ).toThrow('does not include usable coordinates')
  })

  it.each([
    ['missing', indianAddressComponents.filter((part) => !part.types.includes('postal_code'))],
    [
      'malformed',
      indianAddressComponents.map((part) =>
        part.types.includes('postal_code') ? { ...part, longText: '50003' } : part,
      ),
    ],
  ])('rejects a %s six-digit postal code', (_case, addressComponents) => {
    expect(() =>
      toCustomerLocation({
        source: 'selected-place',
        formattedAddress: 'Hyderabad, India',
        coordinates: { latitude: 17.385, longitude: 78.4867 },
        addressComponents,
      }),
    ).toThrow('six-digit postal code')
  })

  it('rejects a result explicitly located outside India', () => {
    expect(() =>
      toCustomerLocation({
        source: 'selected-place',
        formattedAddress: 'Singapore 238839',
        coordinates: { latitude: 1.3039, longitude: 103.8318 },
        addressComponents: [
          { longText: '238839', shortText: '238839', types: ['postal_code'] },
          { longText: 'Singapore', shortText: 'SG', types: ['country'] },
        ],
      }),
    ).toThrow('within India')
  })
})
