import { lazy, Suspense, useMemo } from 'react'
import { VendorBillingPanel } from '@/modules/vendor/components/VendorBillingPanel'
import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import { createVendorBillingContextService, isLiveApi } from '@/shared/api'

/** The six-state prototype is local development only; production demo builds keep the billing panel. */
const VendorBillingPrototype = import.meta.env.DEV
  ? lazy(() => import('@/modules/vendor/components/VendorBillingPrototype').then((module) => ({ default: module.VendorBillingPrototype })))
  : null

export function VendorPlanPage() {
  const { vendorId, refreshContext } = useVendorAccount()
  const source = isLiveApi() ? 'backend' : 'demo'
  const service = useMemo(() => createVendorBillingContextService(source, refreshContext), [source, refreshContext])

  return (
    <div className="grid max-w-3xl gap-4">
      {source === 'demo' && VendorBillingPrototype ? <Suspense fallback={<p>Loading shop plan…</p>}>
        <VendorBillingPrototype />
      </Suspense> : <VendorBillingPanel key={vendorId} vendorId={vendorId} service={service} />}
    </div>
  )
}
