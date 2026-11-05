import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { DashboardPanel } from '@/modules/vendor/components/DashboardPanel'
import { OrderLedger } from '@/modules/vendor/components/OrderLedger'
import { RowSkeleton } from '@/modules/vendor/components/RowSkeleton'
import { StoreStatusScreen } from '@/modules/vendor/components/StoreStatusScreen'
import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import { VENDOR_ORDER_DETAILS_SHOWN } from '@/modules/vendor/lib/order-actions'
import { groupByProduct } from '@/modules/vendor/lib/product-groups'
import {
  isoDay,
  selectWorkQueue,
  WORK_QUEUE_STATUSES,
  workQueueStatusCounts,
  workQueueWindow,
} from '@/modules/vendor/lib/work-queue'
import type { VendorInsights, VendorOrderPage } from '@/modules/vendor/types/dashboard'
import { getErrorMessage, vendorOrdersService, vendorProductsService, vendorService } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Button, LoadError, LoadingSkeleton, Spinner } from '@/shared/components'
import { cn } from '@/shared/lib/utils'

/**
 * One figure and what it counts, as the shared design draws it: the label small and
 * tracked out above, the number large below.
 *
 * The space between them is load-bearing. Both spans are inline, so without it the tile's
 * accessible name runs the two together as "New2".
 */
function MetricTile({ to, label, value }: { to: string; label: string; value: ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-[var(--vc-radius)] border border-[var(--vc-edge)] bg-[var(--vc-panel)] px-4 py-3.5 shadow-[var(--vc-shadow)] transition hover:border-[var(--vc-tint-line)]"
    >
      <span className="vc-label block">{label}</span>{' '}
      <span className="font-display vc-num mt-1.5 block text-2xl font-bold">{value}</span>
    </Link>
  )
}

/**
 * A `MetricTile`'s frame with its two lines drawn as skeletons, so it holds the same space.
 * With a `label` it announces its own load; without one it is hidden, for tiles whose load
 * another status already announces.
 */
function MetricTilePlaceholder({ label }: { label?: string }) {
  return (
    <div
      aria-hidden={label ? undefined : 'true'}
      className="rounded-[var(--vc-radius)] border border-[var(--vc-edge)] bg-[var(--vc-panel)] px-4 py-3.5 shadow-[var(--vc-shadow)]"
    >
      {label ? (
        <span role="status" aria-label={label} className="sr-only">
          {label}
        </span>
      ) : null}
      <LoadingSkeleton className="h-[0.84rem] w-16" />
      <LoadingSkeleton className="mt-1.5 h-8 w-10" />
    </div>
  )
}

/**
 * How much of each kind of work there is, and how much of the catalog is built.
 *
 * The reference's fourth tile is the day's takings. There is none to show: no order read in
 * the contract carries a creation date, so "today" cannot be asked for, and the console's
 * one money figure lives on Orders beside the delivery range it describes. The catalog size
 * takes the slot, counted from the catalog itself: the vendor context no longer reports usage.
 *
 * Every status renders separately and always renders a number. The backend omits
 * zero-valued keys entirely, so `workQueueStatusCounts` supplies the `0` — a blank where
 * "none" belongs reads as missing data, not as nothing to do.
 */
/**
 * Products counted the way the Products page groups them, so the two never disagree. Loads on
 * its own so a slow catalog read never holds back the order counts; a failed read shows a dash.
 */
function ProductCountTile({ vendorId }: { vendorId: string }) {
  const [count, setCount] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    setCount(null)
    setFailed(false)

    // Started a tick late for the same reason as the reads in `Metrics` and `WorkQueue`.
    // Here it also keeps StrictMode's throwaway mount from starting a read only to abort it.
    const start = window.setTimeout(() => {
      void vendorProductsService
        .listSizes(vendorId, controller.signal)
        .then((sizes) => {
          if (!cancelled) setCount(groupByProduct(sizes).length)
        })
        .catch(() => {
          if (!cancelled) setFailed(true)
        })
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(start)
      controller.abort()
    }
  }, [vendorId])

  if (count === null && !failed) return <MetricTilePlaceholder label="Loading your product count" />
  return <MetricTile to="/vendor/products" label="Products" value={failed ? '—' : count} />
}

