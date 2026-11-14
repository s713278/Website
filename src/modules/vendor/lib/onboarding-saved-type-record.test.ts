// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import {
  clearSavedTypeRecords,
  clearTypeSaveInFlight,
  markTypeSaveInFlight,
  readSavedTypeRecord,
  recordConfirmedType,
  SAVED_TYPE_STORAGE_KEY,
} from './onboarding-saved-type-record'

const dairy = { id: 1, name: 'Dairy & Farm Fresh', icon: null, displayOrder: 1 }
const bakery = { id: 4, name: 'Bakery & Snacks', icon: 'https://icons.example.test/bakery.svg', displayOrder: 4 }

afterEach(() => localStorage.clear())

describe('saved business type record', () => {
  it('keeps a pending save until its outcome is known, then the confirmed type', () => {
    markTypeSaveInFlight('91', dairy)
    expect(readSavedTypeRecord('91')).toEqual({ confirmed: null, inFlight: dairy })
    recordConfirmedType('91', dairy)
    expect(readSavedTypeRecord('91')).toEqual({ confirmed: dairy, inFlight: null })
  })

  it('forgets a pending save that did not land, keeping any confirmed type', () => {
    markTypeSaveInFlight('91', dairy)
    clearTypeSaveInFlight('91')
    expect(readSavedTypeRecord('91')).toEqual({ confirmed: null, inFlight: null })
    expect(localStorage.getItem(SAVED_TYPE_STORAGE_KEY)).toBeNull()

    recordConfirmedType('91', dairy)
    markTypeSaveInFlight('91', dairy)
    clearTypeSaveInFlight('91')
    expect(readSavedTypeRecord('91')).toEqual({ confirmed: dairy, inFlight: null })
  })

  it('answers only for the vendor it belongs to', () => {
    recordConfirmedType('91', dairy)
    markTypeSaveInFlight('92', bakery)
    expect(readSavedTypeRecord('92')).toEqual({ confirmed: null, inFlight: bakery })
    expect(readSavedTypeRecord('93')).toEqual({ confirmed: null, inFlight: null })
    expect(readSavedTypeRecord('91')).toEqual({ confirmed: dairy, inFlight: null })
  })

  it('treats a malformed or unreadable record as absent', () => {
    localStorage.setItem(SAVED_TYPE_STORAGE_KEY, '{not json')
    expect(readSavedTypeRecord('91')).toEqual({ confirmed: null, inFlight: null })
    localStorage.setItem(SAVED_TYPE_STORAGE_KEY, JSON.stringify({ 91: { confirmed: { id: 0, name: '' }, inFlight: 'x' } }))
    expect(readSavedTypeRecord('91')).toEqual({ confirmed: null, inFlight: null })
  })

  it('is cleared for every vendor on sign-out', () => {
    recordConfirmedType('91', dairy)
    recordConfirmedType('92', bakery)
    clearSavedTypeRecords()
    expect(readSavedTypeRecord('91').confirmed).toBeNull()
    expect(readSavedTypeRecord('92').confirmed).toBeNull()
  })
})
