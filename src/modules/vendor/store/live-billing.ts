import { useSyncExternalStore } from 'react'
import { liveBillingService, mapLiveBilling, type LiveBillingView } from '@/shared/api'
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
  error: unknown
  reading: boolean
}

interface Snapshot extends LiveBillingRead { vendorId: string | null }

const empty: Snapshot = { vendorId: null, view: null, error: null, reading: false }
/** What a vendor sees before its first read lands. */
const unread: LiveBillingRead = { view: null, error: null, reading: true }
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
      if (current()) publish({ vendorId, view: mapLiveBilling(read, plans, new Date()), error: null, reading: false })
    } catch (error) {
      if (current()) publish({ vendorId, view: null, error, reading: false })
    } finally {
      if (inFlight?.generation === claim) inFlight = null
    }
  })()
  inFlight = { vendorId, generation: claim, controller, promise }
  return promise
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
