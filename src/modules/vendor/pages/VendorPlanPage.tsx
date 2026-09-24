import { lazy, Suspense, useMemo, useState } from 'react'
import { VendorBillingPanel } from '@/modules/vendor/components/VendorBillingPanel'
import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import { createVendorBillingContextService, isLiveApi } from '@/shared/api'
import { Button } from '@/shared/components/ui'

const VendorBillingMockOverride = import.meta.env.DEV
  ? lazy(() => import('@/modules/vendor/components/VendorBillingMockOverride').then((module) => ({ default: module.VendorBillingMockOverride })))
  : null
const VendorBillingLocalTest = import.meta.env.DEV
  ? lazy(() => import('@/modules/vendor/components/VendorBillingLocalTest').then((module) => ({ default: module.VendorBillingLocalTest })))
  : null

export function VendorPlanPage() {
  const { vendorId, refreshContext } = useVendorAccount()
  const [mockOverride, setMockOverride] = useState(false)
  const [testVendorId, setTestVendorId] = useState<string | null>(() => import.meta.env.DEV ? localStorage.getItem('md-local-billing-test-vendor') : null)
  const testSelected = testVendorId === vendorId
  const source = isLiveApi() ? 'backend' : 'demo'
  const service = useMemo(() => createVendorBillingContextService(source, refreshContext), [source, refreshContext])

  return (
    <div className="grid max-w-3xl gap-4">
      {VendorBillingLocalTest ? <Button className="w-fit" variant="outline" onClick={() => {
        setMockOverride(false)
        if (testSelected) { localStorage.removeItem('md-local-billing-test-vendor'); setTestVendorId(null) }
        else { localStorage.setItem('md-local-billing-test-vendor', vendorId); setTestVendorId(vendorId) }
      }}>{testSelected ? 'Return to ordinary billing' : 'Use local Razorpay Test Mode'}</Button> : null}
      {!testSelected && VendorBillingMockOverride ? <Button className="w-fit" variant="outline" onClick={() => setMockOverride((value) => !value)}>
        {mockOverride ? 'Return to account billing' : 'Show a sample billing status'}
      </Button> : null}
      {testSelected && VendorBillingLocalTest ? <Suspense fallback={<p>Loading local Test billing…</p>}>
        <VendorBillingLocalTest key={vendorId} vendorId={vendorId} />
      </Suspense> : mockOverride && VendorBillingMockOverride ? <Suspense fallback={<p>Loading sample billing…</p>}>
        <VendorBillingMockOverride key={vendorId} vendorId={vendorId} />
      </Suspense> : <VendorBillingPanel key={vendorId} vendorId={vendorId} service={service} />}
    </div>
  )
}
