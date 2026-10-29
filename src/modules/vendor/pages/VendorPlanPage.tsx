import { lazy, Suspense, useMemo } from 'react'
import { LiveVendorPlan } from '@/modules/vendor/components/LiveVendorPlan'
import { VendorBillingPanel } from '@/modules/vendor/components/VendorBillingPanel'
import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import { createVendorBillingContextService, isLiveApi, usesLiveBilling } from '@/shared/api'

/** Local development demo mode only: seeds the local Razorpay Test helper that stands in for the backend. */
const BillingTestScenarios = import.meta.env.DEV
  ? lazy(() => import('@/modules/vendor/components/BillingTestScenarios').then((module) => ({ default: module.BillingTestScenarios })))
  : null

/** Demo mode in a production build: the billing panel over the demo context. */
function DemoBillingPanel() {
  const { vendorId, refreshContext } = useVendorAccount()
  const service = useMemo(() => createVendorBillingContextService(refreshContext), [refreshContext])
  return <VendorBillingPanel key={vendorId} vendorId={vendorId} service={service} />
}

export function VendorPlanPage() {
  return (
    <div className="grid gap-4">
      {usesLiveBilling() ? <LiveVendorPlan /> : <DemoBillingPanel />}
      {!isLiveApi() && BillingTestScenarios ? <Suspense fallback={null}><BillingTestScenarios /></Suspense> : null}
    </div>
  )
}
