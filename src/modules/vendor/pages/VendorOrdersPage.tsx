import { useEffect, useMemo, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { DashboardPanel } from '@/modules/vendor/components/DashboardPanel'
import { OrderFilterBar } from '@/modules/vendor/components/OrderFilterBar'
import { OrderLedger } from '@/modules/vendor/components/OrderLedger'
import { OrdersSectionTabs } from '@/modules/vendor/components/OrdersSectionTabs'
import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import {
  canRecordPayment,
  forwardActionLabel,
  forwardRefusalMessage,
  nextVendorDeliveryStatus,
} from '@/modules/vendor/lib/order-actions'
import {
  hasDeliveryRange,
  rangeError,
  readOrdersQuery,
  subtotalHeading,
  writeOrdersQuery,
  type DeliveryRange,
} from '@/modules/vendor/lib/order-filters'
import {
  SUBTOTAL_PAGE_SIZE,
  sumDeliveryWindow,
  type SubtotalOutcome,
} from '@/modules/vendor/lib/order-subtotal'
import { isoDay } from '@/modules/vendor/lib/work-queue'
import type { DeliveryStatus, VendorOrderPage } from '@/modules/vendor/types/dashboard'
import { getErrorMessage, isOrderAdvancePartial, isOrderTransitionRefused, vendorOrdersService } from '@/shared/api'
import { Button, Spinner } from '@/shared/components'
import { formatCurrency } from '@/shared/lib/utils'

/**
 * The screen a vendor works from: filter by delivery date, page through, open an order,
 * move it one step.
 *
 * One panel, following `design-reference/dashboard.html`: the filters and the rows they
 * narrow share a frame, so it is never ambiguous which list a chip is acting on.
 *
 * The whole filter state — status, both dates and the page — lives in the URL. That is what
 * makes it survive opening an order and coming back: history restores the URL, where
 * component state would have unmounted on the way out. It is also how Overview's status
 * counts link straight into a filtered view.
 */

type SubtotalState = { kind: 'loading' } | SubtotalOutcome

/**
 * The console's one money figure, and the only screen allowed to show one.
 *
 * It is labelled with the exact filter it totals, because a number beside a date range is
 * read as that range's takings — and this console cannot report takings at all: no order
 * read carries a creation date, so there is no "sold in September", only "delivering in
 * September".
 *
 * It is a second pass over the same filter rather than a sum of the visible rows, and it is
 * withheld outright rather than shown partial. See `lib/order-subtotal.ts`.
 *
 * Rendered as the tinted strip the shared design uses for the one fact on a panel that
 * outranks the rest of it — the same treatment Store & Share gives the shop link.
 */
function DeliveryWindowSubtotal({ heading, state }: { heading: string; state: SubtotalState }) {
  return (
    <div className="mb-4 rounded-[var(--vc-radius)] border border-[var(--vc-tint-line)] bg-[var(--vc-tint)] px-4 py-3">
      <p className="text-xs font-semibold text-[var(--vc-tint-ink)]">{heading}</p>
      {state.kind === 'loading' ? (
        <p className="mt-1 text-sm text-[var(--md-muted)]">Adding it up…</p>
      ) : null}
      {state.kind === 'total' ? (
        <p className="font-display vc-num mt-0.5 text-2xl font-bold">
          {formatCurrency(state.amount)}{' '}
          <span className="font-sans text-sm font-normal text-[var(--md-muted)]">
            across {state.orders} {state.orders === 1 ? 'order' : 'orders'}
          </span>
        </p>
      ) : null}
      {state.kind === 'too-large' ? (
        <p className="mt-1 max-w-[68ch] text-sm font-medium">
          Range too large to total. Narrow the delivery dates and it will add up again.
        </p>
      ) : null}
      {state.kind === 'withheld' ? (
        <p className="mt-1 max-w-[68ch] text-sm font-medium">
          {state.reason === 'failed'
            ? `No total: part of this range did not load. A partial total would look complete. ${getErrorMessage(state.error, 'The request failed.')}`
            : 'No total: some of these orders have no amount, so any figure would be short.'}
        </p>
      ) : null}
    </div>
  )
}

export function VendorOrdersPage() {
  const { vendorId } = useVendorAccount()
  const [searchParams, setSearchParams] = useSearchParams()
  const { search } = useLocation()

  const query = useMemo(() => readOrdersQuery(searchParams), [searchParams])
  const { status, page } = query
  const { startDate, endDate } = query.range
  // Fixed for the life of the screen: the preset chips must not shift under the vendor if
  // midnight passes while they are looking at them.
  const today = useMemo(() => new Date(), [])
  const todayIso = useMemo(() => isoDay(today), [today])
  const rangeIssue = rangeError(query.range)
  const heading = subtotalHeading(query.range, status)

  const [result, setResult] = useState<VendorOrderPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [subtotal, setSubtotal] = useState<SubtotalState>({ kind: 'loading' })
  const [reloadToken, setReloadToken] = useState(0)

  function applyFilters(next: { status?: DeliveryStatus | null; range?: DeliveryRange }) {
    // Any filter change returns to the first page. Page 3 of the old filter is not page 3
    // of the new one, and an out-of-range page answers with nothing at all.
    setSearchParams(
      writeOrdersQuery({
        status: next.status !== undefined ? next.status : status,
        range: next.range ?? query.range,
        page: 0,
      }),
      { replace: true },
    )
  }

  function goToPage(nextPage: number) {
    setSearchParams(writeOrdersQuery({ ...query, page: Math.max(0, nextPage) }), { replace: true })
  }

  useEffect(() => {
    if (rangeIssue) {
      setResult(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setLoadError('')

    // Filtering and paging happen on the server: one request per view, rather than
    // fetching everything and narrowing it here.
    void vendorOrdersService
      .list(vendorId, { page, status, startDate, endDate })
      .then((data) => {
        if (!cancelled) setResult(data)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        // A failed request is not an empty result. Clearing the rows keeps the previous
        // filter's orders from sitting under a heading that now describes a different one.
        setResult(null)
        setLoadError(getErrorMessage(err, 'Could not load orders'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [vendorId, page, status, startDate, endDate, rangeIssue, reloadToken])

  useEffect(() => {
    if (!startDate && !endDate) return
    if (rangeIssue) return

    let cancelled = false
    setSubtotal({ kind: 'loading' })

    // Deliberately not keyed on `page`: this totals the whole filtered set, which is the
    // only thing the heading beside it can honestly claim.
    void sumDeliveryWindow((walkPage) =>
      vendorOrdersService.list(vendorId, {
        page: walkPage,
        size: SUBTOTAL_PAGE_SIZE,
        status,
        startDate,
        endDate,
      }),
    ).then((outcome) => {
      if (!cancelled) setSubtotal(outcome)
    })

    return () => {
      cancelled = true
    }
  }, [vendorId, status, startDate, endDate, rangeIssue, reloadToken])

  async function advance(orderId: string, current: DeliveryStatus, next: DeliveryStatus) {
    setBusyId(orderId)
    setActionError('')
    try {
      await vendorOrdersService.advance(vendorId, orderId, current, next)
      setReloadToken((token) => token + 1)
    } catch (err) {
      // A refusal arrives as HTTP 200 and its reason is the same generic sentence for every
      // illegal edge, so the vendor is told what failed rather than what the backend said.
      setActionError(
        isOrderAdvancePartial(err) || isOrderTransitionRefused(err)
          ? forwardRefusalMessage(next, isOrderAdvancePartial(err))
          : getErrorMessage(err, 'Could not update the order'),
      )
    } finally {
      setBusyId(null)
    }
  }

  /**
   * Record that this order was paid.
   *
   * Its own busy marker rather than sharing `busyId`. The two are independent actions on
   * independent axes, so neither reports the other's progress and neither blocks it.
   * Where the record is kept is the service's business — see
   * `docs/adr/0003-payment-status-is-a-device-local-vendor-record.md`.
   */
  async function recordPayment(orderId: string) {
    setPayingId(orderId)
    setActionError('')
    try {
      await vendorOrdersService.setPaymentStatus(vendorId, orderId, 'PAID')
      setReloadToken((token) => token + 1)
    } catch (err) {
      // This record is the only copy that exists anywhere: no backend route stores one. A
      // write that did not land must not pass as one that did.
      setActionError(getErrorMessage(err, 'Could not save the payment record'))
    } finally {
      setPayingId(null)
    }
  }

  const orders = result?.orders ?? []

  return (
    <div className="grid gap-4">
      <OrdersSectionTabs />

      <DashboardPanel title="All orders">
        <OrderFilterBar
          status={status}
          range={query.range}
          today={today}
          onApply={applyFilters}
        />

        {rangeIssue ? (
          <p className="mb-4 text-sm text-[var(--md-danger)]">{rangeIssue}</p>
        ) : null}

        {heading && !rangeIssue ? (
          <DeliveryWindowSubtotal heading={heading} state={subtotal} />
        ) : null}

        {actionError ? (
          <p className="mb-4 max-w-[68ch] text-sm text-[var(--md-danger)]">{actionError}</p>
        ) : null}
        {loading ? <Spinner label="Loading orders…" /> : null}

        {/*
          A failed request and an empty list are different facts, and "No orders here" is the
          wrong one to guess at: a vendor who reads it stops looking.
        */}
        {!loading && loadError ? (
          <div className="rounded-lg border border-[var(--md-danger)] p-4">
            <p className="max-w-[68ch] text-sm text-[var(--md-danger)]">{loadError}</p>
            <p className="mt-1 text-sm text-[var(--md-muted)]">
              This is a failed request, not an empty list.
            </p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-3"
              onClick={() => setReloadToken((token) => token + 1)}
            >
              Try again
            </Button>
          </div>
        ) : null}

        {!loading && !loadError && !rangeIssue && !orders.length ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--md-muted)]">
            <span className="mb-1 block font-semibold text-[var(--md-ink)]">No orders here</span>
            {status || hasDeliveryRange(query.range)
              ? 'Nothing matches these filters. Widen the delivery dates or clear the status.'
              : 'When a customer orders from your store, it will show up here.'}
          </p>
        ) : null}

        {!loading && !loadError && orders.length ? (
          <OrderLedger
            orders={orders}
            todayIso={todayIso}
            caption="Orders matching the current filters"
            showAmount
            /*
              The filters ride along in history state so that the detail screen's own "Back to
              orders" returns to this exact view. Browser back already would; a vendor who uses
              the button on screen should not be punished for it by losing the range they typed.
            */
            linkState={{ from: `/vendor/orders${search}` }}
            renderPaymentAction={(order) => {
              // Reversal is deliberately detail-only: on a list a vendor is scrolling, and a
              // paid flag flipped by accident is a flag nothing else can correct.
              if (!canRecordPayment(order.deliveryStatus) || order.paymentStatus === 'PAID') {
                return null
              }

              return (
                <Button
                  size="sm"
                  variant="link"
                  className="h-auto p-0 text-xs"
                  disabled={payingId !== null}
                  onClick={() => void recordPayment(order.id)}
                >
                  {payingId === order.id ? 'Saving…' : 'Mark paid'}
                </Button>
              )
            }}
            renderNextStep={(order) => {
              const next = nextVendorDeliveryStatus(order.deliveryStatus)
              if (!next) return null

              return (
                <Button
                  size="sm"
                  className="rounded-full"
                  disabled={busyId !== null}
                  onClick={() => void advance(order.id, order.deliveryStatus, next)}
                >
                  {busyId === order.id ? 'Working…' : forwardActionLabel(next)}
                </Button>
              )
            }}
          />
        ) : null}

        {result && result.totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-between border-t border-[var(--vc-rule)] pt-4">
            <Button
              size="sm"
              variant="secondary"
              disabled={page === 0 || loading}
              onClick={() => goToPage(page - 1)}
            >
              Previous
            </Button>
            <span className="vc-num text-sm text-[var(--md-muted)]">
              Page {result.page + 1} of {result.totalPages}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={result.lastPage || loading}
              onClick={() => goToPage(page + 1)}
            >
              Next
            </Button>
          </div>
        ) : null}
      </DashboardPanel>
    </div>
  )
}
