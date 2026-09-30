import { useState } from 'react'
import { Link } from 'react-router-dom'
import { VendorBillingPanel } from '@/modules/vendor/components/VendorBillingPanel'
import { billingFixtureVendorId, createVendorBillingPreviewService, type BillingPreviewConfig, type BillingPreviewScenario } from '@/shared/api'
import { Badge, Button, Card, Input } from '@/shared/components/ui'

const scenarios: Array<{ value: BillingPreviewScenario; label: string }> = [
  { value: 'trial_start', label: 'Trial starts after approval · fixture' },
  { value: 'trial_active', label: 'Trial active · 10 days remaining · fixture' },
  { value: 'trial_three_days', label: 'Trial notice · three days · fixture' },
  { value: 'trial_last_day', label: 'Trial notice · last day · fixture' },
  { value: 'setup_pending', label: 'AutoPay confirmation pending · fixture' },
  { value: 'setup_confirmed', label: 'AutoPay confirmed, trial retained · fixture' },
  { value: 'trial_expired', label: 'Trial expired · fixture' },
  { value: 'trial_ineligible', label: 'Identity ineligible for a new trial · fixture' },
  { value: 'setup_incomplete', label: 'Onboarding incomplete · fixture' },
  { value: 'approval_pending', label: 'Approval pending · fixture' },
  { value: 'paid_after_expiry', label: 'Paid after expiry · fixture' },
]

export function VendorBillingPreviewPage() {
  const [config, setConfig] = useState<BillingPreviewConfig>({
    keyId: import.meta.env.VITE_RAZORPAY_TEST_KEY_ID ?? '',
    immediateSubscriptionId: import.meta.env.VITE_RAZORPAY_TEST_SUBSCRIPTION_ID ?? '',
    futureSubscriptionId: import.meta.env.VITE_RAZORPAY_TEST_FUTURE_SUBSCRIPTION_ID ?? '',
    futureStartAt: '',
  })
  const [scenario, setScenario] = useState<BillingPreviewScenario>('trial_active')
  const [preview, setPreview] = useState(() => ({
    revision: 0,
    scenario: 'trial_active' as BillingPreviewScenario,
    service: createVendorBillingPreviewService(config, 'trial_active'),
  }))

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8 sm:px-8">
      <div className="mx-auto grid max-w-4xl gap-6">
        <header>
          <Link to="/" className="text-sm font-medium text-primary">MithraDirect</Link>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold">Vendor billing preview</h1>
            <Badge tone="warning">Development · Razorpay Test Mode</Badge>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">The trial and billing statuses on this page are simulated examples. A configured Razorpay Test Checkout may return an unverified callback; it cannot grant platform access or verify a payment.</p>
        </header>

        <Card className="gap-4 p-6">
          <h2 className="font-display text-lg font-semibold">Test configuration</h2>
          <p className="text-sm text-muted-foreground">Use a Test Mode public key and fresh subscriptions from the same Razorpay account. The provider controls the actual amount and schedule. Check each subscription in the Test Dashboard before using it.</p>
          <form className="grid gap-4" onSubmit={(event) => {
            event.preventDefault()
            setPreview((current) => ({ revision: current.revision + 1, scenario, service: createVendorBillingPreviewService(config, scenario) }))
          }}>
            <Input label="Test Mode public key ID" placeholder="rzp_test_…" value={config.keyId} autoComplete="off" onChange={(event) => setConfig({ ...config, keyId: event.target.value.trim() })} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Immediate-start test subscription ID" placeholder="sub_…" value={config.immediateSubscriptionId} autoComplete="off" onChange={(event) => setConfig({ ...config, immediateSubscriptionId: event.target.value.trim() })} />
              <Input label="Future-start test subscription ID" placeholder="sub_…" value={config.futureSubscriptionId} autoComplete="off" onChange={(event) => setConfig({ ...config, futureSubscriptionId: event.target.value.trim() })} />
            </div>
            <Input label="Inspected future-start date (ISO with timezone)" placeholder="2026-10-15T10:00:00Z" value={config.futureStartAt ?? ''} autoComplete="off" onChange={(event) => setConfig({ ...config, futureStartAt: event.target.value.trim() })} />
            <p className="text-xs text-muted-foreground">During a trial, real Test Checkout opens only when the inspected future-start date matches the fixture trial expiry. Otherwise Pay Now stays simulated. A scenario choice never changes a Razorpay subscription. Never enter an API key secret.</p>
            <label className="grid gap-2 text-sm font-medium">
              Fixture scenario
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={scenario} onChange={(event) => {
                const selected = scenarios.find((item) => item.value === event.target.value)
                if (selected) setScenario(selected.value)
              }}>
                {scenarios.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <Button className="w-fit" variant="outline" type="submit">Apply configuration and reset preview</Button>
          </form>
          <p className="text-xs text-muted-foreground">Reset changes local fixture state only; it is not Plan's provider-safe Reset Test scenario and cancels nothing at Razorpay. After a real callback, inspect the provider status and use a fresh subscription for another attempt. A confirmed fixture is a simulation, not verification of a Test Checkout result.</p>
        </Card>

        <VendorBillingPanel key={preview.revision} vendorId={billingFixtureVendorId(preview.scenario)} service={preview.service} />
      </div>
    </main>
  )
}
