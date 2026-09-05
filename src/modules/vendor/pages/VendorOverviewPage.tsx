import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import { presentStoreState, setupProgress } from '@/modules/vendor/lib/store-state'
import type { VendorInsights } from '@/modules/vendor/types/dashboard'
import { getErrorMessage, vendorService } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Button, Card, PageHeader, Spinner } from '@/shared/components'
import { formatCurrency } from '@/shared/lib/utils'

/** A figure with an honest empty phrasing, because zero is the normal state for a new store. */
function Tile({
  label,
  value,
  empty,
  hint,
}: {
  label: string
  value: string | null
  empty: string
  hint?: string
}) {
  return (
    <Card>
      <p className="text-sm text-[var(--md-muted)]">{label}</p>
      {value ? (
        <p className="font-display mt-2 text-3xl font-bold">{value}</p>
      ) : (
        <p className="mt-2 text-sm text-slate-500">{empty}</p>
      )}
      {hint ? <p className="mt-2 text-xs text-[var(--md-muted)]">{hint}</p> : null}
    </Card>
  )
}

/** What the store's state means, and the one action that follows from it. */
function StoreStateCard() {
  const { storeState, context } = useVendorAccount()
  const presentation = presentStoreState(storeState)
  const progress = setupProgress(context.onboarding.nextStep)

  return (
    <Card className="mb-6">
      <h2 className="font-display font-semibold">{presentation.label}</h2>
      <p className="mt-1 text-sm text-[var(--md-muted)]">{presentation.description}</p>

      {storeState === 'SETTING_UP' ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link to="/onboarding">
            <Button size="sm">Continue setup</Button>
          </Link>
          {progress ? (
            <span className="text-sm text-[var(--md-muted)]">
              Step {progress.step} of {progress.total}
            </span>
          ) : null}
        </div>
      ) : null}

      {storeState === 'OPEN' ? (
        <div className="mt-4">
          <Link to="/vendor/storefront">
            <Button size="sm" variant="secondary">
              View your storefront
            </Button>
          </Link>
        </div>
      ) : null}
    </Card>
  )
}

export function VendorOverviewPage() {
  // Insights are keyed on the user id, not the vendor id: the path is
  // `/v1/users/{user_id}/dashboard`, and a vendor id returns 403.
  const userId = useAuthStore((s) => s.user?.id)
  const { plan } = useVendorAccount()
  const [insights, setInsights] = useState<VendorInsights | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    setLoading(true)

    void vendorService
      .getInsights(userId)
      .then((data) => {
        if (!cancelled) setInsights(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load your figures'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [userId])

  const openOrders =
    (insights?.ordersByStatus.PENDING ?? 0) +
    (insights?.ordersByStatus.SCHEDULED ?? 0) +
    (insights?.ordersByStatus.IN_PROCESS ?? 0)
  const delivered = insights?.ordersByStatus.DELIVERED ?? 0

  const products = plan.usage.products
  const productLimit = plan.limits.products
  const sizes = plan.usage.skus
  const sizeLimit = plan.limits.skus

  return (
    <div>
      <PageHeader title="Overview" subtitle="How your store is doing right now" />
      <StoreStateCard />

      {error ? <p className="mb-4 text-sm text-[var(--md-danger)]">{error}</p> : null}
      {loading ? <Spinner label="Loading your figures…" /> : null}

      {!loading && insights ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Tile
            label="Orders to handle"
            value={openOrders > 0 ? String(openOrders) : null}
            empty="Nothing waiting"
            hint={delivered > 0 ? `${delivered} delivered so far` : undefined}
          />
          <Tile
            label="Customers"
            value={insights.totalCustomers ? String(insights.totalCustomers) : null}
            empty="No customers yet"
          />
          {/*
            Cumulative, not a period figure: no date-scoped revenue aggregate exists in the
            contract, so this must never be labelled "today".
          */}
          <Tile
            label="Payments due"
            value={insights.dueAmount ? formatCurrency(insights.dueAmount) : null}
            empty="Nothing outstanding"
            hint={
              insights.paidAmount
                ? `${formatCurrency(insights.paidAmount)} collected in total`
                : undefined
            }
          />
          <Tile
            label="Catalog"
            value={products ? `${products}${productLimit ? ` / ${productLimit}` : ''}` : null}
            empty="Nothing listed yet"
            hint={
              sizes != null && sizeLimit != null
                ? `${sizes} of ${sizeLimit} sizes used on your plan`
                : undefined
            }
          />
        </div>
      ) : null}
    </div>
  )
}
