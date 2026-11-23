/**
 * Counts, per vendor, the times another tab or device may have changed the account since a read:
 *
 * - the tab came back after being hidden for `AWAY_AFTER_MS` or longer (counts for every vendor);
 * - another tab of this browser announced a write for the vendor (`announceAccountWrite`).
 *
 * A read stamped with an older count is no longer known to be current. Shorter tab switches,
 * window blur and focus (DevTools, a file picker, a window side by side) do not count, so they
 * cost no reads; another device saving within that time is not detected.
 *
 * The count is per vendor because the caches that compare against it are keyed by vendor, and a
 * write announced for one vendor says nothing about another's account.
 *
 * A leaf module, like the caches that import it: no app imports. The listeners are installed
 * once, when the module first loads, and live as long as the page.
 */
export const AWAY_AFTER_MS = 15 * 60 * 1000

/** A transient note, not session state: a vendor id and a time, never field values. */
export const ACCOUNT_WRITE_SIGNAL_KEY = 'md-vendor-onboarding-saved-signal-v1'

let aways = 0
const writesElsewhere = new Map<string, number>()
let hiddenAt: number | null = null

if (typeof document !== 'undefined') {
  if (document.visibilityState === 'hidden') hiddenAt = Date.now()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt ??= Date.now()
      return
    }
    if (hiddenAt !== null && Date.now() - hiddenAt >= AWAY_AFTER_MS) aways += 1
    hiddenAt = null
  })
}

if (typeof window !== 'undefined') {
  // Fires only in the other tabs of this browser, never in the tab that wrote.
  window.addEventListener('storage', (event) => {
    if (event.key !== ACCOUNT_WRITE_SIGNAL_KEY || !event.newValue) return
    let vendorId: unknown
    try {
      vendorId = (JSON.parse(event.newValue) as { vendorId?: unknown } | null)?.vendorId
    } catch {
      return
    }
    if (typeof vendorId === 'string') writesElsewhere.set(vendorId, (writesElsewhere.get(vendorId) ?? 0) + 1)
  })
}

/** The current count for the vendor. A read stamped with an older one predates an away. */
export function pageAwayEpoch(vendorId: string): number {
  return aways + (writesElsewhere.get(vendorId) ?? 0)
}

/**
 * Tell this browser's other tabs that a write from this one may have changed the vendor's
 * account. The time makes every note a change, so each one reaches them.
 */
export function announceAccountWrite(vendorId: string): void {
  try {
    localStorage.setItem(ACCOUNT_WRITE_SIGNAL_KEY, JSON.stringify({ vendorId, at: Date.now() }))
  } catch {
    // Storage unavailable: other tabs fall back to the away rule.
  }
}
