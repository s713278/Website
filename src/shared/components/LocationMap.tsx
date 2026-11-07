import { useEffect, useRef, useState } from 'react'
import { Loader2, Navigation, X } from 'lucide-react'
import {
  FALLBACK_LOCATION,
  getSavedLocation,
  requestBrowserCoords,
} from '@/shared/lib/customer-location'
import {
  loadGoogleMaps,
  placeDetails,
  placeSuggestions,
  reverseGeocode,
  type PlaceSuggestion,
} from '@/shared/lib/google-maps'
import type { DeliveryAddressInput } from '@/shared/types/delivery-address'
import { Button, ShadcnInput } from '@/shared/components'

type LocationMapProps = {
  initial?: DeliveryAddressInput | null
  confirmLabel?: string
  onConfirm: (pin: DeliveryAddressInput) => void
}

function startingPin(initial?: DeliveryAddressInput | null): DeliveryAddressInput {
  if (initial?.lat != null && initial?.lng != null) {
    return {
      lat: initial.lat,
      lng: initial.lng,
      location: initial.location || FALLBACK_LOCATION.label,
      city: initial.city,
      country: initial.country,
      zipCode: initial.zipCode,
    }
  }
  const saved = getSavedLocation()
  if (saved) {
    return { lat: saved.latitude, lng: saved.longitude, location: saved.label }
  }
  return {
    lat: FALLBACK_LOCATION.latitude,
    lng: FALLBACK_LOCATION.longitude,
    location: FALLBACK_LOCATION.label,
  }
}

/**
 * Pin a delivery point on the map.
 * Search matches MithraUserApp: Google Places suggestions (3+ letters), then move the pin.
 */
