import { describe, expect, it } from 'vitest'
import {
  formatPlanPrice,
  planSavings,
  starterFeatureGroups,
  starterIncludedFeatureNames,
  starterPlan,
} from './pricing-plans'

describe('starter plan', () => {
  it('offers only Mithra Social Starter at 399 after a discount from 899', () => {
    expect(starterPlan).toMatchObject({
      id: 'starter',
      name: 'Mithra Social Starter',
      price: 399,
      originalPrice: 899,
    })
    expect(planSavings(starterPlan.originalPrice, starterPlan.price)).toBe(500)
  })

  it('keeps the starter capabilities, including qualified ones', () => {
    expect(starterIncludedFeatureNames()).toEqual([
      '14-Day Free Trial',
      'Digital Storefront',
      'Mobile-First Store',
      'MithraDirect Store URL',
      'Business Profile',
      'Logo & Store Banner',
      'Store QR Code',
      'Basic SEO',
      'WhatsApp Ordering',
      'WhatsApp Business Link',
      'Instagram Integration',
      'Facebook Integration',
      'Order Notifications',
      'Customer Orders',
      'Order Management',
      'Repeat Orders',
      'COD / Online Payments',
      'Product Catalog',
      'Product Categories',
      'Product Images',
      'Product Descriptions',
      'SKU & Pricing Management',
      'Basic Inventory / Availability',
      'Delivery & Service Area',
      'Basic Sales Dashboard',
      'Customer Management',
      'AI Product Descriptions',
      'AI Catalog Assistance',
      'Priority Support',
    ])
    expect(starterFeatureGroups.flatMap((group) => group.features).filter((feature) => feature.note)).toEqual([
      { name: 'Customer Management', note: 'Basic' },
      { name: 'AI Product Descriptions', note: 'Basic' },
      { name: 'AI Catalog Assistance', note: 'Basic' },
      { name: 'Priority Support', note: 'Standard' },
    ])
  })

  it('formats rupee amounts with Indian grouping', () => {
    expect(formatPlanPrice(899)).toBe('₹899')
    expect(formatPlanPrice(1398)).toBe('₹1,398')
  })
})
