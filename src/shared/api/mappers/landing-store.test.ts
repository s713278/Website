import { describe, expect, it } from 'vitest'
import { mapLandingStore, resolveLandingStoreArtwork } from './landing-store'

describe('landing store presentation', () => {
  it('maps a vendor_id row into truthful card content', () => {
    expect(
      mapLandingStore({
        vendor_id: 91,
        name: 'H2A2 Farms',
        banner_image: 'https://cdn.example.com/banner.jpg',
        thumbnail_image: 'https://cdn.example.com/thumb.jpg',
        rating: 4.8,
        category: 'Farm produce',
        distance_km: 2.4,
        eta_mins: 25,
        offer: 'Fresh today',
      }),
    ).toEqual({
      id: '91',
      name: 'H2A2 Farms',
      rating: 4.8,
      category: 'Farm produce',
      distanceKm: 2.4,
      etaMins: 25,
      offer: 'Fresh today',
      artworkCandidates: [
        'https://cdn.example.com/banner.jpg',
        'https://cdn.example.com/thumb.jpg',
      ],
    })
  })

  it('accepts id and omits metadata the backend did not provide', () => {
    expect(
      mapLandingStore({
        id: 54,
        business_name: 'Tastebuds Adventures',
        thumbnail_image: 'https://cdn.example.com/tastebuds.png',
      }),
    ).toEqual({
      id: '54',
      name: 'Tastebuds Adventures',
      artworkCandidates: ['https://cdn.example.com/tastebuds.png'],
    })
  })

  it('rejects rows without a usable identifier or store name', () => {
    expect(mapLandingStore({ name: 'No identifier' })).toBeNull()
    expect(mapLandingStore({ vendor_id: 12, name: '   ' })).toBeNull()
  })

  it('ignores invalid image values and the undocumented generic image_path', () => {
    expect(
      mapLandingStore({
        vendor_id: 91,
        name: 'H2A2 Farms',
        banner_image: 'javascript:alert(1)',
        thumbnail_image: 42,
        image_path: 'https://cdn.example.com/ambiguous.jpg',
      }),
    ).toEqual({ id: '91', name: 'H2A2 Farms', artworkCandidates: [] })
  })

  it('prefers the banner, advances to the thumbnail after failure, then uses the store name', () => {
    const store = mapLandingStore({
      vendor_id: 91,
      name: 'H2A2 Farms',
      banner_image: 'https://cdn.example.com/banner.jpg',
      thumbnail_image: 'https://cdn.example.com/thumb.jpg',
    })!

    expect(resolveLandingStoreArtwork(store, [])).toEqual({
      kind: 'image',
      url: 'https://cdn.example.com/banner.jpg',
    })
    expect(resolveLandingStoreArtwork(store, ['https://cdn.example.com/banner.jpg'])).toEqual({
      kind: 'image',
      url: 'https://cdn.example.com/thumb.jpg',
    })
    expect(
      resolveLandingStoreArtwork(store, [
        'https://cdn.example.com/banner.jpg',
        'https://cdn.example.com/thumb.jpg',
      ]),
    ).toEqual({ kind: 'name', text: 'H2A2 Farms' })
  })
})
