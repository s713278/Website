import { describe, expect, it } from 'vitest'
import { hasStrikethroughPrice } from './product-price'

describe('hasStrikethroughPrice', () => {
  it('is true when list_price is the higher MRP', () => {
    expect(hasStrikethroughPrice(245, 250)).toBe(true)
  })

  it('is false when sale and list are the same', () => {
    expect(hasStrikethroughPrice(250, 250)).toBe(false)
  })

  it('is false when list_price is missing or not higher', () => {
    expect(hasStrikethroughPrice(245)).toBe(false)
    expect(hasStrikethroughPrice(245, 200)).toBe(false)
  })
})
