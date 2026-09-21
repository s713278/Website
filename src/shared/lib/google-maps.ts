type LatLng = { lat: number; lng: number }

/** Minimal Maps surface we actually use. */
type MapsApi = {
  Map: new (el: HTMLElement, opts?: Record<string, unknown>) => {
    panTo: (p: LatLng) => void
    addListener: (event: string, handler: (e: { latLng?: { lat: () => number; lng: () => number } | null }) => void) => {
      remove: () => void
    }
  }
  Marker: new (opts: { map?: unknown; position: LatLng; draggable?: boolean }) => {
    setPosition: (p: LatLng) => void
    getPosition: () => { lat: () => number; lng: () => number } | null
    addListener: (event: string, handler: () => void) => { remove: () => void }
    setMap: (map: unknown) => void
  }
  Geocoder: new () => {
    geocode: (req: { location: LatLng }) => Promise<{
      results: Array<{
        formatted_address: string
        address_components?: Array<{ long_name: string; short_name: string; types: string[] }>
      }>
    }>
  }
  places: {
    AutocompleteService: new () => {
      getPlacePredictions: (
        request: {
          input: string
          language?: string
          componentRestrictions?: { country: string | string[] }
        },
        callback: (
          predictions: Array<{
            place_id: string
            structured_formatting?: { main_text?: string; secondary_text?: string }
          }> | null,
          status: string,
        ) => void,
      ) => void
    }
    PlacesService: new (attrContainer: HTMLElement) => {
      getDetails: (
        request: { placeId: string; fields: string[] },
        callback: (
          place: {
            formatted_address?: string
            address_components?: Array<{ long_name: string; short_name: string; types: string[] }>
            geometry?: { location?: { lat: () => number; lng: () => number } }
          } | null,
          status: string,
        ) => void,
      ) => void
    }
  }
}

export type PlaceSuggestion = {
  placeId: string
  mainText: string
  secondaryText: string
}

export type GeocodedPlace = {
  lat: number
  lng: number
  location: string
  city?: string
  country?: string
  zipCode?: string
}

function pickComponent(
  components: Array<{ long_name: string; types: string[] }> | undefined,
  ...types: string[]
) {
  if (!components?.length) return undefined
  for (const type of types) {
    const match = components.find((item) => item.types.includes(type))?.long_name?.trim()
    if (match) return match
  }
  return undefined
}

function partsFromComponents(
  components: Array<{ long_name: string; types: string[] }> | undefined,
) {
  const zip = pickComponent(components, 'postal_code')?.replace(/\D/g, '').slice(0, 6)
  return {
    city: pickComponent(
      components,
      'locality',
      'administrative_area_level_2',
      'sublocality',
      'sublocality_level_1',
    ),
    country: pickComponent(components, 'country'),
    zipCode: zip && zip.length === 6 ? zip : undefined,
  }
}

const SCRIPT_ID = 'md-google-maps'
let loading: Promise<MapsApi> | null = null

function mapsApi() {
  return (window as Window & { google?: { maps?: MapsApi } }).google?.maps
}

export function loadGoogleMaps() {
  const ready = mapsApi()
  if (ready?.places) return Promise.resolve(ready)
  if (loading) return loading

  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()
  if (!key) return Promise.reject(new Error('Google Maps is not configured.'))

  loading = new Promise((resolve, reject) => {
    const fail = () => {
      loading = null
      reject(new Error('Could not load Google Maps.'))
    }

    const finish = () => {
      const maps = mapsApi()
      if (maps?.places) resolve(maps)
      else if (maps) {
        reject(new Error('Location search is not ready. Refresh the page and try again.'))
      } else fail()
    }

    const existing = document.getElementById(SCRIPT_ID)
    if (existing) {
      const maps = mapsApi()
      if (maps?.places) {
        resolve(maps)
        return
      }
      if (maps) {
        reject(new Error('Location search is not ready. Refresh the page and try again.'))
        return
      }
      existing.addEventListener('load', finish, { once: true })
      existing.addEventListener('error', fail, { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.async = true
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`
    script.onload = finish
    script.onerror = fail
    document.head.appendChild(script)
  })

  return loading
}

export async function placeSuggestions(input: string): Promise<PlaceSuggestion[]> {
  const text = input.trim()
  if (text.length < 3) return []

  const maps = await loadGoogleMaps()
  const service = new maps.places.AutocompleteService()

  return new Promise((resolve, reject) => {
    service.getPlacePredictions(
      {
        input: text,
        language: 'en',
        componentRestrictions: { country: 'in' },
      },
      (predictions, status) => {
        if (status !== 'OK' && status !== 'ZERO_RESULTS') {
          reject(new Error('Could not search locations.'))
          return
        }
        resolve(
          (predictions ?? []).map((item) => ({
            placeId: item.place_id,
            mainText: item.structured_formatting?.main_text || 'Location',
            secondaryText: item.structured_formatting?.secondary_text || '',
          })),
        )
      },
    )
  })
}

/** Place Details → map region. */
export async function placeDetails(placeId: string): Promise<GeocodedPlace> {
  const maps = await loadGoogleMaps()
  const service = new maps.places.PlacesService(document.createElement('div'))

  return new Promise((resolve, reject) => {
    service.getDetails(
      { placeId, fields: ['geometry', 'formatted_address', 'address_components'] },
      (place, status) => {
        const location = place?.geometry?.location
        if (status !== 'OK' || !location) {
          reject(new Error('Could not open that place. Try another suggestion.'))
          return
        }
        resolve({
          lat: location.lat(),
          lng: location.lng(),
          location: place.formatted_address || '',
          ...partsFromComponents(place.address_components),
        })
      },
    )
  })
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodedPlace> {
  const maps = await loadGoogleMaps()
  const result = await new maps.Geocoder().geocode({ location: { lat, lng } })
  const place = result.results[0]
  if (!place?.formatted_address) throw new Error('Could not find that location.')
  return {
    lat,
    lng,
    location: place.formatted_address,
    ...partsFromComponents(place.address_components),
  }
}
