import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { vendorService, type VendorDashboardStats } from '@/shared/api'
import { getErrorMessage } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Badge, Button, Card, EmptyState, PageHeader, Spinner } from '@/shared/components'
import { applyStoreTheme } from '@/shared/lib/theme'
import { formatCurrency } from '@/shared/lib/utils'

export function VendorDashboardPage() {
  const vendorId = useAuthStore((s) => s.user?.vendorId || 'r1')
  const [stats, setStats] = useState<VendorDashboardStats | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void vendorService
      .getDashboard(vendorId)
      .then((data) => {
        if (!cancelled) setStats(data)
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load dashboard'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [vendorId])

  useEffect(() => {
    if (stats && wrapperRef.current) applyStoreTheme(stats.theme, wrapperRef.current)
  }, [stats])

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Spinner label="Loading dashboard…" />
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <EmptyState title="Dashboard unavailable" description={error} />
      </div>
    )
  }

  return (
    <div ref={wrapperRef} className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader
        title="Vendor dashboard"
        subtitle={stats.storeName}
        actions={
          <Link to="/vendor/orders">
            <Button>Manage orders</Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-[var(--md-muted)]">Open orders</p>
          <p className="font-display mt-2 text-3xl font-bold">{stats.openOrders}</p>
        </Card>
        <Card>
          <p className="text-sm text-[var(--md-muted)]">Menu items live</p>
          <p className="font-display mt-2 text-3xl font-bold">{stats.availableItems}</p>
        </Card>
        <Card>
          <p className="text-sm text-[var(--md-muted)]">Today’s sales</p>
          <p className="font-display mt-2 text-3xl font-bold">
            {formatCurrency(stats.todayRevenue)}
          </p>
        </Card>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="font-display mb-3 font-semibold">Quick links</h2>
          <div className="flex flex-wrap gap-2">
            <Link to="/vendor/orders">
              <Button variant="secondary" size="sm">
                Orders
              </Button>
            </Link>
            <Link to="/vendor/products">
              <Button variant="secondary" size="sm">
                Products
              </Button>
            </Link>
          </div>
        </Card>
        <Card>
          <h2 className="font-display mb-3 font-semibold">Store status</h2>
          <Badge tone={stats.online ? 'success' : 'warning'}>
            {stats.online ? 'Online · accepting orders' : 'Offline'}
          </Badge>
          <p className="mt-3 text-sm text-[var(--md-muted)]">
            Keep ETA under 35 minutes during lunch rush for better ranking.
          </p>
        </Card>
      </div>
    </div>
  )
}
