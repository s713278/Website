import { useLayoutEffect, useState } from 'react'
import logoDarkMd from '@/assets/logo_dark_md.png'
import { useShowAfterDelay } from '@/shared/hooks/useShowAfterDelay'

// A chain of loads (session restore, then a route chunk, then the page's data) unmounts one
// loader and mounts the next. These let the next one appear at once and keep the same spin.
let visibleCount = 0
let lastVisibleAt = 0
const HANDOFF_WINDOW_MS = 200
const SPIN_PERIOD_MS = 2000

/**
 * The brand loader for a load that blocks a whole area whose layout is not known yet.
 * Fills and centres in its container; draws after a short delay. The label is sr-only.
 */
export function PageLoader({ label = 'Loading' }: { label?: string }) {
  const [startVisible] = useState(
    () => visibleCount > 0 || Date.now() - lastVisibleAt < HANDOFF_WINDOW_MS,
  )
  const [phase] = useState(() => -(Date.now() % SPIN_PERIOD_MS))
  const visible = useShowAfterDelay(undefined, startVisible)

  useLayoutEffect(() => {
    if (!visible) return
    visibleCount++
    return () => {
      visibleCount--
      lastVisibleAt = Date.now()
    }
  }, [visible])

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
            className="absolute inset-0 size-full text-primary motion-safe:animate-[spin_2s_linear_infinite]"
            style={{ animationDelay: `${phase}ms` }}
          >
            <circle
              className="md-loader-arc"
              cx="32"
              cy="32"
              r="30"
              pathLength="100"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="25 75"
              transform="rotate(-90 32 32)"
              style={{ animationDelay: `${phase}ms` }}
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
