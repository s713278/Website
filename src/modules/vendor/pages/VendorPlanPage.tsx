import { DashboardPanel } from '@/modules/vendor/components/DashboardPanel'
import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import { formatPlanUsage } from '@/modules/vendor/lib/plan-usage'
import type { VendorPlan } from '@/modules/vendor/types/dashboard'

const USAGE_ITEMS: Array<{
  key: keyof VendorPlan['usage']
  label: string
}> = [
  { key: 'categories', label: 'Categories' },
  { key: 'products', label: 'Products' },
  { key: 'skus', label: 'Sizes' },
  { key: 'images', label: 'Images' },
]

/**
 * What the store can use, then what it is on.
 *
 * Usage leads because it is the only part of this surface that changes a vendor's day: it
 * is the answer to why a catalog add was refused. The plan's own name and status follow,
 * and nothing else does — there is no tier list, no price and no trial here, and that is
 * deliberate. `GET /v1/api/subscription-plans` answers 403 on a vendor token, pricing is
 * undecided, and the backend models no trial. See `docs/VENDOR_CONSOLE_V1_SCOPE.md`.
 */
export function VendorPlanPage() {
  const { plan } = useVendorAccount()

  return (
    <div className="grid max-w-3xl gap-4">
      <DashboardPanel title="Usage against limits">
        <dl className="grid gap-4 sm:grid-cols-2">
          {USAGE_ITEMS.map(({ key, label }) => (
            <div key={key}>
              <dt className="vc-label">{label}</dt>
              <dd className="vc-num mt-1 text-lg font-semibold text-[var(--md-ink)]">
                {formatPlanUsage(plan.usage[key], plan.limits[key])}
              </dd>
            </div>
          ))}
        </dl>
      </DashboardPanel>

      <DashboardPanel title="Your plan">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="vc-label">Plan name</dt>
            <dd className="mt-1 font-semibold text-[var(--md-ink)]">
              {plan.name ?? 'Not available'}
            </dd>
          </div>
          <div>
            <dt className="vc-label">Status</dt>
            <dd className="mt-1 font-semibold text-[var(--md-ink)]">
              {plan.status ?? 'Not available'}
            </dd>
          </div>
        </dl>
        {/* Rendered only when present, never computed from a hardcoded trial length. No
            deployed response has carried this key yet. */}
        {plan.trialEndsAt ? (
          <p className="vc-num mt-4 text-sm text-[var(--md-muted)]">
            Trial ends {new Date(plan.trialEndsAt).toLocaleDateString()}
          </p>
        ) : null}
      </DashboardPanel>
    </div>
  )
}
