// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import {
  clearSavedTypeRecords,
  readSavedTypeRecord,
  recordConfirmedType,
  SAVED_TYPE_STORAGE_KEY,
} from './onboarding-saved-type-record'

const dairy = { id: 1, name: 'Dairy & Farm Fresh', icon: null, displayOrder: 1 }
const bakery = { id: 4, name: 'Bakery & Snacks', icon: 'https://icons.example.test/bakery.svg', displayOrder: 4 }

afterEach(() => localStorage.clear())

describe('saved business type record', () => {
  it('reads an entry holding only an old pending save as absent', () => {
    localStorage.setItem(SAVED_TYPE_STORAGE_KEY, JSON.stringify({ 91: { inFlight: dairy } }))
    expect(readSavedTypeRecord('91')).toEqual({ confirmed: null })
    recordConfirmedType('91', bakery)
    expect(readSavedTypeRecord('91')).toEqual({ confirmed: bakery })
    expect(JSON.parse(localStorage.getItem(SAVED_TYPE_STORAGE_KEY)!)).toEqual({ 91: { confirmed: bakery } })
  })

  it('answers only for the vendor it belongs to', () => {
    recordConfirmedType('91', dairy)
    recordConfirmedType('92', bakery)
    expect(readSavedTypeRecord('92')).toEqual({ confirmed: bakery })
    expect(readSavedTypeRecord('93')).toEqual({ confirmed: null })
    expect(readSavedTypeRecord('91')).toEqual({ confirmed: dairy })
  })

  it('treats a malformed or unreadable record as absent', () => {
    localStorage.setItem(SAVED_TYPE_STORAGE_KEY, '{not json')
    expect(readSavedTypeRecord('91')).toEqual({ confirmed: null })
    localStorage.setItem(SAVED_TYPE_STORAGE_KEY, JSON.stringify({ 91: { confirmed: { id: 0, name: '' }, inFlight: 'x' } }))
    expect(readSavedTypeRecord('91')).toEqual({ confirmed: null })
  })

  it('is cleared for every vendor on sign-out', () => {
    recordConfirmedType('91', dairy)
    recordConfirmedType('92', bakery)
    clearSavedTypeRecords()
    expect(readSavedTypeRecord('91').confirmed).toBeNull()
    expect(readSavedTypeRecord('92').confirmed).toBeNull()
  })
})
