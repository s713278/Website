import { describe, expect, it } from 'vitest'
import { checkFeatures, FEATURES_MAX_BYTES } from './product-features'

/** One feature whose sent object, `{"Note":"…"}`, is exactly `bytes` long in UTF-8. */
function featureOfBytes(bytes: number) {
  const overhead = JSON.stringify({ Note: '' }).length
  return [{ label: 'Note', detail: 'a'.repeat(bytes - overhead) }]
}

describe('checkFeatures size estimate', () => {
  it('accepts features exactly at the limit and refuses one byte more', () => {
    expect(checkFeatures(featureOfBytes(FEATURES_MAX_BYTES)).tooLong).toBe(false)
    expect(checkFeatures(featureOfBytes(FEATURES_MAX_BYTES + 1)).tooLong).toBe(true)
  })

  it('counts multi-byte text by its UTF-8 bytes, not its characters', () => {
    // 6,000 characters, but ₹ is 3 bytes: 18,000 bytes.
    const check = checkFeatures([{ label: 'Price note', detail: '₹'.repeat(6_000) }])
    expect(check.tooLong).toBe(true)
    expect(check.ok).toBe(false)
  })

  it('measures what is sent: blank rows and surrounding spaces do not count', () => {
    const padded = [...featureOfBytes(FEATURES_MAX_BYTES), { label: '   ', detail: ' '.repeat(500) }]
    padded[0] = { label: '  Note  ', detail: `${padded[0].detail}   ` }
    expect(checkFeatures(padded).tooLong).toBe(false)
  })
})
