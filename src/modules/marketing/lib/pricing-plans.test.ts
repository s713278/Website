import { describe, expect, it } from 'vitest'
import {
  formatPlanPrice,
  planSavings,
  starterFeatureGroups,
  starterIncludedFeatureNames,
  starterPlan,
} from './pricing-plans'

describe('pricing plans', () => {
  it('offers Starter at ₹399 against ₹899, saving ₹500', () => {
    expect(starterPlan.price).toBe(399)
    expect(starterPlan.originalPrice).toBe(899)
    expect(planSavings(starterPlan)).toBe(500)
  })

  it('routes the trial to onboarding', () => {
    expect(starterPlan.to).toBe('/onboarding')
  })

  it('advertises every Starter capability once, grouped by vendor job', () => {
    expect(starterFeatureGroups.map((group) => group.title)).toEqual([
      'Your own branded store',
      'Share and take orders',
      'Manage products and orders',
      'Understand your sales',
    ])
    const names = starterIncludedFeatureNames()
    expect(names).toHaveLength(11)
    expect(new Set(names).size).toBe(names.length)
    expect(names).toContain('Shareable store link and QR code')
    expect(names).toContain('WhatsApp ordering and order notifications')
  })

  it('keeps qualified capabilities labelled Basic', () => {
    expect(starterIncludedFeatureNames()).toContain('Basic sales dashboard')
  })

  it('formats rupee amounts with Indian grouping', () => {
    expect(formatPlanPrice(1398)).toBe('₹1,398')
  })
})
