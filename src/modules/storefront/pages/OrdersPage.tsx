import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ordersService, type CustomerOrder } from '@/shared/api'
import { getErrorMessage } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Button, Card, EmptyState, PageHeader, Spinner } from '@/shared/components'
import { formatCurrency } from '@/shared/lib/utils'

export function OrdersPage() {
  const user = useAuthStore((s) => s.user)
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void ordersService
      .listMyOrders(user?.id)
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
  }, [user?.id])

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Spinner label="Loading orders…" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState title="Could not load orders" description={error} />
      </div>
    )
  }

  if (!orders.length) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState
          title="No orders yet"
          description="Your past orders will show up here."
          action={
            <Link to="/stores">
              <Button>Browse stores</Button>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader title="Your orders" subtitle="Track recent deliveries" />
      <div className="space-y-3">
        {orders.map((order) => (
          <Card key={order.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{order.storeName}</p>
                <p className="text-sm text-[var(--md-muted)]">
                  {order.id} · {new Date(order.placedAt).toLocaleString()}
                </p>
              </div>
              <p className="font-semibold capitalize text-[var(--md-green-700)]">
                {order.status.replaceAll('_', ' ')}
              </p>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {order.items.map((item) => `${item.qty}× ${item.name}`).join(' · ')}
            </p>
            <p className="mt-2 font-semibold">{formatCurrency(order.total)}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}
