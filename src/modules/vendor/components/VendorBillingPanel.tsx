import { useCallback, useEffect, useRef, useState } from 'react'
import { billingFailure, getErrorMessage, type BillingCheckoutAttempt, type SimulatedCancellationStep, type SimulatedRenewalStep, type VendorBillingService, type VendorBillingStatus } from '@/shared/api'
import { Badge, Button, Card, Spinner } from '@/shared/components/ui'
import { CheckoutBeforeOpenError, openSubscriptionCheckout } from '@/shared/payments/razorpay-checkout'

function displayDate(value: string): string {
  return `${new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))} IST`
}

function displayMoney(amountMinor: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amountMinor / 100)
}

function scheduleChanged(attempt: BillingCheckoutAttempt, status: VendorBillingStatus): boolean {
  const displayedDate = attempt.action === 'pay_first_fee' ? null : status.trial.status === 'active' ? status.trial.endsAt : status.membership.paidThrough
  const preparedDate = attempt.expected.chargeAt
  return attempt.expected.amountMinor !== status.plan.amountMinor || attempt.expected.currency !== status.plan.currency
    || (preparedDate === null || displayedDate === null ? preparedDate !== displayedDate : Date.parse(preparedDate) !== Date.parse(displayedDate))
}

/** The coverage cancellation keeps: the source's trial expiry or current paid-through date, never a computed period. */
function retainedBoundary(status: VendorBillingStatus): { kind: 'trial' | 'paid'; at: string } | null {
  if (status.accessStatus === 'TRIAL' && status.trial.status === 'active' && status.trial.endsAt) return { kind: 'trial', at: status.trial.endsAt }
  if (status.accessStatus === 'PAID' && status.membership.paidThrough) return { kind: 'paid', at: status.membership.paidThrough }
  return null
}

const SIMULATED_STEP_LABELS: Record<SimulatedCancellationStep, string> = {
  cancellation_confirmed: 'Simulate cancellation confirmed',
  cancellation_failed: 'Simulate cancellation failure',
  renewal_debit_collected: 'Simulate renewal debit racing the cancellation',
  refund_started: 'Simulate refund started',
  refund_completed: 'Simulate refund completed',
  refund_failed: 'Simulate refund failure',
}

const SIMULATED_RENEWAL_LABELS: Record<SimulatedRenewalStep, string> = {
  renewal_due: 'Simulate renewal fee due',
  renewal_failed: 'Simulate collection halted',
  renewal_retry_confirmed: 'Simulate successful retry',
}

/** Offers only the explicit simulated outcome that can follow the displayed progress. */
function simulatedCancellationSteps(status: VendorBillingStatus): SimulatedCancellationStep[] {
  if (status.cancellation?.status === 'requested') return ['cancellation_confirmed', 'cancellation_failed']
  if (status.refund?.status === 'owed') return ['refund_started']
  if (status.refund?.status === 'pending') return ['refund_completed', 'refund_failed']
  if (status.cancellation?.status === 'scheduled' && !status.refund) return ['cancellation_confirmed', 'renewal_debit_collected']
  return []
}

