import { describe, expect, it } from 'vitest'
import { formatPlanPrice, pricingFeatureRows, pricingPlans } from './pricing-plans'

describe('pricing plans', () => {
  it('shows discounted monthly prices at half the listed original', () => {
    for (const plan of pricingPlans) {
      expect(plan.originalPrice).toBe(plan.price * 2)
    }
  })

  it('keeps only Mithra Social Starter available', () => {
    expect(pricingPlans.filter((plan) => plan.available).map((plan) => plan.id)).toEqual(['starter'])
  })

  it('covers every comparison column for each feature', () => {
    expect(pricingFeatureRows.every((row) => row.values.length === pricingPlans.length)).toBe(true)
  })

  it('formats rupee amounts with Indian grouping', () => {
    expect(formatPlanPrice(1398)).toBe('₹1,398')
  })
})
