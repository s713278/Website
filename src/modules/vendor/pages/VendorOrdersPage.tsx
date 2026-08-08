import { useEffect, useState } from 'react'
import { vendorOrdersService } from '@/shared/api'
import type { VendorOrder, VendorOrderStatus } from '@/modules/vendor/types'
import { getErrorMessage } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Badge, Button, Card, EmptyState, PageHeader, Spinner } from '@/shared/components'
import { formatCurrency } from '@/shared/lib/utils'

const NEXT: Partial<Record<VendorOrderStatus, VendorOrderStatus>> = {
  new: 'accepted',
  accepted: 'preparing',
  preparing: 'ready',
  ready: 'completed',
}

const TONE: Record<VendorOrderStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  new: 'danger',
  accepted: 'warning',
  preparing: 'warning',
  ready: 'success',
  completed: 'neutral',
}

export function VendorOrdersPage() {
  const vendorId = useAuthStore((s) => s.user?.vendorId || 'r1')
  const [orders, setOrders] = useState<VendorOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void vendorOrdersService
      .list(vendorId)
      .then((data) => {
        if (!cancelled) setOrders(data)
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load orders'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [vendorId])

  async function advance(order: VendorOrder) {
    const next = NEXT[order.status]
    if (!next) return
    setBusyId(order.id)
    setError('')
    try {
      const updated = await vendorOrdersService.updateStatus(vendorId, order.id, next)
      if (updated) {
        setOrders((prev) => prev.map((row) => (row.id === order.id ? { ...row, status: next } : row)))
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update order'))
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Spinner label="Loading orders…" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <PageHeader title="Orders" subtitle="Accept and progress kitchen tickets" />
      {error ? <p className="mb-4 text-sm text-[var(--md-danger)]">{error}</p> : null}
      {!orders.length ? (
        <EmptyState title="No orders" description="New tickets will show up here." />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Card key={order.id} className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{order.id}</h2>
                  <Badge tone={TONE[order.status] || 'neutral'}>{order.status}</Badge>
                </div>
                <p className="text-sm text-[var(--md-muted)]">
                  {order.customerName} · {new Date(order.placedAt).toLocaleTimeString()}
                </p>
                <p className="mt-2 text-sm">
                  {order.items.map((item) => `${item.qty}× ${item.name}`).join(' · ')}
                </p>
                <p className="mt-2 font-semibold">{formatCurrency(order.total)}</p>
              </div>
              {NEXT[order.status] ? (
                <Button
                  size="sm"
                  disabled={busyId === order.id}
                  onClick={() => void advance(order)}
                >
                  Mark {NEXT[order.status]}
                </Button>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
