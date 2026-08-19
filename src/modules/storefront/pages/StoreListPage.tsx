import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { catalogService, getErrorMessage } from '@/shared/api'
import type { Store } from '@/modules/storefront/types'
import {
  detectBrowserLocation,
  FALLBACK_LOCATION,
  getSavedLocation,
  lookupArea,
  saveLocation,
  type CustomerLocation,
} from '@/shared/lib/customer-location'
import { Badge, Button, Card, EmptyState, Input, PageHeader, Spinner } from '@/shared/components'

export function StoreListPage() {
  const [query, setQuery] = useState('')
  const [areaInput, setAreaInput] = useState(() => getSavedLocation()?.label ?? FALLBACK_LOCATION.label)
  const [location, setLocation] = useState<CustomerLocation>(
    () => getSavedLocation() ?? FALLBACK_LOCATION,
  )
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')
  const [areaError, setAreaError] = useState('')

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError('')
      void catalogService
        .listStores(query, location)
        .then((data) => {
          if (!cancelled) setStores(data)
        })
        .catch((err) => {
          if (!cancelled) setError(getErrorMessage(err, 'Could not load stores'))
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, query ? 250 : 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, location])

  function applyLocation(next: CustomerLocation) {
    saveLocation(next)
    setLocation(next)
    setAreaInput(next.label)
    setAreaError('')
  }



  async function onUseMyLocation() {
    setLocating(true)
    setAreaError('')
    try {
      applyLocation(await detectBrowserLocation())
    } catch (err) {
      setAreaError(getErrorMessage(err, 'Could not access location.'))
    } finally {
      setLocating(false)
    }
  }

  async function onApplyArea(event: FormEvent) {
    event.preventDefault()
    setLocating(true)
    setAreaError('')
    try {
      applyLocation(await lookupArea(areaInput))
    } catch (err) {
      setAreaError(getErrorMessage(err, 'Enter a valid pincode or city.'))
    } finally {
      setLocating(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader
        title="Stores near you"
        subtitle={`Showing stores for ${location.label}`}
      />

      <form className="mb-4 flex max-w-xl flex-col gap-2 sm:flex-row sm:items-end" onSubmit={onApplyArea}>
        <div className="min-w-0 flex-1">
          <Input
            name="area"
            label="Delivery area"
            placeholder="Pincode or city"
            value={areaInput}
            onChange={(e) => setAreaInput(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="secondary" disabled={locating}>
            Apply
          </Button>
          <Button type="button" disabled={locating} onClick={() => void onUseMyLocation()}>
            <MapPin className="size-4" />
            {locating ? 'Detecting…' : 'Use my location'}
          </Button>
        </div>
      </form>
      {areaError ? <p className="mb-4 text-sm text-[var(--md-danger)]">{areaError}</p> : null}

      <div className="mb-6 max-w-md">
        <Input
          name="search"
          placeholder="Search stores or categories"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading ? <Spinner label="Loading stores…" /> : null}
      {!loading && error ? (
        <EmptyState title="Something went wrong" description={error} />
      ) : null}
      {!loading && !error && stores.length === 0 ? (
        <EmptyState
          title="No stores in this area"
          description="Try another pincode, city, or Use my location."
        />
      ) : null}
      {!loading && !error && stores.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((store) => (
            <Link key={store.id} to={`/stores/${store.id}`}>
              <Card className="h-full overflow-hidden p-0 transition hover:-translate-y-0.5 hover:shadow-lg">
                <div
                  className="relative flex h-36 items-end p-4 text-white"
                  style={{ background: store.image }}
                >
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 to-black/10" />
                  <div className="relative">
                    <h2 className="font-display text-xl font-bold">{store.name}</h2>
                    <p className="text-sm text-white/90">{store.category}</p>
                  </div>
                </div>
                <div className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    <Badge tone="success">★ {store.rating}</Badge>
                    <span>{store.etaMins} mins</span>
                    <span>·</span>
                    <span>{store.distanceKm} km</span>
                  </div>
                  {store.offer ? (
                    <p className="text-sm font-semibold text-[var(--md-green-700)]">
                      {store.offer}
                    </p>
                  ) : null}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}
