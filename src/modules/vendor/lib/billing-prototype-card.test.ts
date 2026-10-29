import { describe, expect, it } from 'vitest'
import { relativeDay } from './billing-prototype-card'

describe('relativeDay', () => {
  it('counts calendar days in India time', () => {
    const now = new Date('2026-09-24T10:00:00Z') // 15:30 IST
    expect(relativeDay('2026-09-24T00:00:00Z', now)).toBe('Today') // 05:30 IST
    expect(relativeDay('2026-09-23T18:00:00Z', now)).toBe('Yesterday') // 23:30 IST the day before
    expect(relativeDay('2026-09-23T19:00:00Z', now)).toBe('Today') // 00:30 IST
    expect(relativeDay('2026-09-10T10:00:00Z', now)).toBe('14 days ago')
    expect(relativeDay('2026-08-27T10:00:00Z', now)).toBe('Last month')
    expect(relativeDay('2026-07-01T10:00:00Z', now)).toBe('2 months ago')
    expect(relativeDay('2026-09-25T10:00:00Z', now)).toBe('Today')
  })
})
