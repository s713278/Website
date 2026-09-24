import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createVendorBillingLocalTestService, getErrorMessage,
  type LocalTestHistoryEntry, type LocalTestResetObject, type LocalTestResetOutcome, type LocalTestScenario, type LocalTestScenarioState,
} from '@/shared/api'
import { Button } from '@/shared/components/ui'
import { VendorBillingPanel } from './VendorBillingPanel'

const choices: Array<{ id: LocalTestScenario; label: string }> = [
  { id: 'active_trial', label: 'Active trial' },
  { id: 'expired_trial', label: 'Expired trial' },
  { id: 'paid_sample', label: 'Paid sample' },
]
const scenarioLabel = (id: LocalTestScenario) => choices.find((choice) => choice.id === id)?.label ?? id

const outcomeLabels: Record<LocalTestResetOutcome, string> = {
  closed: 'already closed at Razorpay Test',
  cancelled_by_reset: 'cancelled by reset, confirmed by a Razorpay Test read',
  never_created: 'never created at Razorpay Test',
  cancel_requested: 'cancellation requested, but Razorpay Test has not answered, so it may still collect',
  cancel_acknowledged: 'Razorpay Test accepted the cancellation, but no read shows it closed yet',
  cancel_rejected: 'Razorpay Test rejected the cancellation, so it may still collect',
  read_failed: 'Razorpay Test could not be read',
  not_owned: 'Razorpay Test shows this helper did not create it for this scenario, so reset leaves it untouched',
  creation_uncertain: 'its creation is still uncertain and Razorpay Test does not list it yet',
}
const objectLine = ({ associationId, outcome }: LocalTestResetObject) =>
  `${associationId ?? 'Unconfirmed Test subscription'}: ${outcomeLabels[outcome]}.`

const displayDate = (value: string) => `${new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))} IST`

function historyLine(entry: LocalTestHistoryEntry) {
  const fees = entry.attempts.reduce((count, attempt) => count + (attempt.fee ? 1 + attempt.renewals.length : 0), 0)
  const boundary = entry.paidThrough ? `sample paid through ${displayDate(entry.paidThrough)}` : `trial ending ${displayDate(entry.trialEndsAt)}`
  return `Generation ${entry.generation} · ${scenarioLabel(entry.scenario)} · selected ${displayDate(entry.selectedAt)}, ${boundary} · ${entry.attempts.length} billing attempt${entry.attempts.length === 1 ? '' : 's'}, ${fees} Razorpay Test verified fee${fees === 1 ? '' : 's'} · reset ${displayDate(entry.resetCompletedAt)}.`
}

