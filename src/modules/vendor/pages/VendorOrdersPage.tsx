import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import {
  forwardActionLabel,
  nextDeliveryStatus,
  presentDeliveryStatus,
  presentPaymentStatus,
} from '@/modules/vendor/lib/order-actions'
import type { DeliveryStatus, VendorOrderPage } from '@/modules/vendor/types/dashboard'
import { getErrorMessage, vendorOrdersService } from '@/shared/api'
import { Badge, Button, Card, EmptyState, PageHeader, Spinner } from '@/shared/components'
import { cn, formatCurrency } from '@/shared/lib/utils'

const FILTERS: Array<{ label: string; value: DeliveryStatus | null }> = [
  { label: 'All', value: null },
  { label: 'New', value: 'PENDING' },
  { label: 'Being prepared', value: 'IN_PROCESS' },
  { label: 'On the way', value: 'SHIPPED' },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Cancelled', value: 'CANCELLED' },
]

export function VendorOrdersPage() {
  const { vendorId } = useVendorAccount()
  const [filter, setFilter] = useState<DeliveryStatus | null>(null)
  const [page, setPage] = useState(0)
  const [result, setResult] = useState<VendorOrderPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    // Filtering and paging happen on the server: one request per view, rather than
    // fetching everything and narrowing it here.
    void vendorOrdersService
      .list(vendorId, { page, status: filter })
      .then((data) => {
        if (!cancelled) setResult(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load orders'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [vendorId, page, filter, reloadToken])

  async function advance(orderId: string, next: DeliveryStatus) {
    setBusyId(orderId)
    setError('')
    try {
      await vendorOrdersService.update(vendorId, orderId, { deliveryStatus: next })
      reload()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update the order'))
    } finally {
      setBusyId(null)
    }
  }

  async function markPaid(orderId: string) {
    setBusyId(orderId)
    setError('')
    try {
      await vendorOrdersService.update(vendorId, orderId, { paymentStatus: 'PAID' })
      reload()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update the payment'))
    } finally {
      setBusyId(null)
    }
  }

  const orders = result?.orders ?? []

  return (
    <div>
      <PageHeader title="Orders" subtitle="Everything customers have ordered from you" />

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map(({ label, value }) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              setFilter(value)
              setPage(0)
            }}
            className={cn(
              'rounded-full border px-3 py-1 text-sm transition',
              filter === value
                ? 'border-[var(--md-green-600)] bg-[var(--md-green-50)] text-[var(--md-green-800)]'
                : 'border-[var(--md-border)] text-slate-600 hover:bg-slate-100',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <p className="mb-4 text-sm text-[var(--md-danger)]">{error}</p> : null}
      {loading ? <Spinner label="Loading orders…" /> : null}

      {!loading && !orders.length ? (
        <EmptyState
          title="No orders here"
          description={
            filter
              ? 'Nothing matches this filter yet.'
              : 'When a customer orders from your store, it will show up here.'
          }
        />
      ) : null}

      {!loading && orders.length ? (
        <div className="space-y-3">
          {orders.map((order) => {
            const delivery = presentDeliveryStatus(order.deliveryStatus)
            const next = nextDeliveryStatus(order.deliveryStatus)
            const busy = busyId === order.id

            return (
              <Card key={order.id} className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Link
                      to={`/vendor/orders/${order.id}`}
                      className="font-semibold hover:underline"
                    >
                      Order #{order.id}
                    </Link>
                    <Badge tone={delivery.tone}>{delivery.label}</Badge>
                    {/*
                      Payment is its own axis: an order can be delivered and still unpaid,
                      which the previous single-status list could not show at all.
                    */}
                    {order.paymentStatus ? (
                      <Badge tone={presentPaymentStatus(order.paymentStatus).tone}>
                        {presentPaymentStatus(order.paymentStatus).label}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-[var(--md-muted)]">
                    {order.customerName ?? 'Customer'}
                    {order.deliveryDate ? ` · for ${order.deliveryDate}` : ''}
                  </p>
                  {order.total != null ? (
                    <p className="mt-2 font-semibold">{formatCurrency(order.total)}</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {order.paymentStatus === 'DUE' ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void markPaid(order.id)}
                    >
                      Mark paid
                    </Button>
                  ) : null}
                  {next ? (
                    <Button size="sm" disabled={busy} onClick={() => void advance(order.id, next)}>
                      {forwardActionLabel(next)}
                    </Button>
                  ) : null}
                </div>
              </Card>
            )
          })}
        </div>
      ) : null}

      {result && result.totalPages > 1 ? (
        <div className="mt-6 flex items-center justify-between">
          <Button
            size="sm"
            variant="secondary"
            disabled={page === 0 || loading}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
          >
            Previous
          </Button>
          <span className="text-sm text-[var(--md-muted)]">
            Page {result.page + 1} of {result.totalPages}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={result.lastPage || loading}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  )
}
