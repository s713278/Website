import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import type { PrototypeCard } from '@/modules/vendor/lib/billing-prototype-card'
import { isBriefOutage, pause, retryDelays } from '@/modules/vendor/lib/live-billing-retry'
import { liveBillingWording, type LiveCheckoutPurpose } from '@/modules/vendor/lib/live-billing-wording'
import { useVendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import { LivePaymentsYouMade } from '@/modules/vendor/components/LivePaymentsYouMade'
import { cancelLiveBilling, holdLiveBilling, readLiveBilling, useLiveBilling } from '@/modules/vendor/store/live-billing'
import { getErrorMessage, isApiError, liveBillingService, mapLiveCheckout, type LiveBillingView } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Button, Card } from '@/shared/components/ui'
import { cn } from '@/shared/lib/utils'
import { openSubscriptionCheckout, type SubscriptionCheckoutCallback } from '@/shared/payments/razorpay-checkout'

const toneClass: Record<PrototypeCard['tone'], string> = {
  neutral: '',
  danger: 'border-destructive/30 bg-destructive/[0.04]',
  warning: 'border-amber-300 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/30',
}

function StateCard({ card, children }: { card: PrototypeCard; children?: ReactNode }) {
  return <Card className={cn('grid gap-3 p-5', toneClass[card.tone])}>
    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{card.eyebrow}</p>
    {'days' in card.figure
      ? <p className="flex items-baseline gap-2"><span className="font-display text-5xl font-bold">{card.figure.days}</span><span className="text-lg text-muted-foreground">days left</span></p>
      : <h2 className="font-display text-4xl font-bold">{card.figure.headline}</h2>}
    <p>{card.body}</p>
    <p className="text-sm font-semibold text-primary">{card.plan}</p>
    {card.autoPay ? <p className="font-semibold text-primary">{card.autoPay}</p> : null}
    {children}
  </Card>
}

const notResponding = 'MithraDirect isn’t responding. Try again in a minute.'
/** Gap A: what a cancel's 500 means, per action. */
const turnOffFailed = 'Couldn’t turn off AutoPay right now. Try again later or contact support.'
const stopFailed = 'Couldn’t stop the plan right now. Try again later or contact support.'
const confirmFailed = 'We couldn’t confirm this payment here. If money was taken, it will show once Razorpay confirms it.'
const pollEvery = 5_000
const pollFor = 90_000
const whatYouGet = ['Your own shop link', 'Customers order on WhatsApp', 'Share on Instagram and Facebook', 'Add products and prices', 'See all orders in one place']
const ifYouDoNotPay = ['Customers cannot open your shop', 'New orders stop', 'You can still see old orders', 'You can pay again any time']

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId()
  return <Card role="region" aria-labelledby={id} className="grid gap-3 p-5">
    <h2 id={id} className="font-display text-lg font-bold">{title}</h2>
    {children}
  </Card>
}