/** The service owns entitlement. Checkout outcomes never grant access in this component. */
export function VendorBillingPanel({ service, vendorId }: { service: VendorBillingService; vendorId: string }) {
  const [status, setStatus] = useState<VendorBillingStatus | null>(null)
  const [stale, setStale] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pendingAttempt, setPendingAttempt] = useState<BillingCheckoutAttempt | null>(null)
  const [lastAttempt, setLastAttempt] = useState<BillingCheckoutAttempt | null>(null)
  const [simulatedPending, setSimulatedPending] = useState(false)
  const [retryAttempt, setRetryAttempt] = useState<BillingCheckoutAttempt | null>(null)
  const [awaitingStatus, setAwaitingStatus] = useState(false)
  const [retryUntil, setRetryUntil] = useState(0)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const lifecycle = useRef<AbortController | null>(null)
  const inFlight = useRef(false)
  const shown = useRef<VendorBillingStatus | null>(null)
  const readClaim = useRef(0)
  const firedBoundary = useRef<string | null>(null)
  const queuedBoundaryRefresh = useRef(false)
  const logicalPreparation = useRef<{ action: BillingCheckoutAttempt['action']; key: string } | null>(null)
  const logicalCancellation = useRef<string | null>(null)

  const showError = useCallback((cause: unknown) => {
    const failure = billingFailure(cause)
    setError(failure.message)
    if (failure.retryAfterSeconds) setRetryUntil(Date.now() + failure.retryAfterSeconds * 1000)
  }, [])

  useEffect(() => {
    if (!retryUntil) return
    const timer = window.setTimeout(() => setRetryUntil(0), Math.max(0, retryUntil - Date.now()))
    return () => window.clearTimeout(timer)
  }, [retryUntil])

  const acceptStatus = useCallback((result: VendorBillingStatus) => {
    if (result.vendorId !== vendorId) throw new Error('Billing was returned for another vendor. Please refresh.')
    if (shown.current && result.revision < shown.current.revision) {
      throw new Error('Billing status is older than the last confirmed context. Please refresh.')
    }
    shown.current = result
    // A read showing the request landed reconciles it; a later cancellation is a new logical request.
    if (result.cancellation) logicalCancellation.current = null
    setStatus(result)
    setStale(false)
    if (result.authorisation.status !== 'pending' && result.membership.paymentStatus !== 'pending') setSimulatedPending(false)
  }, [vendorId])

  useEffect(() => {
    const controller = new AbortController()
    lifecycle.current = controller
    inFlight.current = false
    shown.current = null
    readClaim.current += 1
    firedBoundary.current = null
    queuedBoundaryRefresh.current = false
    setStatus(null)
    setStale(false)
    setError(null)
    setMessage(null)
    setPendingAttempt(null)
    setLastAttempt(null)
    setSimulatedPending(false)
    setRetryAttempt(null)
    setAwaitingStatus(false)
    setRetryUntil(0)
    setConfirmingCancel(false)
    logicalPreparation.current = null
    logicalCancellation.current = null
    const claim = readClaim.current
    void service.getStatus(vendorId).then(
      (result) => { if (!controller.signal.aborted && claim === readClaim.current) acceptStatus(result) },
    ).catch((cause: unknown) => { if (!controller.signal.aborted && claim === readClaim.current) { showError(cause); setStale(true) } })
    return () => controller.abort()
  }, [service, vendorId, acceptStatus, showError])

  const refresh = useCallback(async () => {
    const signal = lifecycle.current?.signal
    if (inFlight.current || retryUntil > Date.now() || !signal || signal.aborted) return
    const claim = ++readClaim.current
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      const result = await service.getStatus(vendorId)
      if (!signal.aborted && claim === readClaim.current) {
        acceptStatus(result)
        setPendingAttempt(null)
        setRetryAttempt((attempt) => attempt && result.availableActions.includes(attempt.action) && !scheduleChanged(attempt, result) ? attempt : null)
        setAwaitingStatus(false)
      }
    } catch (cause) {
      if (!signal.aborted && claim === readClaim.current) { setStale(true); showError(cause) }
    } finally {
      if (!signal.aborted) {
        inFlight.current = false
        setBusy(false)
        if (queuedBoundaryRefresh.current) {
          queuedBoundaryRefresh.current = false
          queueMicrotask(() => { void refresh() })
        }
      }
    }
  }, [service, vendorId, acceptStatus, retryUntil, showError])

  const finishBusy = useCallback((signal: AbortSignal) => {
    if (signal.aborted) return
    inFlight.current = false
    setBusy(false)
    if (queuedBoundaryRefresh.current) {
      queuedBoundaryRefresh.current = false
      queueMicrotask(() => { void refresh() })
    }
  }, [refresh])

  const readAfterUncertainOutcome = useCallback((signal: AbortSignal) => {
    const claim = ++readClaim.current
    void service.getStatus(vendorId).then((next) => {
      if (!signal.aborted && claim === readClaim.current) { acceptStatus(next); setAwaitingStatus(false) }
    }).catch((cause: unknown) => {
      if (!signal.aborted && claim === readClaim.current) { setStale(true); showError(cause) }
    })
  }, [service, vendorId, acceptStatus, showError])

  useEffect(() => {
    const onFocus = () => { void refresh() }
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onVisible) }
  }, [refresh])

  useEffect(() => {
    if (!status) return
    const boundary = status.accessStatus === 'TRIAL' ? status.trial.endsAt
      : status.accessStatus === 'PAID' ? status.membership.paidThrough : null
    if (!boundary) return
    const key = `${vendorId}:${boundary}`
    if (firedBoundary.current === key) return
    const delay = Math.max(0, Date.parse(boundary) - Date.parse(status.serverTime))
    const timer = window.setTimeout(() => {
      firedBoundary.current = key
      setStale(true)
      if (inFlight.current) queuedBoundaryRefresh.current = true
      else void refresh()
    }, Math.min(delay, 2147483647))
    return () => window.clearTimeout(timer)
  }, [status, vendorId, refresh])

  async function finishCheckout(attempt: BillingCheckoutAttempt, signal: AbortSignal) {
    if (attempt.mode === 'simulated') {
      const next = await service.submitCheckout(attempt, null)
      if (!signal.aborted) {
        acceptStatus(next)
        setSimulatedPending(true)
        setMessage('Simulated billing acknowledgement received. Confirmation is pending until explicit simulated reconciliation.')
      }
      return
    }
    if (!attempt.config) throw new Error('Test Checkout configuration is missing.')
    let failed = false
    let result
    try { result = await openSubscriptionCheckout(attempt.config, {
      signal,
      onPaymentFailure: (description) => {
        if (signal.aborted) return
        failed = true
        setError(getErrorMessage(new Error(description)))
      },
    }) } catch (cause) {
      if (!signal.aborted && cause instanceof CheckoutBeforeOpenError) {
        setRetryAttempt(attempt)
        showError(cause)
        setMessage('Checkout could not open. Retry this prepared attempt without creating a new one.')
        return
      }
      throw cause
    }
    if (signal.aborted) return
    setRetryAttempt(null)
    if (result.status === 'dismissed') {
      setMessage(failed ? 'Checkout closed after a failed attempt. Refresh billing status before retrying.' : 'Checkout was closed. Refresh billing status before retrying.')
      setAwaitingStatus(true)
      const refreshed = await service.getStatus(vendorId)
      if (!signal.aborted) { acceptStatus(refreshed); setAwaitingStatus(false) }
      return
    }
    // A later in-modal attempt was submitted, so an earlier card failure is no longer the outcome.
    setError(null)
    setMessage('Checkout callback received. Billing confirmation is pending; current access is unchanged.')
    setAwaitingStatus(true)
    let next: VendorBillingStatus
    try { next = await service.submitCheckout(attempt, result.callback) }
    finally {
      result.callback.razorpay_payment_id = ''
      result.callback.razorpay_subscription_id = ''
      result.callback.razorpay_signature = ''
    }
    if (!signal.aborted) {
      acceptStatus(next)
      setAwaitingStatus(false)
      setMessage(next.source === 'preview'
        ? 'Test Checkout callback received. Backend verification is unavailable in this preview; authorisation and paid access remain unconfirmed.'
        : next.authorisation.status === 'confirmed' || next.membership.paymentStatus === 'confirmed'
          ? 'Test Checkout callback received. The status below shows only what has been confirmed; anything else remains pending.'
          : 'Test Checkout callback received. Verification is pending; AutoPay authorisation and the platform fee remain unconfirmed.')
    }
  }

  async function prepare(action: 'setup_autopay' | 'pay_first_fee') {
    const signal = lifecycle.current?.signal
    if (inFlight.current || stale || pendingAttempt || retryAttempt || awaitingStatus || retryUntil > Date.now() || !signal || signal.aborted || !status?.availableActions.includes(action)) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    let preparationReturned = false
    try {
      if (logicalPreparation.current?.action !== action) logicalPreparation.current = { action, key: crypto.randomUUID() }
      const attempt = await service.prepareCheckout(vendorId, action, logicalPreparation.current.key)
      if (signal.aborted) return
      preparationReturned = true
      setLastAttempt(attempt)
      if (Date.parse(attempt.expiresAt) <= Date.now()) {
        logicalPreparation.current = null
        setAwaitingStatus(true)
        setMessage('This prepared attempt expired. Refresh billing status and review the current fee and date before another Checkout.')
        setStale(true)
        return
      }
      if (scheduleChanged(attempt, status)) {
        setPendingAttempt(attempt)
        setMessage('The prepared fee or first collection date differs from the displayed plan. Confirm the new schedule before opening Checkout.')
      } else {
        await finishCheckout(attempt, signal)
      }
    } catch (cause) {
      if (!signal.aborted) {
        setStale(true)
        setAwaitingStatus(true)
        showError(cause)
        setMessage(preparationReturned ? 'Checkout outcome is unconfirmed. Billing status is being refreshed.' : 'The preparation outcome is unconfirmed. Choose Pay Now again only if refreshed billing status still offers it.')
        if (!billingFailure(cause).retryAfterSeconds) readAfterUncertainOutcome(signal)
      }
    } finally {
      finishBusy(signal)
    }
  }

  async function confirmSchedule() {
    const signal = lifecycle.current?.signal
    const attempt = pendingAttempt
    if (inFlight.current || stale || !signal || signal.aborted || !attempt) return
    inFlight.current = true
    setBusy(true)
    setPendingAttempt(null)
    setError(null)
    try {
      if (Date.parse(attempt.expiresAt) <= Date.now()) {
        logicalPreparation.current = null
        setStale(true)
        setAwaitingStatus(true)
        setMessage('The prepared attempt expired. Refresh billing status and review a new preparation.')
      } else await finishCheckout(attempt, signal)
    } catch (cause) {
      if (!signal.aborted) { setStale(true); setAwaitingStatus(true); showError(cause); if (!billingFailure(cause).retryAfterSeconds) readAfterUncertainOutcome(signal) }
    } finally {
      finishBusy(signal)
    }
  }

  async function retryCheckout() {
    const signal = lifecycle.current?.signal
    const attempt = retryAttempt
    if (!signal || signal.aborted || inFlight.current || !attempt || stale || !status?.availableActions.includes(attempt.action)) return
    if (scheduleChanged(attempt, status)) {
      setRetryAttempt(null)
      setPendingAttempt(attempt)
      setMessage('The displayed schedule changed. Review this prepared attempt again before Checkout.')
      return
    }
    if (Date.parse(attempt.expiresAt) <= Date.now()) {
      setRetryAttempt(null)
      logicalPreparation.current = null
      setStale(true)
      setAwaitingStatus(true)
      setMessage('The prepared attempt expired. Refresh billing status and review the current schedule.')
      return
    }
    inFlight.current = true
    setBusy(true)
    setError(null)
    try { await finishCheckout(attempt, signal) }
    catch (cause) { if (!signal.aborted) { setStale(true); setAwaitingStatus(true); showError(cause); if (!billingFailure(cause).retryAfterSeconds) readAfterUncertainOutcome(signal) } }
    finally { finishBusy(signal) }
  }

  async function reconcileSimulated(outcome: 'confirmed' | 'failed' = 'confirmed') {
    const signal = lifecycle.current?.signal
    if (inFlight.current || stale || !signal || signal.aborted || !service.reconcileSimulatedCheckout) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      const next = await service.reconcileSimulatedCheckout(vendorId, outcome)
      if (!signal.aborted) { acceptStatus(next); setSimulatedPending(false); if (outcome === 'confirmed') logicalPreparation.current = null; setMessage(outcome === 'failed' ? 'Simulated attempt failed. Original access boundary remains; review current status before retrying.' : 'Simulated billing confirmation is complete. Access follows the reconciled status and original trial or paid boundary.') }
    } catch (cause) {
      if (!signal.aborted) { setStale(true); showError(cause) }
    } finally {
      finishBusy(signal)
    }
  }

  async function confirmCancellation() {
    const signal = lifecycle.current?.signal
    if (inFlight.current || stale || awaitingStatus || retryUntil > Date.now() || !signal || signal.aborted || !status?.availableActions.includes('cancel')) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    setConfirmingCancel(false)
    // A lost response is retried with the same key, so the source can recognise the one logical request.
    logicalCancellation.current ??= crypto.randomUUID()
    try {
      const next = await service.requestCancellation(vendorId, logicalCancellation.current)
      if (!signal.aborted) {
        acceptStatus(next)
        logicalCancellation.current = null
        setMessage('Cancellation request acknowledged. Billing status shows only what has been confirmed.')
      }
    } catch (cause) {
      if (!signal.aborted) {
        setStale(true)
        setAwaitingStatus(true)
        showError(cause)
        setMessage('The cancellation outcome is unconfirmed. Billing status is being refreshed; nothing is shown as cancelled until it is confirmed.')
        if (!billingFailure(cause).retryAfterSeconds) readAfterUncertainOutcome(signal)
      }
    } finally {
      finishBusy(signal)
    }
  }

  async function simulateCancellation(step: SimulatedCancellationStep) {
    const signal = lifecycle.current?.signal
    if (inFlight.current || stale || !signal || signal.aborted || !service.simulateCancellationProgress) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      const next = await service.simulateCancellationProgress(vendorId, step)
      if (!signal.aborted) { acceptStatus(next); setMessage('Simulated cancellation or refund progress updated. Access follows the status and its original boundary.') }
    } catch (cause) {
      if (!signal.aborted) { setStale(true); showError(cause) }
    } finally {
      finishBusy(signal)
    }
  }

  async function simulateRenewal(step: SimulatedRenewalStep) {
    const signal = lifecycle.current?.signal
    if (inFlight.current || stale || !signal || signal.aborted || !service.simulateRenewalProgress) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      const next = await service.simulateRenewalProgress(vendorId, step)
      if (!signal.aborted) { acceptStatus(next); setMessage('Simulated renewal progress updated. Coverage follows the status and its original renewal date.') }
    } catch (cause) {
      if (!signal.aborted) { setStale(true); showError(cause) }
    } finally {
      finishBusy(signal)
    }
  }

  if (!status) {
    return error ? <Card className="p-6"><p role="alert">Billing unavailable: {error}</p><Button className="mt-3" onClick={refresh} disabled={busy || retryUntil > Date.now()}>Refresh billing status</Button></Card>
      : <Spinner label="Loading billing status…" />
  }

  const trialActive = status.trial.status === 'active'
  const canSetup = status.availableActions.includes('setup_autopay')
  const canPayFirstFee = status.availableActions.includes('pay_first_fee')
  const paymentPending = status.authorisation.status === 'pending' || status.membership.paymentStatus === 'pending'
  const canCancel = status.availableActions.includes('cancel')
  const retained = retainedBoundary(status)
  const simulated = status.source !== 'backend'
  const simulatedSteps = simulated && service.simulateCancellationProgress ? simulatedCancellationSteps(status) : []
  const renewalSteps = simulated && service.simulateRenewalProgress ? status.simulatedRenewalSteps ?? [] : []
  // Without retained trial or paid access, a pending or failed fee grants nothing: there is no grace period.
  const feeUnsettled = status.membership.paymentStatus === 'pending' || status.membership.paymentStatus === 'failed'
  const feeOutcomeOutstanding = !retained && feeUnsettled
  // An early renewal attempt that has not succeeded leaves coverage at its confirmed end, not beyond it.
  const feeDueDuringCoverage = retained?.kind === 'paid' && feeUnsettled
  const mutationsBlocked = busy || stale || !!pendingAttempt || !!retryAttempt || awaitingStatus || retryUntil > Date.now()

  return (
    <div className="grid gap-4">
      <Card className="gap-5 p-6">
        {stale ? <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Last confirmed billing snapshot is stale. Refresh before making a billing change; current access must be checked with the server.</p> : null}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">Your platform membership</h2>
            <p className="mt-1 text-sm text-muted-foreground">{status.plan.name}</p>
            {simulated ? <Badge tone="warning">Simulated billing</Badge> : null}
            {status.source === 'preview' ? <Badge>Razorpay Test Mode preview</Badge> : null}
          </div>
          <p className="font-display text-2xl font-semibold">{displayMoney(status.plan.amountMinor)}<span className="text-sm font-normal text-muted-foreground"> / month</span></p>
        </div>
        <dl className="grid gap-4 sm:grid-cols-3">
          <div><dt className="text-sm text-muted-foreground">Platform access</dt><dd className="mt-1 font-medium">{status.accessStatus === 'TRIAL' || status.accessStatus === 'PAID' ? 'Available' : 'Limited'} <Badge>{status.accessStatus}</Badge></dd></div>
          <div><dt className="text-sm text-muted-foreground">AutoPay authorisation</dt><dd className="mt-1 font-medium">{status.authorisation.status === 'confirmed' ? 'Confirmed' : status.authorisation.status === 'pending' ? 'Confirmation pending' : status.authorisation.status === 'not_configured' ? 'Not configured' : status.authorisation.status === 'failed' ? 'Failed' : 'Revoked'}{status.providerVerified?.authorisation ? <> <Badge>Razorpay Test verified</Badge></> : null}</dd></div>
          <div><dt className="text-sm text-muted-foreground">Platform fee payment</dt><dd className="mt-1 font-medium">{status.membership.paymentStatus === 'confirmed' ? (status.accessStatus === 'PAID' ? 'Confirmed paid' : 'Last fee confirmed') : status.membership.paymentStatus === 'pending' ? 'Confirmation pending' : status.membership.paymentStatus === 'failed' ? 'Failed' : 'No confirmed payment'}{status.providerVerified?.payment ? <> <Badge>Razorpay Test verified</Badge></> : null}</dd></div>
        </dl>
        {trialActive && status.trial.endsAt ? <p>Trial access until <strong>{displayDate(status.trial.endsAt)}</strong>. {status.trial.daysRemaining} days remaining.</p> : null}
        {status.accessStatus === 'SETUP_INCOMPLETE' ? <p>Your trial has not started. {status.setupPendingReason === 'both' ? 'Complete store setup and await approval.' : status.setupPendingReason === 'onboarding' ? 'Complete store setup first.' : 'Await store approval.'} No trial days are being used while you wait.</p> : null}
        {status.trial.status === 'ineligible' ? <p>This vendor identity is not eligible for a new trial.</p> : null}
        {status.trial.status === 'ended' && status.accessStatus !== 'PAID' ? <p>{status.membership.paidThrough
          ? 'Your paid coverage has ended. There is no grace period.'
          : 'Your trial has ended. Paid membership requires confirmation of the first platform fee.'}</p> : null}
        {status.membership.paidThrough ? <p>{status.accessStatus === 'PAID' ? 'Confirmed paid coverage through' : 'Last confirmed paid coverage ended'} {displayDate(status.membership.paidThrough)}.</p> : null}
        {status.membership.nextChargeAt ? <p>{feeOutcomeOutstanding || feeDueDuringCoverage
          ? `Platform fee due ${displayDate(status.membership.nextChargeAt)} ${status.membership.paymentStatus === 'pending' ? 'is awaiting confirmation' : 'was not collected'}.${
            // A scheduled fee still being collected keeps the store open until collection halts; a fee paid now does not.
            status.membership.paymentStatus === 'pending' ? (status.storeVisible ? ' The store stays open while it is being collected, retries included.' : '')
              : feeDueDuringCoverage && retained ? ` Paid coverage still ends ${displayDate(retained.at)}; there is no grace period after it.` : ''}`
          : `Next platform fee scheduled for ${displayDate(status.membership.nextChargeAt)}.`}</p> : null}
        <div aria-live="polite" className="grid gap-5 empty:hidden">
        {status.cancellation ? <section aria-label="Cancellation progress" className="grid gap-1 rounded-lg border p-4 text-sm">
          {simulated ? <p className="text-xs font-medium uppercase text-muted-foreground">Simulated · cancellation progress</p> : null}
          {status.cancellation.status === 'requested' ? <>
            <p className="font-medium">Cancellation requested</p>
            <p>Received{status.cancellation.requestedAt ? ` ${displayDate(status.cancellation.requestedAt)}` : ''}. Stopping future collection is not confirmed yet; this shows progress until it is.</p>
          </> : status.cancellation.status === 'scheduled' ? <>
            <p className="font-medium">Renewal cancellation scheduled</p>
            <p>Renewal is set to stop at the end of your paid period{status.cancellation.effectiveAt ? `, ${displayDate(status.cancellation.effectiveAt)}` : ''}. This is not yet a completed cancellation.</p>
            {status.membership.nextChargeAt ? null : <p>No further platform fee is scheduled.</p>}
          </> : status.cancellation.status === 'confirmed' ? <>
            <p className="font-medium">Cancellation confirmed{status.providerVerified?.cancellation ? <> <Badge>Razorpay Test verified</Badge></> : null}</p>
            <p>Future collection for this agreement has stopped{status.cancellation.effectiveAt ? ` as of ${displayDate(status.cancellation.effectiveAt)}` : ''}.{retained ? ` You keep ${retained.kind === 'trial' ? 'your trial until' : 'paid access through'} ${displayDate(retained.at)}.` : ''}</p>
          </> : <>
            <p className="font-medium">Cancellation not confirmed</p>
            <p>The request could not be confirmed, so future collection has not been stopped. Refresh billing status to check the current agreement before trying again.</p>
          </>}
        </section> : null}
        {status.refund ? <section aria-label="Refund progress" className="grid gap-1 rounded-lg border p-4 text-sm">
          {simulated ? <p className="text-xs font-medium uppercase text-muted-foreground">Simulated · refund progress</p> : null}
          <p className="font-medium">{status.refund.status === 'owed' ? 'Refund owed' : status.refund.status === 'pending' ? 'Refund in progress' : status.refund.status === 'completed' ? 'Refund completed' : 'Refund failed'}</p>
          <p>{status.refund.status === 'owed' ? `${displayMoney(status.refund.amountMinor)} collected after a timely cancellation will be refunded in full. The refund has not started yet.`
            : status.refund.status === 'pending' ? `${displayMoney(status.refund.amountMinor)} is being refunded. It is not instant and is shown complete only once confirmed.`
              : status.refund.status === 'completed' ? `${displayMoney(status.refund.amountMinor)} has been refunded.`
                : `${displayMoney(status.refund.amountMinor)} is still owed. The refund did not go through.`}</p>
          <p className="text-muted-foreground">The amount is the total across every unintended fee. Refunds never add access or change your coverage dates.</p>
        </section> : null}
        </div>
        {!status.storeVisible ? <p>The store is hidden from the marketplace and new orders are blocked. Billing and account remain available{status.capabilities.includes('ORDERS') ? '; existing orders can still be viewed' : ''}{status.capabilities.includes('FULFILL_EXISTING_ORDERS') ? ' and orders placed before expiry can still be fulfilled' : ''}.</p> : null}
        {status.notice ? <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{status.notice}</p> : null}
        {canSetup ? <div className="grid gap-3 border-t pt-5">
          <p className="text-sm">{retained?.kind === 'paid'
            ? `Pay Now sets up AutoPay again for your paid membership. No fee is taken today: the next ${displayMoney(status.plan.amountMinor)} platform fee is scheduled for ${displayDate(retained.at)}, when your confirmed paid coverage ends. There is no new trial and no duplicate fee.`
            : <>{status.authorisation.status === 'failed' ? 'Pay Now retries the failed AutoPay setup during your existing trial.'
              : status.authorisation.status === 'revoked' ? 'Pay Now sets up AutoPay again during your existing trial; it does not start a new trial.'
                : 'Pay Now sets up AutoPay during your existing trial.'} The first monthly platform fee is scheduled for {status.trial.endsAt ? displayDate(status.trial.endsAt) : 'the end of your confirmed coverage'}; all remaining trial days stay yours.</>}</p>
          <Button className="w-fit" disabled={busy || stale || !!pendingAttempt || !!retryAttempt || awaitingStatus || retryUntil > Date.now()} onClick={() => prepare('setup_autopay')}>Pay Now</Button>
        </div> : null}
        {canPayFirstFee ? <div className="grid gap-3 border-t pt-5">
          <p className="text-sm">{status.membership.paidThrough
            ? `Your paid coverage has ended, so Pay Now starts a new subscription. The ${displayMoney(status.plan.amountMinor)} platform fee is collected now; paid access returns only after that fee is confirmed. No new trial is offered.`
            : status.membership.paymentStatus === 'failed'
              ? `Pay Now retries the failed first ${displayMoney(status.plan.amountMinor)} platform fee. It is collected now; paid access begins only after that fee is confirmed.`
              : `Pay Now starts an immediate subscription. The first ${displayMoney(status.plan.amountMinor)} platform fee is collected now; paid access begins only after that fee is confirmed.`}</p>
          <Button className="w-fit" disabled={busy || stale || !!pendingAttempt || !!retryAttempt || awaitingStatus || retryUntil > Date.now()} onClick={() => prepare('pay_first_fee')}>Pay Now</Button>
        </div> : null}
        {canCancel ? <div className="grid gap-3 border-t pt-5">
          {confirmingCancel ? <div role="group" aria-label="Confirm cancellation" className="grid gap-2 rounded-lg border p-4 text-sm">
            <p>{retained?.kind === 'trial' ? `You keep your trial until ${displayDate(retained.at)}. Cancelling asks us to stop future platform fee collection, so the first fee is not taken.`
              : retained?.kind === 'paid' ? `You keep paid access through ${displayDate(retained.at)}, the period already paid for. Cancelling asks us to stop future platform fee collection. Ordinary cancellation has no automatic prorated refund.`
                : 'Cancelling asks us to stop future platform fee collection. It does not restore or extend access.'}</p>
            <p>Stopping collection is pending until it is confirmed; this page shows its progress.</p>
            <p>Once confirmed, cancellation cannot be undone at the payment provider. {retained
              ? `To rejoin, set up billing again with Pay Now before ${displayDate(retained.at)}; the next fee is scheduled for that same date, with no new trial and no duplicate fee.`
              : 'To rejoin, set up billing again with Pay Now.'}</p>
            <div className="flex flex-wrap gap-2">
              <Button className="w-fit" variant="danger" disabled={mutationsBlocked} onClick={confirmCancellation}>Confirm cancellation</Button>
              <Button className="w-fit" variant="ghost" disabled={busy} onClick={() => setConfirmingCancel(false)}>Keep AutoPay</Button>
            </div>
          </div> : <Button className="w-fit" variant="outline" disabled={mutationsBlocked} onClick={() => setConfirmingCancel(true)}>Cancel AutoPay</Button>}
        </div> : null}
        {lastAttempt?.expected.authorisationAmountMinor != null ? <p className="text-sm">A separate payment-method authorisation amount of {displayMoney(lastAttempt.expected.authorisationAmountMinor)} may be charged at setup. This is separate from the monthly platform fee.</p> : null}
        {pendingAttempt ? <div className="grid gap-2 rounded-lg border p-4" role="status">
          <p>Displayed platform fee: {displayMoney(status.plan.amountMinor)} {status.plan.currency}; prepared platform fee: {displayMoney(pendingAttempt.expected.amountMinor)} {pendingAttempt.expected.currency}.</p>
          <p>Displayed first fee: {pendingAttempt.action === 'pay_first_fee' ? 'collected now' : status.trial.status === 'active' && status.trial.endsAt ? displayDate(status.trial.endsAt) : status.membership.paidThrough ? displayDate(status.membership.paidThrough) : 'collected now'}.</p>
          <p>Prepared first fee: {pendingAttempt.expected.chargeAt ? displayDate(pendingAttempt.expected.chargeAt) : 'collected now'}.</p>
          <Button className="w-fit" disabled={busy || stale} onClick={confirmSchedule}>Confirm updated schedule</Button>
          <Button className="w-fit" variant="ghost" disabled={busy} onClick={() => { setPendingAttempt(null); setAwaitingStatus(true); setMessage('Checkout was not opened. Refresh billing status before choosing another action.') }}>Keep current status</Button>
        </div> : null}
        {retryAttempt ? <Button className="w-fit" variant="outline" disabled={busy || stale || retryUntil > Date.now()} onClick={retryCheckout}>Retry prepared Checkout</Button> : null}
        {paymentPending ? <p className="text-sm font-medium">{retained ? 'Confirmation is pending. Your current trial or confirmed paid boundary still applies.' : 'Confirmation is pending. Access stays limited until the fee is confirmed; there is no grace period.'}</p> : null}
        {simulatedSteps.length ? <div className="flex flex-wrap gap-2">{simulatedSteps.map((step) => (
          <Button key={step} className="w-fit" variant="outline" disabled={busy || stale} onClick={() => simulateCancellation(step)}>{SIMULATED_STEP_LABELS[step]}</Button>
        ))}</div> : null}
        {renewalSteps.length ? <div className="flex flex-wrap gap-2">{renewalSteps.map((step) => (
          <Button key={step} className="w-fit" variant="outline" disabled={busy || stale} onClick={() => simulateRenewal(step)}>{SIMULATED_RENEWAL_LABELS[step]}</Button>
        ))}</div> : null}
        {simulatedPending && service.reconcileSimulatedCheckout ? <div className="flex gap-2"><Button className="w-fit" variant="outline" disabled={busy || stale} onClick={() => reconcileSimulated()}>Simulate confirmation</Button><Button className="w-fit" variant="outline" disabled={busy || stale} onClick={() => reconcileSimulated('failed')}>Simulate failure</Button></div> : null}
        <div className="flex items-center gap-3 border-t pt-4">
          <Button variant="ghost" onClick={refresh} disabled={busy || retryUntil > Date.now()}>Refresh billing status</Button>
          {busy ? <span role="status" className="text-sm text-muted-foreground">Checkout or confirmation in progress…</span> : null}
        </div>
      </Card>
      {error ? <p role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">{error}</p> : null}
      {message ? <p role="status" className="rounded-lg bg-muted p-4 text-sm">{message}</p> : null}
    </div>
  )
}
