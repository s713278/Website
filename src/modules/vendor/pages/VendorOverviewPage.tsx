import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { DashboardPanel } from '@/modules/vendor/components/DashboardPanel'
import { OrderLedger } from '@/modules/vendor/components/OrderLedger'
import { StoreStatusScreen } from '@/modules/vendor/components/StoreStatusScreen'
import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import {
  isoDay,
  selectWorkQueue,
  workQueueStatusCounts,
  workQueueWindow,
} from '@/modules/vendor/lib/work-queue'
import type { VendorInsights, VendorOrderPage, VendorPlan } from '@/modules/vendor/types/dashboard'
import { getErrorMessage, vendorOrdersService, vendorService } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Spinner } from '@/shared/components'

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
 * How much of each kind of work there is, and how much of the catalog is built.
 *
 * The reference's fourth tile is the day's takings. There is none to show: no order read in
 * the contract carries a creation date, so "today" cannot be asked for, and the console's
 * one money figure lives on Orders beside the delivery range it describes. The catalog size
 * takes the slot — it is real, it comes from the context the shell has already read, and it
 * is the number that explains a refused product add.
 *
 * Every status renders separately and always renders a number. The backend omits
 * zero-valued keys entirely, so `workQueueStatusCounts` supplies the `0` — a blank where
 * "none" belongs reads as missing data, not as nothing to do.
 */
function Metrics({ userId, plan }: { userId: string; plan: VendorPlan }) {
  const [insights, setInsights] = useState<VendorInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

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

    return () => {
      cancelled = true
    }
  }, [userId])

  if (loading) return <Spinner label="Loading your order counts…" />
  if (error) return <p className="text-sm text-[var(--md-danger)]">{error}</p>
  if (!insights) return null

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {/* New counts PENDING + SCHEDULED but links to SCHEDULED: the single-status filter
          omits legacy PENDING rows, so its list can be shorter than the tile count. */}
      {workQueueStatusCounts(insights.ordersByStatus).map(({ status, label, count }) => (
        <MetricTile
          key={status}
          to={`/vendor/orders?status=${status}`}
          label={label}
          value={count}
        />
      ))}
      <MetricTile
        to="/vendor/products"
        label="Products"
        value={plan.usage.products ?? '—'}
      />
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

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    void vendorOrdersService
      .list(vendorId, {
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

    return () => {
      cancelled = true
    }
  }, [vendorId, queueWindow])

  const queue = result ? selectWorkQueue(result.orders) : []

  return (
    <DashboardPanel
      title="What needs doing"
      action={
        <Link
          to="/vendor/orders"
          className="text-sm font-semibold text-[var(--md-muted)] transition hover:text-[var(--vc-tint-ink)]"
        >
          See all
        </Link>
      }
    >
      <p className="vc-num -mt-2 mb-3 max-w-[68ch] text-xs text-[var(--md-muted)]">
        Deliveries due between {queueWindow.startDate} and {queueWindow.endDate}, still open.
      </p>

      {loading ? <Spinner label="Loading what needs doing…" /> : null}

      {/*
        A failed request and an empty queue are different facts. Telling a vendor there is
        nothing to do because a request failed is the worse of the two mistakes.
      */}
      {!loading && error ? (
        <div className="rounded-lg border border-[var(--md-danger)] p-4">
          <p className="max-w-[68ch] text-sm text-[var(--md-danger)]">{error}</p>
          <p className="mt-1 text-sm text-[var(--md-muted)]">
            This is a failed request, not an empty queue.
          </p>
        </div>
      ) : null}

      {/*
        The reference's own empty state: one centred line inside the panel, not a dashed
        `EmptyState` box. A panel that already has a title and a frame does not need a
        second frame drawn inside it to say it is empty.
      */}
      {!loading && !error && !queue.length ? (
        <p className="px-4 py-8 text-center text-sm text-[var(--md-muted)]">
          <span className="mb-1 block font-semibold text-[var(--md-ink)]">
            {result?.lastPage ? 'Nothing waiting' : 'More orders to check'}
          </span>
          {result?.lastPage
            ? 'No open orders are due in this window. New orders appear here as they arrive.'
            : 'No open orders appear on this page. Check the remaining orders before finishing for the day.'}
        </p>
      ) : null}

      {!loading && !error && queue.length ? (
        <OrderLedger
          orders={queue}
          todayIso={todayIso}
          caption="Open orders due in this window, soonest first"
        />
      ) : null}

      {/* A locally empty page says nothing about unfinished orders on later pages. */}
      {!loading && !error && result && !result.lastPage ? (
        <p className="mt-3 max-w-[68ch] text-sm text-[var(--md-muted)]">
          Only the first page of this window is shown.{' '}
          <Link to="/vendor/orders" className="font-medium hover:underline">
            Open Orders
          </Link>{' '}
          to see the rest.
        </p>
      ) : null}
    </DashboardPanel>
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
  const { context, plan } = useVendorAccount()

  return (
    <div className="grid gap-4">
      {userId ? <Metrics userId={userId} plan={plan} /> : null}
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
