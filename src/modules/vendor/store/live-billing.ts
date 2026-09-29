import { useEffect, useSyncExternalStore } from 'react'
import { isBriefOutage, pause, retryDelays } from '@/modules/vendor/lib/live-billing-retry'
import { isSettledView } from '@/modules/vendor/lib/live-billing-wording'
import { liveBillingService, mapLiveBilling, mapLivePlanName, mapLiveTrialStart, type LiveBillingView } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'

/**
 * The Live API billing read, shared by Plan and the console chrome so they cannot disagree. One read
 * covers the subscription and the plans list; if either fails, the whole read fails.
 *
 * The read belongs to one vendor and one session. A session or vendor change clears it, and a
 * response that lands after that is dropped, so the next vendor on this browser never sees it.
 * The confirmation hold lives beside it, in memory only, and is cleared with it.
 */
export interface LiveBillingRead {
  /** The last view read. A failed reread keeps it, with its plan name, beside the error. */
  view: LiveBillingView | null
  /** The subscription's plan name, for the rail and Settings; the vendor context no longer has it. */
  planName: string | null
  /** When the free days started, for Plan's "Payments you made". */
  trialStartedAt: string | null
  /** The last read's failure, or `null` once a read lands. A 502, 503 or network failure here has run out of retries. */
  error: unknown
  reading: boolean
  /**
   * The confirmation hold's waiting line, or `null` when there is no hold. From Checkout's success
   * until a settled read, Plan keeps the card's Checkout action off, so a payment that may still be
   * in flight is never offered twice. It survives leaving Plan; a reload, sign-out or vendor change
   * ends it.
   */
  hold: string | null
}

/** `plans` is the last plans response, so a cancel response can be mapped without reading it again. */
interface Snapshot extends LiveBillingRead { vendorId: string | null; plans: unknown }

const empty: Snapshot = { vendorId: null, plans: null, view: null, planName: null, trialStartedAt: null, error: null, reading: false, hold: null }
/** What a vendor sees before its first read lands. */
const unread: LiveBillingRead = { view: null, planName: null, trialStartedAt: null, error: null, reading: true, hold: null }
let snapshot = empty
let generation = 0
/** The read in flight; `waiting` while it waits to retry. */
let inFlight: { vendorId: string; generation: number; controller: AbortController; waiting: boolean; promise: Promise<void> } | null = null
const listeners = new Set<() => void>()
/** The reread at the shown view's next T or P. */
let boundaryTimer: number | undefined

/**
 * A new view sets the boundary timer again; a session or vendor change leaves none to set. A settled
 * view ends the confirmation hold.
 */
function publish(next: Snapshot) {
  const viewChanged = next.view !== snapshot.view
  snapshot = next.hold !== null && next.view !== null && isSettledView(next.view) ? { ...next, hold: null } : next
  if (viewChanged) armBoundary()
  listeners.forEach((listener) => listener())
}

/**
 * Reads the vendor's billing. A read already in flight for that vendor, including its retries, is
 * joined. A 502, 503 or network failure is retried quietly 5, 15 and 30 s apart before it shows,
 * unless nothing shows the read any more. It never rejects.
 */
export function readLiveBilling(vendorId: string): Promise<void> {
  if (inFlight?.vendorId === vendorId) return inFlight.promise
  inFlight?.controller.abort()
  const claim = ++generation
  const controller = new AbortController()
  const flight = { vendorId, generation: claim, controller, waiting: false }
  const current = () => claim === generation && useAuthStore.getState().user?.vendorId === vendorId
  publish({ ...(snapshot.vendorId === vendorId ? snapshot : empty), vendorId, reading: true })

  const promise = (async () => {
    try {
      for (let retry = 0; ; retry += 1) {
        try {
          const [read, plans] = await Promise.all([
            liveBillingService.readSubscription(vendorId, { signal: controller.signal }),
            liveBillingService.listPaidPlans({ signal: controller.signal }),
          ])
          if (current()) publish({ vendorId, plans, view: mapLiveBilling(read, plans, new Date()), planName: mapLivePlanName(read), trialStartedAt: mapLiveTrialStart(read), error: null, reading: false, hold: snapshot.hold })
          return
        } catch (error) {
          if (!current()) return
          if (isBriefOutage(error) && retry < retryDelays.length) {
            flight.waiting = true
            await pause(retryDelays[retry], controller.signal)
            flight.waiting = false
            if (!current()) return
            continue
          }
          // A failed reread keeps the last view on screen, beside the error.
          publish({ ...snapshot, error, reading: false })
          return
        }
      }
    } finally {
      if (inFlight?.generation === claim) inFlight = null
    }
  })()
  inFlight = Object.assign(flight, { promise })
  return promise
}

