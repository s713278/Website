import { useMemo, useState } from 'react'
import { createVendorBillingMockService, type BillingFixtureScenario } from '@/shared/api'
import { VendorBillingPanel } from './VendorBillingPanel'

/** DEV-only panel fixture; it never refreshes the selected account or changes API mode. */
export function VendorBillingMockOverride({ vendorId }: { vendorId: string }) {
  const [scenario, setScenario] = useState<BillingFixtureScenario>('trial_active')
  const service = useMemo(() => createVendorBillingMockService(scenario, 'mock', vendorId), [scenario, vendorId])
  return <div className="grid gap-3">
    <label className="text-sm">Sample billing phase
      <select className="ml-3 rounded-md border bg-background px-2 py-1" value={scenario} onChange={(event) => setScenario(event.target.value as BillingFixtureScenario)}>
        <option value="trial_active">Active trial</option>
        <option value="setup_confirmed">AutoPay set up during trial</option>
        <option value="paid_active">Paid membership</option>
        <option value="trial_expired">Expired trial</option>
        <option value="authorisation_failed">Failed AutoPay setup</option>
        <option value="first_fee_failed">Failed first fee</option>
        <option value="cancel_confirmed_trial">Cancelled trial AutoPay (rejoin)</option>
        <option value="authorisation_revoked">AutoPay revoked during trial</option>
        <option value="authorisation_revoked_paid">AutoPay revoked during paid coverage</option>
        <option value="schedule_completed">Finite Test schedule ended</option>
      </select>
    </label>
    <VendorBillingPanel key={`${vendorId}:${scenario}`} vendorId={vendorId} service={service} />
  </div>
}
