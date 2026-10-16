import { useEffect, useState, useSyncExternalStore } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

/** After this wait, offer Retry while the request is still outstanding. */
const STALLED_MS = 10_000

type LoadState = 'hidden' | 'loading' | 'stalled' | 'offline'

function subscribeOnline(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

function useLoadState(loading: boolean): LoadState {
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  )
  const [stalled, setStalled] = useState(false)

  useEffect(() => {
    if (!loading) {
      setStalled(false)
      return
    }
    const timer = window.setTimeout(() => setStalled(true), STALLED_MS)
    return () => {
      window.clearTimeout(timer)
      setStalled(false)
    }
  }, [loading])

  if (!loading) return 'hidden'
  if (!online) return 'offline'
  if (stalled) return 'stalled'
  return 'loading'
}

type LoadingStatusProps = {
  /** When true, show the bottom-center status pill. */
  loading: boolean
  /** One short line for the whole wait, e.g. "Loading cart…". */
  label: string
  /** Shown after a long wait, or when the device is offline. */
  onRetry?: () => void
  className?: string
}

/**
 * Compact bottom-center status for storefront waits.
 * Same look everywhere: spinner + one label; Retry only if stuck or offline.
 */
export function LoadingStatus({ loading, label, onRetry, className }: LoadingStatusProps) {
  const state = useLoadState(loading)
  if (state === 'hidden') return null

  const offline = state === 'offline'
  const title = offline ? "You're offline" : label
  const showRetry = Boolean(onRetry) && (state === 'stalled' || offline)

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4',
        'bottom-[max(1rem,env(safe-area-inset-bottom))]',
        className,
      )}
    >
      <div
        className={cn(
          'pointer-events-auto flex w-full max-w-sm items-center gap-2.5',
          'rounded-full bg-white/95 px-3.5 py-2.5 shadow-[0_10px_28px_rgba(15,23,42,0.14)]',
          'ring-1 ring-slate-200/80 backdrop-blur-md',
        )}
      >
        <span
          className={cn(
            'inline-flex size-7 shrink-0 items-center justify-center rounded-full',
            'bg-[var(--store-theme-soft,rgba(16,185,129,0.14))] text-[var(--store-theme,var(--md-green-700))]',
          )}
        >
          <Loader2 className={cn('size-3.5', !offline && 'animate-spin')} aria-hidden />
        </span>

        <p className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight text-slate-900">
          {title}
        </p>

        {showRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1',
              'bg-[var(--store-theme,var(--md-green-700))] text-[11px] font-semibold text-white',
              'transition hover:opacity-90 active:scale-[0.98]',
            )}
          >
            <RefreshCw className="size-3" aria-hidden />
            Retry
          </button>
        ) : null}
      </div>
    </div>
  )
}
