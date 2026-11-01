import { useLayoutEffect, useState } from 'react'
// Inlined so the M draws with the ring on a slow network, not after it.
import logoDarkMd from '@/assets/logo_dark_md.png?inline'
import { LOADER_SHOW_DELAY_MS, useShowAfterDelay } from '@/shared/hooks/useShowAfterDelay'

// A chain of loads (session restore, then a route chunk, then the page's data) unmounts one
// loader and mounts the next. These keep the chain on one delay, counted from its first loader,
// and let a loader that takes over from a visible one appear at once, continuing its spin.
let mountedCount = 0
let visibleCount = 0
let lastUnmountedAt = 0
let lastVisibleAt = 0
let chainStartedAt = 0
// When the chain's first mark appeared; that mark starts its cycle at 0, as the wizard's does.
let chainVisibleSince = 0
const HANDOFF_WINDOW_MS = 200
const SPIN_PERIOD_MS = 2000

/** The delay left for a loader mounting now, starting a new chain when none is live. */
function remainingChainDelay(now: number): number {
  const chainLive = mountedCount > 0 || now - lastUnmountedAt < HANDOFF_WINDOW_MS
  if (!chainLive) chainStartedAt = now
  return Math.max(0, LOADER_SHOW_DELAY_MS - (now - chainStartedAt))
}

/**
 * The brand loader for a load that blocks a whole area whose layout is not known yet.
 * Fills and centres in its container; draws after a short delay. The label is sr-only.
 */
export function PageLoader({ label = 'Loading' }: { label?: string }) {
  const [{ delayMs, startVisible, takesOver, phase }] = useState(() => {
    const now = Date.now()
    const remaining = remainingChainDelay(now)
    const takesOver = visibleCount > 0 || now - lastVisibleAt < HANDOFF_WINDOW_MS
    // A taking-over mark is drawn at once, so its animation starts now: offset it by how far the
    // chain's mark has already spun.
    const phase = takesOver ? -((now - chainVisibleSince) % SPIN_PERIOD_MS) : null
    return { delayMs: remaining, startVisible: takesOver || remaining === 0, takesOver, phase }
  })
  const visible = useShowAfterDelay(delayMs, startVisible)

  useLayoutEffect(() => {
    mountedCount++
    return () => {
      mountedCount--
      lastUnmountedAt = Date.now()
    }
  }, [])

  useLayoutEffect(() => {
    if (!visible) return
    if (!takesOver) chainVisibleSince = Date.now()
    visibleCount++
    return () => {
      visibleCount--
      lastVisibleAt = Date.now()
    }
  }, [visible, takesOver])

  return (
    <div
      role="status"
      aria-label={label}
      aria-busy="true"
      data-slot="page-loader"
      data-state={visible ? 'visible' : 'waiting'}
      className="grid min-h-72 w-full place-items-center"
    >
      <span className="sr-only">{label}</span>
      {visible ? (
        <span aria-hidden="true" className="relative grid size-14 place-items-center">
          <svg
            viewBox="0 0 64 64"
            fill="none"
            className="absolute inset-0 size-full motion-safe:animate-[spin_2s_linear_infinite]"
            style={phase === null ? undefined : { animationDelay: `${phase}ms` }}
          >
            <circle
              className="md-loader-arc"
              cx="32"
              cy="32"
              r="30"
              pathLength="100"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="25 75"
              transform="rotate(-90 32 32)"
              style={phase === null ? undefined : { animationDelay: `${phase}ms` }}
            />
          </svg>
          {/* Crop the original logo lockup to its round mark without redrawing the brand. */}
          <svg viewBox="0 0 68 68" className="size-11 overflow-hidden">
            <image href={logoDarkMd} width="317" height="68" />
          </svg>
        </span>
      ) : null}
    </div>
  )
}

/** The viewport-filling PageLoader, for route fallbacks and the cold start. The label is sr-only. */
export function PageLoaderScreen({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="grid min-h-dvh bg-background">
      <PageLoader label={label} />
    </div>
  )
}
