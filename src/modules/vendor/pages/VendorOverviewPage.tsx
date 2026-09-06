import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CustomerContact } from '@/modules/vendor/components/CustomerContact'
import { StoreStatusScreen } from '@/modules/vendor/components/StoreStatusScreen'
import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import { presentDeliveryStatus } from '@/modules/vendor/lib/order-actions'
import {
  dueDescription,
  isOverdue,
  isoDay,
  selectWorkQueue,
  workQueueStatusCounts,
  workQueueWindow,
} from '@/modules/vendor/lib/work-queue'
import type { VendorInsights, VendorOrderPage } from '@/modules/vendor/types/dashboard'
import { getErrorMessage, vendorOrdersService, vendorService } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Badge, Card, EmptyState, PageHeader, Spinner } from '@/shared/components'
import { cn } from '@/shared/lib/utils'

/**
 * What still needs doing, soonest first.
 *
 * One request over `delivery_date`, because `order_status` is a single-value server filter
 * and a queue spanning three statuses cannot be one status-filtered call. The window reaches
 * a week back so an order that went past its delivery date while unfinished still surfaces —
 * see `lib/work-queue.ts`.
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
      .list(vendorId, { startDate: queueWindow.startDate, endDate: queueWindow.endDate })
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
    <section className="mb-8">
      <div className="mb-3">
        <h2 className="font-display text-lg font-semibold">What needs doing</h2>
        <p className="text-sm text-[var(--md-muted)]">
          Deliveries due between {queueWindow.startDate} and {queueWindow.endDate}, still open.
        </p>
      </div>

      {loading ? <Spinner label="Loading what needs doing…" /> : null}

      {/*
        A failed request and an empty queue are different facts. Telling a vendor there is
        nothing to do because a request failed is the worse of the two mistakes.
      */}
      {!loading && error ? (
        <Card className="border-[var(--md-danger)]">
          <p className="text-sm text-[var(--md-danger)]">{error}</p>
          <p className="mt-1 text-sm text-[var(--md-muted)]">
            This is a failed request, not an empty queue.
          </p>
        </Card>
      ) : null}

      {!loading && !error && !queue.length ? (
        <EmptyState
          title="Nothing waiting"
          description="No open orders are due in this window. New orders appear here as they arrive."
        />
      ) : null}

      {!loading && !error && queue.length ? (
        <div className="space-y-3">
          {queue.map((order) => {
            const delivery = presentDeliveryStatus(order.deliveryStatus)
            const late = isOverdue(order.deliveryDate, todayIso)

            return (
              <Card
                key={order.id}
                className={cn(
                  'border-l-4',
                  late ? 'border-l-[var(--md-danger)]' : 'border-l-[var(--md-green-600)]',
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/vendor/orders/${order.id}`} className="font-semibold hover:underline">
                    Order #{order.id}
                  </Link>
                  <Badge tone={delivery.tone}>{delivery.label}</Badge>
                  {late ? <Badge tone="danger">Overdue</Badge> : null}
                </div>
                <p
                  className={cn(
                    'mt-1 text-sm',
                    late ? 'font-medium text-[var(--md-danger)]' : 'text-[var(--md-muted)]',
                  )}
                >
                  {dueDescription(order.deliveryDate, todayIso)}
                </p>
                <CustomerContact
                  className="mt-2"
                  name={order.customerName}
                  mobile={order.customerMobile}
                />
              </Card>
            )
          })}

          {/*
            One request, one page. Saying so is better than silently showing part of the
            window as if it were all of it.
          */}
          {result && !result.lastPage ? (
            <p className="text-sm text-[var(--md-muted)]">
              Only the first page of this window is shown.{' '}
              <Link to="/vendor/orders" className="font-medium hover:underline">
                Open Orders
              </Link>{' '}
              to see the rest.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

/**
 * How much of each kind of work there is, each count a way into Orders.
 *
 * Every status renders separately and always renders a number. The backend omits
 * zero-valued keys entirely, so `workQueueStatusCounts` supplies the `0` — a blank where
 * "none" belongs reads as missing data, not as nothing to do.
 */
function StatusCounts({ userId }: { userId: string }) {
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

  return (
    <section className="mb-8">
      <h2 className="font-display mb-3 text-lg font-semibold">Where your orders stand</h2>

      {loading ? <Spinner label="Loading your order counts…" /> : null}
      {!loading && error ? <p className="text-sm text-[var(--md-danger)]">{error}</p> : null}

      {!loading && !error && insights ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {workQueueStatusCounts(insights.ordersByStatus).map(({ status, label, count }) => (
            <Link
              key={status}
              to={`/vendor/orders?status=${status}`}
              className="rounded-lg border border-[var(--md-border)] bg-white p-4 transition hover:border-[var(--md-green-600)] hover:bg-[var(--md-green-50)]"
            >
              {/* The space is load-bearing: without it the link's accessible name is "2New". */}
              <span className="font-display block text-3xl font-bold">{count}</span>{' '}
              <span className="mt-1 block text-sm text-[var(--md-muted)]">{label}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  )
}

/**
 * The plan, with what it allows against what has been used.
 *
 * Same source and labels as the sidebar summary this replaces. Nothing is computed: no trial
 * deadline is derived from an assumed trial length, and no billing figure appears that the
 * backend did not send.
 */
function PlanUsage() {
  const { plan } = useVendorAccount()

  return (
    <section>
      <h2 className="font-display mb-3 text-lg font-semibold">Your plan</h2>
      <Card>
        <p className="font-semibold">{plan.name ?? plan.code ?? 'Your plan'}</p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-[var(--md-muted)]">Products</dt>
            <dd className="mt-1 font-medium">
              {plan.usage.products != null && plan.limits.products != null
                ? `${plan.usage.products} of ${plan.limits.products} used`
                : 'Not available'}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--md-muted)]">Sizes</dt>
            <dd className="mt-1 font-medium">
              {plan.usage.skus != null && plan.limits.skus != null
                ? `${plan.usage.skus} of ${plan.limits.skus} used`
                : 'Not available'}
            </dd>
          </div>
        </dl>
        {/*
          A trial countdown appears only when the backend sends an end date. No deployed
          response carries one yet, so nothing is shown rather than a deadline computed from
          a hardcoded trial length.
        */}
        {plan.trialEndsAt ? (
          <p className="mt-3 text-sm text-[var(--md-muted)]">
            Trial ends {new Date(plan.trialEndsAt).toLocaleDateString()}
          </p>
        ) : null}
      </Card>
    </section>
  )
}

/**
 * Overview for an open store, in the order a vendor needs it: what needs doing, how much of
 * it there is, then the plan it all runs on.
 *
 * Insights are keyed on the **user** id, not the vendor id: the path is
 * `/v1/users/{user_id}/dashboard`, and a vendor id returns 403.
 */
function OpenStoreOverview({ vendorId }: { vendorId: string }) {
  const userId = useAuthStore((s) => s.user?.id)

  return (
    <div>
      <WorkQueue vendorId={vendorId} />
      {userId ? <StatusCounts userId={userId} /> : null}
      <PlanUsage />
    </div>
  )
}

export function VendorOverviewPage() {
  const { vendorId, storeState } = useVendorAccount()

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle={storeState === 'OPEN' ? 'What needs doing right now' : 'Where your store stands'}
      />
      {/*
        The four non-open states share one screen and show nothing else. A vendor who cannot
        receive orders has no queue and no counts, and rendering empty ones would read as
        "no orders yet" rather than "your store is not open".
      */}
      {storeState === 'OPEN' ? (
        <OpenStoreOverview vendorId={vendorId} />
      ) : (
        <StoreStatusScreen state={storeState} />
      )}
    </div>
  )
}
