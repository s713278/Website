import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { CustomerContact } from '@/modules/vendor/components/CustomerContact'
import { OrdersSectionTabs } from '@/modules/vendor/components/OrdersSectionTabs'
import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import {
  forwardActionLabel,
  forwardRefusalMessage,
  nextDeliveryStatus,
  presentDeliveryStatus,
  presentPaymentStatus,
} from '@/modules/vendor/lib/order-actions'
import {
  hasDeliveryRange,
  matchingPreset,
  NO_RANGE,
  ORDER_STATUS_FILTERS,
  presetRange,
  RANGE_PRESETS,
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
import { vendorFilterChipClass } from '@/modules/vendor/lib/filter-chip'
import type { DeliveryStatus, VendorOrderPage } from '@/modules/vendor/types/dashboard'
import { getErrorMessage, isOrderTransitionRefused, vendorOrdersService } from '@/shared/api'
import { Badge, Button, Card, EmptyState, Input, PageHeader, Spinner } from '@/shared/components'
import { formatCurrency } from '@/shared/lib/utils'

/**
 * The screen a vendor works from: filter by delivery date, page through, open an order,
 * move it one step.
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
 */
function DeliveryWindowSubtotal({ heading, state }: { heading: string; state: SubtotalState }) {
  return (
    <Card className="mb-6 p-5">
      <p className="text-sm text-[var(--md-muted)]">{heading}</p>
      {state.kind === 'loading' ? (
        <p className="mt-1 text-sm text-[var(--md-muted)]">Adding it up…</p>
      ) : null}
      {state.kind === 'total' ? (
        <p className="font-display vc-num mt-1 text-3xl font-bold">
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
    </Card>
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
  const rangeIssue = rangeError(query.range)
  const heading = subtotalHeading(query.range, status)
  const activePreset = matchingPreset(query.range, today)

  const [result, setResult] = useState<VendorOrderPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
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

  async function advance(orderId: string, next: DeliveryStatus) {
    setBusyId(orderId)
    setActionError('')
    try {
      await vendorOrdersService.advance(vendorId, orderId, next)
      setReloadToken((token) => token + 1)
    } catch (err) {
      // A refusal arrives as HTTP 200 and its reason is the same generic sentence for every
      // illegal edge, so the vendor is told what failed rather than what the backend said.
      setActionError(
        isOrderTransitionRefused(err)
          ? forwardRefusalMessage(next)
          : getErrorMessage(err, 'Could not update the order'),
      )
    } finally {
      setBusyId(null)
    }
  }

  const orders = result?.orders ?? []

  return (
    <div>
      <PageHeader title="Orders" subtitle="Filter by delivery date, then work down the list" />
      <OrdersSectionTabs />

      <Card className="mb-6 space-y-5 p-5">
        <div role="group" aria-label="Order status">
          <p className="mb-2 text-sm font-medium">Order status</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyFilters({ status: null })}
              className={vendorFilterChipClass(status === null)}
            >
              All
            </button>
            {ORDER_STATUS_FILTERS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => applyFilters({ status: value })}
                className={vendorFilterChipClass(status === value)}
              >
                {presentDeliveryStatus(value).label}
              </button>
            ))}
          </div>
        </div>

        {/*
          Every control in this group says "delivery date", and that is not decoration. It
          is the only date the contract carries — there is no creation timestamp on any order
          read — so a control labelled "date" would be read as an order date and quietly
          answer a different question than the one it was asked.
        */}
        <div role="group" aria-label="Delivery date">
          <p className="mb-2 text-sm font-medium">Delivery date</p>
          <div className="flex flex-wrap gap-2">
            {RANGE_PRESETS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() =>
                  applyFilters({
                    range: activePreset === key ? NO_RANGE : presetRange(key, today),
                  })
                }
                className={vendorFilterChipClass(activePreset === key)}
              >
                {label}
              </button>
            ))}
            {hasDeliveryRange(query.range) ? (
              <button
                type="button"
                onClick={() => applyFilters({ range: NO_RANGE })}
                className={vendorFilterChipClass(false)}
              >
                Clear dates
              </button>
            ) : null}
          </div>

          <div className="mt-3 grid gap-3 sm:max-w-md sm:grid-cols-2">
            <Input
              type="date"
              name="delivery-date-from"
              label="Delivery date from"
              value={startDate ?? ''}
              onChange={(event) =>
                applyFilters({
                  range: {
                    ...query.range,
                    startDate: event.target.value || null,
                  },
                })
              }
            />
            <Input
              type="date"
              name="delivery-date-to"
              label="Delivery date to"
              value={endDate ?? ''}
              onChange={(event) =>
                applyFilters({
                  range: {
                    ...query.range,
                    endDate: event.target.value || null,
                  },
                })
              }
            />
          </div>
        </div>
      </Card>

      {rangeIssue ? <p className="mb-6 text-sm text-[var(--md-danger)]">{rangeIssue}</p> : null}

      {heading && !rangeIssue ? (
        <DeliveryWindowSubtotal heading={heading} state={subtotal} />
      ) : null}

      {actionError ? (
        <p className="mb-6 max-w-[68ch] text-sm text-[var(--md-danger)]">{actionError}</p>
      ) : null}
      {loading ? <Spinner label="Loading orders…" /> : null}

      {/*
        A failed request and an empty list are different facts, and "No orders here" is the
        wrong one to guess at: a vendor who reads it stops looking.
      */}
      {!loading && loadError ? (
        <Card className="border-[var(--md-danger)] p-5">
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
        </Card>
      ) : null}

      {!loading && !loadError && !rangeIssue && !orders.length ? (
        <EmptyState
          title="No orders here"
          description={
            status || hasDeliveryRange(query.range)
              ? 'Nothing matches these filters. Widen the delivery dates or clear the status.'
              : 'When a customer orders from your store, it will show up here.'
          }
        />
      ) : null}

      {!loading && !loadError && orders.length ? (
        <div>
          {/*
            One panel with ruled rows, not a card per order. Thirteen separately shadowed
            cards make thirteen things to look at; a vendor working down a delivery day is
            comparing rows, and the columns below only line up if they share a panel.
          */}
          <Card className="vc-rows p-0">
            {orders.map((order) => {
              const delivery = presentDeliveryStatus(order.deliveryStatus)
              const next = nextDeliveryStatus(order.deliveryStatus)
              const busy = busyId === order.id

              return (
                <div
                  key={order.id}
                  className="grid gap-x-6 gap-y-3 px-4 py-4 transition-colors hover:bg-slate-50/70 sm:grid-cols-[minmax(0,1fr)_13rem_16rem] sm:items-start sm:px-5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {/*
                      The filters ride along in history state so that the detail screen's
                      own "Back to orders" returns to this exact view. Browser back already
                      would; a vendor who uses the button on screen should not be punished
                      for it by losing the range they just typed.
                    */}
                      <Link
                        to={`/vendor/orders/${order.id}`}
                        state={{ from: `/vendor/orders${search}` }}
                        className="vc-num font-semibold hover:underline"
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
                    <CustomerContact
                      className="mt-1.5"
                      name={order.customerName}
                      mobile={order.customerMobile}
                    />
                  </div>

                  {/*
                    Date over amount, right-aligned in a fixed column so the rupee figures
                    stack into one edge. `null` is unknown, `0` is a genuinely free order:
                    rendering both as nothing, or both as ₹0, would merge two facts.
                  */}
                  <div className="sm:text-right">
                    {order.deliveryDate ? (
                      <p className="vc-num text-sm text-[var(--md-muted)] sm:whitespace-nowrap">
                        Delivery date {order.deliveryDate}
                      </p>
                    ) : null}
                    {order.total != null ? (
                      <p className="vc-num mt-0.5 text-lg font-semibold">
                        {formatCurrency(order.total)}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-sm text-slate-500">Amount not available</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {next ? (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => void advance(order.id, next)}
                      >
                        {busy ? 'Working…' : forwardActionLabel(next)}
                      </Button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </Card>
        </div>
      ) : null}

      {result && result.totalPages > 1 ? (
        <div className="mt-6 flex items-center justify-between border-t border-[var(--vc-edge)] pt-5">
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
    </div>
  )
}
