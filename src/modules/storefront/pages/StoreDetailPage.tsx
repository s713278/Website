import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { catalogService, getErrorMessage } from '@/shared/api'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import type { Store } from '@/modules/storefront/types'
import { Badge, Button, Card, EmptyState, PageHeader, Spinner } from '@/shared/components'
import { applyStoreTheme, clearStoreTheme } from '@/shared/lib/theme'
import { formatCurrency } from '@/shared/lib/utils'

export function StoreDetailPage() {
  const { storeId = '' } = useParams()
  const addItem = useCartStore((s) => s.addItem)
  const itemCount = useCartStore((s) => s.itemCount())
  const [store, setStore] = useState<Store | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    void catalogService
      .getStore(storeId)
      .then((data) => {
        if (!cancelled) setStore(data)
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load store'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [storeId])

  useEffect(() => {
    const root = wrapperRef.current
    if (!store || !root) return
    applyStoreTheme(store.theme, root)
    // Without this a vendor's canvas could outlive its page — very visible now that
    // the theme paints a full-viewport background.
    return () => clearStoreTheme(root)
  }, [store])

  // One themed wrapper hosts every state, so loading/error don't flash the default
  // Mithra canvas before a themed store paints.
  return (
    <div ref={wrapperRef}>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ background: 'var(--store-bg)' }}
      />
      {loading ? (
        <div className="mx-auto max-w-3xl px-4 py-10">
          <Spinner label="Loading products…" />
        </div>
      ) : error || !store ? (
        <div className="mx-auto max-w-3xl px-4 py-10">
          <EmptyState
            title="Store not found"
            description={error || 'This store may be offline.'}
            action={
              <Link to="/stores">
                <Button variant="secondary">Back to stores</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <StoreDetail store={store} addItem={addItem} itemCount={itemCount} />
      )}
    </div>
  )
}

type StoreDetailProps = {
  store: Store
  addItem: (storeId: string, storeName: string, item: Store['products'][number]) => void
  itemCount: number
}

function StoreDetail({ store, addItem, itemCount }: StoreDetailProps) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div
        className="mb-6 overflow-hidden rounded-[var(--md-radius)] p-6 text-white shadow-[var(--md-shadow)]"
        style={{ background: store.image }}
      >
        <div className="flex items-center gap-3">
          {store.theme?.logoImage ? (
            <img
              src={store.theme.logoImage}
              alt=""
              className="h-12 w-12 shrink-0 rounded-full border border-white/40 object-cover"
            />
          ) : null}
          <div>
            <p className="text-sm text-white/85">{store.category}</p>
            <h1 className="font-display mt-1 text-3xl font-bold">{store.name}</h1>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Badge tone="success">★ {store.rating}</Badge>
          <span>{store.etaMins} mins</span>
          <span>{store.distanceKm} km</span>
        </div>
      </div>

      <PageHeader
        title="Products"
        subtitle="Add items to your cart"
        actions={
          itemCount > 0 ? (
            <Link to="/cart">
              <Button>View cart ({itemCount})</Button>
            </Link>
          ) : null
        }
      />

      <div className="space-y-3">
        {store.products.map((item) => (
          <Card key={item.id} className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                {/* Green/red veg marks are a regulatory label under India's FSS
                    (Packaging and Labelling) Regulations — the colours carry legal
                    meaning. Intentionally excluded from vendor theming; do not
                    convert these to theme tokens. */}
                <span
                  className={`inline-block h-3 w-3 rounded-sm border ${
                    item.veg ? 'border-green-600' : 'border-red-600'
                  }`}
                  aria-hidden
                >
                  <span
                    className={`m-[2px] block h-1.5 w-1.5 rounded-full ${
                      item.veg ? 'bg-green-600' : 'bg-red-600'
                    }`}
                  />
                </span>
                <h2 className="font-semibold">{item.name}</h2>
                {item.popular ? <Badge tone="warning">Popular</Badge> : null}
              </div>
              <p className="text-muted-foreground text-sm">{item.description}</p>
              <p className="mt-2 font-semibold">{formatCurrency(item.price)}</p>
            </div>
            <Button size="sm" onClick={() => addItem(store.id, store.name, item)}>
              Add
            </Button>
          </Card>
        ))}
      </div>
    </div>
  )
}
