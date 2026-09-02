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
    geocode: (req: { location: LatLng }) => Promise<{ results: Array<{ formatted_address: string }> }>
  }
}

const SCRIPT_ID = 'md-google-maps'
let loading: Promise<MapsApi> | null = null

function mapsApi() {
  return (window as Window & { google?: { maps?: MapsApi } }).google?.maps
}

export function loadGoogleMaps() {
  const ready = mapsApi()
  if (ready) return Promise.resolve(ready)
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
      if (maps) resolve(maps)
      else fail()
    }

    const existing = document.getElementById(SCRIPT_ID)
    if (existing) {
      existing.addEventListener('load', finish, { once: true })
      existing.addEventListener('error', fail, { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.async = true
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}`
    script.onload = finish
    script.onerror = fail
    document.head.appendChild(script)
  })

  return loading
}

export async function reverseGeocode(lat: number, lng: number) {
  const maps = await loadGoogleMaps()
  const result = await new maps.Geocoder().geocode({ location: { lat, lng } })
  const place = result.results[0]?.formatted_address
  if (!place) throw new Error('Could not find that location.')
  return place
}
