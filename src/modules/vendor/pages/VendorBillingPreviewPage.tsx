import { useState } from 'react'
import { Link } from 'react-router-dom'
import { VendorBillingPanel } from '@/modules/vendor/components/VendorBillingPanel'
import { createVendorBillingPreviewService, type BillingPreviewConfig, type BillingPreviewScenario } from '@/shared/api'
import { Badge, Button, Card, Input } from '@/shared/components/ui'

const scenarios: Array<{ value: BillingPreviewScenario; label: string }> = [
  { value: 'trial', label: 'Option A · Free trial, 3 days remaining' },
  { value: 'last_day', label: 'Option A · Last day of trial' },
  { value: 'expired', label: 'Option A · Trial ended, payment required' },
  { value: 'setup', label: 'Option B · AutoPay setup required' },
  { value: 'authorised_trial', label: 'Option B · Backend-confirmed trial (fixture)' },
  { value: 'paid', label: 'Backend-confirmed paid membership (fixture)' },
]

export function VendorBillingPreviewPage() {
  const [config, setConfig] = useState<BillingPreviewConfig>({
    keyId: import.meta.env.VITE_RAZORPAY_TEST_KEY_ID ?? '',
    immediateSubscriptionId: import.meta.env.VITE_RAZORPAY_TEST_SUBSCRIPTION_ID ?? '',
    futureSubscriptionId: import.meta.env.VITE_RAZORPAY_TEST_FUTURE_SUBSCRIPTION_ID ?? '',
  })
  const [scenario, setScenario] = useState<BillingPreviewScenario>('trial')
  const [preview, setPreview] = useState(() => ({
    revision: 0,
    service: createVendorBillingPreviewService(config, scenario),
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
          <p className="mt-3 text-sm text-muted-foreground">This page opens real Test Mode Checkout. Billing and access below are development examples; no vendor account or production access is changed. Neither trial policy is approved.</p>
        </header>

        <Card className="gap-4 p-6">
          <h2 className="font-display text-lg font-semibold">Test configuration</h2>
          <p className="text-sm text-muted-foreground">Use a Test Mode public key and an unconsumed subscription from the same Razorpay account, on the ₹299 INR monthly plan. Razorpay controls the actual amount and schedule. This preview cannot verify them or create subscriptions.</p>
          <form className="grid gap-4" onSubmit={(event) => {
            event.preventDefault()
            setPreview((current) => ({ revision: current.revision + 1, service: createVendorBillingPreviewService(config, scenario) }))
          }}>
            <Input label="Test Mode public key ID" placeholder="rzp_test_…" value={config.keyId} autoComplete="off" onChange={(event) => setConfig({ ...config, keyId: event.target.value.trim() })} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Immediate-start test subscription ID" placeholder="sub_…" value={config.immediateSubscriptionId} autoComplete="off" onChange={(event) => setConfig({ ...config, immediateSubscriptionId: event.target.value.trim() })} />
              <Input label="Future-start test subscription ID (Option B)" placeholder="sub_…" value={config.futureSubscriptionId} autoComplete="off" onChange={(event) => setConfig({ ...config, futureSubscriptionId: event.target.value.trim() })} />
            </div>
            <p className="text-xs text-muted-foreground">Never enter an API key secret. For Option B, the subscription must already have the intended billing date; selecting a scenario does not change Razorpay's schedule. Callback values are kept in memory only.</p>
            <label className="grid gap-2 text-sm font-medium">
              Presentation scenario
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={scenario} onChange={(event) => {
                const selected = scenarios.find((item) => item.value === event.target.value)
                if (selected) setScenario(selected.value)
              }}>
                {scenarios.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <Button className="w-fit" variant="outline" type="submit">Apply configuration and reset preview</Button>
          </form>
          <p className="text-xs text-muted-foreground">Resetting or reloading clears local progress, not Razorpay state. After a callback, inspect the provider status and use a fresh subscription for another test. Confirmed scenarios are fixtures, never Checkout outcomes. The expiry dates and reminders shown are illustrative.</p>
        </Card>

        <VendorBillingPanel key={preview.revision} service={preview.service} />
      </div>
    </main>
  )
}
