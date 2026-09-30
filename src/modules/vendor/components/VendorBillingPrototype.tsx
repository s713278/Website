import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  loadPrototypeState, markPrototypeHelperDown, prototypeView, showHelperScenario, showLocalPrototypeState, useBillingPrototype,
} from '@/modules/vendor/hooks/use-billing-prototype'
import { autoPayWaitNotice, confirmingPaymentNotice, isPayNowState, isTrialState, prototypeHistory, stopPlanConfirmation, stopWaitNotice, type PrototypeCard, type PrototypeHistoryRow } from '@/modules/vendor/lib/billing-prototype-card'
import { vendorFilterChipClass } from '@/modules/vendor/lib/filter-chip'
import {
  createVendorBillingLocalTestService, getErrorMessage, LocalTestHelperUnavailableError,
  PROTOTYPE_VENDOR_KEY, prototypeStateLabels, prototypeStates,
  type BillingAction, type PrototypeState,
} from '@/shared/api'
import { Button, Card } from '@/shared/components/ui'
import { cn } from '@/shared/lib/utils'
import { CheckoutBeforeOpenError, openSubscriptionCheckout } from '@/shared/payments/razorpay-checkout'

type CheckoutAction = Exclude<BillingAction, 'cancel'>
/** Keep shop open is a future-start AutoPay at the paid-through date, like trial AutoPay at the trial end. */
type CheckoutPurpose = CheckoutAction | 'keep_shop_open'
const actionOf = (purpose: CheckoutPurpose): CheckoutAction => purpose === 'keep_shop_open' ? 'setup_autopay' : purpose

/** What a closed or failed Checkout says for each purpose; the state is unchanged either way. */
const checkoutNotices: Record<CheckoutPurpose, { dismissed: string; failed: (message: string) => string }> = {
  setup_autopay: {
    dismissed: 'Checkout was closed before AutoPay was set up. Nothing changed; your free days are the same.',
    failed: (message) => `The card payment did not go through (${message}), so AutoPay is not set up. Nothing changed; your free days are the same.`,
  },
  pay_first_fee: {
    dismissed: 'Checkout was closed before the ₹299 was paid. Nothing changed; your shop is still hidden.',
    failed: (message) => `The card payment did not go through (${message}). Nothing changed; your shop is still hidden.`,
  },
  keep_shop_open: {
    dismissed: 'Checkout was closed before AutoPay was set up again. Nothing changed; the plan is still stopped.',
    failed: (message) => `The card payment did not go through (${message}), so AutoPay is not set up again. Nothing changed; the plan is still stopped.`,
  },
}

/** Razorpay Test keeps a finished Checkout's outcome even when its callback never reaches the helper; a reread finds it. */
const lostResultNotice = 'Checkout finished, but its result did not reach the local helper, so this shows what Razorpay Test reports. If the payment is not shown yet, refresh Plan in a moment rather than paying again.'

const toneClass: Record<PrototypeCard['tone'], string> = {
  neutral: '',
  danger: 'border-destructive/30 bg-destructive/[0.04]',
  warning: 'border-amber-300 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/30',
}

function StateCard({ card, actionDisabled, onAction, children }: { card: PrototypeCard; actionDisabled: boolean; onAction?: () => void; children?: ReactNode }) {
  return <Card className={cn('grid gap-3 p-5', toneClass[card.tone])}>
    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{card.eyebrow}</p>
    {'days' in card.figure
      ? <p className="flex items-baseline gap-2"><span className="font-display text-5xl font-bold">{card.figure.days}</span><span className="text-lg text-muted-foreground">days left</span></p>
      : <h2 className="font-display text-4xl font-bold">{card.figure.headline}</h2>}
    <p>{card.body}</p>
    {card.sample ? <p className="text-sm text-muted-foreground">{card.sample}</p> : null}
    <p className="text-sm font-semibold text-primary">{card.plan}</p>
    {card.action ? <div className="grid gap-1">
      <Button size="lg" fullWidth className="rounded-full" disabled={actionDisabled} onClick={onAction}>{card.action.label}</Button>
      <p className="text-xs text-muted-foreground">{card.action.help}</p>
    </div> : null}
    {card.autoPay ? <p className="font-semibold text-primary">{card.autoPay}</p> : null}
    {children}
  </Card>
}