/**
 * Stops the plan. The response is the subscription, so it replaces the vendor's
 * view directly, with no reread; a read still on its way is dropped. A failure rejects and leaves
 * the view as it was. It is shown even after Plan unmounts, so the chrome stays true; only a session
 * or vendor change drops it.
 */
export async function cancelLiveBilling(vendorId: string): Promise<void> {
  const user = useAuthStore.getState().user
  const subscription = await liveBillingService.cancel(vendorId)
  if (useAuthStore.getState().user !== user || snapshot.vendorId !== vendorId || !snapshot.plans) return
  const read = { kind: 'subscription', subscription } as const
  const view = mapLiveBilling(read, snapshot.plans, new Date())
  dropRead()
  publish({ ...snapshot, view, planName: mapLivePlanName(read), trialStartedAt: mapLiveTrialStart(read), error: null, reading: false })
}

/**
 * Starts the confirmation hold once Checkout reports a payment, with the Checkout action's waiting
 * line. Only a settled read ends it.
 */
export function holdLiveBilling(vendorId: string, waiting: string) {
  if (snapshot.vendorId === vendorId) publish({ ...snapshot, hold: waiting })
}

/** Drops the read in flight, so neither its response nor its retries land. */
function dropRead() {
  generation += 1
  inFlight?.controller.abort()
  inFlight = null
}

/** Forgets the read and drops any response still on its way. */
export function resetLiveBilling() {
  dropRead()
  publish(empty)
}

// A new session, a sign-out or a vendor switch all replace the session's user.
useAuthStore.subscribe((state, previous) => {
  if (state.user !== previous.user) resetLiveBilling()
})

/*
  While anything shows the read, it stays current: returning to the window rereads it, and so does
  the view's next T or P, when its free days or paid days end. Day counts stay as read until then.
  There is one focus listener and one timer however many components show the read, so they cause
  one reread. Once nothing shows it, a read waiting to retry gives up, and the next showing reads
  afresh.
*/

/** The longest delay a browser timer takes (about 24.8 days); a longer one runs at once. */
const maxTimerDelay = 2 ** 31 - 1

/** The view's T or P, while it is still ahead. */
function nextBoundary(view: LiveBillingView | null): number | null {
  const boundary = view && 'trialEndsAt' in view ? view.trialEndsAt : view && 'paidThrough' in view ? view.paidThrough : null
  const at = boundary === null ? null : Date.parse(boundary)
  return at !== null && at > Date.now() ? at : null
}

/**
 * Sets the timer for the shown view's next T or P, replacing any earlier one. A paid period can be
 * 30 days away, beyond the longest timer, so a long wait is set in steps.
 */
function armBoundary() {
  if (boundaryTimer !== undefined) window.clearTimeout(boundaryTimer)
  boundaryTimer = undefined
  const { vendorId, view } = snapshot
  const at = listeners.size > 0 ? nextBoundary(view) : null
  if (vendorId === null || at === null) return
  const arm = () => {
    const delay = at - Date.now()
    boundaryTimer = delay > maxTimerDelay ? window.setTimeout(arm, maxTimerDelay) : window.setTimeout(() => void readLiveBilling(vendorId), delay)
  }
  arm()
}

/** Rereads for the signed-in vendor, and for no one after sign-out. */
function rereadOnFocus() {
  const vendorId = useAuthStore.getState().user?.vendorId
  if (vendorId) void readLiveBilling(vendorId)
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  if (listeners.size === 1) {
    window.addEventListener('focus', rereadOnFocus)
    armBoundary()
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size > 0) return
    window.removeEventListener('focus', rereadOnFocus)
    armBoundary()
    if (inFlight?.waiting) {
      dropRead()
      publish({ ...snapshot, reading: false })
    }
  }
}

/** The shared read for this vendor; another vendor's read is never returned. */
export function useLiveBilling(vendorId: string): LiveBillingRead {
  const current = useSyncExternalStore(subscribe, () => snapshot)
  return current.vendorId === vendorId ? current : unread
}

/**
 * The shared read for this vendor, started when none is loaded: the chrome, the rail and Settings
 * use it. A read already in flight, such as Plan's, is joined.
 */
export function useStartedLiveBilling(vendorId: string): LiveBillingRead {
  // A new session clears the shared read, even for the same vendor, so it is read again.
  const sessionUser = useAuthStore((state) => state.user)
  const read = useLiveBilling(vendorId)
  const loaded = read.view !== null || read.error !== null

  // The shared read drops a response for a previous vendor or session, so there is nothing to cancel here.
  useEffect(() => {
    if (!loaded) void readLiveBilling(vendorId)
  }, [vendorId, sessionUser, loaded])

  return read
}
