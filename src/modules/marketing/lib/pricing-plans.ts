export type StarterFeature = {
  name: string
  /** Qualifier such as Basic or Standard, when the plan does not include the full capability. */
  note?: string
}

export type StarterFeatureGroup = {
  title: string
  summary: string
  features: StarterFeature[]
}

export const starterPlan = {
  id: 'starter' as const,
  name: 'Mithra Social Starter',
  price: 399,
  originalPrice: 899,
  trial: '14-Day Free Trial',
  cta: 'Start 14-day free trial',
  to: '/onboarding',
}

export function formatPlanPrice(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`
}

export function planSavings(originalPrice: number, price: number): number {
  return originalPrice - price
}

/**
 * Capabilities that shipped with Mithra Social Starter. Other plans are not offered,
 * so rows that were only on those plans are omitted.
 */
export const starterFeatureGroups: StarterFeatureGroup[] = [
  {
    title: 'A shop that looks like yours',
    summary: 'Customers open your store on their phone, with your name and your photos.',
    features: [
      { name: 'Digital Storefront' },
      { name: 'Mobile-First Store' },
      { name: 'MithraDirect Store URL' },
      { name: 'Business Profile' },
      { name: 'Logo & Store Banner' },
      { name: 'Store QR Code' },
      { name: 'Basic SEO' },
    ],
  },
  {
    title: 'Orders on WhatsApp and Instagram',
    summary: 'Buyers stay in the apps they already use. You still get the order.',
    features: [
      { name: 'WhatsApp Ordering' },
      { name: 'WhatsApp Business Link' },
      { name: 'Instagram Integration' },
      { name: 'Facebook Integration' },
      { name: 'Order Notifications' },
      { name: 'Customer Orders' },
      { name: 'Order Management' },
      { name: 'Repeat Orders' },
      { name: 'COD / Online Payments' },
    ],
  },
  {
    title: 'Products, prices, and delivery',
    summary: 'Add what you sell, set the price, and say how far you deliver.',
    features: [
      { name: 'Product Catalog' },
      { name: 'Product Categories' },
      { name: 'Product Images' },
      { name: 'Product Descriptions' },
      { name: 'SKU & Pricing Management' },
      { name: 'Basic Inventory / Availability' },
      { name: 'Delivery & Service Area' },
    ],
  },
  {
    title: 'A simple view of the business',
    summary: 'See what sold, without learning a new tool.',
    features: [
      { name: 'Basic Sales Dashboard' },
      { name: 'Customer Management', note: 'Basic' },
      { name: 'AI Product Descriptions', note: 'Basic' },
      { name: 'AI Catalog Assistance', note: 'Basic' },
      { name: 'Priority Support', note: 'Standard' },
    ],
  },
]

export function starterIncludedFeatureNames(): string[] {
  return [starterPlan.trial, ...starterFeatureGroups.flatMap((group) => group.features.map((feature) => feature.name))]
}
