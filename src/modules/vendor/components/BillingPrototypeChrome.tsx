import { Link } from 'react-router-dom'
import { BillingStateBanner } from '@/modules/vendor/components/BillingStateBanner'
import { useBillingPrototypeView } from '@/modules/vendor/hooks/use-billing-prototype'
import { Button } from '@/shared/components/ui'

/*
  DEV demo only: the six-state Plan prototype outside Plan. Messaging only — each piece links to Plan,
  which is the one place Checkout opens, and nothing here hides the storefront or blocks orders.
*/

/** The state's banner under the console's top bar; Paid has none. */
export function PrototypeShellBanner() {
  const banner = useBillingPrototypeView()?.banner
  return banner ? <BillingStateBanner banner={banner} className="mx-[var(--vc-gutter)] mt-4" /> : null
}

/** The top bar's Plan button, labelled for the state: "Pay ₹299", "Keep open · ₹299" or "Shop plan". */
export function PrototypeHeaderButton() {
  const label = useBillingPrototypeView()?.header ?? 'Shop plan'
  return (
    <Link to="/vendor/plan">
      <Button size="sm" variant={label === 'Shop plan' ? 'outline' : 'primary'} className="rounded-full">
        {label}
      </Button>
    </Link>
  )
}