export function VendorBillingLocalTest({ vendorId }: { vendorId: string }) {
  const service = useMemo(() => createVendorBillingLocalTestService(), [])
  const [state, setState] = useState<LocalTestScenarioState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const [checking, setChecking] = useState(false)
  const resetKey = useRef<string | null>(null)
  const scenario = state?.scenario ?? null

  useEffect(() => {
    let active = true
    void service.readScenario(vendorId).then((value) => { if (active) { setState(value); setLoading(false) } })
      .catch((cause: unknown) => { if (active) { setError(getErrorMessage(cause)); setLoading(false) } })
    return () => { active = false }
  }, [service, vendorId])

  async function select(value: LocalTestScenario) {
    setLoading(true)
    setError(null)
    try {
      await service.selectScenario(vendorId, value)
      setState(await service.readScenario(vendorId))
      setRevision((current) => current + 1)
    } catch (cause) { setError(getErrorMessage(cause)) }
    finally { setLoading(false) }
  }

  /** The panel may have created subscriptions since mount, so the confirmation describes a fresh helper read. */
  async function beginReset() {
    setChecking(true)
    setError(null)
    try {
      const next = await service.readScenario(vendorId)
      setState(next)
      setConfirming(Boolean(next.scenario && !next.reset))
    } catch (cause) { setError(getErrorMessage(cause)) }
    finally { setChecking(false) }
  }

  /** One logical reset per generation: a retry reuses its key, and the helper converges any key on it. */
  async function reset() {
    if (!state?.scenario || state.generation === null) return
    setConfirming(false)
    setLoading(true)
    setError(null)
    resetKey.current ??= crypto.randomUUID()
    try {
      const next = await service.resetScenario(vendorId, { scenario: state.scenario, generation: state.generation }, resetKey.current)
      if (!next.scenario) resetKey.current = null
      setState(next)
      setRevision((current) => current + 1)
    } catch (cause) { setError(getErrorMessage(cause)) }
    finally { setLoading(false) }
  }

  const count = state?.objectCount ?? 0
  return <div className="grid gap-3">
    <p className="text-sm">Local Razorpay Test Mode · selected vendor {vendorId}. Scenario dates, access and restrictions are simulated locally; only facts marked Razorpay Test verified come from the provider. A Test Dashboard accelerated charge is read as a provider payment fact only: it does not advance the trial, move the renewal date or show that backend enforcement works. Use the Paid sample scenario for renewal exercises. Cancel AutoPay asks Razorpay Test to stop only this scenario's subscription; a cancellation is not a refund. Cancellation-race and refund progress appear only in the labelled simulated billing samples, and this helper requests no Test refund.</p>
    {loading ? <p role="status">Reading local Test scenario…</p> : scenario && state?.generation ? <div className="grid gap-2">
      <p>Scenario: {scenarioLabel(scenario)} · generation {state.generation}. Reloading, restarting the helper or switching modes keeps this scenario; only Reset Test scenario replaces it.</p>
      {state.reset ? <div role="status" className="grid gap-1 text-sm">
        <p>Reset pending since {displayDate(state.reset.requestedAt)}. Not every Test subscription recorded for this scenario is confirmed closed at Razorpay Test, so no new scenario or Checkout can start. Refresh billing status to review, then retry the reset.</p>
        <ul className="list-disc pl-5">{state.reset.objects.map((item, index) => <li key={item.associationId ?? index}>{objectLine(item)}</li>)}</ul>
        <Button className="w-fit" variant="outline" onClick={() => void reset()}>Retry reset</Button>
      </div> : confirming ? <div role="group" aria-label="Confirm Test scenario reset" className="grid gap-2 text-sm">
        <p>Reset the {scenarioLabel(scenario)} scenario (generation {state.generation}) for vendor {vendorId}?</p>
        <p>{count ? `The helper rereads the ${count} Razorpay Test subscription${count === 1 ? '' : 's'} it recorded for this scenario and asks Razorpay Test to cancel any that can still collect, immediately.` : 'No Razorpay Test subscription is recorded for this scenario, so nothing is cancelled.'} A cancellation counts only once a Razorpay Test read shows the subscription closed; until then the reset stays pending. The locally simulated trial dates, access and restrictions are simply discarded: that is not a provider cancellation, and nothing is refunded.</p>
        <p>Subscriptions this helper did not create for this scenario, including anything else in the Test account, are outside reset's reach. Its history is kept, and you then choose a new scenario explicitly.</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void reset()}>Confirm reset</Button>
          <Button variant="outline" onClick={() => setConfirming(false)}>Keep scenario</Button>
        </div>
      </div> : <Button className="w-fit" variant="outline" disabled={checking} onClick={() => void beginReset()}>Reset Test scenario</Button>}
    </div> : <div className="grid gap-2">
      {state?.history.length ? <p className="text-sm">The previous scenario was reset. Choose a scenario to start generation {(state.history.at(-1)?.generation ?? 0) + 1}.</p> : null}
      <div className="flex flex-wrap gap-2">{choices.map((choice) => <Button key={choice.id} variant="outline" onClick={() => void select(choice.id)}>{choice.label}</Button>)}</div>
    </div>}
    {error ? <p role="alert">{error}</p> : null}
    {scenario && !loading ? <VendorBillingPanel key={`${vendorId}:${revision}`} vendorId={vendorId} service={service} /> : null}
    {state?.history.length ? <section aria-label="Earlier Test scenarios" className="grid gap-1 text-sm">
      <h3 className="font-semibold">Earlier Test scenarios for vendor {vendorId}</h3>
      {[...state.history].reverse().map((entry) => <div key={entry.generation}>
        <p>{historyLine(entry)}</p>
        {entry.objects.length ? <ul className="list-disc pl-5">{entry.objects.map((item, index) => <li key={item.associationId ?? index}>{objectLine(item)}</li>)}</ul>
          : <p>No Razorpay Test subscription was recorded.</p>}
      </div>)}
    </section> : null}
  </div>
}
