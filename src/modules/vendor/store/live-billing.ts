import { useEffect, useSyncExternalStore } from 'react'
import { liveBillingService, mapLiveBilling, mapLivePlanName, type LiveBillingView } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'

/**
 * The Live API billing read, shared by Plan and the console chrome so they cannot disagree. One read
 * covers the subscription and the plans list; if either fails, the whole read fails.
 *
 * The read belongs to one vendor and one session. A session or vendor change clears it, and a
 * response that lands after that is dropped, so the next vendor on this browser never sees it.
 */
export interface LiveBillingRead {
  view: LiveBillingView | null
  /** The subscription's plan name, for the rail and Settings; the vendor context no longer has it. */
  planName: string | null
  error: unknown
  reading: boolean
}

/** `plans` is the last plans response, so a cancel response can be mapped without reading it again. */
interface Snapshot extends LiveBillingRead { vendorId: string | null; plans: unknown }

const empty: Snapshot = { vendorId: null, plans: null, view: null, planName: null, error: null, reading: false }
/** What a vendor sees before its first read lands. */
const unread: LiveBillingRead = { view: null, planName: null, error: null, reading: true }
let snapshot = empty
let generation = 0
let inFlight: { vendorId: string; generation: number; controller: AbortController; promise: Promise<void> } | null = null
const listeners = new Set<() => void>()

function publish(next: Snapshot) {
  snapshot = next
  listeners.forEach((listener) => listener())
}

/** Reads the vendor's billing. A read already in flight for that vendor is joined. It never rejects. */
export function readLiveBilling(vendorId: string): Promise<void> {
  if (inFlight?.vendorId === vendorId) return inFlight.promise
  inFlight?.controller.abort()
  const claim = ++generation
  const controller = new AbortController()
  const current = () => claim === generation && useAuthStore.getState().user?.vendorId === vendorId
  publish({ ...(snapshot.vendorId === vendorId ? snapshot : empty), vendorId, reading: true })

  const promise = (async () => {
    try {
      const [read, plans] = await Promise.all([
        liveBillingService.readSubscription(vendorId, { signal: controller.signal }),
        liveBillingService.listPaidPlans({ signal: controller.signal }),
      ])
      if (current()) publish({ vendorId, plans, view: mapLiveBilling(read, plans, new Date()), planName: mapLivePlanName(read), error: null, reading: false })
    } catch (error) {
      if (current()) publish({ vendorId, plans: null, view: null, planName: null, error, reading: false })
    } finally {
      if (inFlight?.generation === claim) inFlight = null
    }
  })()
  inFlight = { vendorId, generation: claim, controller, promise }
  return promise
}

/**
 * Turns off AutoPay or stops the plan. The response is the subscription, so it replaces the vendor's
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
  generation += 1
  inFlight?.controller.abort()
  inFlight = null
  publish({ ...snapshot, view, planName: mapLivePlanName(read), error: null, reading: false })
}

/** Forgets the read and drops any response still on its way. */
export function resetLiveBilling() {
  generation += 1
  inFlight?.controller.abort()
  inFlight = null
  publish(empty)
}

// A new session, a sign-out or a vendor switch all replace the session's user.
useAuthStore.subscribe((state, previous) => {
  if (state.user !== previous.user) resetLiveBilling()
})

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
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
