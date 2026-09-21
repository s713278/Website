export type PlanFeatureValue = boolean | string

export type PricingPlan = {
  id: 'starter' | 'growth' | 'pro'
  name: string
  price: number
  originalPrice: number
  bestFor: string
  cta: string
  available: boolean
  featured: boolean
  to?: string
}

export type PricingFeatureRow = {
  feature: string
  values: PlanFeatureValue[]
}

export function formatPlanPrice(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`
}

/** Landing pricing cards — prices after 50% off (monthly, before taxes). */
export const pricingPlans: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Mithra Social Starter',
    price: 299,
    originalPrice: 598,
    bestFor: 'Starting sellers',
    cta: 'Start 14-day free trial',
    available: true,
    featured: true,
    to: '/onboarding',
  },
  {
    id: 'growth',
    name: 'Mithra Social Growth',
    price: 699,
    originalPrice: 1398,
    bestFor: 'Growing businesses',
    cta: 'Coming soon',
    available: false,
    featured: false,
  },
  {
    id: 'pro',
    name: 'Mithra Business Pro',
    price: 999,
    originalPrice: 1998,
    bestFor: 'Established businesses',
    cta: 'Coming soon',
    available: false,
    featured: false,
  },
]

/** Feature comparison table columns follow `pricingPlans` order. */
export const pricingFeatureRows: PricingFeatureRow[] = [
  { feature: '14-Day Free Trial', values: [true, true, true] },
  { feature: 'Digital Storefront', values: [true, true, true] },
  { feature: 'MithraDirect Store URL', values: [true, true, true] },
  { feature: 'Mobile-First Store', values: [true, true, true] },
  { feature: 'Business Profile', values: [true, true, true] },
  { feature: 'Logo & Store Banner', values: [true, true, true] },
  { feature: 'Product Catalog', values: [true, true, true] },
  { feature: 'Product Categories', values: [true, true, true] },
  { feature: 'Product Images', values: [true, true, true] },
  { feature: 'Product Descriptions', values: [true, true, true] },
  { feature: 'SKU & Pricing Management', values: [true, true, true] },
  { feature: 'Basic Inventory / Availability', values: [true, true, true] },
  { feature: 'Customer Orders', values: [true, true, true] },
  { feature: 'Order Management', values: [true, true, true] },
  { feature: 'WhatsApp Ordering', values: [true, true, true] },
  { feature: 'COD / Online Payments', values: [true, true, true] },
  { feature: 'Delivery & Service Area', values: [true, true, true] },
  { feature: 'Instagram Integration', values: [true, true, true] },
  { feature: 'Facebook Integration', values: [true, true, true] },
  { feature: 'WhatsApp Business Link', values: [true, true, true] },
  { feature: 'Store QR Code', values: [true, true, true] },
  { feature: 'Order Notifications', values: [true, true, true] },
  { feature: 'Customer Management', values: ['Basic', 'Advanced', 'Advanced'] },
  { feature: 'Repeat Orders', values: [true, true, true] },
  { feature: 'Basic Sales Dashboard', values: [true, true, true] },
  { feature: 'Basic SEO', values: [true, 'Advanced', 'Advanced'] },
  { feature: 'AI Product Descriptions', values: ['Basic', 'Advanced', 'Advanced'] },
  { feature: 'AI Catalog Assistance', values: ['Basic', 'Advanced', 'Advanced'] },
  { feature: 'Featured Products', values: [false, true, true] },
  { feature: 'Promotional Banners', values: [false, true, true] },
  { feature: 'Coupons & Discounts', values: [false, true, true] },
  { feature: 'Offers & Promotions', values: [false, true, true] },
  { feature: 'Advanced Product Search & Filters', values: [false, true, true] },
  { feature: 'Customer Segmentation', values: [false, true, true] },
  { feature: 'Product Performance Analytics', values: [false, true, true] },
  { feature: 'Advanced Sales Analytics', values: [false, true, true] },
  { feature: 'Customer / Order Analytics', values: [false, true, true] },
  { feature: 'Abandoned Order Tracking', values: [false, true, true] },
  { feature: 'Marketing Campaigns', values: [false, true, true] },
  { feature: 'WhatsApp Campaign Support', values: [false, true, true] },
  { feature: 'Bulk Product Management', values: [false, true, true] },
  { feature: 'Bulk Price Updates', values: [false, true, true] },
  { feature: 'Advanced Store Branding', values: [false, true, true] },
  { feature: 'Staff Users', values: [false, false, true] },
  { feature: 'Staff Roles & Permissions', values: [false, false, true] },
  { feature: 'Advanced Inventory', values: [false, false, true] },
  { feature: 'Advanced Delivery Configuration', values: [false, false, true] },
  { feature: 'Advanced Business Reports', values: [false, false, true] },
  { feature: 'Report Export', values: [false, false, true] },
  { feature: 'Customer Lifetime Value', values: [false, false, true] },
  { feature: 'Repeat Purchase Analytics', values: [false, false, true] },
  { feature: 'Advanced AI Catalog Management', values: [false, false, true] },
  { feature: 'Multi-Channel Business Management', values: [false, false, true] },
  { feature: 'Priority Support', values: ['Standard', 'Priority', 'Priority'] },
  { feature: 'Best For', values: ['Starting sellers', 'Growing businesses', 'Established businesses'] },
]
