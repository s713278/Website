/** Delivery area sent to GET /v1/home (`service_area` + lat/lng). */

export type CustomerLocation = {
  serviceArea: string
  latitude: number
  longitude: number
  label: string
}

const STORAGE_KEY = 'md-delivery-location'

/** Used only until the customer shares GPS or types a PIN/city. */
export const FALLBACK_LOCATION: CustomerLocation = {
  serviceArea: 'Hyderabad',
  latitude: 17.385044,
  longitude: 78.486671,
  label: 'Hyderabad',
}

export function getSavedLocation(): CustomerLocation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CustomerLocation>
    if (
      typeof parsed.serviceArea === 'string' &&
      typeof parsed.latitude === 'number' &&
      typeof parsed.longitude === 'number'
    ) {
      return {
        serviceArea: parsed.serviceArea,
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        label: parsed.label || parsed.serviceArea,
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

export function saveLocation(location: CustomerLocation) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(location))
  } catch {
    /* ignore */
  }
}

export function homeQuery(location: CustomerLocation) {
  return {
    service_area: location.serviceArea,
    latitude: location.latitude,
    longitude: location.longitude,
  }
}

const LOCATION_UNAVAILABLE = 'Could not access location. Allow location or enter a PIN / city.'
const LOCATION_BLOCKED = 'Location is blocked for this site. Allow location, or enter a PIN / city.'
const PERMISSION_DENIED = 1

function geolocationCode(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null
  const code = (error as { code: unknown }).code
  return typeof code === 'number' ? code : null
}

function readGpsCoords(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Location is not supported in this browser.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      (error) => reject(error),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    )
  })
}

async function readIpCoords(): Promise<{ latitude: number; longitude: number }> {
  const res = await fetch(
    'https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=en',
  )
  if (!res.ok) throw new Error(LOCATION_UNAVAILABLE)
  const data = (await res.json()) as { latitude?: unknown; longitude?: unknown }
  if (typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
    throw new Error(LOCATION_UNAVAILABLE)
  }
  return { latitude: data.latitude, longitude: data.longitude }
}

export async function requestBrowserCoords(): Promise<{ latitude: number; longitude: number }> {
  try {
    return await readGpsCoords()
  } catch (error) {
    if (geolocationCode(error) === PERMISSION_DENIED) throw new Error(LOCATION_BLOCKED)
    try {
      return await readIpCoords()
    } catch (ipError) {
      if (ipError instanceof Error && ipError.message === LOCATION_UNAVAILABLE) throw ipError
      throw error instanceof Error ? error : new Error(LOCATION_UNAVAILABLE)
    }
  }
}

type ReversePayload = {
  city?: string
  locality?: string
  principalSubdivision?: string
  postcode?: string
}

function pinFrom(value: unknown) {
  return String(value || '')
    .replace(/\D/g, '')
    .slice(0, 6)
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<CustomerLocation> {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Could not resolve your area.')
  const data = (await res.json()) as ReversePayload
  const postcode = pinFrom(data.postcode)
  const city = data.city || data.locality || data.principalSubdivision || 'Your area'
  return {
    serviceArea: postcode.length === 6 ? postcode : city,
    latitude,
    longitude,
    label: postcode.length === 6 ? `${city} ${postcode}` : city,
  }
}

type PhotonFeature = {
  geometry?: { coordinates?: number[] }
  properties?: {
    name?: string
    city?: string
    postcode?: string
    state?: string
  }
}

export async function lookupArea(query: string): Promise<CustomerLocation> {
  const q = query.trim()
  if (!q) throw new Error('Enter a pincode or city.')

  const res = await fetch(
    `https://photon.komoot.io/api/?q=${encodeURIComponent(`${q}, India`)}&limit=1&lang=en`,
  )
  if (!res.ok) throw new Error('Could not find that area.')
  const body = (await res.json()) as { features?: PhotonFeature[] }
  const feature = body.features?.[0]
  const coords = feature?.geometry?.coordinates
  const props = feature?.properties || {}

  if (!coords || coords.length < 2) {
    if (/^\d{6}$/.test(q)) {
      const fallback = getSavedLocation() ?? FALLBACK_LOCATION
      return { serviceArea: q, latitude: fallback.latitude, longitude: fallback.longitude, label: q }
    }
    throw new Error('Could not find that pincode or city.')
  }

  const longitude = coords[0]
  const latitude = coords[1]
  const postcode = pinFrom(props.postcode)
  const city = props.city || props.name || q
  const typedPin = /^\d{6}$/.test(q)

  return {
    serviceArea: typedPin ? q : postcode.length === 6 ? postcode : city,
    latitude,
    longitude,
    label: typedPin ? `${city} ${q}` : postcode.length === 6 ? `${city} ${postcode}` : city,
  }
}

export async function detectBrowserLocation(): Promise<CustomerLocation> {
  const coords = await requestBrowserCoords()
  return reverseGeocode(coords.latitude, coords.longitude)
}
