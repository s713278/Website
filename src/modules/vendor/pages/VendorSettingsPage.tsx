import { useEffect, useState } from 'react'
import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import type { VendorStoreProfile } from '@/modules/vendor/types/dashboard'
import { getErrorMessage, vendorService } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Button, Card, PageHeader, Spinner } from '@/shared/components'
import { formatCurrency } from '@/shared/lib/utils'

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-[var(--md-border)] py-2 first:border-0">
      <dt className="text-sm text-[var(--md-muted)]">{label}</dt>
      <dd className="text-sm font-medium">{value ?? 'Not set'}</dd>
    </div>
  )
}

/**
 * Store details and account controls.
 *
 * Read-only, and not by choice: `PUT /v1/vendors/{id}` is the only write covering these
 * fields and it fails with a JPA transaction error for every body shape — including one
 * that echoes the record back unchanged. Recorded in `docs/API_GAPS.md`. Business type
 * and branding do have working writes, through their setup steps.
 */
export function VendorSettingsPage() {
  const { vendorId, plan } = useVendorAccount()
  const logout = useAuthStore((s) => s.logout)
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
      {error ? <p className="mb-4 text-sm text-[var(--md-danger)]">{error}</p> : null}
      {loading ? <Spinner label="Loading your details…" /> : null}

      {!loading && profile ? (
        <Card className="mb-4">
          <h2 className="font-display mb-3 font-semibold">Store details</h2>
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
          <p className="mt-3 text-xs text-[var(--md-muted)]">
            These details cannot be changed from here yet — the backend has no working update for
            them. Contact support if something is wrong.
          </p>
        </Card>
      ) : null}

      <Card className="mb-4">
        <h2 className="font-display mb-3 font-semibold">Your plan</h2>
        <dl>
          <Row label="Plan" value={plan.name ?? plan.tier} />
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

      <Card>
        <h2 className="font-display mb-3 font-semibold">Account</h2>
        <Button variant="secondary" onClick={() => void logout()}>
          Log out
        </Button>
      </Card>
    </div>
  )
}
