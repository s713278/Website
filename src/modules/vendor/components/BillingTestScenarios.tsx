import { useEffect, useState } from 'react'
import { vendorFilterChipClass } from '@/modules/vendor/lib/filter-chip'
import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import { readLiveBilling, resetLiveBilling } from '@/modules/vendor/store/live-billing'
import {
  deliverLocalSimulatedPayment,
  getErrorMessage,
  getLocalBillingSimulation,
  installLocalSimulatedCheckout,
  localBillingScenarios,
  selectLocalBillingScenario,
  selectLocalBillingSimulation,
  type LocalBillingOutcome,
  type LocalBillingScenario,
  type LocalBillingSimulation,
} from '@/shared/api'
import { Card } from '@/shared/components/ui'

const labels: Record<LocalBillingScenario, string> = {
  free_days: 'Free days',
  three_days_left: '3 days left',
  trial_ending_soon: 'Free days end in 5 min',
  trial_ended: 'Free days over',
  paid: 'Paid',
  stopped: 'Stopped',
  autopay_off: 'AutoPay off',
  paid_days_ended: 'Paid days over',
  renewal_retrying: 'Renewal retrying',
  payment_failed: 'Payment failed',
}

const outcomes: LocalBillingOutcome[] = ['real', 'pending', 'succeed', 'fail']
const outcomeLabel = (outcome: LocalBillingOutcome, delayMs: number) => {
  const seconds = Math.round(delayMs / 1000)
  return { real: 'Real Test Checkout', pending: 'Stay pending', succeed: `Succeed in ${seconds} s`, fail: `Fail in ${seconds} s` }[outcome]
}

/**
 * Local development demo mode only: seeds the local Razorpay Test helper's billing for this vendor.
 * Choosing one first closes every Razorpay Test subscription the helper made for the vendor. Paying,
 * stopping and keeping the shop open then run real Razorpay Test Checkout through Plan, unless a
 * simulated payment outcome is chosen: then a stand-in Checkout pays without the modal and the
 * helper decides the outcome, which "Deliver now" can settle at once.
 */
export function BillingTestScenarios() {
  const { vendorId } = useVendorAccount()
  const [target, setTarget] = useState<LocalBillingScenario | null>(null)
  const [chosen, setChosen] = useState<LocalBillingScenario | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [simulation, setSimulation] = useState<LocalBillingSimulation | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    getLocalBillingSimulation(vendorId, { signal: controller.signal })
      .then(setSimulation)
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(getErrorMessage(cause)) })
    return () => controller.abort()
  }, [vendorId])

  // While a simulated outcome is chosen, Plan's Pay opens the stand-in instead of Razorpay Checkout.
  const outcome = simulation?.outcome ?? 'real'
  useEffect(() => outcome === 'real' ? undefined : installLocalSimulatedCheckout(vendorId), [vendorId, outcome])

  async function choose(scenario: LocalBillingScenario) {
    setTarget(scenario)
    setError(null)
    try {
      await selectLocalBillingScenario(vendorId, scenario)
      setChosen(scenario)
      resetLiveBilling()
      await readLiveBilling(vendorId)
    } catch (cause) {
      setError(getErrorMessage(cause))
    } finally {
      setTarget(null)
    }
  }

  async function simulate(next: LocalBillingOutcome) {
    setBusy(true)
    setError(null)
    try {
      setSimulation(await selectLocalBillingSimulation(vendorId, next))
    } catch (cause) {
      setError(getErrorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  async function deliver(result: 'succeed' | 'fail') {
    setBusy(true)
    setError(null)
    try {
      await deliverLocalSimulatedPayment(vendorId, result)
      await readLiveBilling(vendorId)
    } catch (cause) {
      setError(getErrorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return <Card className="grid gap-2 bg-muted/40 p-5">
    <h2 className="text-sm font-semibold">Local Razorpay Test: choose a billing scenario</h2>
    <p className="text-xs text-muted-foreground">
      Served by npm run dev:billing-helper, which acts as the backend. Seeded paid days have no Razorpay payment behind
      them; every payment you make here is a real Razorpay Test payment unless a simulated payment outcome is chosen.
    </p>
    <div className="flex flex-wrap gap-2">
      {localBillingScenarios.map((scenario) => <button key={scenario} type="button" aria-pressed={chosen === scenario}
        className={vendorFilterChipClass(chosen === scenario)} disabled={target !== null} onClick={() => void choose(scenario)}>
        {target === scenario ? 'Switching…' : labels[scenario]}
      </button>)}
    </div>
    {simulation ? <>
      <h3 className="text-xs font-semibold">Payment outcome</h3>
      <div className="flex flex-wrap gap-2">
        {outcomes.map((option) => <button key={option} type="button" aria-pressed={outcome === option}
          className={vendorFilterChipClass(outcome === option)} disabled={busy} onClick={() => void simulate(option)}>
          {outcomeLabel(option, simulation.delayMs)}
        </button>)}
        <button type="button" className={vendorFilterChipClass(false)} disabled={busy} onClick={() => void deliver('succeed')}>Deliver now: success</button>
        <button type="button" className={vendorFilterChipClass(false)} disabled={busy} onClick={() => void deliver('fail')}>Deliver now: failure</button>
      </div>
    </> : null}
    {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
  </Card>
}
