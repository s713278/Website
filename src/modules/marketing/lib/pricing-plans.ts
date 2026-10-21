export type StarterPlan = {
  name: string
  audience: string
  price: number
  originalPrice: number
  approxDailyPrice: number
  trialDays: number
  cta: string
  to: string
  highlights: string[]
}

export type StarterFeatureGroup = {
  id: 'store' | 'channels' | 'catalog' | 'insights'
  title: string
  copy: string
  features: string[]
}

export function formatPlanPrice(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`
}

/** Landing offer — the only plan marketed. Monthly charges before taxes. */
export const starterPlan: StarterPlan = {
  name: 'Mithra Social Starter',
  audience: 'For home businesses, Instagram and WhatsApp sellers, farmers, and neighbourhood shops.',
  price: 399,
  originalPrice: 899,
  approxDailyPrice: 13,
  trialDays: 14,
  cta: 'Start Your 14-Day Free Trial',
  to: '/onboarding',
  highlights: [
    '0% MithraDirect sales commission*',
    'Your business name, logo, and customer relationships stay yours',
    'Set up with your phone number — no coding required',
  ],
}

export function planSavings(plan: Pick<StarterPlan, 'price' | 'originalPrice'>): number {
  return plan.originalPrice - plan.price
}

/** Starter capabilities grouped by vendor job, in display order. */
export const starterFeatureGroups: StarterFeatureGroup[] = [
  {
    id: 'store',
    title: 'Your own branded store',
    copy: 'Give customers a simple, mobile-friendly place to browse your business and products.',
    features: [
      'Digital storefront and business profile',
      'Logo, store banner, and product images',
      'Shareable store link and QR code',
    ],
  },
  {
    id: 'channels',
    title: 'Share and take orders',
    copy: 'Help customers find your store through the channels they already use.',
    features: ['WhatsApp ordering and order notifications', 'Share your store on Instagram and Facebook'],
  },
  {
    id: 'catalog',
    title: 'Manage products and orders',
    copy: 'Keep your catalogue, pricing, and order information organized.',
    features: ['Product catalogue and SKU pricing', 'Product availability and images', 'Order management in one place'],
  },
  {
    id: 'insights',
    title: 'Understand your sales',
    copy: 'See a simple view of orders and how your business is doing.',
    features: ['Basic sales dashboard', 'Order activity at a glance', 'Customer relationships stay yours'],
  },
]

export function starterIncludedFeatureNames(): string[] {
  return starterFeatureGroups.flatMap((group) => group.features)
}
