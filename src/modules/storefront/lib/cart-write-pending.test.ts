import { afterEach, describe, expect, it } from 'vitest'
import {
  beginCartWrite,
  cartWriteIsPending,
  cartWriteKey,
  cartWriteKeyFromItemId,
  clearCartWrites,
  endCartWrite,
  getCartWriteSnapshot,
  isCartWritePending,
} from './cart-write-pending'

afterEach(() => {
  clearCartWrites()
})

describe('cart write pending', () => {
  it('keys a SKU so two sizes of one product stay independent', () => {
    expect(cartWriteKey('273', '423', '4404')).toBe('273:423:4404')
    expect(cartWriteKey('273', '423', '4405')).toBe('273:423:4405')
    expect(cartWriteKeyFromItemId('273', '423:4404')).toBe('273:423:4404')
  })

  it('keeps the first SKU pending after a second SKU starts', () => {
    const first = cartWriteKey('273', '423', '4404')
    const second = cartWriteKey('273', '423', '4405')
    beginCartWrite(first)
    beginCartWrite(second)

    expect(isCartWritePending(first)).toBe(true)
    expect(isCartWritePending(second)).toBe(true)
    expect(cartWriteIsPending(getCartWriteSnapshot(), '273', '423', '4404')).toBe(true)

    endCartWrite(second)
    expect(isCartWritePending(first)).toBe(true)
    expect(isCartWritePending(second)).toBe(false)
  })

  it('clears every in-flight write on logout', () => {
    beginCartWrite(cartWriteKey('273', '423', '4404'))
    clearCartWrites()
    expect(getCartWriteSnapshot()).toBe('')
  })
})
