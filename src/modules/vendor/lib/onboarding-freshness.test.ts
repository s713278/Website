import { describe, expect, it } from 'vitest'
import { mergeRuntimeRecord, mergeRuntimeValue, revalidationReads } from './onboarding-freshness'

const setup = { submitted: false, approved: false, typeSaved: true, pending: [] }

describe('revalidationReads', () => {
  it('names each catalog and checkout step’s own resources', () => {
    expect(revalidationReads(4, setup)).toEqual(['categories'])
    expect(revalidationReads(5, setup)).toEqual(['products'])
    expect(revalidationReads(6, setup)).toEqual(['products', 'skus'])
    expect(revalidationReads(7, setup)).toEqual(['checkout'])
    expect(revalidationReads(8, setup)).toEqual(['checkout'])
  })

  it('reads the profile for Step 3 only while no type is saved', () => {
    expect(revalidationReads(3, setup)).toEqual([])
    expect(revalidationReads(3, { ...setup, typeSaved: false })).toEqual(['profile'])
  })

  it('reads Step 9’s storefront settings only once they are readable, after approval', () => {
    expect(revalidationReads(9, setup)).toEqual([])
    expect(revalidationReads(9, { ...setup, submitted: true, approved: false })).toEqual([])
    expect(revalidationReads(9, { ...setup, submitted: true, approved: true })).toEqual(['storefront'])
  })

  it('reads for Step 10 what its unsaved steps need, once each', () => {
    expect(revalidationReads(10, setup)).toEqual([])
    expect(revalidationReads(10, { ...setup, pending: [5, 6, 7, 8, 9] })).toEqual(['products', 'skus', 'checkout'])
    expect(revalidationReads(10, { ...setup, submitted: true, pending: [7] })).toEqual([])
  })

  it('reads nothing for the identity steps', () => {
    expect(revalidationReads(1, setup)).toEqual([])
    expect(revalidationReads(2, setup)).toEqual([])
  })
})

describe('mergeRuntimeValue', () => {
  it('takes the account’s value for an untouched one', () => {
    expect(mergeRuntimeValue('old@upi', 'old@upi', 'new@upi')).toBe('new@upi')
  })

  it('keeps an edit while the account still holds the value it started from', () => {
    expect(mergeRuntimeValue('mine@upi', 'old@upi', 'old@upi')).toBe('mine@upi')
  })

  it('lets a newer saved value win over an edit', () => {
    expect(mergeRuntimeValue('mine@upi', 'old@upi', 'new@upi')).toBe('new@upi')
  })

  it('keeps the input when no saved value is known', () => {
    expect(mergeRuntimeValue('mine@upi', undefined, 'new@upi')).toBe('mine@upi')
  })

  it('merges a record value by value', () => {
    expect(mergeRuntimeRecord(
      { upiId: 'mine@upi', bankName: 'Old Bank' },
      { upiId: 'old@upi', bankName: 'Old Bank' },
      { upiId: 'old@upi', bankName: 'New Bank' },
    )).toEqual({ upiId: 'mine@upi', bankName: 'New Bank' })
  })
})