const whatYouGet = ['Your own shop link', 'Customers order on WhatsApp', 'Share on Instagram and Facebook', 'Add products and prices', 'See all orders in one place']
const ifYouDoNotPay = ['Customers cannot open your shop', 'New orders stop', 'You can still see old orders', 'You can pay again any time']

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId()
  return <Card role="region" aria-labelledby={id} className="grid gap-3 p-5">
    <h2 id={id} className="font-display text-lg font-bold">{title}</h2>
    {children}
  </Card>
}

function History({ rows }: { rows: PrototypeHistoryRow[] }) {
  // A scenario stored before history was seeded has no rows until a state is chosen again.
  if (!rows.length) return <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
  return <ul className="grid gap-2">
    {rows.map((row, index) => <li key={index} className="rounded-xl border bg-muted/30 px-3 py-2.5">
      <p className="text-sm font-semibold">{row.title}</p>
      <p className="text-xs text-muted-foreground">{row.detail} · {row.when}</p>
    </li>)}
  </ul>
}

/**
 * DEV-only demo Plan: six seeded shop-plan states kept by the local helper under its own vendor key.
 * Choosing a chip resets the current prototype scenario (the guarded reset) and then selects the new one.
 * The displayed state is shared with the console chrome, which shows its banner on every page, Plan included.
 */
