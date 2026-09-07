import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { CustomerContact } from '@/modules/vendor/components/CustomerContact'
import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import {
  canCancel,
  forwardActionLabel,
  forwardRefusalMessage,
  nextDeliveryStatus,
  presentDeliveryStatus,
  presentPaymentStatus,
} from '@/modules/vendor/lib/order-actions'
import { chargeLines, chargesReconcile } from '@/modules/vendor/lib/order-charges'
import type { DeliveryStatus, VendorOrderDetail } from '@/modules/vendor/types/dashboard'
import { getErrorMessage, isOrderTransitionRefused, vendorOrdersService } from '@/shared/api'
import { Badge, Button, Card, EmptyState, Input, PageHeader, Spinner } from '@/shared/components'
import { formatCurrency } from '@/shared/lib/utils'

/**
 * One order, with its lines.
 *
 * A route rather than an inline expand on the list: line items come from a second
 * endpoint (`/orders/{id}/items`), so expanding rows in place would cost one request per
 * expand. This way a vendor pays for detail only when they ask for it, and the URL is
 * shareable.
 *
 * Three failures are told apart deliberately — still loading, the request failed, and there
 * is no such order. They need different words and only one of them is worth a retry; the
 * previous version collapsed all three into "Order not found".
 */
export function VendorOrderDetailPage() {
  const { orderId = '' } = useParams()
  const { state } = useLocation()
  const { vendorId } = useVendorAccount()
  const [order, setOrder] = useState<VendorOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  // The Orders list hands its filters over in history state, so this screen's own back
  // button returns to the view the vendor left rather than to an unfiltered list.
  const backTo =
    typeof (state as { from?: unknown } | null)?.from === 'string'
      ? (state as { from: string }).from
      : '/vendor/orders'

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')

    void vendorOrdersService
      .get(vendorId, orderId)
      .then((data) => {
        if (!cancelled) setOrder(data)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        // `get` answers a missing order with `null`, so anything thrown here is a failure
        // of the request itself — which is the one of the two that retrying can fix.
        setOrder(null)
        setLoadError(getErrorMessage(err, 'Could not load this order'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [vendorId, orderId, reloadToken])

  /**
   * One step along the delivery chain.
   *
   * Separate from `run` because a refusal is not an error message to pass through: it
   * arrives as HTTP 200, and every refusal carries the same generic reason, so the vendor
   * is told what did not happen rather than handed a sentence about an input they never
   * typed.
   */
  async function advance(next: DeliveryStatus) {
    setBusy(true)
    setActionError('')
    try {
      await vendorOrdersService.advance(vendorId, orderId, next)
      reload()
    } catch (err) {
      setActionError(
        isOrderTransitionRefused(err)
          ? forwardRefusalMessage(next)
          : getErrorMessage(err, 'Could not update the order'),
      )
    } finally {
      setBusy(false)
    }
  }

  async function run(action: () => Promise<void>, fallback: string) {
    setBusy(true)
    setActionError('')
    try {
      await action()
      reload()
    } catch (err) {
      // Nothing entered is cleared here: a cancellation reason typed into a failed attempt
      // is still the reason, and retyping it is a punishment for the backend's failure.
      setActionError(getErrorMessage(err, fallback))
    } finally {
      setBusy(false)
    }
  }

  const backButton = (
    <Link to={backTo}>
      <Button size="sm" variant="secondary">
        Back to orders
      </Button>
    </Link>
  )

  if (loading) return <Spinner label="Loading order…" />

  if (loadError) {
    return (
      <div>
        <PageHeader title="Order" actions={backButton} />
        <Card className="border-[var(--md-danger)]">
          <p className="text-sm text-[var(--md-danger)]">{loadError}</p>
          <p className="mt-1 text-sm text-[var(--md-muted)]">
            This order could not be loaded. That is not the same as it not existing.
          </p>
          <Button size="sm" variant="secondary" className="mt-3" onClick={reload}>
            Try again
          </Button>
        </Card>
      </div>
    )
  }

  if (!order) {
    return (
      <EmptyState
        title="Order not found"
        description="There is no order with this number on your store."
        action={backButton}
      />
    )
  }

  const delivery = presentDeliveryStatus(order.deliveryStatus)
  const next = nextDeliveryStatus(order.deliveryStatus)
  const lines = chargeLines(order.charges)
  const reconciles = chargesReconcile(order.charges, order.total)

  return (
    <div>
      <PageHeader
        title={`Order #${order.id}`}
        subtitle={order.customerName ?? 'Customer'}
        actions={backButton}
      />

      {actionError ? <p className="mb-4 text-sm text-[var(--md-danger)]">{actionError}</p> : null}

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
          {/*
            Anything not already paid, including an order whose `payment_status` the backend
            omitted — keying on `DUE` would hide the control on the rows where the missing
            capability is hardest to notice.
          */}
          {order.paymentStatus !== 'PAID' ? (
            <Button size="sm" variant="secondary" disabled>
              Mark paid
            </Button>
          ) : null}
          {next ? (
            <Button size="sm" disabled={busy} onClick={() => void advance(next)}>
              {busy ? 'Working…' : forwardActionLabel(next)}
            </Button>
          ) : null}
          {canCancel(order.deliveryStatus) && !cancelling ? (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setCancelling(true)}>
              Cancel order
            </Button>
          ) : null}
        </div>

        {/*
          Kept on screen rather than removed. No route in the contract can set
          `payment_status`, and a control that quietly disappears takes the missing
          capability with it — this is one of the gaps the backend conversation is about.
        */}
        {order.paymentStatus !== 'PAID' ? (
          <p className="mt-3 text-sm text-[var(--md-muted)]">
            Marking an order paid is not possible yet: nothing in the backend records a
            payment. The button stays visible so the gap is not hidden.
          </p>
        ) : null}

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
                    // Its own endpoint, never the bulk one: `CANCELLED` is in that enum but
                    // 417s through it.
                    await vendorOrdersService.cancel(vendorId, order.id, reason.trim())
                    setCancelling(false)
                    setReason('')
                  }, 'Could not cancel the order')
                }
              >
                {busy ? 'Cancelling…' : 'Cancel order'}
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
                  {/*
                    Quantity and unit price are both read from the response; neither is
                    derived from the line total, so a line whose numbers disagree shows the
                    disagreement rather than a tidied version of it.
                  */}
                  <p className="text-xs text-[var(--md-muted)]">
                    {line.size ? `${line.size} · ` : ''}
                    {line.quantity} ×{line.unitPrice != null ? ` ${formatCurrency(line.unitPrice)}` : ''}
                  </p>
                </div>
                {line.amount != null ? (
                  <p className="text-sm font-semibold">{formatCurrency(line.amount)}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {/*
          Only the charges the response carried. Nothing here is derived from the total to
          make the column add up — a charge invented to close a gap is a charge the vendor
          would be asked to explain, and no system anywhere holds it.
        */}
        {lines.length ? (
          <dl className="mt-3 space-y-1 border-t border-[var(--md-border)] pt-3 text-sm">
            {lines.map((line) => (
              <div key={line.key} className="flex items-center justify-between">
                <dt className="text-[var(--md-muted)]">{line.label}</dt>
                <dd>{formatCurrency(line.amount)}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {order.total != null ? (
          <div className="mt-3 flex items-center justify-between border-t border-[var(--md-border)] pt-3">
            <span className="text-sm font-medium">Total</span>
            <span className="font-display font-bold">{formatCurrency(order.total)}</span>
          </div>
        ) : (
          <p className="mt-3 border-t border-[var(--md-border)] pt-3 text-sm text-slate-500">
            Amount not available
          </p>
        )}

        {reconciles === false ? (
          <p className="mt-2 text-sm text-[var(--md-muted)]">
            These charges do not add up to the total. They are shown exactly as the store
            recorded them; nothing has been added to close the difference.
          </p>
        ) : null}
      </Card>
    </div>
  )
}
