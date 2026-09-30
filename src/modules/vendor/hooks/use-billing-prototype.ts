import { useEffect, useSyncExternalStore } from 'react'
import {
  isTrialState, prototypeBanner, prototypeCard, type PrototypeBanner, type PrototypeCard,
} from '@/modules/vendor/lib/billing-prototype-card'
import {
  createVendorBillingLocalTestService, isPrototypeState, LocalTestHelperUnavailableError, PROTOTYPE_VENDOR_KEY, prototypeSeed,
  type LocalTestScenarioState, type PrototypeSeed, type PrototypeState,
} from '@/shared/api'

/**
 * The DEV demo Plan prototype's state, shared by Plan and the console chrome (banner and header button)
 * so they cannot disagree after a transition. It imports no Checkout code: only Plan opens
 * Checkout, and it writes each helper reread here.
 */

export interface DisplayedState extends Pick<LocalTestScenarioState, 'generation' | 'autoPay' | 'payment' | 'actions'> { state: PrototypeState; seed: PrototypeSeed; now: Date }
export type PrototypeHelperStatus = 'reading' | 'up' | 'down'
interface Snapshot { helper: PrototypeHelperStatus; shown: DisplayedState | null }

/** Display-only: the shared seed, dated from the browser's clock. */
const localSeed = (state: PrototypeState): DisplayedState => ({ state, seed: prototypeSeed(state, new Date()), now: new Date(), generation: null, autoPay: null, payment: null, actions: [] })

function fromHelper({ scenario, seed, serverTime, generation, autoPay, payment, actions }: LocalTestScenarioState): DisplayedState | null {
  return isPrototypeState(scenario) && seed ? { state: scenario, seed, now: serverTime ? new Date(serverTime) : new Date(), generation, autoPay, payment, actions } : null
}

const initial: Snapshot = { helper: 'reading', shown: null }
let snapshot = initial
let loading: Promise<LocalTestScenarioState | null> | null = null
const listeners = new Set<() => void>()

function publish(next: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...next }
  listeners.forEach((listener) => listener())
}

/** Shows a state without the helper: the chips still switch the screen while it is down. */
export const showLocalPrototypeState = (state: PrototypeState) => publish({ helper: 'down', shown: localSeed(state) })

/** Keeps the last helper read on screen: the bare seed would hide an AutoPay agreement it recorded. */
export const markPrototypeHelperDown = () => publish({ helper: 'down' })

/** Shows a helper read, or throws for a scenario the prototype does not know. */
export function showHelperScenario(value: LocalTestScenarioState) {
  const next = fromHelper(value)
  if (!next) throw new Error('The local helper returned a scenario the prototype does not know. Choose a state again.')
  publish({ helper: 'up', shown: next })
}

/**
 * Reads the stored prototype scenario, selecting Free days when none is stored, and shows it. Callers
 * share one read in flight, so the shell and Plan never both select. With the helper down, Free days
 * shows display-only and this resolves `null`.
 *
 * The helper is `reading` meanwhile, keeping the last state on screen but Plan's actions off: the helper
 * serialises each vendor's requests, so a click during this read would be refused as already in progress.
 */
export function loadPrototypeState(): Promise<LocalTestScenarioState | null> {
  loading ??= (async () => {
    publish({ helper: 'reading' })
    const service = createVendorBillingLocalTestService()
    try {
      let value = await service.readScenario(PROTOTYPE_VENDOR_KEY)
      if (!value.scenario) {
        await service.selectScenario(PROTOTYPE_VENDOR_KEY, 'free_days')
        value = await service.readScenario(PROTOTYPE_VENDOR_KEY)
      }
      showHelperScenario(value)
      return value
    } catch (cause) {
      if (!(cause instanceof LocalTestHelperUnavailableError)) throw cause
      showLocalPrototypeState('free_days')
      return null
    }
  })().finally(() => { loading = null })
  return loading
}

/** Back to nothing read. The state is module-wide, so tests reset it between cases. */
export function resetBillingPrototypeState() {
  snapshot = initial
  loading = null
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useBillingPrototype(): Snapshot {
  return useSyncExternalStore(subscribe, () => snapshot)
}

export interface PrototypeView { card: PrototypeCard; banner: PrototypeBanner | null; header: string }

/** What the chrome and Plan's card show for one state, derived once so they cannot drift. */
export function prototypeView(shown: DisplayedState): PrototypeView {
  // Only a date the helper read from Razorpay Test is shown; nothing is inferred from the seed.
  const autoPaying = (isTrialState(shown.state) || shown.state === 'paid') && shown.autoPay && ['on', 'turning_off'].includes(shown.autoPay.status) ? shown.autoPay : null
  const autoPayChargeAt = autoPaying?.chargeAt ?? null
  // A Paid state reached by a captured ₹299 is real, not the labelled sample; so is its cycle-end stop.
  const verifiedFee = shown.payment?.verified ? { nextChargeAt: shown.payment.nextChargeAt, stopScheduled: shown.autoPay?.status === 'ending' } : null
  const retrying = shown.payment?.retrying ?? false
  const card = prototypeCard(shown.state, shown.seed, shown.now, autoPayChargeAt, verifiedFee, retrying)
  const banner = prototypeBanner(shown.state, shown.seed, shown.now, autoPayChargeAt, Boolean(verifiedFee), retrying)
  return { card, banner, header: banner?.action ?? 'Shop plan' }
}

/** For the chrome: the current view, reading the helper once if nothing has yet. */
export function useBillingPrototypeView(): PrototypeView | null {
  const { shown } = useBillingPrototype()
  useEffect(() => {
    if (snapshot.helper === 'reading') void loadPrototypeState().catch(() => undefined)
  }, [])
  return shown ? prototypeView(shown) : null
}