function Metrics({ userId, vendorId }: { userId: string; vendorId: string }) {
  const [insights, setInsights] = useState<VendorInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    // Started a tick after mount, so StrictMode's development mount-unmount-remount clears
    // the first timer before it fires and the read is sent once. This request cannot be
    // aborted, so without the delay the throwaway mount's copy would still go out.
    const start = window.setTimeout(() => {
      void vendorService
        .getInsights(userId)
        .then((data) => {
          if (!cancelled) setInsights(data)
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(getErrorMessage(err, 'Could not load your order counts'))
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(start)
    }
  }, [userId, reloadToken])

  // The product tile renders in every state, so its read starts alongside this one rather
  // than after it. While loading, placeholders hold the count tiles' cells so nothing moves
  // when they arrive; an error notice sits above the grid, where nothing arrives later.
  return (
    <div className="grid gap-3">
      {loading ? (
        <span role="status" className="sr-only">
          Loading your order counts…
        </span>
      ) : null}
      {!loading && error ? <LoadError onRetry={() => setReloadToken((token) => token + 1)} /> : null}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loading
          ? WORK_QUEUE_STATUSES.map((status) => <MetricTilePlaceholder key={status} />)
          : null}
        {/* New counts PENDING + SCHEDULED but links to SCHEDULED: the single-status filter
            omits legacy PENDING rows, so its list can be shorter than the tile count. */}
        {!loading && !error && insights
          ? workQueueStatusCounts(insights.ordersByStatus).map(({ status, label, count }) => (
              <MetricTile
                key={status}
                to={`/vendor/orders?status=${status}`}
                label={label}
                value={count}
              />
            ))
          : null}
        <ProductCountTile vendorId={vendorId} />
      </div>
    </div>
  )
}

/**
 * What still needs doing, soonest first.
 *
 * One request over `delivery_date`, because `order_status` is a single-value server filter
 * and a queue spanning three statuses cannot be one status-filtered call. The window reaches
 * a week back so an order that went past its delivery date while unfinished still surfaces —
 * see `lib/work-queue.ts`.
 *
 * The reference calls this panel "Recent orders". It is not recency: with no creation date
 * anywhere in the contract there is no such ordering to offer, and what a vendor opens the
 * console for is the list of orders still owed to somebody.
 *
 * No amount is rendered here. The console's one money figure lives on Orders beside the range
 * it describes; a total on this screen would describe a window the vendor did not choose.
 */
function WorkQueue({ vendorId }: { vendorId: string }) {
  const queueWindow = useMemo(() => workQueueWindow(new Date()), [])
  const todayIso = useMemo(() => isoDay(new Date()), [])
  const [result, setResult] = useState<VendorOrderPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(0)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    // Started a tick late for the same reason as the read in `Metrics`.
    const start = window.setTimeout(() => {
      void vendorOrdersService
        .list(vendorId, {
          page,
          startDate: queueWindow.startDate,
          endDate: queueWindow.endDate,
        })
        .then((data) => {
          if (!cancelled) setResult(data)
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(getErrorMessage(err, 'Could not load what needs doing'))
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(start)
    }
  }, [vendorId, queueWindow, page, reloadToken])

  const queue = result ? selectWorkQueue(result.orders) : []
  // Only the first read has nothing to show. A page change keeps the rows on screen, dimmed.
  const firstLoad = loading && result === null
  const refetching = loading && result !== null

  return (
    <DashboardPanel
      title="What needs doing"
      action={
        <div className="flex items-center gap-3">
          {refetching ? <Spinner label="Updating what needs doing" /> : null}
          <Link
            to="/vendor/orders"
            className="text-sm font-semibold text-[var(--md-muted)] transition hover:text-[var(--vc-tint-ink)]"
          >
            See all
          </Link>
        </div>
      }
    >
      <p className="vc-num -mt-2 mb-3 max-w-[68ch] text-xs text-[var(--md-muted)]">
        Deliveries due between {queueWindow.startDate} and {queueWindow.endDate}, still open.
      </p>

      {/* The narrow ledger turns from cards into rows at `lg`, so the placeholders do too. */}
      {firstLoad ? <RowSkeleton label="Loading what needs doing" rowClassName="h-39 lg:h-[4.5rem]" /> : null}

      {/*
        A failed request and an empty queue are different facts. Telling a vendor there is
        nothing to do because a request failed is the worse of the two mistakes.
      */}
      {!loading && error ? <LoadError onRetry={() => setReloadToken((token) => token + 1)} /> : null}

      {/*
        The reference's own empty state: one centred line inside the panel, not a dashed
        `EmptyState` box. A panel that already has a title and a frame does not need a
        second frame drawn inside it to say it is empty.
      */}
      {!firstLoad && !error && result ? (
        <div
          aria-busy={refetching || undefined}
          className={cn('transition-opacity motion-reduce:transition-none', refetching && 'opacity-60')}
        >
          {!queue.length ? (
            <p className="px-4 py-8 text-center text-sm text-[var(--md-muted)]">
              <span className="mb-1 block font-semibold text-[var(--md-ink)]">
                {result.lastPage ? 'Nothing waiting' : 'More orders to check'}
              </span>
              {result.lastPage
                ? 'No open orders are due in this window. New orders appear here as they arrive.'
                : 'No open orders appear on this page. Check the remaining orders before finishing for the day.'}
            </p>
          ) : (
            <OrderLedger
              orders={queue}
              todayIso={todayIso}
              caption="Open orders due in this window, soonest first"
            />
          )}
        </div>
      ) : null}

      {result && result.totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between border-t border-[var(--vc-rule)] pt-4">
          <Button size="sm" variant="secondary" disabled={page === 0 || loading} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span className="vc-num text-sm text-[var(--md-muted)]">
            Page {result.page + 1} of {result.totalPages}
          </span>
          <Button size="sm" variant="secondary" disabled={result.lastPage || loading} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      ) : null}
    </DashboardPanel>
  )
}

