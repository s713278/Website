import { useEffect, useSyncExternalStore } from 'react'
import { isBriefOutage, pause, retryDelays } from '@/modules/vendor/lib/live-billing-retry'
import { isSettledView, liveBillingWording } from '@/modules/vendor/lib/live-billing-wording'
import { liveBillingService, mapLiveBilling, mapLivePlanName, mapLiveTrialEnd, mapLiveTrialStart, type LiveBillingView } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'

/**
 * The Live API billing read, shared by Plan and the console chrome so they cannot disagree. One read
 * covers the subscription and the plans list; if either fails, the whole read fails. The plans list
 * is read once per page load and shared by every later read.
 *
 * The read belongs to one vendor and one session. A session or vendor change clears it, and a
 * response that lands after that is dropped, so the next vendor on this browser never sees it.
 * The confirmation hold lives beside it, in memory only, and is cleared with it; so does Plan's last
 * good history (TEMP(vendor-billing-reads): see docs/VENDOR_BILLING_READS_TARGET.md).
 */
export interface LiveBillingRead {
  /** The last view read. A failed reread keeps it, with its plan name, beside the error. */
  view: LiveBillingView | null
  /** The subscription's plan name, for the rail and Settings; the vendor context no longer has it. */
  planName: string | null
  /** When the free days started, for Plan's "Payments you made". */
  trialStartedAt: string | null
  /** When the free days end, for the shell's Free plan banner. */
  trialEndsAt: string | null
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

/**
 * `plans` is the last plans response, so a cancel response can be mapped without reading it again.
 * `readAt` is when the view last landed, or `null` when another tab says it is out of date.
 * `signature` is the content of the subscription response the view came from, so Plan's history
 * knows whether the subscription changed.
 */
// TEMP(vendor-billing-reads): see docs/VENDOR_BILLING_READS_TARGET.md.
interface Snapshot extends LiveBillingRead { vendorId: string | null; plans: unknown; readAt: number | null; signature: string | null }

const empty: Snapshot = { vendorId: null, plans: null, readAt: null, signature: null, view: null, planName: null, trialStartedAt: null, trialEndsAt: null, error: null, reading: false, hold: null }
/** What a vendor sees before its first read lands. */
const unread: LiveBillingRead = { view: null, planName: null, trialStartedAt: null, trialEndsAt: null, error: null, reading: true, hold: null }
let snapshot = empty
let generation = 0
/** The read in flight; `waiting` while it waits to retry. */
let inFlight: { vendorId: string; generation: number; controller: AbortController; waiting: boolean; promise: Promise<void> } | null = null
const listeners = new Set<() => void>()
/** The reread at the shown view's next T or P. */
let boundaryTimer: number | undefined
// TEMP(vendor-billing-reads): see docs/VENDOR_BILLING_READS_TARGET.md.
/** The plans list, read once per page load and kept across sessions: it is public and holds no vendor data. */
let plansRead: Promise<unknown> | null = null
// TEMP(vendor-billing-reads): see docs/VENDOR_BILLING_READS_TARGET.md.
/** Tells the browser's other tabs that a vendor's billing changed, while anything here shows the read. */
let channel: BroadcastChannel | null = null
// TEMP(vendor-billing-reads): see docs/VENDOR_BILLING_READS_TARGET.md.
/** Counts other tabs' messages, so a read that started before one does not count as fresh. */
let announcements = 0
// TEMP(vendor-billing-reads): see docs/VENDOR_BILLING_READS_TARGET.md.
/** Plan's last good history read, with the subscription response it was read against; memory only. */
let historyRead: { vendorId: string; signature: string; events: unknown } | null = null
// TEMP(vendor-billing-reads): see docs/VENDOR_BILLING_READS_TARGET.md.
/** Counts resets, so a history read that lands after one is not kept. */
let resets = 0

// TEMP(vendor-billing-reads): see docs/VENDOR_BILLING_READS_TARGET.md.
function readPlans(): Promise<unknown> {
  if (plansRead) return plansRead
  // No signal: one read's abort must not fail the plans list every later read shares.
  const read = liveBillingService.listPaidPlans()
  plansRead = read
  read.catch(() => {
    if (plansRead === read) plansRead = null
  })
  return read
}

/** Lets each test read the plans list afresh; the app never forgets it. */
// TEMP(vendor-billing-reads): see docs/VENDOR_BILLING_READS_TARGET.md.
export function resetLiveBillingPlansForTests() {
  plansRead = null
}

// TEMP(vendor-billing-reads): see docs/VENDOR_BILLING_READS_TARGET.md.
function announce(vendorId: string | null) {
  if (vendorId !== null) channel?.postMessage({ vendorId })
}

/**
 * A new view sets the boundary timer again; a session or vendor change leaves none to set. A settled
 * view ends the confirmation hold.
 */
function publish(next: Snapshot) {
  const viewChanged = next.view !== snapshot.view
  const settled = next.hold !== null && next.view !== null && isSettledView(next.view)
  snapshot = settled ? { ...next, hold: null } : next
  if (viewChanged) armBoundary()
  // TEMP(vendor-billing-reads): see docs/VENDOR_BILLING_READS_TARGET.md.
  if (settled) announce(next.vendorId)
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
        // TEMP(vendor-billing-reads): see docs/VENDOR_BILLING_READS_TARGET.md.
        const seen = announcements
        try {
          const [read, plans] = await Promise.all([
            liveBillingService.readSubscription(vendorId, { signal: controller.signal }),
            // TEMP(vendor-billing-reads): see docs/VENDOR_BILLING_READS_TARGET.md.
            readPlans(),
          ])
          // TEMP(vendor-billing-reads): a read that started before another tab's message may predate its change.
          if (current()) publish({ vendorId, plans, readAt: seen === announcements ? Date.now() : null, signature: JSON.stringify(read), view: mapLiveBilling(read, plans, new Date()), planName: mapLivePlanName(read), trialStartedAt: mapLiveTrialStart(read), trialEndsAt: mapLiveTrialEnd(read), error: null, reading: false, hold: snapshot.hold })
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
  // TEMP(vendor-billing-reads): see docs/VENDOR_BILLING_READS_TARGET.md.
  publish({ ...snapshot, readAt: Date.now(), signature: JSON.stringify(read), view, planName: mapLivePlanName(read), trialStartedAt: mapLiveTrialStart(read), trialEndsAt: mapLiveTrialEnd(read), error: null, reading: false })
  announce(vendorId)
}

/**
 * Starts the confirmation hold once Checkout reports a payment, with the Checkout action's waiting
 * line. Only a settled read ends it.
 */
export function holdLiveBilling(vendorId: string, waiting: string) {
  if (snapshot.vendorId !== vendorId) return
  publish({ ...snapshot, hold: waiting })
  // TEMP(vendor-billing-reads): see docs/VENDOR_BILLING_READS_TARGET.md.
  announce(vendorId)
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
  // TEMP(vendor-billing-reads): see docs/VENDOR_BILLING_READS_TARGET.md.
  historyRead = null
  resets += 1
  publish(empty)
}

/**
 * The vendor's last good history, while the subscription response it was read against is still the
 * shown one; otherwise `undefined`, and the history must be read again.
 */
// TEMP(vendor-billing-reads): see docs/VENDOR_BILLING_READS_TARGET.md.
export function keptLiveHistory(vendorId: string): unknown {
  return historyRead && snapshot.vendorId === vendorId && historyRead.vendorId === vendorId && historyRead.signature === snapshot.signature ? historyRead.events : undefined
}

/**
 * Reads the vendor's history and keeps a good one against the shown subscription response. Plan's
 * read on open starts just after its sections mount, so this first waits a tick and for any read in
 * flight to land; that read's landing usually supersedes this one, which then sends nothing.
 */
// TEMP(vendor-billing-reads): see docs/VENDOR_BILLING_READS_TARGET.md.
export async function readLiveHistory(vendorId: string, signal: AbortSignal): Promise<unknown> {
  await Promise.resolve()
  if (inFlight?.vendorId === vendorId) await inFlight.promise
  if (signal.aborted) throw signal.reason
  const signature = snapshot.vendorId === vendorId ? snapshot.signature : null
  const claim = resets
  const events = await liveBillingService.readHistory(vendorId, { signal })
  if (!signal.aborted && signature !== null && claim === resets) historyRead = { vendorId, signature, events }
  return events
}

// A new session, a sign-out or a vendor switch all replace the session's user.
useAuthStore.subscribe((state, previous) => {
  if (state.user !== previous.user) resetLiveBilling()
})

/*
  While anything shows the read, it stays current: returning to the window rereads it once it is
  15 minutes old, has failed, waits on a payment (a hold or a Confirming view), or another tab has
  changed the vendor's billing; so does the view's next T or P, when its free days or paid days end.
  Day counts stay as read until then. There is one focus listener, one timer and one channel to
  other tabs however many components show the read, so they cause one reread. Once nothing shows
  it, a read waiting to retry gives up, and the next showing reads afresh.
  TEMP(vendor-billing-reads): see docs/VENDOR_BILLING_READS_TARGET.md.
*/

// TEMP(vendor-billing-reads): see docs/VENDOR_BILLING_READS_TARGET.md.
/** How long a read stays fresh enough that returning to the window does not reread it. */
const freshFor = 15 * 60_000

/** The longest delay a browser timer takes (about 24.8 days); a longer one runs at once. */
const maxTimerDelay = 2 ** 31 - 1

/** The view's next T or P still ahead. Paid with the free days kept carries both, and T comes first. */
function nextBoundary(view: LiveBillingView | null): number | null {
  const boundaries = [view && 'trialEndsAt' in view ? view.trialEndsAt : null, view && 'paidThrough' in view ? view.paidThrough : null]
  const ahead = boundaries.flatMap((boundary) => boundary === null ? [] : [Date.parse(boundary)]).filter((at) => at > Date.now())
  return ahead.length > 0 ? Math.min(...ahead) : null
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

/** Rereads for the signed-in vendor, and for no one after sign-out, when the read may be out of date. */
function rereadOnFocus() {
  const vendorId = useAuthStore.getState().user?.vendorId
  if (vendorId && isStale(vendorId)) void readLiveBilling(vendorId)
}

// TEMP(vendor-billing-reads): see docs/VENDOR_BILLING_READS_TARGET.md.
function isStale(vendorId: string): boolean {
  const { readAt, error, hold, view } = snapshot
  return snapshot.vendorId !== vendorId || readAt === null || error !== null || hold !== null
    || (view !== null && liveBillingWording(view).confirming !== null) || Date.now() - readAt >= freshFor
}

// TEMP(vendor-billing-reads): see docs/VENDOR_BILLING_READS_TARGET.md.
/** Another tab changed this vendor's billing, so the next return to the window rereads it. */
function onAnnounced(event: MessageEvent<{ vendorId?: unknown }>) {
  if (snapshot.vendorId === null || event.data?.vendorId !== snapshot.vendorId) return
  announcements += 1
  publish({ ...snapshot, readAt: null })
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  if (listeners.size === 1) {
    window.addEventListener('focus', rereadOnFocus)
    // TEMP(vendor-billing-reads): see docs/VENDOR_BILLING_READS_TARGET.md.
    channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('md-vendor-billing') : null
    if (channel) channel.onmessage = onAnnounced
    armBoundary()
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size > 0) return
    window.removeEventListener('focus', rereadOnFocus)
    // TEMP(vendor-billing-reads): see docs/VENDOR_BILLING_READS_TARGET.md.
    channel?.close()
    channel = null
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