export function LocationMap({
  initial,
  confirmLabel = 'Confirm location',
  onConfirm,
}: LocationMapProps) {
  const mapEl = useRef<HTMLDivElement>(null)
  const markerRef = useRef<{
    setPosition: (p: { lat: number; lng: number }) => void
    getPosition: () => { lat: () => number; lng: () => number } | null
    setMap: (map: unknown) => void
  } | null>(null)
  const mapRef = useRef<{ panTo: (p: { lat: number; lng: number }) => void } | null>(null)
  const placePinRef = useRef<
    (
      lat: number,
      lng: number,
      hint?: { location?: string; city?: string; country?: string; zipCode?: string },
    ) => Promise<void>
  >(async () => undefined)

  const start = startingPin(initial)
  const [pin, setPin] = useState<DeliveryAddressInput>(start)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [focused, setFocused] = useState(false)
  const [loading, setLoading] = useState(true)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')
  const searchSeq = useRef(0)

  useEffect(() => {
    const el = mapEl.current
    if (!el) return

    let cancelled = false
    const listeners: Array<{ remove: () => void }> = []

    async function placePin(
      lat: number,
      lng: number,
      hint?: { location?: string; city?: string; country?: string; zipCode?: string },
    ) {
      let location = hint?.location?.trim()
      let city = hint?.city
      let country = hint?.country
      let zipCode = hint?.zipCode
      if (!location || !city || !zipCode) {
        const geocoded = await reverseGeocode(lat, lng)
        location = location || geocoded.location
        city = city || geocoded.city
        country = country || geocoded.country
        zipCode = zipCode || geocoded.zipCode
      }
      if (cancelled) return
      markerRef.current?.setPosition({ lat, lng })
      mapRef.current?.panTo({ lat, lng })
      setPin({ lat, lng, location: location || `${lat}, ${lng}`, city, country, zipCode })
    }
    placePinRef.current = placePin

    async function setup() {
      setLoading(true)
      setError('')
      try {
        const maps = await loadGoogleMaps()
        if (cancelled || !el) return

        const origin = { lat: start.lat, lng: start.lng }

        const map = new maps.Map(el, {
          center: origin,
          zoom: 16,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        })
        mapRef.current = map

        const marker = new maps.Marker({ map, position: origin, draggable: true })
        markerRef.current = marker

        listeners.push(
          map.addListener('click', (event) => {
            if (!event.latLng) return
            void placePin(event.latLng.lat(), event.latLng.lng()).catch((err: unknown) => {
              setError(err instanceof Error ? err.message : 'Could not read that pin.')
            })
          }),
          marker.addListener('dragend', () => {
            const position = marker.getPosition()
            if (!position) return
            void placePin(position.lat(), position.lng()).catch((err: unknown) => {
              setError(err instanceof Error ? err.message : 'Could not read that pin.')
            })
          }),
        )

        // Start from saved / edited / Hyderabad fallback — do not force GPS.
        // GPS is opt-in via "Use current location".
        if (!initial?.location) {
          await placePin(origin.lat, origin.lng, {
            location: start.location,
            city: start.city,
            country: start.country,
            zipCode: start.zipCode,
          })
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the map.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void setup()

    return () => {
      cancelled = true
      listeners.forEach((listener) => listener.remove())
      markerRef.current?.setMap(null)
    }
    // Mount once with the starting pin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function searchArea(text: string) {
    const requestId = ++searchSeq.current
    if (text.trim().length < 3) {
      setSuggestions([])
      setSearching(false)
      return
    }
    setSearching(true)
    setError('')
    try {
      const next = await placeSuggestions(text)
      if (requestId !== searchSeq.current) return
      setSuggestions(next)
    } catch (err) {
      if (requestId !== searchSeq.current) return
      setSuggestions([])
      setError(err instanceof Error ? err.message : 'Could not search locations.')
    } finally {
      if (requestId === searchSeq.current) setSearching(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void searchArea(query)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query])

  async function chooseSuggestion(suggestion: PlaceSuggestion) {
    searchSeq.current += 1
    setSuggestions([])
    setFocused(false)
    setSearching(true)
    setError('')
    try {
      const found = await placeDetails(suggestion.placeId)
      await placePinRef.current(found.lat, found.lng, {
        location:
          found.location ||
          `${suggestion.mainText}${suggestion.secondaryText ? `, ${suggestion.secondaryText}` : ''}`,
        city: found.city,
        country: found.country,
        zipCode: found.zipCode,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open that place.')
    } finally {
      setSearching(false)
    }
  }

  async function goToMyLocation() {
    setLocating(true)
    setError('')
    try {
      const coords = await requestBrowserCoords()
      await placePinRef.current(coords.latitude, coords.longitude)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not use current location.')
    } finally {
      setLocating(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative space-y-2 border-b border-slate-100 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Search delivery location
        </p>
        <div className="relative">
          <ShadcnInput
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setFocused(true)
            }}
            onFocus={() => setFocused(true)}
            placeholder="Search"
            aria-label="Search location"
            autoComplete="off"
            className="h-11 pr-10"
            disabled={loading}
          />
          {query ? (
            <button
              type="button"
              className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
              aria-label="Clear search"
              onClick={() => {
                searchSeq.current += 1
                setQuery('')
                setSuggestions([])
                setFocused(true)
              }}
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        {focused && (searching || suggestions.length > 0) ? (
          <ul className="absolute inset-x-4 top-[4.6rem] z-20 max-h-56 overflow-auto rounded-b-xl border border-slate-200 bg-white shadow-lg">
            {searching && suggestions.length === 0 ? (
              <li className="flex items-center gap-2 px-3 py-3 text-sm text-slate-500">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Searching…
              </li>
            ) : null}
            {suggestions.map((suggestion) => (
              <li key={suggestion.placeId} className="border-t border-slate-100 first:border-t-0">
                <button
                  type="button"
                  className="w-full px-3 py-2.5 text-left hover:bg-slate-50"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void chooseSuggestion(suggestion)}
                >
                  <span className="block truncate text-sm font-medium text-slate-800">
                    {suggestion.mainText}
                  </span>
                  {suggestion.secondaryText ? (
                    <span className="block truncate text-xs text-slate-500">
                      {suggestion.secondaryText}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="relative min-h-[280px] flex-1 bg-slate-100">
        <div ref={mapEl} className="absolute inset-0" />
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 className="size-6 animate-spin text-[var(--store-theme,var(--md-green-700))]" />
          </div>
        ) : null}
      </div>

      <div className="space-y-3 border-t border-slate-100 bg-white p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Selected location
          </p>
          <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-900">{pin.location}</p>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button
          type="button"
          variant="outline"
          className="w-full rounded-lg"
          disabled={locating || loading}
          onClick={() => void goToMyLocation()}
        >
          {locating ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Navigation className="size-4" aria-hidden />
          )}
          Use current location
        </Button>
        <Button
          type="button"
          fullWidth
          className="rounded-lg"
          disabled={loading || !pin.location}
          onClick={() => onConfirm(pin)}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  )
}
