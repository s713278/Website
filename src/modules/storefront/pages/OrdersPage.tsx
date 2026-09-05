import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Package, ShieldCheck, ShoppingBag } from 'lucide-react'
import { OrderCard } from '@/modules/storefront/components/OrderCard'
import { isPastOrder } from '@/modules/storefront/lib/order-display'
import { ordersService, getErrorMessage } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Button, EmptyState, Spinner } from '@/shared/components'
import { cn } from '@/lib/utils'

type OrdersTab = 'all' | 'past'

export function OrdersPage() {
  const user = useAuthStore((s) => s.user)
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof ordersService.listMyOrders>>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<OrdersTab>('all')

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

  const visible = useMemo(
    () => orders.filter((order) => (tab === 'past' ? isPastOrder(order.status) : true)),
    [orders, tab],
  )

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Spinner label="Loading orders…" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState title="Could not load orders" description={error} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <header className="mb-6">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--md-green-50,#ecfdf5)] text-[var(--md-green-700,#047857)]">
            <ShoppingBag className="size-5" strokeWidth={2} aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Your orders</h1>
            <p className="mt-1 text-sm text-slate-500">Track and manage your recent deliveries</p>
          </div>
        </div>

        <nav className="mt-5 flex gap-6 border-b border-slate-200" aria-label="Order filters">
          <TabButton active={tab === 'all'} onClick={() => setTab('all')} icon={Package} label="All Orders" />
          <TabButton active={tab === 'past'} onClick={() => setTab('past')} icon={ShoppingBag} label="Past Orders" />
        </nav>
      </header>

      {orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Your orders will show up here after checkout."
          action={
            <Link to="/stores/r1">
              <Button>Browse store</Button>
            </Link>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title={tab === 'past' ? 'No past orders' : 'No active orders'}
          description={
            tab === 'past'
              ? 'Delivered orders will appear here.'
              : 'Place an order to see it here.'
          }
        />
      ) : (
        <div className="space-y-4">
          {visible.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}

      {orders.length > 0 ? (
        <div className="mt-8 flex items-center gap-4 rounded-2xl bg-[var(--md-green-50,#ecfdf5)] px-5 py-4 ring-1 ring-[var(--md-green-100,#d1fae5)]">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-[var(--md-green-700,#047857)] shadow-sm">
            <ShieldCheck className="size-5" strokeWidth={2} aria-hidden />
          </span>
          <div>
            <p className="font-semibold text-slate-900">Safe. Secure. Reliable.</p>
            <p className="text-sm text-slate-600">Your orders are protected and delivered with care.</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: typeof Package
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        '-mb-px inline-flex items-center gap-2 border-b-2 pb-3 text-sm font-semibold transition',
        active
          ? 'border-[var(--md-green-700,#047857)] text-[var(--md-green-700,#047857)]'
          : 'border-transparent text-slate-500 hover:text-slate-700',
      )}
    >
      <Icon className="size-4" strokeWidth={2} aria-hidden />
      {label}
    </button>
  )
}
