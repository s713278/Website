import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { catalogService, getErrorMessage, isLiveApi } from '@/shared/api'
import type { Store } from '@/modules/storefront/types'
import {
  detectBrowserLocation,
  FALLBACK_LOCATION,
  getSavedLocation,
  lookupArea,
  saveLocation,
  type CustomerLocation,
} from '@/shared/lib/customer-location'
import { Badge, Button, Card, EmptyState, Input, PageHeader, SearchField } from '@/shared/components'
import {
  isSearchActive,
  isSearchApiReady,
  matchesSearchQuery,
  searchUiMinChars,
} from '@/shared/lib/search-query'
import { Skeleton } from '@/components/ui/skeleton'
import { LoadingStatus } from '@/shared/components/LoadingStatus'

function StoreCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-white" aria-hidden>
      <Skeleton className="h-36 w-full rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}

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

  const keyword = query.trim()
  const minChars = searchUiMinChars(isLiveApi())
  const searchActive = isSearchActive(keyword, minChars)
  const useApiSearch = isSearchApiReady(keyword)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError('')
      const request = useApiSearch
        ? catalogService.searchStoresByKeyword(keyword, location)
        : catalogService.listStores(undefined, location)
      void request
        .then((data) => {
          if (cancelled) return
          if (!useApiSearch && searchActive) {
            const needle = keyword.toLowerCase()
            setStores(
              data.filter(
                (store) =>
                  matchesSearchQuery(store.name, needle) ||
                  matchesSearchQuery(store.category, needle) ||
                  store.products.some((product) => matchesSearchQuery(product.name, needle)),
              ),
            )
            return
          }
          setStores(data)
        })
        .catch((err) => {
          if (!cancelled) setError(getErrorMessage(err, 'Could not load stores'))
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, searchActive ? 300 : 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [keyword, searchActive, useApiSearch, location, reloadKey])

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
    <div className="marketing-measure marketing-gutter box-content py-8">
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

      <SearchField
        className="mb-6 max-w-md"
        value={query}
        onChange={setQuery}
        placeholder="Search stores, products, or categories"
        aria-label="Search stores"
        minChars={minChars}
      />

     {loading ? (
        <div className="space-y-4" aria-busy="true">
          <LoadingStatus
            loading={loading}
            label={searchActive ? 'Searching stores…' : 'Loading stores…'}
            onRetry={() => setReloadKey((k) => k + 1)}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <StoreCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : null}
     {!loading && error ? (
        <EmptyState
          title="Could not load stores"
          description={error}
          action={<Button onClick={() => setReloadKey((k) => k + 1)}>Try again</Button>}
        />
      ) : null}
      {!loading && !error && stores.length === 0 ? (
        <EmptyState
          title={searchActive ? 'No matches' : 'No stores in this area'}
          description={
            searchActive
              ? `Nothing matched “${keyword}” in ${location.label}.`
              : 'Try another pincode, city, or Use my location.'
          }
        />
      ) : null}
      {!loading && !error && stores.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((store) => (
           <Link key={store.id} to={`/stores/${store.id}`} state={{ storeName: store.name }}>
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
