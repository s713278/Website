import type {
  FulfillmentType,
  OnboardingRuntimeState,
  PaymentType,
  VendorOnboardingDraftV1,
} from '../types/onboarding'

/** How many category names the brief spells out before collapsing the rest into `+N`. */
const CATEGORY_PREVIEW_LIMIT = 3

export const FULFILMENT_SUMMARY_LABELS: Record<FulfillmentType, string> = {
  HOME_DELIVERY: 'Home delivery',
  STORE_PICKUP: 'Store pickup',
  BOTH: 'Delivery & pickup',
}

export const PAYMENT_SUMMARY_LABELS: Record<PaymentType, string> = {
  PRE_PAID: 'UPI',
  ONLINE: 'Bank account',
  CASH_ON_DELIVERY: 'Cash on delivery',
}

export type CatalogSummary = {
  businessType: string | null
  /** At most `CATEGORY_PREVIEW_LIMIT` names; anything beyond is counted in `extraCategoryCount`. */
  categoryNames: string[]
  extraCategoryCount: number
  productCount: number
  activeSizeCount: number
  inactiveSizeCount: number
}

export type OrdersSummary = {
  fulfilment: string
  paymentMethods: string[]
  /** Masked; `null` when nothing has been entered so the row can be dropped. */
  orderWhatsapp: string | null
  /** Masked; `null` when the optional support number is absent. */
  supportWhatsapp: string | null
}

export type StoreSummary = {
  storeName: string | null
  businessLocation: string | null
}

export type ReviewSummary = {
  catalog: CatalogSummary
  orders: OrdersSummary
  store: StoreSummary
}

/**
 * Display-only mask for a contact number shown on the review brief.
 *
 * Never returns the whole number: at most the last four digits are visible, matching the
 * verified-phone mask elsewhere in onboarding. An empty value collapses to `null` so the
 * caller can drop the row entirely. The mask is a fixed width, not a per-digit blanking, so a
 * partial number entered before Step 9 validation passes cannot leak how many digits it holds.
 */
export function maskContact(value: string): string | null {
  const digits = value.replace(/\D/g, '')
  if (!digits) return null
  return `•••••• ${digits.slice(-4)}`
}

function trimmedOrNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

/**
 * Condense the draft into the compact account of the store the vendor has configured that
 * Step 10 shows above the final action.
 *
 * Pure and account-agnostic: it summarizes the draft and its runtime contacts and nothing
 * else. It deliberately omits credentials, OTPs, and low-value styling detail, and it masks
 * both contact numbers — the review brief is a recap, not a place to surface secrets.
 */
export function buildReviewSummary(
  draft: VendorOnboardingDraftV1,
  runtime: OnboardingRuntimeState,
): ReviewSummary {
  const categoryNames = draft.categories.map((category) => category.name)
  const activeSizeCount = draft.skus.filter((sku) => sku.active).length

  return {
    catalog: {
      businessType: draft.business.businessType?.name ?? null,
      categoryNames: categoryNames.slice(0, CATEGORY_PREVIEW_LIMIT),
      extraCategoryCount: Math.max(0, categoryNames.length - CATEGORY_PREVIEW_LIMIT),
      productCount: draft.products.length,
      activeSizeCount,
      inactiveSizeCount: draft.skus.length - activeSizeCount,
    },
    orders: {
      fulfilment: FULFILMENT_SUMMARY_LABELS[draft.delivery.fulfillmentType],
      paymentMethods: draft.payments
        .filter((payment) => payment.enabled)
        .map((payment) => PAYMENT_SUMMARY_LABELS[payment.type]),
      orderWhatsapp: maskContact(runtime.orderWhatsapp),
      supportWhatsapp: maskContact(runtime.supportWhatsapp),
    },
    store: {
      storeName: trimmedOrNull(draft.storefront.storeName),
      businessLocation: trimmedOrNull(draft.storefront.businessLocation),
    },
  }
}
