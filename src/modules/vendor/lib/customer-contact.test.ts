import { describe, expect, it } from 'vitest'
import { shortCustomerName } from './customer-contact'

describe('shortCustomerName', () => {
  it('keeps the first name and the initial of the last', () => {
    expect(shortCustomerName('hemesh thakur')).toBe('Hemesh T.')
    // The last word, not the second: a middle name does not stand in for the surname.
    expect(shortCustomerName('Mohammed Abdul Rahman')).toBe('Mohammed R.')
  })

  it('leaves a one-word name whole', () => {
    expect(shortCustomerName('Ravi')).toBe('Ravi')
  })

  it('keeps the rest of the first word as sent', () => {
    expect(shortCustomerName('McKenzie  smith ')).toBe('McKenzie S.')
  })

  it('gives nothing for a blank or missing name, so the number takes its place', () => {
    expect(shortCustomerName('  ')).toBeNull()
    expect(shortCustomerName('')).toBeNull()
    expect(shortCustomerName(null)).toBeNull()
  })
})
