import { useEffect, useRef, useState } from 'react'
import { Loader2, Navigation } from 'lucide-react'
import { FALLBACK_LOCATION, requestBrowserCoords } from '@/shared/lib/customer-location'
import { loadGoogleMaps, reverseGeocode } from '@/shared/lib/google-maps'
import type { DeliveryAddressInput } from '@/shared/types/delivery-address'
import { Button } from '@/shared/components'

type LocationMapProps = {
  initial?: DeliveryAddressInput | null
  confirmLabel?: string
  onConfirm: (pin: DeliveryAddressInput) => void
}

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

  const [pin, setPin] = useState<DeliveryAddressInput>({
    lat: initial?.lat ?? FALLBACK_LOCATION.latitude,
    lng: initial?.lng ?? FALLBACK_LOCATION.longitude,
    location: initial?.location ?? FALLBACK_LOCATION.label,
  })
  const [loading, setLoading] = useState(true)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const el = mapEl.current
    if (!el) return

    let cancelled = false
    const listeners: Array<{ remove: () => void }> = []

    async function placePin(lat: number, lng: number) {
      const location = await reverseGeocode(lat, lng)
      if (cancelled) return
      markerRef.current?.setPosition({ lat, lng })
      mapRef.current?.panTo({ lat, lng })
      setPin({ lat, lng, location })
    }

    async function setup() {
      setLoading(true)
      setError('')
      try {
        const maps = await loadGoogleMaps()
        if (cancelled || !el) return

        const start = {
          lat: initial?.lat ?? FALLBACK_LOCATION.latitude,
          lng: initial?.lng ?? FALLBACK_LOCATION.longitude,
        }

        const map = new maps.Map(el, {
          center: start,
          zoom: 16,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        })
        mapRef.current = map

        const marker = new maps.Marker({ map, position: start, draggable: true })
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

        if (initial?.lat != null && initial?.lng != null) {
          if (!initial.location) await placePin(initial.lat, initial.lng)
          return
        }

        try {
          const coords = await requestBrowserCoords()
          if (!cancelled) await placePin(coords.latitude, coords.longitude)
        } catch {
          if (!cancelled) await placePin(start.lat, start.lng)
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

  async function goToMyLocation() {
    setLocating(true)
    setError('')
    try {
      const coords = await requestBrowserCoords()
      const location = await reverseGeocode(coords.latitude, coords.longitude)
      const next = { lat: coords.latitude, lng: coords.longitude, location }
      markerRef.current?.setPosition(next)
      mapRef.current?.panTo(next)
      setPin(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not use current location.')
    } finally {
      setLocating(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
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
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected location</p>
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
          {locating ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Navigation className="size-4" aria-hidden />}
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
