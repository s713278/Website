/**
 * Counts the times this page left the vendor's attention: the tab hidden or shown, the window
 * blurred or focused. Another tab or device can only change the account while the page is away,
 * so an account read started before the latest count is no longer known to be current.
 *
 * A leaf module, like the caches that import it: no app imports. The listeners are installed
 * once, when the module first loads, and live as long as the page. Only the window's own blur
 * and focus count; an element's do not reach these listeners.
 */
let epoch = 0

const bump = (event: Event) => {
  // On the window's own blur and focus the window is the target, not an element on the page.
  if (event.type === 'visibilitychange' || event.target === event.currentTarget) epoch += 1
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', bump)
  window.addEventListener('blur', bump)
  window.addEventListener('focus', bump)
}

/** The current count. A read stamped with an older one predates an away. */
export function pageAwayEpoch(): number {
  return epoch
}