/** Plan with the Live API: the vendor's billing state from the published backend billing API. */
export function LiveVendorPlan() {
  const { vendorId } = useVendorAccount()
  // A new session clears the shared read, even for the same vendor, so Plan reads again.
  const sessionUser = useAuthStore((state) => state.user)
  const { view, error, reading, trialStartedAt, hold } = useLiveBilling(vendorId)
  // The shared read retries an outage quietly, so one shown here has run out of retries.
  const errorMessage = useMemo(() => error ? isBriefOutage(error) ? notResponding : getErrorMessage(error) : null, [error])

  /** The actions of this vendor and session: aborted on a change or unmount, so Plan ignores a late answer. */
  const actions = useRef<{ controller: AbortController; running: boolean } | null>(null)
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  /** Stop the plan's single confirm step is open. */
  const [confirmStop, setConfirmStop] = useState(false)
  /**
   * After Checkout, Plan polls while the shared read's hold lasts, for up to 90 s. The hold outlives
   * the poll and Plan; leaving Plan stops the poll, and it does not restart on return.
   */
  const [pollWindowOpen, setPollWindowOpen] = useState(false)
  const polling = pollWindowOpen && hold !== null
  /** Successful `confirm` calls: each one rereads the history. A cancel's response is a new view, which does too. */
  const [confirmed, setConfirmed] = useState(0)

  // The shared read drops a response for a previous vendor or session, so there is nothing to cancel here.
  useEffect(() => {
    const current = { controller: new AbortController(), running: false }
    actions.current = current
    setActing(false)
    setActionError(null)
    setConfirmStop(false)
    setPollWindowOpen(false)
    void readLiveBilling(vendorId)
    return () => { current.controller.abort() }
  }, [vendorId, sessionUser])

  useEffect(() => {
    if (!polling) return
    const poll = window.setInterval(() => void readLiveBilling(vendorId), pollEvery)
    const cap = window.setTimeout(() => setPollWindowOpen(false), pollFor)
    return () => {
      window.clearInterval(poll)
      window.clearTimeout(cap)
    }
  }, [polling, vendorId])

  /** Turn off AutoPay and Stop the plan: one call per click, never retried; a failure leaves the view. */
  async function cancel(refused: string) {
    const current = actions.current
    if (!current || current.running) return
    current.running = true
    setActing(true)
    setActionError(null)
    try {
      await cancelLiveBilling(vendorId)
      if (!current.controller.signal.aborted) setConfirmStop(false)
    } catch (cause) {
      // Gap A: dev answers a cancel before Razorpay's first cycle with a 500; after an early first
      // fee, that is any stop before P.
      if (!current.controller.signal.aborted) setActionError(isApiError(cause) && cause.status === 500 ? refused : getErrorMessage(cause))
    } finally {
      current.running = false
      if (!current.controller.signal.aborted) setActing(false)
    }
  }

  /**
   * Subscribe, Checkout, confirm, then the poll. Subscribe is never retried; a repeat while pending
   * returns the same subscription, so trying again is safe. Closing Checkout changes nothing.
   */
  async function checkout(purpose: LiveCheckoutPurpose, from: LiveBillingView) {
    const current = actions.current
    if (!current || current.running) return
    current.running = true
    setActing(true)
    setActionError(null)
    const { signal } = current.controller
    try {
      const config = mapLiveCheckout(await liveBillingService.subscribe(vendorId, from.plan.code))
      if (signal.aborted) return
      const failure = { reason: null as string | null }
      const result = await openSubscriptionCheckout(
        { ...config, name: 'MithraDirect', description: from.plan.name },
        { signal, onPaymentFailure: (reason) => { failure.reason = reason } },
      )
      if (result.status === 'dismissed') {
        if (failure.reason) setActionError(purpose.failed(failure.reason))
        return
      }
      holdLiveBilling(vendorId, purpose.waiting)
      setPollWindowOpen(true)
      void confirm(result.callback, signal)
    } catch (cause) {
      // Gap E: dev refuses Keep shop open with a 409 while the stopped plan's paid days last.
      // Gap I: paying after the trial fails with a 500, whose backend copy getErrorMessage shows.
      if (!signal.aborted) setActionError(isApiError(cause) && cause.status === 409 && purpose.refused ? purpose.refused : getErrorMessage(cause))
    } finally {
      current.running = false
      if (!signal.aborted) setActing(false)
    }
  }

  /** Sends Checkout's values to `confirm`. The payment may be taken whatever happens here, so the poll runs regardless. */
  async function confirm(callback: SubscriptionCheckoutCallback, signal: AbortSignal) {
    for (let retry = 0; ; retry += 1) {
      try {
        await liveBillingService.confirm(vendorId, callback)
        if (!signal.aborted) setConfirmed((count) => count + 1)
        return
      } catch (cause) {
        if (signal.aborted) return
        if (isBriefOutage(cause) && retry < retryDelays.length) {
          await pause(retryDelays[retry], signal)
          if (signal.aborted) return
          continue
        }
        setActionError(isApiError(cause) && (cause.status === 400 || cause.status === 401) ? confirmFailed : getErrorMessage(cause))
        return
      }
    }
  }

  // A failed reread keeps the last view on screen, under this line.
  const readAlert = errorMessage ? <div className="grid gap-2 text-sm">
    <p role="alert" className="text-destructive">{errorMessage}</p>
    <Button className="w-fit" variant="outline" size="sm" disabled={reading} onClick={() => void readLiveBilling(vendorId)}>Try again</Button>
  </div> : null
  if (!view) return readAlert ?? <p role="status">Reading shop plan…</p>

  const { card, note, confirming, stopConfirmation, checkout: purpose } = liveBillingWording(view)
  const actionAlert = actionError ? <p role="alert" className="text-sm text-destructive">{actionError}</p> : null
  return <div className="grid gap-4">
    {readAlert}
    {note ? <Card className="p-5"><p>{note}</p></Card> : null}
    {card ? <>
      <StateCard card={card}>
        {card.action && purpose ? <div className="grid gap-1">
          <Button size="lg" fullWidth className="rounded-full" disabled={acting || hold !== null} onClick={() => void checkout(purpose, view)}>{card.action.label}</Button>
          <p className="text-xs text-muted-foreground">{card.action.help}</p>
          {actionAlert}
        </div> : null}
        {view.state === 'autopay_on' ? <>
          <Button className="w-fit px-0" variant="link" disabled={acting} onClick={() => void cancel(turnOffFailed)}>Turn off AutoPay</Button>
          {actionAlert}
        </> : null}
      </StateCard>
      {/* A Confirming view's own status line is the waiting line, so it never shows twice. */}
      {hold && !confirming ? <div className="grid gap-2 text-sm">
        <p role="status">{hold}</p>
        {!polling ? <Button className="w-fit" variant="outline" size="sm" disabled={reading} onClick={() => void readLiveBilling(vendorId)}>Check again</Button> : null}
      </div> : null}
      {/* Confirming offers no payment action; Check again only rereads the shared read. */}
      {confirming ? <div className="grid gap-2 text-sm">
        <p role="status">{confirming}</p>
        <Button className="w-fit" variant="outline" size="sm" disabled={reading} onClick={() => void readLiveBilling(vendorId)}>Check again</Button>
      </div> : null}
      <Section title="What you get">
        <ul className="grid list-disc gap-1.5 pl-5 text-sm">{whatYouGet.map((item) => <li key={item}>{item}</li>)}</ul>
      </Section>
      {/* Hidden while paid or while Razorpay collects: the vendor has nothing to pay. */}
      {view.state !== 'collecting' && view.state !== 'paid' ? <Section title="If you do not pay">
        <ul className="grid list-disc gap-1.5 pl-5 text-sm text-[var(--badge-warning-fg)]">{ifYouDoNotPay.map((item) => <li key={item}>{item}</li>)}</ul>
      </Section> : null}
      <Section title="Payments you made">
        <LivePaymentsYouMade vendorId={vendorId} view={view} reading={reading} trialStartedAt={trialStartedAt} writes={confirmed} />
      </Section>
      {stopConfirmation ? <Section title="Stop the plan">
        {confirmStop ? <>
          <p className="text-sm">{stopConfirmation}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" className="w-fit rounded-full" disabled={acting} onClick={() => void cancel(stopFailed)}>Yes, stop the plan</Button>
            <Button variant="outline" className="w-fit rounded-full" disabled={acting} onClick={() => setConfirmStop(false)}>Keep the plan</Button>
          </div>
        </> : <>
          <p className="text-sm text-muted-foreground">Stop any time. The shop stays open until the days you already paid for are over.</p>
          <Button variant="outline" className="w-fit rounded-full" disabled={acting} onClick={() => setConfirmStop(true)}>Stop the plan</Button>
        </>}
        {actionAlert}
      </Section> : null}
    </> : null}
  </div>
}
