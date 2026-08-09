import { useEffect, useState } from 'react'
import { vendorProductsService } from '@/shared/api'
import type { VendorProduct } from '@/modules/vendor/types'
import { getErrorMessage } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Badge, Button, Card, EmptyState, PageHeader, Spinner } from '@/shared/components'
import { formatCurrency } from '@/shared/lib/utils'

export function VendorProductsPage() {
  const vendorId = useAuthStore((s) => s.user?.vendorId || 'r1')
  const [products, setProducts] = useState<VendorProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void vendorProductsService
      .list(vendorId)
      .then((data) => {
        if (!cancelled) setProducts(data)
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load products'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [vendorId])

  async function toggle(product: VendorProduct) {
    setBusyId(product.id)
    setError('')
    try {
      const updated = await vendorProductsService.setAvailability(
        vendorId,
        product.id,
        !product.available,
      )
      if (updated) {
        setProducts((prev) =>
          prev.map((row) => (row.id === product.id ? { ...row, available: updated.available } : row)),
        )
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update product'))
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Spinner label="Loading products…" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <PageHeader title="Products" subtitle="Toggle availability for your menu" />
      {error ? <p className="mb-4 text-sm text-[var(--md-danger)]">{error}</p> : null}
      {!products.length ? (
        <EmptyState title="No products" description="Add menu items from your vendor admin." />
      ) : (
        <div className="space-y-3">
          {products.map((product) => (
            <Card key={product.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{product.name}</h2>
                  <Badge tone={product.available ? 'success' : 'neutral'}>
                    {product.available ? 'Available' : 'Hidden'}
                  </Badge>
                  <Badge tone={product.veg ? 'success' : 'danger'}>
                    {product.veg ? 'Veg' : 'Non-veg'}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-[var(--md-muted)]">
                  {formatCurrency(product.price)}
                </p>
              </div>
              <Button
                size="sm"
                variant={product.available ? 'secondary' : 'primary'}
                disabled={busyId === product.id}
                onClick={() => void toggle(product)}
              >
                {product.available ? 'Mark unavailable' : 'Mark available'}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
