import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createLandingLocationSearch,
  isConfirmedLandingLocation,
  toCustomerLocation,
} from './landing-location'

const indianProperties = {
  name: 'Banjara Hills',
  city: 'Hyderabad',
  state: 'Telangana',
  postcode: '500034',
  country: 'India',
  countrycode: 'IN',
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('landing location conversion', () => {
  it('converts a selected Photon result into the exact confirmed delivery location', () => {
    expect(
      toCustomerLocation({
        source: 'selected-place',
        coordinates: { latitude: 17.4138277, longitude: 78.4397584 },
        properties: indianProperties,
      }),
    ).toEqual({
      serviceArea: '500034',
      latitude: 17.4138277,
      longitude: 78.4397584,
      label: 'Banjara Hills, Hyderabad, Telangana 500034, India',
    })
  })

  it('uses the browser coordinates for a reverse-geocoded Photon result', () => {
    expect(
      toCustomerLocation({
        source: 'reverse-geocode',
        coordinates: { latitude: 17.4101, longitude: 78.4372 },
        properties: {
          ...indianProperties,
          name: 'Road No. 12',
        },
      }),
    ).toEqual({
      serviceArea: '500034',
      latitude: 17.4101,
      longitude: 78.4372,
      label: 'Road No. 12, Hyderabad, Telangana 500034, India',
    })
  })

  it('rejects a selected place without coordinates instead of borrowing fallback coordinates', () => {
    expect(() =>
      toCustomerLocation({
        source: 'selected-place',
        properties: indianProperties,
      }),
    ).toThrow('does not include usable coordinates')
  })

  it.each([
    ['missing', { ...indianProperties, postcode: undefined }],
    ['malformed', { ...indianProperties, postcode: '50003' }],
  ])('rejects a %s six-digit postal code', (_case, properties) => {
    expect(() =>
      toCustomerLocation({
        source: 'selected-place',
        coordinates: { latitude: 17.385, longitude: 78.4867 },
        properties,
      }),
    ).toThrow("We couldn't identify the pincode")
  })

  it('rejects a result explicitly located outside India', () => {
    expect(() =>
      toCustomerLocation({
        source: 'selected-place',
        coordinates: { latitude: 1.3039, longitude: 103.8318 },
        properties: {
          name: 'Orchard Road',
          postcode: '238839',
          country: 'Singapore',
          countrycode: 'SG',
        },
      }),
    ).toThrow('within India')
  })

  it('does not trust a legacy saved location without matching validation provenance', () => {
    const saved = {
      serviceArea: '500034',
      latitude: 17.385044,
      longitude: 78.486671,
      label: 'Typed pincode with old coordinates',
    }

    expect(isConfirmedLandingLocation(saved, null)).toBe(false)
    expect(
      isConfirmedLandingLocation(saved, {
        ...saved,
        longitude: 78.4397584,
      }),
    ).toBe(false)
    expect(isConfirmedLandingLocation(saved, saved)).toBe(true)
  })
})

describe('Photon landing location search', () => {
  it('recovers a consistent nearby pincode without changing the selected coordinates', async () => {
    const selectedFeature = {
      properties: {
        name: 'Kasu Brahmananda Reddy National Park',
        city: 'Hyderabad',
        state: 'Telangana',
        country: 'India',
        countrycode: 'IN',
        osm_type: 'W',
        osm_id: 78252,
      },
      geometry: { coordinates: [78.420463, 17.4202917] },
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ features: [selectedFeature] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          features: [
            selectedFeature,
            {
              properties: { ...indianProperties, name: 'Chiraan Palace', postcode: '500096' },
              geometry: { coordinates: [78.4211586, 17.4203398] },
            },
            {
              properties: { ...indianProperties, name: 'KBR Park Nature Trail', postcode: '500096' },
              geometry: { coordinates: [78.4203003, 17.4176502] },
            },
          ],
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const search = await createLandingLocationSearch()
    const [suggestion] = await search.suggestions('KBR Park')

    await expect(search.select(suggestion.id)).resolves.toEqual({
      serviceArea: '500096',
      latitude: 17.4202917,
      longitude: 78.420463,
      label: 'Kasu Brahmananda Reddy National Park, Hyderabad, Telangana 500096, India',
    })

    const reverseUrl = fetchMock.mock.calls[1]?.[0] as URL
    expect(reverseUrl.searchParams.get('limit')).toBe('10')
    expect(reverseUrl.searchParams.get('radius')).toBe('1')
    expect(reverseUrl.searchParams.getAll('layer')).toEqual(['house', 'street', 'locality'])
  })

  it('does not guess when nearby address results disagree on the pincode', async () => {
    const selectedFeature = {
      properties: {
        name: 'Boundary Landmark',
        city: 'Hyderabad',
        state: 'Telangana',
        country: 'India',
        countrycode: 'IN',
      },
      geometry: { coordinates: [78.42, 17.42] },
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ features: [selectedFeature] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          features: [
            {
              properties: { ...indianProperties, postcode: '500096' },
              geometry: { coordinates: [78.4201, 17.4201] },
            },
            {
              properties: { ...indianProperties, postcode: '500034' },
              geometry: { coordinates: [78.4202, 17.4202] },
            },
          ],
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const search = await createLandingLocationSearch()
    const [suggestion] = await search.suggestions('Boundary Landmark')

    await expect(search.select(suggestion.id)).rejects.toThrow(
      "We couldn't identify the pincode",
    )
  })

  it('keeps a displayed suggestion selectable while the next search is pending', async () => {
    const firstPayload = {
      features: [
        {
          properties: {
            ...indianProperties,
            osm_type: 'N',
            osm_id: 123,
          },
          geometry: { coordinates: [78.4397584, 17.4138277] },
        },
      ],
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => firstPayload,
      })
      .mockImplementationOnce((_url: URL, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('Search replaced', 'AbortError')),
          )
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const search = await createLandingLocationSearch()
    const [displayedSuggestion] = await search.suggestions('Banjara Hills')
    const replacementSearch = search.suggestions('Banjara Hills Road 12')
    void replacementSearch.catch(() => undefined)

    await expect(search.select(displayedSuggestion.id)).resolves.toEqual({
      serviceArea: '500034',
      latitude: 17.4138277,
      longitude: 78.4397584,
      label: 'Banjara Hills, Hyderabad, Telangana 500034, India',
    })
  })

  it('keeps the displayed generation selectable until newer suggestions are rendered', async () => {
    const feature = {
      properties: {
        ...indianProperties,
        osm_type: 'N',
        osm_id: 123,
      },
      geometry: { coordinates: [78.4397584, 17.4138277] },
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ features: [feature] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          features: [
            {
              properties: {
                ...indianProperties,
                name: 'Jubilee Hills',
                osm_type: 'N',
                osm_id: 456,
              },
              geometry: { coordinates: [78.4071, 17.4326] },
            },
          ],
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const search = await createLandingLocationSearch()
    const [displayedSuggestion] = await search.suggestions('Banjara Hills')
    await search.suggestions('Jubilee Hills')

    await expect(search.select(displayedSuggestion.id)).resolves.toMatchObject({
      serviceArea: '500034',
      latitude: 17.4138277,
      longitude: 78.4397584,
    })
  })
})
