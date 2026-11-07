import { isApiError, type ApiError } from '@/shared/api'

/** The waits before each retry of a billing read or `confirm`. */
export const retryDelays = [5_000, 15_000, 30_000]

/** A failure that may be a brief outage rather than an answer: 502, 503 or the network. */
export const isBriefOutage = (cause: unknown): cause is ApiError =>
  isApiError(cause) && (cause.status === 502 || cause.status === 503 || cause.kind === 'network')

/** Resolves after `ms`, or at once when `signal` aborts. */
export function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const done = () => { window.clearTimeout(timer); resolve() }
    const timer = window.setTimeout(done, ms)
    signal.addEventListener('abort', done, { once: true })
  })
}
