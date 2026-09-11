import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { DashboardPanel } from '@/modules/vendor/components/DashboardPanel'
import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import type { VendorStoreProfile } from '@/modules/vendor/types/dashboard'
import { getErrorMessage, vendorService } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Button, Spinner } from '@/shared/components'

/**
 * One detail, as term and value.
 *
 * A fixed 8rem term column, from `design-reference/dashboard.css` — `.dash-settings`.
 * Spread across the full width of the console with `justify-between`, "Store name" and
 * "My Store" end up a canyon apart and the eye has to travel the whole line to pair them.
 * The pair reads at a glance when every value starts on the same vertical.
 *
 * Below `sm` the two stack, because 8rem of term beside a wrapping address is neither.
 */
function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-0.5 border-b border-[var(--vc-rule)] pb-2.5 last:border-0 last:pb-0 sm:grid-cols-[8rem_1fr] sm:gap-2">
      <dt className="vc-label sm:pt-0.5">{label}</dt>
      <dd className="vc-num min-w-0 text-sm font-semibold">{value ?? 'Not set'}</dd>
    </div>
  )
}

/**
 * Store details, read-only.
 *
 * Read-only because the editor is not built yet, **not** because the backend refuses.
 * `PUT /v1/vendors/{id}` was verified working on both a gone-live and a never-submitted
 * store, for the business name, contact fields and the structured address.
 *
 * When it does get built, two measured behaviors constrain it: the write is a partial merge
 * that silently ignores `null`, so no field can be cleared, and `assign_categories` need
 * not be echoed despite being declared required.
 *
 * Until then the panel's one control sends the vendor to the wizard that *can* change these
 * — the same "Edit setup" the shared design puts here.
 */
function StoreSettings({ profile, planName }: { profile: VendorStoreProfile; planName: string }) {
  return (
    <DashboardPanel
      title="Store settings"
      action={
        <Link to="/onboarding">
          <Button size="sm" variant="outline" className="rounded-full">
            Edit setup
          </Button>
        </Link>
      }
    >
      <dl className="grid gap-2.5">
        <Row label="Store name" value={profile.businessName} />
        <Row label="What you sell" value={profile.businessType} />
        <Row label="Description" value={profile.description} />
        <Row label="Owner" value={profile.ownerName} />
        <Row label="Contact" value={profile.contactPerson} />
        <Row label="Phone" value={profile.contactNumber} />
        <Row label="Email" value={profile.email} />
        <Row label="Address" value={profile.address} />
        <Row label="Plan" value={planName} />
      </dl>
      {/*
        The previous copy told vendors the backend had no working update and to contact
        support. It does have one. Say only what is true: editing is not built here yet.
      */}
      <p className="mt-4 text-xs text-[var(--md-muted)]">
        Changes made in setup show up here. Editing them on this screen is coming.
      </p>
    </DashboardPanel>
  )
}

/**
 * Who is signed in, and the way out.
 *
 * Log out lives here rather than in a header menu, following the shared design. That trades
 * one tap for a screen that can say what logging out actually does — which matters on a
 * shared counter device, where the vendor's real question is whether their catalog goes
 * with them.
 */
function AccountPanel() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  // `role` is the wire enum, which is lower case. It is a label here, not a value.
  const role = user?.role ? user.role[0].toUpperCase() + user.role.slice(1) : null

  return (
    <DashboardPanel
      title="Account"
      action={
        <span className="rounded-full border border-[var(--vc-tint-line)] bg-[var(--vc-tint)] px-2.5 py-0.5 text-[0.7rem] font-bold tracking-wide uppercase text-[var(--vc-tint-ink)]">
          {role ?? 'Signed in'}
        </span>
      }
    >
      <dl className="grid gap-2.5">
        <Row label="Signed in" value={user?.phone ?? user?.email ?? user?.name ?? 'Not set'} />
        <Row label="Role" value={role ?? 'Not set'} />
      </dl>

      <p className="mt-4 max-w-[68ch] text-xs text-[var(--md-muted)]">
        Logging out ends this session on this device only. Your store and catalog stay exactly
        as they are.
      </p>

      <Button
        variant="outline"
        className="mt-3.5 w-full max-w-64 rounded-full border-red-200 text-[var(--md-danger)] hover:border-red-400 hover:bg-red-50 hover:text-red-800"
        onClick={() => void logout()}
      >
        Log out
      </Button>
    </DashboardPanel>
  )
}

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
    <div className="grid max-w-3xl gap-4">
      {error ? <p className="max-w-[68ch] text-sm text-[var(--md-danger)]">{error}</p> : null}
      {loading ? <Spinner label="Loading your details…" /> : null}

      {!loading && profile ? (
        <StoreSettings profile={profile} planName={plan.name ?? plan.code ?? 'Not set'} />
      ) : null}

      {/*
        Rendered whatever happens to the store read. A vendor who cannot load their details
        must still be able to sign out — that is often exactly why they came here.
      */}
      <AccountPanel />
    </div>
  )
}
