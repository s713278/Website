import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { CustomerContact } from '@/modules/vendor/components/CustomerContact'
import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import {
  canCancel,
  forwardActionLabel,
  forwardRefusalMessage,
  nextVendorDeliveryStatus,
  presentDeliveryStatus,
  presentPaymentStatus,
} from '@/modules/vendor/lib/order-actions'
import { chargeLines, chargesReconcile } from '@/modules/vendor/lib/order-charges'
import type { DeliveryStatus, VendorOrderDetail } from '@/modules/vendor/types/dashboard'
import { getErrorMessage, isOrderAdvancePartial, isOrderTransitionRefused, vendorOrdersService } from '@/shared/api'
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
   * One visible step along the delivery chain, including both wire hops for legacy New.
   *
   * Separate from `run` because a refusal is not an error message to pass through: it
   * arrives as HTTP 200, and every refusal carries the same generic reason, so the vendor
   * is told what did not happen rather than handed a sentence about an input they never
   * typed.
   */
  async function advance(next: DeliveryStatus) {
    if (!order) return
    setBusy(true)
    setActionError('')
    try {
      await vendorOrdersService.advance(vendorId, orderId, order.deliveryStatus, next)
      reload()
    } catch (err) {
      setActionError(
        isOrderAdvancePartial(err) || isOrderTransitionRefused(err)
          ? forwardRefusalMessage(next, isOrderAdvancePartial(err))
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

  /*
   * Above the title, not opposite it. As a `PageHeader` action the link is pushed to the far
   * edge of the console, a screen's width from the order it returns from; a vendor reads it
   * as unrelated chrome. Where you came from belongs before where you are.
   */
  const backLink = (
    <Link
      to={backTo}
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--md-muted)] transition hover:text-[var(--md-ink)]"
    >
      <ChevronLeft className="size-4" aria-hidden />
      Back to orders
    </Link>
  )

  /* The not-found screen has no header to sit under, so there the link is the action. */
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
        {backLink}
        <PageHeader title="Order" />
        <Card className="max-w-[68ch] border-[var(--md-danger)] p-5">
          <p className="text-sm text-[var(--md-danger)]">{loadError}</p>
          <p className="mt-1 text-sm text-[var(--md-muted)]">
            This order could not be loaded. That is not the same as it not existing.
          </p>
          <Button size="sm" variant="secondary" className="mt-4" onClick={reload}>
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
  const next = nextVendorDeliveryStatus(order.deliveryStatus)
  const lines = chargeLines(order.charges)
  const reconciles = chargesReconcile(order.charges, order.total)

  return (
    <div>
      {backLink}
      <PageHeader title={`Order #${order.id}`} subtitle={order.customerName ?? 'Customer'} />

      {actionError ? (
        <p className="mb-6 max-w-[68ch] text-sm text-[var(--md-danger)]">{actionError}</p>
      ) : null}

      {/*
        The order on the left, the bill on the right. They are two different questions — what
        do I do with this, and what does it come to — and stacking them put the second one
        below the fold on every order with more than a couple of lines.
      */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <Card className="p-5">
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

          <dl className="mt-5 grid gap-4 border-t border-[var(--vc-rule)] pt-4 text-sm sm:grid-cols-2">
            {order.deliveryDate ? (
              <div>
                <dt className="text-[var(--md-muted)]">Delivery date</dt>
                <dd className="vc-num mt-0.5 font-medium">{order.deliveryDate}</dd>
              </div>
            ) : null}
            {order.deliveryAddress ? (
              <div className="sm:col-span-2">
                <dt className="text-[var(--md-muted)]">Delivering to</dt>
                <dd className="mt-0.5 font-medium">{order.deliveryAddress}</dd>
              </div>
            ) : null}
          </dl>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--vc-rule)] pt-5">
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

          {cancelling ? (
            <div className="mt-5 rounded-lg border border-[var(--vc-edge)] bg-slate-50/60 p-4">
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

        {/*
          The bill. Every figure on it — line amounts, charges and the total — is right-aligned
          on one edge in tabular figures, so the column reads down as a column and a vendor can
          check the arithmetic the way they would on paper.
        */}
        <Card className="p-0">
          <h2 className="font-display border-b border-[var(--vc-rule)] px-5 py-3.5 font-semibold">
            Items
          </h2>
          {!order.lines.length ? (
            <p className="px-5 py-4 text-sm text-[var(--md-muted)]">No items on this order.</p>
          ) : (
            <ul className="vc-rows">
              {order.lines.map((line) => (
                <li key={line.id} className="flex items-baseline justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{line.name}</p>
                    {/*
                      Quantity and unit price are both read from the response; neither is
                      derived from the line total, so a line whose numbers disagree shows the
                      disagreement rather than a tidied version of it.
                    */}
                    <p className="vc-num mt-0.5 text-xs text-[var(--md-muted)]">
                      {line.size ? `${line.size} · ` : ''}
                      {line.quantity} ×
                      {line.unitPrice != null ? ` ${formatCurrency(line.unitPrice)}` : ''}
                    </p>
                  </div>
                  {line.amount != null ? (
                    <p className="vc-num shrink-0 text-sm font-semibold">
                      {formatCurrency(line.amount)}
                    </p>
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
            <dl className="space-y-1.5 border-t border-[var(--vc-rule)] px-5 py-4 text-sm">
              {lines.map((line) => (
                <div key={line.key} className="flex items-baseline justify-between gap-4">
                  <dt className="text-[var(--md-muted)]">{line.label}</dt>
                  <dd className="vc-num">{formatCurrency(line.amount)}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {/*
            The total sits on the panel's own edge weight rather than a row rule: it closes the
            bill, and closing it with the same line that separates two items would let the eye
            run straight past.
          */}
          {order.total != null ? (
            <div className="flex items-baseline justify-between gap-4 border-t border-[var(--vc-edge)] px-5 py-4">
              <span className="text-sm font-medium">Total</span>
              <span className="font-display vc-num text-lg font-bold">
                {formatCurrency(order.total)}
              </span>
            </div>
          ) : (
            <p className="border-t border-[var(--vc-edge)] px-5 py-4 text-sm text-slate-500">
              Amount not available
            </p>
          )}

          {reconciles === false ? (
            <p className="border-t border-[var(--vc-rule)] px-5 py-3 text-sm text-[var(--md-muted)]">
              These charges do not add up to the total. They are shown exactly as the store recorded
              them; nothing has been added to close the difference.
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  )
}
