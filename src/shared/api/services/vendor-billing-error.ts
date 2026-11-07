import { getErrorMessage } from '../errors'

/** Only the server's bounded retry hint delays a manual recovery action. */
export function billingFailure(error: unknown): { message: string; retryAfterSeconds: number } {
  const body = error && typeof error === 'object' && 'body' in error ? error.body : null
  const hint = body && typeof body === 'object' && 'retry_after_seconds' in body ? body.retry_after_seconds : null
  const retryAfterSeconds = typeof hint === 'number' && Number.isSafeInteger(hint) && hint > 0 && hint <= 300 ? hint : 0
  return {
    message: `${getErrorMessage(error)}${retryAfterSeconds ? ` Wait ${retryAfterSeconds} seconds before retrying.` : ''}`,
    retryAfterSeconds,
  }
}
