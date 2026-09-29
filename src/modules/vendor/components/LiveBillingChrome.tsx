import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BillingStateBanner } from '@/modules/vendor/components/BillingStateBanner'
import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import { liveBillingWording, type LiveBillingWording } from '@/modules/vendor/lib/live-billing-wording'
import { readLiveBilling, useLiveBilling } from '@/modules/vendor/store/live-billing'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Button } from '@/shared/components/ui'

/*
  The Live API billing banner and header button. Messaging only: both read the billing read Plan
  shares and link to Plan, which is the one place Checkout opens.
*/

/**
 * The shared read's wording, or `null` while the first read loads or after it fails. The chrome
 * starts the read when none is loaded; a read already in flight, such as Plan's, is joined.
 */
function useLiveBillingChrome(): LiveBillingWording | null {
  const { vendorId } = useVendorAccount()
  // A new session clears the shared read, even for the same vendor, so the chrome reads again.
  const sessionUser = useAuthStore((state) => state.user)
  const { view, error } = useLiveBilling(vendorId)
  const loaded = view !== null || error !== null

  // The shared read drops a response for a previous vendor or session, so there is nothing to cancel here.
  useEffect(() => {
    if (!loaded) void readLiveBilling(vendorId)
  }, [vendorId, sessionUser, loaded])

  return view ? liveBillingWording(view) : null
}

/**
 * The state's banner under the console's top bar. `planBanner` shows instead only once the read
 * has landed with no billing banner to show.
 */
export function LiveShellBanner({ planBanner }: { planBanner: ReactNode }) {
  const wording = useLiveBillingChrome()
  if (!wording) return null
  return wording.banner ? <BillingStateBanner banner={wording.banner} className="mx-[var(--vc-gutter)] mt-4" /> : planBanner
}

/** The top bar's Plan button, labelled for the state: "Pay ₹299", "Keep open · ₹299" or "Shop plan". */
export function LiveHeaderButton() {
  const label = useLiveBillingChrome()?.header ?? 'Shop plan'
  return (
    <Link to="/vendor/plan">
      <Button size="sm" variant={label === 'Shop plan' ? 'outline' : 'primary'} className="rounded-full">
        {label}
      </Button>
    </Link>
  )
}