/**
 * TEMP(vendor-orders-minimal-rows): the one orders read Overview makes while status and
 * delivery date are hidden — the first page of every order, in the order the API returns them.
 * Both the Orders tile and the Latest orders panel render from it, so the total costs no
 * request of its own.
 */
type LatestOrdersRead = {
  result: VendorOrderPage | null
  loading: boolean
  error: string
  reload: () => void
}

function useLatestOrders(vendorId: string): LatestOrdersRead {
  const [result, setResult] = useState<VendorOrderPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    // Started a tick late for the same reason as the read in `Metrics`.
    const start = window.setTimeout(() => {
      void vendorOrdersService
        .list(vendorId, { page: 0 })
        .then((data) => {
          if (!cancelled) setResult(data)
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(getErrorMessage(err, 'Could not load your latest orders'))
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(start)
    }
  }, [vendorId, reloadToken])

  return { result, loading, error, reload: () => setReloadToken((token) => token + 1) }
}

/**
 * TEMP(vendor-orders-minimal-rows): how many orders there are, and how much of the catalog is
 * built. The total is the latest-orders read's own count; that panel announces its load and
 * its failure, so the tile only holds its place and then shows a dash.
 *
 * Two tiles share the row at every width. The four-column grid the full Overview uses would
 * leave half of a desktop row empty, and nothing else is known without another request.
 */
function MinimalMetrics({ vendorId, latest }: { vendorId: string; latest: LatestOrdersRead }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {latest.loading ? (
        <MetricTilePlaceholder />
      ) : (
        <MetricTile
          to="/vendor/orders"
          label="Orders"
          value={latest.error || !latest.result ? '—' : latest.result.totalElements}
        />
      )}
      <ProductCountTile vendorId={vendorId} />
    </div>
  )
}

/**
 * TEMP(vendor-orders-minimal-rows): the first page of orders in place of the queue. With no
 * status there is no telling an open order from a finished one, so nothing is filtered out;
 * paging is left to Orders, one "See all" away.
 */
