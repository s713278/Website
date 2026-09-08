import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import { formatPlanUsage } from '@/modules/vendor/lib/plan-usage'
import type { VendorPlan } from '@/modules/vendor/types/dashboard'
import { Card, PageHeader } from '@/shared/components'

const USAGE_ITEMS: Array<{
  key: keyof VendorPlan['usage']
  label: string
}> = [
  { key: 'categories', label: 'Categories' },
  { key: 'products', label: 'Products' },
  { key: 'skus', label: 'Sizes' },
  { key: 'images', label: 'Images' },
]

export function VendorPlanPage() {
  const { plan } = useVendorAccount()

  return (
    <div>
      <PageHeader title="Plan" subtitle="What your store can use" />

      <section aria-labelledby="plan-usage-heading">
        <h2 id="plan-usage-heading" className="font-display mb-4 text-lg font-semibold">
          Usage against limits
        </h2>
        <Card className="max-w-3xl p-5">
          <dl className="grid gap-5 sm:grid-cols-2">
            {USAGE_ITEMS.map(({ key, label }) => (
              <div key={key}>
                <dt className="text-sm text-[var(--md-muted)]">{label}</dt>
                <dd className="vc-num mt-1 text-lg font-semibold text-[var(--md-ink)]">
                  {formatPlanUsage(plan.usage[key], plan.limits[key])}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      </section>

      <section className="mt-8" aria-labelledby="plan-details-heading">
        <h2 id="plan-details-heading" className="font-display mb-4 text-lg font-semibold">
          Your plan
        </h2>
        <Card className="max-w-3xl p-5">
          <dl className="grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-[var(--md-muted)]">Plan name</dt>
              <dd className="mt-1 font-semibold text-[var(--md-ink)]">
                {plan.name ?? 'Not available'}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--md-muted)]">Status</dt>
              <dd className="mt-1 font-semibold text-[var(--md-ink)]">
                {plan.status ?? 'Not available'}
              </dd>
            </div>
          </dl>
          {plan.trialEndsAt ? (
            <p className="vc-num mt-5 text-sm text-[var(--md-muted)]">
              Trial ends {new Date(plan.trialEndsAt).toLocaleDateString()}
            </p>
          ) : null}
        </Card>
      </section>
    </div>
  )
}
