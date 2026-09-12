import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { OrdersSectionTabs } from '@/modules/vendor/components/OrdersSectionTabs'
import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import {
  readSubscriptionsQuery,
  SUBSCRIPTION_STATUS_FILTERS,
  writeSubscriptionsQuery,
  type SubscriptionFilterStatus,
} from '@/modules/vendor/lib/subscription-filters'
import { vendorFilterChipClass } from '@/modules/vendor/lib/filter-chip'
import type {
  SubscriptionStatus,
  VendorSubscriptionPage,
} from '@/modules/vendor/types/dashboard'
import { getErrorMessage, vendorSubscriptionsService } from '@/shared/api'
import { DashboardPanel } from '@/modules/vendor/components/DashboardPanel'
import { Badge, Button, Spinner } from '@/shared/components'

function titleCaseToken(value: string | null): string {
  if (!value) return 'Not available'
  const words = value.toLowerCase().replaceAll('_', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function statusPresentation(status: SubscriptionStatus | null) {
  switch (status) {
    case 'ACTIVE':
      return { label: 'Active', tone: 'success' as const }
    case 'PENDING':
      return { label: 'Pending', tone: 'warning' as const }
    case 'DELETED':
      return { label: 'Deleted', tone: 'danger' as const }
    case 'PAUSED':
      return { label: 'Paused', tone: 'warning' as const }
    case 'CANCELLED':
      return { label: 'Cancelled', tone: 'neutral' as const }
    case 'EXPIRED':
      return { label: 'Expired', tone: 'neutral' as const }
    default:
      return { label: 'Status not available', tone: 'neutral' as const }
  }
}

export function VendorSubscriptionsPage() {
  const { vendorId } = useVendorAccount()
  const [searchParams, setSearchParams] = useSearchParams()
  const query = useMemo(() => readSubscriptionsQuery(searchParams), [searchParams])
  const { status, page } = query

  const [result, setResult] = useState<VendorSubscriptionPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  function filterBy(nextStatus: SubscriptionFilterStatus | null) {
    setSearchParams(writeSubscriptionsQuery({ status: nextStatus, page: 0 }), { replace: true })
  }

  function goToPage(nextPage: number) {
    setSearchParams(
      writeSubscriptionsQuery({ ...query, page: Math.max(0, nextPage) }),
      { replace: true },
    )
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')

    void vendorSubscriptionsService
      .list(vendorId, { page, status })
      .then((data) => {
        if (!cancelled) setResult(data)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setResult(null)
        setLoadError(getErrorMessage(error, 'Could not load subscriptions'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [vendorId, page, status, reloadToken])

  const subscriptions = result?.subscriptions ?? []

  return (
    <div className="grid gap-4">
      <OrdersSectionTabs />

      <DashboardPanel
        title="All subscriptions"
        action={
          <p className="text-xs text-[var(--md-muted)]">Read-only</p>
        }
      >
        <div
          role="group"
          aria-label="Subscription status"
          className="mb-4 flex flex-wrap items-center gap-1.5"
        >
          <span className="vc-label mr-1">Status</span>
          <button
            type="button"
            onClick={() => filterBy(null)}
            className={vendorFilterChipClass(status === null)}
          >
            All
          </button>
          {SUBSCRIPTION_STATUS_FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => filterBy(value)}
              className={vendorFilterChipClass(status === value)}
            >
              {titleCaseToken(value)}
            </button>
          ))}
        </div>

      {loading ? <Spinner label="Loading subscriptions…" /> : null}

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

      {!loading && !loadError && !subscriptions.length ? (
        <p className="px-4 py-8 text-center text-sm text-[var(--md-muted)]">
          <span className="mb-1 block font-semibold text-[var(--md-ink)]">
            No subscriptions yet
          </span>
          {status
            ? 'Nothing matches this status. Clear the filter to see every subscription.'
            : 'Customer subscriptions will show up here when they are created.'}
        </p>
      ) : null}

      {!loading && !loadError && subscriptions.length ? (
        <div className="vc-rows">
          {subscriptions.map((subscription) => {
            const presentation = statusPresentation(subscription.status)
            return (
              <article
                key={subscription.id}
                className="grid gap-x-8 gap-y-4 px-2 py-4 sm:grid-cols-[minmax(0,1.35fr)_minmax(12rem,1fr)_minmax(12rem,1fr)]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="vc-num font-semibold">Subscription #{subscription.id}</p>
                    <Badge tone={presentation.tone}>{presentation.label}</Badge>
                  </div>
                  <p className="mt-1.5 font-medium">
                    {subscription.skuName ?? 'Size not available'}
                  </p>
                  <p className="vc-num mt-1 text-sm text-[var(--md-muted)]">
                    {subscription.mobile ?? 'Mobile not available'}
                  </p>
                  <p className="vc-num mt-0.5 text-xs text-[var(--md-muted)]">
                    Customer #{subscription.customerId ?? 'not available'}
                  </p>
                </div>

                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--md-muted)]">Quantity</dt>
                    <dd className="vc-num font-medium">{subscription.quantity ?? 'Not available'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--md-muted)]">Frequency</dt>
                    <dd>{titleCaseToken(subscription.frequency)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--md-muted)]">Delivery</dt>
                    <dd>{titleCaseToken(subscription.deliveryMode)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--md-muted)]">Payment</dt>
                    <dd>{titleCaseToken(subscription.paymentType)}</dd>
                  </div>
                </dl>

                <dl className="space-y-1.5 text-sm sm:text-right">
                  <div>
                    <dt className="text-[var(--md-muted)]">Start date</dt>
                    <dd className="vc-num">{subscription.startDate ?? 'Not available'}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--md-muted)]">Next delivery</dt>
                    <dd className="vc-num">{subscription.nextDelivery ?? 'Not available'}</dd>
                  </div>
                </dl>
              </article>
            )
          })}
        </div>
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