function LatestOrders({ latest }: { latest: LatestOrdersRead }) {
  const todayIso = useMemo(() => isoDay(new Date()), [])
  const { result, loading, error } = latest

  return (
    <DashboardPanel
      title="Latest orders"
      action={
        <Link
          to="/vendor/orders"
          className="text-sm font-semibold text-[var(--md-muted)] transition hover:text-[var(--vc-tint-ink)]"
        >
          See all
        </Link>
      }
    >
      {/* The minimal row's own heights, phone and from `sm`. */}
      {loading ? (
        <RowSkeleton label="Loading latest orders" rowClassName="h-[7rem] sm:h-[4.5rem]" />
      ) : null}

      {!loading && error ? <LoadError onRetry={latest.reload} /> : null}

      {!loading && !error && result ? (
        result.orders.length ? (
          <OrderLedger orders={result.orders} todayIso={todayIso} caption="Latest orders" />
        ) : (
          <p className="px-4 py-8 text-center text-sm text-[var(--md-muted)]">
            <span className="mb-1 block font-semibold text-[var(--md-ink)]">No orders yet.</span>
            When a customer orders from your store, it will show up here.
          </p>
        )
      ) : null}
    </DashboardPanel>
  )
}

/**
 * TEMP(vendor-orders-minimal-rows): Overview while status and delivery date are hidden. No
 * insights read: its counts are per status, and the status tiles are what is hidden.
 */
function MinimalOpenStoreOverview({
  vendorId,
  storeIdentifier,
}: {
  vendorId: string
  storeIdentifier: string | null
}) {
  const latest = useLatestOrders(vendorId)

  return (
    <div className="grid gap-4">
      <MinimalMetrics vendorId={vendorId} latest={latest} />
      <LatestOrders latest={latest} />
      <QuickActions storeIdentifier={storeIdentifier} />
    </div>
  )
}

/**
 * The three jobs a vendor comes back to the console for, one tap from the first screen.
 *
 * Each says what it opens rather than selling it, and the storefront card is withheld until
 * there is a storefront to open — a card that lands on a 404 is worse than three cards.
 */
function QuickActions({ storeIdentifier }: { storeIdentifier: string | null }) {
  const actions = [
    { to: '/vendor/storefront', title: 'Share shop link', detail: 'WhatsApp & Instagram' },
    { to: '/vendor/products', title: 'Manage products', detail: 'Prices & sizes' },
    ...(storeIdentifier
      ? [{ to: `/stores/${storeIdentifier}`, title: 'Open storefront', detail: 'Customer view' }]
      : []),
  ]

  return (
    <section aria-labelledby="quick-actions-heading">
      <h2 id="quick-actions-heading" className="font-display mb-2.5 text-base font-semibold">
        Quick actions
      </h2>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map(({ to, title, detail }) => (
          <Link
            key={to}
            to={to}
            className="grid gap-0.5 rounded-[var(--vc-radius)] border border-[var(--vc-edge)] bg-[var(--vc-panel)] px-4 py-3.5 shadow-[var(--vc-shadow)] transition hover:border-[var(--vc-tint-line)] hover:bg-[var(--md-green-50)]/40"
          >
            <strong className="text-sm font-semibold">{title}</strong>
            <span className="text-xs text-[var(--md-muted)]">{detail}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

/**
 * Overview for an open store, in the order a vendor needs it: how much of each kind of work
 * there is, then what to do next, then the ways out to the three jobs beyond this screen.
 *
 * Insights are keyed on the **user** id, not the vendor id: the path is
 * `/v1/users/{user_id}/dashboard`, and a vendor id returns 403.
 */
function OpenStoreOverview({ vendorId }: { vendorId: string }) {
  const userId = useAuthStore((s) => s.user?.id)
  const { context } = useVendorAccount()

  // TEMP(vendor-orders-minimal-rows): no status tiles or queue while order details are hidden.
  if (!VENDOR_ORDER_DETAILS_SHOWN) {
    return <MinimalOpenStoreOverview vendorId={vendorId} storeIdentifier={context.storeIdentifier} />
  }

  return (
    <div className="grid gap-4">
      {userId ? <Metrics userId={userId} vendorId={vendorId} /> : null}
      <WorkQueue vendorId={vendorId} />
      <QuickActions storeIdentifier={context.storeIdentifier} />
    </div>
  )
}

export function VendorOverviewPage() {
  const { vendorId, storeState } = useVendorAccount()

  /*
    The four non-open states share one screen and show nothing else. A vendor who cannot
    receive orders has no queue and no counts, and rendering empty ones would read as
    "no orders yet" rather than "your store is not open".
  */
  return storeState === 'OPEN' ? (
    <OpenStoreOverview vendorId={vendorId} />
  ) : (
    <StoreStatusScreen state={storeState} />
  )
}
