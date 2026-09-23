import { describe, expect, it } from 'vitest'
import { ApiError } from '@/shared/api'
import { isMissingCartItemError, isMissingVendorCartError } from './cart-errors'

function apiError(status: number, user_message: string) {
  return new ApiError(user_message, status, { user_message }, undefined, 'not_found')
}

describe('cart error classification', () => {
  it('does not treat a missing line as a missing vendor cart', () => {
    const error = apiError(404, 'The specified item was not found in cart')
    expect(isMissingCartItemError(error)).toBe(true)
    expect(isMissingVendorCartError(error)).toBe(false)
  })

  it('still recognizes a missing vendor cart', () => {
    const error = apiError(404, 'Cart not found')
    expect(isMissingCartItemError(error)).toBe(false)
    expect(isMissingVendorCartError(error)).toBe(true)
  })
})
