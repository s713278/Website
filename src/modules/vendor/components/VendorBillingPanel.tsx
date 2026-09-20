import { useEffect, useRef, useState } from 'react'
import { getErrorMessage, type BillingIntent, type VendorBillingService, type VendorBillingStatus } from '@/shared/api'
import { Badge, Button, Card, Spinner } from '@/shared/components/ui'
import { openSubscriptionCheckout } from '@/shared/payments/razorpay-checkout'

function displayDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

/** Renders service-owned entitlements. A browser event can only change the progress message. */
export function VendorBillingPanel({ service }: { service: VendorBillingService }) {
  const [status, setStatus] = useState<VendorBillingStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [earlyConversionAccepted, setEarlyConversionAccepted] = useState(false)
  const lifecycle = useRef<AbortController | null>(null)
  const inFlight = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    lifecycle.current = controller
    inFlight.current = false
    service.getStatus().then(
      (result) => { if (!controller.signal.aborted) setStatus(result) },
      (cause: unknown) => { if (!controller.signal.aborted) setError(getErrorMessage(cause)) },
    )
    return () => controller.abort()
  }, [service])

  async function refresh() {
    const signal = lifecycle.current?.signal
    if (inFlight.current || !signal || signal.aborted) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      const result = await service.getStatus()
      if (!signal.aborted) setStatus(result)
    } catch (cause) {
      if (!signal.aborted) setError(getErrorMessage(cause))
    } finally {
      if (!signal.aborted) {
        inFlight.current = false
        setBusy(false)
      }
    }
  }

  async function subscribe(intent: BillingIntent) {
    const signal = lifecycle.current?.signal
    if (inFlight.current || !signal || signal.aborted || !status?.availableActions.includes(intent)) return
    if (intent === 'paid_membership' && status.trial.status === 'active' && !earlyConversionAccepted) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    setMessage('Opening secure Checkout…')
    let failed = false
    try {
      const attempt = await service.prepareCheckout(intent)
      if (signal.aborted) return
      const result = await openSubscriptionCheckout(attempt.config, {
        signal,
        onPaymentFailure: (description) => {
          if (signal.aborted) return
          failed = true
          setMessage(null)
          setError(getErrorMessage(new Error(description)))
        },
      })
      if (signal.aborted) return
      if (result.status === 'dismissed') {
        setMessage(failed
          ? 'Checkout closed after a failed attempt. Your access has not changed. Check billing status before retrying.'
          : 'Checkout was closed. Your access has not changed. Check billing status before retrying.')
        return
      }
      setError(null)
      setMessage('Confirmation pending. Your existing access remains unchanged until billing is confirmed.')
      const confirmedStatus = await service.submitCheckout(attempt, result.callback)
      if (!signal.aborted) {
        setStatus(confirmedStatus)
        setMessage(confirmedStatus.source === 'development'
          ? 'Callback received. Backend verification is unavailable in this preview; authorisation and paid access remain unconfirmed.'
          : 'Billing status received. Access below reflects the latest backend confirmation.')
      }
    } catch (cause) {
      if (!signal.aborted) {
        setError(getErrorMessage(cause))
        setMessage('Access has not changed. Refresh billing status before trying again.')
      }
    } finally {
      if (!signal.aborted) {
        inFlight.current = false
        setBusy(false)
      }
    }
  }

  if (!status) {
    return error ? <Card><p role="alert">{error}</p><Button className="mt-3" onClick={refresh} disabled={busy}>Retry billing status</Button></Card>
      : <Spinner label="Loading billing status…" />
  }

  const price = new Intl.NumberFormat('en-IN', { style: 'currency', currency: status.plan.currency, maximumFractionDigits: 0 }).format(status.plan.amountMinor / 100)
  const activeTrial = status.trial.status === 'active'
  const canPay = status.availableActions.includes('paid_membership')
  const canAuthorise = status.availableActions.includes('trial_authorisation')
  const pending = status.authorisation === 'pending' || status.payment === 'pending'

  return (
    <div className="grid gap-4">
      <Card className="gap-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">Your platform membership</h2>
            <p className="mt-1 text-sm text-muted-foreground">{status.plan.name}</p>
          </div>
          <p className="font-display text-2xl font-semibold">{price}<span className="text-sm font-normal text-muted-foreground"> / month</span></p>
        </div>
        <dl className="grid gap-4 sm:grid-cols-3">
          <div><dt className="text-sm text-muted-foreground">Platform access</dt><dd className="mt-1 font-medium">{status.canAccessPlatform ? 'Available' : 'Not available'} <Badge>{status.accessStatus}</Badge></dd></div>
          <div><dt className="text-sm text-muted-foreground">AutoPay authorisation</dt><dd className="mt-1 font-medium">{status.authorisation === 'confirmed' ? 'Confirmed' : status.authorisation === 'pending' ? 'Confirmation pending' : 'Not configured'}</dd></div>
          <div><dt className="text-sm text-muted-foreground">Platform fee payment</dt><dd className="mt-1 font-medium">{status.payment === 'confirmed' ? 'Confirmed paid' : status.payment === 'pending' ? 'Confirmation pending' : 'No confirmed payment'}</dd></div>
        </dl>
        {activeTrial && status.trial.endsAt ? <p>Trial access until <strong>{displayDate(status.trial.endsAt)}</strong>.</p> : null}
        {status.trial.status === 'not_started' ? <p>Your trial has not started. AutoPay setup must be confirmed before this proposed trial flow can begin.</p> : null}
        {status.trial.status === 'ended' ? <p>Your free trial has ended. Start paid membership to restore platform access.</p> : null}
        {status.paidThrough ? <p>Paid membership through {displayDate(status.paidThrough)}.</p> : null}
        {status.trial.reminder ? (
          <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
            {status.trial.reminder === 'three_days' ? 'Your free trial ends in 3 days.' : 'This is the last day of your free trial.'}{' '}
            {pending ? 'Billing confirmation is pending. Your current trial expiry still applies.'
              : status.authorisation === 'confirmed' ? 'AutoPay is configured for scheduled billing.' : 'Choose paid membership when you are ready to continue.'}
          </p>
        ) : null}
        {status.availableActions.includes('continue_trial') ? (
          <div>
            <Button variant="outline" disabled={busy} onClick={() => setMessage('Your existing trial access continues until the displayed expiry. No Checkout is needed for this action.')}>Continue free trial</Button>
          </div>
        ) : null}
        {canPay ? (
          <div className="grid gap-3 border-t pt-5">
            {activeTrial ? (
              <>
                <p className="text-sm">Pay {price} to start your monthly paid membership immediately after payment is confirmed. Your remaining trial days will end at that point. A failed or unconfirmed payment preserves your original trial expiry.</p>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1 accent-emerald-600" checked={earlyConversionAccepted} onChange={(event) => setEarlyConversionAccepted(event.target.checked)} disabled={busy} />
                  I understand that confirmed payment ends my remaining free trial.
                </label>
              </>
            ) : <p className="text-sm">The platform fee is {price} per month. Paid access begins only after your first payment is confirmed.</p>}
            <Button className="w-fit max-w-full whitespace-normal" disabled={busy || (activeTrial && !earlyConversionAccepted)} onClick={() => subscribe('paid_membership')}>Pay {price} now and start paid membership</Button>
          </div>
        ) : null}
        {canAuthorise ? (
          <div className="grid gap-3 border-t pt-5">
            <p className="text-sm">Set up recurring payments for a 14-day trial, then {price} per month. The monthly platform fee is scheduled after the trial. A payment-method authorisation transaction may apply.</p>
            <Button className="w-fit max-w-full whitespace-normal" disabled={busy} onClick={() => subscribe('trial_authorisation')}>Set up AutoPay and start trial</Button>
          </div>
        ) : null}
        {status.earlyConversionRequiresBackend ? (
          <div className="grid gap-2 border-t pt-5">
            <p className="text-sm">Paying early would start {price} monthly membership after confirmed payment and end your remaining trial. Your scheduled subscription must first be safely changed or replaced to avoid duplicate charges.</p>
            <Button className="w-fit" disabled>Pay now — unavailable in preview</Button>
          </div>
        ) : null}
        {pending ? <p className="text-sm font-medium">Confirmation is pending. Checkout authorisation alone does not establish paid membership.</p> : null}
        <div className="flex items-center gap-3 border-t pt-4">
          <Button variant="ghost" onClick={refresh} disabled={busy}>Refresh billing status</Button>
          {busy ? <span className="text-sm text-muted-foreground" role="status">Checkout or confirmation in progress…</span> : null}
        </div>
      </Card>
      {error ? <p role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">{error}</p> : null}
      {message ? <p role="status" className="rounded-lg bg-muted p-4 text-sm">{message}</p> : null}
    </div>
  )
}
