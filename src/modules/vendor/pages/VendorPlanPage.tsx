import { lazy, Suspense, useMemo } from 'react'
import { LiveVendorPlan } from '@/modules/vendor/components/LiveVendorPlan'
import { VendorBillingPanel } from '@/modules/vendor/components/VendorBillingPanel'
import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import { createVendorBillingContextService, isLiveApi } from '@/shared/api'

/** The six-state prototype is local development only; production demo builds keep the billing panel. */
const VendorBillingPrototype = import.meta.env.DEV
  ? lazy(() => import('@/modules/vendor/components/VendorBillingPrototype').then((module) => ({ default: module.VendorBillingPrototype })))
  : null

/** Demo mode in a production build: the billing panel over the demo context. */
function DemoBillingPanel() {
  const { vendorId, refreshContext } = useVendorAccount()
  const service = useMemo(() => createVendorBillingContextService(refreshContext), [refreshContext])
  return <VendorBillingPanel key={vendorId} vendorId={vendorId} service={service} />
}

export function VendorPlanPage() {
  return (
    <div className="grid max-w-3xl gap-4">
      {isLiveApi() ? <LiveVendorPlan /> : VendorBillingPrototype ? <Suspense fallback={<p>Loading shop plan…</p>}>
        <VendorBillingPrototype />
      </Suspense> : <DemoBillingPanel />}
    </div>
  )
}
