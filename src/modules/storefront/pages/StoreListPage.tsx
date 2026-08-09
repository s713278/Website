import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { catalogService } from '@/shared/api'
import type { Store } from '@/modules/storefront/types'
import { getErrorMessage } from '@/shared/api'
import { Badge, Card, EmptyState, Input, PageHeader, Spinner } from '@/shared/components'

export function StoreListPage() {
  const [query, setQuery] = useState('')
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      setLoading(true)
      setError('')
      void catalogService
        .listStores(query)
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
      clearTimeout(timer)
    }
  }, [query])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader title="Stores near you" subtitle="Order from local stores delivering to your area" />
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
        <EmptyState title="No matches" description="Try another category or store name." />
      ) : null}
      {!loading && !error && stores.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((store) => (
            <Link key={store.id} to={`/stores/${store.id}`}>
              <Card className="h-full overflow-hidden p-0 transition hover:-translate-y-0.5 hover:shadow-lg">
                <div
                  className="flex h-36 items-end p-4 text-white"
                  style={{ background: store.image }}
                >
                  <div>
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
