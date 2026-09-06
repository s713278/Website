import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CustomerContact } from '@/modules/vendor/components/CustomerContact'
import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import {
  canCancel,
  forwardActionLabel,
  nextDeliveryStatus,
  presentDeliveryStatus,
  presentPaymentStatus,
} from '@/modules/vendor/lib/order-actions'
import type { VendorOrderDetail } from '@/modules/vendor/types/dashboard'
import { getErrorMessage, vendorOrdersService } from '@/shared/api'
import { Badge, Button, Card, EmptyState, Input, PageHeader, Spinner } from '@/shared/components'
import { formatCurrency } from '@/shared/lib/utils'

/**
 * One order, with its lines.
 *
 * A route rather than an inline expand on the list: line items come from a second
 * endpoint (`/orders/{id}/items`), so expanding rows in place would cost one request per
 * expand. This way a vendor pays for detail only when they ask for it, and the URL is
 * shareable.
 */
export function VendorOrderDetailPage() {
  const { orderId = '' } = useParams()
  const { vendorId } = useVendorAccount()
  const [order, setOrder] = useState<VendorOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    void vendorOrdersService
      .get(vendorId, orderId)
      .then((data) => {
        if (!cancelled) setOrder(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load this order'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [vendorId, orderId, reloadToken])

  async function run(action: () => Promise<void>, fallback: string) {
    setBusy(true)
    setError('')
    try {
      await action()
      reload()
    } catch (err) {
      setError(getErrorMessage(err, fallback))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner label="Loading order…" />

  if (!order) {
    return (
      <EmptyState
        title="Order not found"
        description={error || 'This order is no longer available.'}
        action={
          <Link to="/vendor/orders">
            <Button size="sm" variant="secondary">
              Back to orders
            </Button>
          </Link>
        }
      />
    )
  }

  const delivery = presentDeliveryStatus(order.deliveryStatus)
  const next = nextDeliveryStatus(order.deliveryStatus)

  return (
    <div>
      <PageHeader
        title={`Order #${order.id}`}
        subtitle={order.customerName ?? 'Customer'}
        actions={
          <Link to="/vendor/orders">
            <Button size="sm" variant="secondary">
              Back to orders
            </Button>
          </Link>
        }
      />

      {error ? <p className="mb-4 text-sm text-[var(--md-danger)]">{error}</p> : null}

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={delivery.tone}>{delivery.label}</Badge>
          {order.paymentStatus ? (
            <Badge tone={presentPaymentStatus(order.paymentStatus).tone}>
              {presentPaymentStatus(order.paymentStatus).label}
            </Badge>
          ) : null}
        </div>

        {/*
          This read carries a real `customer_name`, unlike a list row — so the detail screen
          shows a person, with the number as an action beside it rather than in its place.
        */}
        <CustomerContact
          name={order.customerName}
          mobile={order.customerMobile}
          className="mt-4"
        />

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          {order.deliveryDate ? (
            <div>
              <dt className="text-[var(--md-muted)]">Delivery date</dt>
              <dd className="font-medium">{order.deliveryDate}</dd>
            </div>
          ) : null}
          {order.deliveryAddress ? (
            <div className="sm:col-span-2">
              <dt className="text-[var(--md-muted)]">Delivering to</dt>
              <dd className="font-medium">{order.deliveryAddress}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          {order.paymentStatus === 'DUE' ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void run(
                  () => vendorOrdersService.update(vendorId, order.id, { paymentStatus: 'PAID' }),
                  'Could not update the payment',
                )
              }
            >
              Mark paid
            </Button>
          ) : null}
          {next ? (
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    vendorOrdersService.update(vendorId, order.id, { deliveryStatus: next }),
                  'Could not update the order',
                )
              }
            >
              {forwardActionLabel(next)}
            </Button>
          ) : null}
          {canCancel(order.deliveryStatus) && !cancelling ? (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setCancelling(true)}>
              Cancel order
            </Button>
          ) : null}
        </div>

        {cancelling ? (
          <div className="mt-4 rounded-lg border border-[var(--md-border)] p-3">
            <p className="text-sm font-medium">Cancel this order?</p>
            <p className="mt-1 text-sm text-[var(--md-muted)]">
              The customer is told the order was cancelled. This cannot be undone.
            </p>
            <div className="mt-3">
              <Input
                label="Reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Out of stock"
              />
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setCancelling(false)
                  setReason('')
                }}
              >
                Keep order
              </Button>
              <Button
                size="sm"
                disabled={busy || !reason.trim()}
                onClick={() =>
                  void run(async () => {
                    await vendorOrdersService.cancel(vendorId, order.id, reason.trim())
                    setCancelling(false)
                    setReason('')
                  }, 'Could not cancel the order')
                }
              >
                Cancel order
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <Card>
        <h2 className="font-display mb-3 font-semibold">Items</h2>
        {!order.lines.length ? (
          <p className="text-sm text-[var(--md-muted)]">No items on this order.</p>
        ) : (
          <ul className="divide-y divide-[var(--md-border)]">
            {order.lines.map((line) => (
              <li key={line.id} className="flex items-center justify-between gap-4 py-2">
                <div>
                  <p className="text-sm font-medium">{line.name}</p>
                  <p className="text-xs text-[var(--md-muted)]">
                    {line.size ? `${line.size} · ` : ''}
                    {line.quantity} ×
                  </p>
                </div>
                {line.amount != null ? (
                  <p className="text-sm font-semibold">{formatCurrency(line.amount)}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {order.total != null ? (
          <div className="mt-3 flex items-center justify-between border-t border-[var(--md-border)] pt-3">
            <span className="text-sm font-medium">Total</span>
            <span className="font-display font-bold">{formatCurrency(order.total)}</span>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