export function VendorBillingPrototype() {
  const service = useMemo(() => createVendorBillingLocalTestService(), [])
  const { helper, shown } = useBillingPrototype()
  /** The chip being switched to, kept while a reset stays unconfirmed. */
  const [target, setTarget] = useState<PrototypeState | null>(null)
  const [busy, setBusy] = useState(false)
  const [resetPending, setResetPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** A Checkout outcome that left the state unchanged. */
  const [notice, setNotice] = useState<string | null>(null)
  /** One logical reset per generation: a retry reuses its key. */
  const resetKey = useRef<string | null>(null)
  /** Set synchronously, so a second click cannot open a second Checkout. */
  const inFlight = useRef(false)
  /** One logical preparation per generation and action: a retry after a closed Checkout reuses it. */
  const preparation = useRef<{ generation: number; action: CheckoutAction; key: string } | null>(null)
  /** One logical turn-off or stop: a retry of an unanswered request reuses its key. */
  const cancelKey = useRef<string | null>(null)
  /** Stop the plan's single confirm step is open. */
  const [confirmStop, setConfirmStop] = useState(false)
  const lifecycle = useRef<AbortController | null>(null)

  function handleFailure(cause: unknown, fallback: PrototypeState) {
    if (cause instanceof LocalTestHelperUnavailableError) showLocalPrototypeState(fallback)
    else setError(getErrorMessage(cause))
  }

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    lifecycle.current = controller
    // Shared with the chrome: a read it already started is joined rather than repeated.
    loadPrototypeState().then((value) => { if (active && value) setResetPending(Boolean(value.reset)) },
      (cause: unknown) => { if (active) setError(getErrorMessage(cause)) })
    return () => { active = false; controller.abort() }
  }, [])

  async function switchTo(next: PrototypeState) {
    if (helper === 'down') { showLocalPrototypeState(next); return }
    if (busy) return
    setBusy(true)
    setTarget(next)
    setError(null)
    setNotice(null)
    try {
      let value = await service.readScenario(PROTOTYPE_VENDOR_KEY)
      if (value.scenario && value.generation !== null && (value.scenario !== next || value.reset)) {
        resetKey.current ??= crypto.randomUUID()
        value = await service.resetScenario(PROTOTYPE_VENDOR_KEY, { scenario: value.scenario, generation: value.generation }, resetKey.current)
        if (value.scenario) { setResetPending(true); return }
        resetKey.current = null
      }
      if (!value.scenario) {
        await service.selectScenario(PROTOTYPE_VENDOR_KEY, next)
        value = await service.readScenario(PROTOTYPE_VENDOR_KEY)
      }
      showHelperScenario(value)
      setResetPending(false)
      setTarget(null)
      setConfirmStop(false)
      cancelKey.current = null
    } catch (cause) {
      handleFailure(cause, next)
      setTarget(null)
    } finally { setBusy(false) }
  }

  async function reread(signal: AbortSignal) {
    const value = await service.readScenario(PROTOTYPE_VENDOR_KEY)
    if (!signal.aborted) showHelperScenario(value)
    return value
  }

  /** Runs one helper-backed action at a time; the state changes only from the helper's reread. */
  async function act(run: (signal: AbortSignal) => Promise<void>) {
    const signal = lifecycle.current?.signal
    if (inFlight.current || !shown || !signal || signal.aborted) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    setNotice(null)
    try { await run(signal) } catch (cause) {
      if (signal.aborted) return
      if (cause instanceof LocalTestHelperUnavailableError) { markPrototypeHelperDown(); return }
      setError(getErrorMessage(cause))
      // The outcome is unknown, so show whatever the helper now has.
      await reread(signal).catch(() => undefined)
    } finally {
      inFlight.current = false
      if (!signal.aborted) setBusy(false)
    }
  }

  /**
   * Opens hosted Test Checkout for the helper's preparation: future-start AutoPay at the trial end or paid-through
   * date, or ₹299 collected now. The helper verifies the callback and reads Razorpay Test before anything changes.
   */
  const payWithCheckout = (purpose: CheckoutPurpose) => act(async (signal) => {
    const generation = shown?.generation
    if (!generation) return
    const action = actionOf(purpose)
    if (preparation.current?.generation !== generation || preparation.current.action !== action) preparation.current = { generation, action, key: crypto.randomUUID() }
    const attempt = await service.prepareCheckout(PROTOTYPE_VENDOR_KEY, action, preparation.current.key)
    if (!attempt.config) throw new Error('Test Checkout configuration is missing.')
    const failure = { message: null as string | null }
    let result
    try { result = await openSubscriptionCheckout(attempt.config, { signal, onPaymentFailure: (message) => { failure.message = message } }) } catch (cause) {
      if (cause instanceof CheckoutBeforeOpenError) { setError(getErrorMessage(cause)); return }
      throw cause
    }
    if (signal.aborted) return
    if (result.status === 'dismissed') {
      setNotice(failure.message ? checkoutNotices[purpose].failed(failure.message) : checkoutNotices[purpose].dismissed)
      await reread(signal)
      return
    }
    try { await service.submitCheckout(attempt, result.callback) } catch (cause) {
      // The payment may already be taken, so one lost request is not reported as the helper being down: the reread
      // below shows what Razorpay Test has, and only if it fails too is the helper shown down.
      if (!(cause instanceof LocalTestHelperUnavailableError)) throw cause
      setNotice(lostResultNotice)
    } finally {
      result.callback.razorpay_payment_id = ''
      result.callback.razorpay_subscription_id = ''
      result.callback.razorpay_signature = ''
    }
    preparation.current = null
    await reread(signal)
  })

  /** Cancels through the helper; Free days return only once a Razorpay Test read shows AutoPay closed. */
  const turnOffAutoPay = () => act(async (signal) => {
    cancelKey.current ??= crypto.randomUUID()
    await service.requestCancellation(PROTOTYPE_VENDOR_KEY, cancelKey.current)
    if ((await reread(signal)).autoPay?.status !== 'turning_off') cancelKey.current = null
  })

  /**
   * Stops Paid through the helper: the sample locally, a paid Test subscription at cycle end. Stopped shows
   * only once the helper records the stop, so an unanswered request leaves Paid and is retried with its key.
   */
  const stopPlan = () => act(async (signal) => {
    cancelKey.current ??= crypto.randomUUID()
    await service.requestCancellation(PROTOTYPE_VENDOR_KEY, cancelKey.current)
    setConfirmStop(false)
    if ((await reread(signal)).scenario !== 'paid') cancelKey.current = null
  })

  const checkAgain = () => act(async (signal) => { await reread(signal) })

  const trial = shown && isTrialState(shown.state) ? shown : null
  const payNow = shown && isPayNowState(shown.state) ? shown : null
  const stopped = shown?.state === 'stopped' ? shown : null
  // The card's one action: trial AutoPay, ₹299 now or Keep shop open. Paid has none; it stops from its own section.
  const cardAction: CheckoutPurpose | null = trial ? 'setup_autopay' : payNow ? 'pay_first_fee' : stopped ? 'keep_shop_open' : null
  const settingUp = trial ?? stopped
  const waiting = settingUp?.autoPay ? autoPayWaitNotice(settingUp.autoPay.status, settingUp.autoPay.chargeAt)
    : payNow?.payment?.status === 'pending' ? confirmingPaymentNotice
      : shown?.state === 'paid' && shown.autoPay?.status === 'turning_off' ? stopWaitNotice : null
  const card = shown ? prototypeView(shown).card : null
  const actionsDisabled = helper !== 'up' || busy || resetPending
  return <div className="grid gap-4">
    {helper === 'down' ? <p role="status" className="rounded-xl bg-amber-50/80 p-4 text-sm text-amber-950 dark:bg-amber-950/35 dark:text-amber-100">
      The local Test helper is not running, so payment buttons are off. Start it with npm run dev:billing-helper, then refresh Plan.
      The chips below still switch this screen, but the choice is not saved.
    </p> : null}
    {card ? <StateCard card={card} actionDisabled={actionsDisabled || Boolean(cardAction && !shown?.actions.includes(actionOf(cardAction)))}
      onAction={cardAction ? () => void payWithCheckout(cardAction) : undefined}>
      {waiting ? <div className="grid gap-2 text-sm">
        <p role="status">{waiting}</p>
        <Button className="w-fit" variant="outline" size="sm" disabled={actionsDisabled} onClick={() => void checkAgain()}>Check again</Button>
      </div> : null}
      {trial?.actions.includes('cancel') ? <Button className="w-fit px-0" variant="link" disabled={actionsDisabled} onClick={() => void turnOffAutoPay()}>Turn off AutoPay</Button> : null}
    </StateCard>
      : helper === 'reading' && !error ? <p role="status">Reading shop plan…</p> : null}
    {notice ? <p role="status" className="text-sm">{notice}</p> : null}
    {resetPending ? <div role="alert" className="grid gap-2 text-sm">
      <p>The previous state still has a Razorpay Test subscription that is not confirmed cancelled, so the switch is waiting. Retry once Razorpay Test has caught up.</p>
      <Button className="w-fit" variant="outline" disabled={busy} onClick={() => void switchTo(target ?? shown?.state ?? 'free_days')}>Retry switch</Button>
    </div> : null}
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    {shown ? <>
      <Section title="What you get">
        <ul className="grid list-disc gap-1.5 pl-5 text-sm">{whatYouGet.map((item) => <li key={item}>{item}</li>)}</ul>
      </Section>
      {shown.state === 'paid' ? null : <Section title="If you do not pay">
        <ul className="grid list-disc gap-1.5 pl-5 text-sm text-[var(--badge-warning-fg)]">{ifYouDoNotPay.map((item) => <li key={item}>{item}</li>)}</ul>
      </Section>}
      <Section title="Payments you made"><History rows={prototypeHistory(shown.seed, shown.now)} /></Section>
      {shown.state === 'paid' ? <Section title="Stop the plan">
        {confirmStop ? <>
          <p className="text-sm">{stopPlanConfirmation(shown.seed.paidThrough)}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" className="w-fit rounded-full" disabled={actionsDisabled} onClick={() => void stopPlan()}>Yes, stop the plan</Button>
            <Button variant="outline" className="w-fit rounded-full" disabled={busy} onClick={() => setConfirmStop(false)}>Keep the plan</Button>
          </div>
        </> : <>
          <p className="text-sm text-muted-foreground">Stop any time. The shop stays open until the days you already paid for are over.</p>
          <Button variant="outline" className="w-fit rounded-full" disabled={actionsDisabled || !shown.actions.includes('cancel')} onClick={() => setConfirmStop(true)}>Stop the plan</Button>
        </>}
      </Section> : null}
    </> : null}
    <Card className="grid gap-2 bg-muted/40">
      <h2 className="text-sm font-semibold">Prototype: try each shop-plan state</h2>
      <p className="text-xs text-muted-foreground">Not a live payment. Use these to walk through the screens.</p>
      <div className="flex flex-wrap gap-2">
        {prototypeStates.map((state) => <button key={state} type="button" aria-pressed={shown?.state === state}
          className={vendorFilterChipClass(shown?.state === state)} disabled={helper === 'reading' && !error} onClick={() => void switchTo(state)}>
          {target === state ? 'Switching…' : prototypeStateLabels[state]}
        </button>)}
      </div>
    </Card>
  </div>
}
