import { describe, expect, it } from 'vitest'
import { formatPlanUsage } from './plan-usage'

describe('formatPlanUsage', () => {
  it('preserves a real zero usage', () => {
    expect(formatPlanUsage(0, 10)).toBe('0 of 10 used')
  })

  it.each([
    [null, 10],
    [0, null],
  ])('reports an unavailable pair when usage or limit is missing', (usage, limit) => {
    expect(formatPlanUsage(usage, limit)).toBe('Not available')
  })
})
