import { isApiError } from '@/shared/api'

function cartErrorText(error: unknown): string {
  if (!isApiError(error)) return ''
  const body = error.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) return ''
  const record = body as Record<string, unknown>
  return `${record.failure_reason ?? ''} ${record.user_message ?? ''} ${record.message ?? ''}`
}

/** One line is gone — do not treat this as an empty vendor cart. */
export function isMissingCartItemError(error: unknown): boolean {
  const text = cartErrorText(error)
  return /specified item/i.test(text) || /item was not found in cart/i.test(text)
}

/** The vendor cart itself is gone. A 404 alone can mean a missing line. */
export function isMissingVendorCartError(error: unknown): boolean {
  if (!isApiError(error)) return false
  if (isMissingCartItemError(error)) return false
  const text = cartErrorText(error)
  return /cart not found/i.test(text)
}
