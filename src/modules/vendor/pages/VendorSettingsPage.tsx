import { useEffect, useState } from 'react'
import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import type { VendorStoreProfile } from '@/modules/vendor/types/dashboard'
import { getErrorMessage, vendorService } from '@/shared/api'
import { Card, PageHeader, Spinner } from '@/shared/components'
import { formatCurrency } from '@/shared/lib/utils'

/**
 * One detail, as label and value.
 *
 * A fixed label column rather than `justify-between`: spread across the full width of the
 * console, "Store name" and "My Store" end up a canyon apart and the eye has to travel the
 * whole line to pair them. The pair reads at a glance when the value starts where every
 * other value starts.
 */
function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-0.5 border-t border-[var(--vc-rule)] py-2.5 first:border-0 first:pt-0">
      <dt className="w-40 shrink-0 text-sm text-[var(--md-muted)]">{label}</dt>
      <dd className="vc-num min-w-0 text-sm font-medium">{value ?? 'Not set'}</dd>
    </div>
  )
}

/**
 * Store details and account controls.
 *
 * Read-only because the editor is not built yet, **not** because the backend refuses.
 * `PUT /v1/vendors/{id}` was verified working on both a gone-live and a never-submitted
 * store, for the business name, contact fields and the structured address. See
 * `docs/VENDOR_CONSOLE_BACKEND_ASKS.md` §1.4.
 *
 * When it does, two measured behaviors constrain it: the write is a partial merge that
 * silently ignores `null`, so no field can be cleared, and `assign_categories` need not be
 * echoed despite being declared required.
 *
 * Log out is **not** here. It lives in the account menu on the shell header, reachable from
 * every surface — leaving required loading a settings screen the vendor did not want.
 */
export function VendorSettingsPage() {
  const { vendorId, plan } = useVendorAccount()
  const [profile, setProfile] = useState<VendorStoreProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    void vendorService
      .getStoreProfile(vendorId)
      .then((data) => {
        if (!cancelled) setProfile(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load your store details'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [vendorId])

  return (
    <div>
      <PageHeader title="Settings" subtitle="Your store details and account" />
      {error ? <p className="mb-6 max-w-[68ch] text-sm text-[var(--md-danger)]">{error}</p> : null}
      {loading ? <Spinner label="Loading your details…" /> : null}

      {!loading && profile ? (
        <Card className="mb-6 max-w-2xl p-5">
          <h2 className="font-display mb-4 font-semibold">Store details</h2>
          <dl>
            <Row label="Store name" value={profile.businessName} />
            <Row label="What you sell" value={profile.businessType} />
            <Row label="Description" value={profile.description} />
            <Row label="Owner" value={profile.ownerName} />
            <Row label="Contact person" value={profile.contactPerson} />
            <Row label="Phone" value={profile.contactNumber} />
            <Row label="Email" value={profile.email} />
            <Row label="Address" value={profile.address} />
          </dl>
          {/*
            The previous copy told vendors the backend had no working update and to contact
            support. It does have one. Say only what is true: editing is not built here yet.
          */}
          <p className="mt-4 text-xs text-[var(--md-muted)]">
            Editing these details from here is coming soon.
          </p>
        </Card>
      ) : null}

      <Card className="max-w-2xl p-5">
        <h2 className="font-display mb-4 font-semibold">Your plan</h2>
        <dl>
          <Row label="Plan" value={plan.name ?? plan.code} />
          <Row
            label="Monthly price"
            value={plan.monthlyPrice != null ? formatCurrency(plan.monthlyPrice) : null}
          />
          <Row
            label="Categories"
            value={
              plan.usage.categories != null && plan.limits.categories != null
                ? `${plan.usage.categories} of ${plan.limits.categories}`
                : null
            }
          />
          <Row
            label="Products"
            value={
              plan.usage.products != null && plan.limits.products != null
                ? `${plan.usage.products} of ${plan.limits.products}`
                : null
            }
          />
          <Row
            label="Sizes"
            value={
              plan.usage.skus != null && plan.limits.skus != null
                ? `${plan.usage.skus} of ${plan.limits.skus}`
                : null
            }
          />
        </dl>
      </Card>
    </div>
  )
}
