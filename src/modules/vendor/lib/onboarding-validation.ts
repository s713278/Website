import {
  ONBOARDING_CONFIG,
  type DeliveryDraft,
  type DraftSku,
  type MeasurementType,
  type OnboardingRuntimeState,
  type OnboardingStep,
  type PaymentDetailsRuntime,
  type PaymentOptionDraft,
  type ValidationIssue,
  type VendorOnboardingDraftV1,
} from '../types/onboarding'
import {
  projectedCategoryTotal,
  projectedProductTotal,
  projectedSkuTotal,
} from './onboarding-catalog-limits'
import { expectedMeasurementFor, type MeasurementCatalog } from './onboarding-measurement'
import { isKnownSkuId } from './onboarding-sku-id'

/**
 * What the account already holds and the plan caps that are not passed positionally.
 *
 * The projected account total — account usage plus what this draft adds — is what a limit
 * gates, so validation needs the account snapshot to be the second line of defence behind
 * the disabled controls. Left empty, it degrades to counting the draft alone against the
 * configured fallbacks, which is the historical behaviour for a first-time/demo flow.
 */
export type CatalogEnforcement = {
  maxProducts?: number
  maxSkus?: number
  account?: { categoryIds: number[]; productIds: number[]; skuIds: number[] }
}

const EMPTY_ACCOUNT = { categoryIds: [], productIds: [], skuIds: [] }

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const INDIA_PHONE_PATTERN = /^[6-9]\d{9}$/
const E164_PATTERN = /^\+[1-9]\d{7,14}$/

export function isValidIndianMobile(value: string): boolean {
  return INDIA_PHONE_PATTERN.test(value.trim())
}

export function isValidE164(value: string): boolean {
  return E164_PATTERN.test(value.trim())
}

export function isValidHex(value: string): boolean {
  return HEX_PATTERN.test(value.trim())
}

function linearChannel(channel: number): number {
  const value = channel / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(hex: string): number {
  if (!isValidHex(hex)) return 0
  const value = hex.slice(1)
  const red = linearChannel(Number.parseInt(value.slice(0, 2), 16))
  const green = linearChannel(Number.parseInt(value.slice(2, 4), 16))
  const blue = linearChannel(Number.parseInt(value.slice(4, 6), 16))
  return red * 0.2126 + green * 0.7152 + blue * 0.0722
}

export function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first)
  const secondLuminance = relativeLuminance(second)
  const lighter = Math.max(firstLuminance, secondLuminance)
  const darker = Math.min(firstLuminance, secondLuminance)
  return (lighter + 0.05) / (darker + 0.05)
}

export function bestContrastText(background: string): '#111827' | '#ffffff' {
  return contrastRatio(background, '#111827') >= contrastRatio(background, '#ffffff')
    ? '#111827'
    : '#ffffff'
}

function issue(step: OnboardingStep, field: string, message: string): ValidationIssue {
  return { step, field, message }
}

function positive(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0
}

function nonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}

/**
 * The server's uniqueness key is (name, weight, vendor_product_id), so two SKUs of one
 * product may share a name as long as they differ in size. That matters on resume: the
 * account stores "Milk-1 L" and "Milk-500 ml", both of which strip back to "Milk".
 */
function skuIdentity(sku: DraftSku): string {
  return `${sku.name.trim().toLowerCase()}::${sku.quantity ?? ''}::${sku.unit.trim().toLowerCase()}`
}

export function validateDraftSku(
  sku: DraftSku,
  siblingSkus: DraftSku[],
  expectedMeasurement?: MeasurementType,
): ValidationIssue[] {
  const prefix = `sku-${sku.id}`
  const issues: ValidationIssue[] = []
  // Local drafts and SKUs resumed from the account are both legitimate; anything else
  // came from neither producer and must not reach a write.
  if (!isKnownSkuId(sku.id)) issues.push(issue(6, prefix, 'This SKU has an unrecognised ID.'))
  // A size may only be measured the way its product is. Step 6 no longer offers a control
  // to change it, but a stale draft, a restored draft, or a direct store write could still
  // carry a size that drifted off. `expectedMeasurement` is omitted when no catalog has
  // loaded to resolve the product's measurement, in which case the check is skipped rather
  // than run against an unresolved answer.
  if (expectedMeasurement && sku.measurementType !== expectedMeasurement) {
    issues.push(issue(6, prefix, "This size must use its product's measurement."))
  }
  if (!sku.name.trim()) issues.push(issue(6, `${prefix}-name`, 'Add a name for this SKU.'))
  if (sku.description.length > 240) issues.push(issue(6, `${prefix}-description`, 'Keep the SKU description under 240 characters.'))
  const identity = skuIdentity(sku)
  const duplicateName = siblingSkus.some(
    (candidate) => candidate.id !== sku.id && skuIdentity(candidate) === identity,
  )
  if (sku.name.trim() && duplicateName) {
    issues.push(issue(6, `${prefix}-name`, 'Each size of a product needs its own name.'))
  }
  if (!sku.unit.trim()) issues.push(issue(6, `${prefix}-unit`, 'Choose a unit.'))
  if (!positive(sku.quantity)) issues.push(issue(6, `${prefix}-quantity`, 'Quantity must be greater than zero.'))
  if (!positive(sku.listPrice)) issues.push(issue(6, `${prefix}-list-price`, 'List price must be greater than zero.'))
  if (!positive(sku.salePrice)) issues.push(issue(6, `${prefix}-sale-price`, 'Sale price must be greater than zero.'))
  if (positive(sku.salePrice) && positive(sku.listPrice) && sku.salePrice > sku.listPrice) {
    issues.push(issue(6, `${prefix}-sale-price`, 'Sale price cannot exceed list price.'))
  }
  if (!sku.homeDelivery && !sku.storePickup) {
    issues.push(issue(6, `${prefix}-fulfillment`, 'Choose delivery, pickup, or both.'))
  }
  return issues
}

export function validateDelivery(delivery: DeliveryDraft): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const hasHomeDelivery = delivery.fulfillmentType !== 'STORE_PICKUP'

  if (hasHomeDelivery) {
    if (delivery.schedulingStrategy === 'FIXED_WINDOW') {
      const { minDeliveryDays, maxDeliveryDays } = delivery.fixedWindow
      if (!nonNegative(minDeliveryDays) || !positive(maxDeliveryDays) || maxDeliveryDays < minDeliveryDays) {
        issues.push(issue(7, 'fixed-window', 'Use a valid delivery-day range with the maximum at least the minimum.'))
      }
    }
    if (delivery.schedulingStrategy === 'CUSTOMER_SELECT_DATE') {
      const { minAdvanceBookingDays, maxAdvanceBookingDays, cutoffTime } = delivery.customerSelectDate
      if (!nonNegative(minAdvanceBookingDays) || !positive(maxAdvanceBookingDays) || maxAdvanceBookingDays < minAdvanceBookingDays) {
        issues.push(issue(7, 'customer-date-range', 'Use a valid advance-booking range.'))
      }
      if (!TIME_PATTERN.test(cutoffTime)) issues.push(issue(7, 'customer-cutoff', 'Enter a valid cutoff time.'))
    }
    if (delivery.schedulingStrategy === 'PREDEFINED_DAYS') {
      if (!delivery.predefinedDays.days.length) {
        issues.push(issue(7, 'predefined-days', 'Choose at least one delivery day.'))
      }
      if (!positive(delivery.predefinedDays.maxOrdersPerDay)) {
        issues.push(issue(7, 'max-orders', 'Maximum orders per day must be greater than zero.'))
      }
    }
    if (delivery.schedulingStrategy === 'INSTANT') {
      const config = delivery.instant
      if (!positive(config.minPrepTimeMinutes) || !positive(config.maxPrepTimeMinutes) || config.maxPrepTimeMinutes < config.minPrepTimeMinutes) {
        issues.push(issue(7, 'prep-range', 'Use a valid preparation range.'))
      }
      if (!TIME_PATTERN.test(config.operatingUntil)) issues.push(issue(7, 'operating-until', 'Enter a valid operating-until time.'))
      if (!TIME_PATTERN.test(config.orderCutoffTime)) issues.push(issue(7, 'order-cutoff', 'Enter a valid order cutoff time.'))
      if (TIME_PATTERN.test(config.operatingUntil) && TIME_PATTERN.test(config.orderCutoffTime) && config.orderCutoffTime > config.operatingUntil) {
        issues.push(issue(7, 'order-cutoff', 'Order cutoff cannot be later than operating hours.'))
      }
    }

    if (!nonNegative(delivery.shipping.charge)) {
      issues.push(issue(7, 'shipping-charge', 'Delivery charge cannot be negative.'))
    }
    if (delivery.shippingStrategy === 'ORDER_AMOUNT_THRESHOLD' && !positive(delivery.shipping.freeDeliveryThreshold)) {
      issues.push(issue(7, 'free-threshold', 'Free-delivery threshold must be greater than zero.'))
    }
  }

  if (hasHomeDelivery) {
    const seenSlots = new Set<string>()
    for (const slot of delivery.slots) {
      const slotKey = `${slot.startTime}-${slot.endTime}`
      if (!TIME_PATTERN.test(slot.startTime) || !TIME_PATTERN.test(slot.endTime) || slot.startTime >= slot.endTime) {
        issues.push(issue(7, `slot-${slot.id}`, 'Each delivery slot needs a valid start time before its end time.'))
      } else if (seenSlots.has(slotKey)) {
        issues.push(issue(7, `slot-${slot.id}`, 'Delivery slots must be unique.'))
      }
      seenSlots.add(slotKey)
    }
  }

  const hasConsent = Boolean(delivery.consentTitle.trim() || delivery.consentText.trim())
  if (hasConsent && (!delivery.consentTitle.trim() || !delivery.consentText.trim())) {
    issues.push(issue(7, 'consent', 'Add both a consent title and consent message, or leave both blank.'))
  }
  return issues
}

export function validatePayments(
  payments: PaymentOptionDraft[],
  paymentDetails: PaymentDetailsRuntime,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const enabled = payments.filter((payment) => payment.enabled)
  const defaults = enabled.filter((payment) => payment.isDefault)
  if (!enabled.length) issues.push(issue(8, 'payment-options', 'Choose at least one payment method.'))
  if (enabled.length && defaults.length !== 1) {
    issues.push(issue(8, 'payment-default', 'Choose exactly one default payment method.'))
  }
  if (payments.some((payment) => !payment.enabled && payment.isDefault)) {
    issues.push(issue(8, 'payment-default', 'The default payment method must be enabled.'))
  }
  if (payments.some((payment) => payment.type === 'PRE_PAID' && payment.enabled)) {
    if (!paymentDetails.upiId.trim()) {
      issues.push(issue(8, 'upi-id', 'Enter the UPI ID.'))
    }
    if (!paymentDetails.upiAccountHolderName.trim()) {
      issues.push(issue(8, 'upi-account-holder-name', 'Enter the UPI account holder name.'))
    }
  }
  return issues
}

function validateInstagram(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return true
  if (/^@?[a-zA-Z0-9._]{1,30}$/.test(trimmed)) return true
  try {
    const url = new URL(trimmed)
    return url.protocol === 'https:' && /(^|\.)instagram\.com$/i.test(url.hostname)
  } catch {
    return false
  }
}

// The plan-limit checks are shared by the full per-step validation and the additive check a
// submitted store uses, so the projected-total comparison and its message live in one place.
// The projected total — account usage ∪ this draft — is what a limit gates, never the draft
// count alone. See `CONTEXT.md` ("Plan limit").
function categoryLimitIssue(accountCategoryIds: number[], draftCategoryIds: number[], maxCategories: number): ValidationIssue[] {
  return projectedCategoryTotal(accountCategoryIds, draftCategoryIds) > maxCategories
    ? [issue(4, 'categories', `Your plan allows ${maxCategories} categories in total, including those already saved to your store.`)]
    : []
}

function productLimitIssue(accountProductIds: number[], draftProductIds: number[], maxProducts: number): ValidationIssue[] {
  return projectedProductTotal(accountProductIds, draftProductIds) > maxProducts
    ? [issue(5, 'products', `Your plan allows ${maxProducts} products in total, including those already saved to your store.`)]
    : []
}

function skuLimitIssue(accountSkuIds: number[], draftSkus: DraftSku[], maxSkus: number): ValidationIssue[] {
  return projectedSkuTotal(accountSkuIds, draftSkus) > maxSkus
    ? [issue(6, 'skus', `Your plan allows ${maxSkus} sizes in total, including those already saved to your store.`)]
    : []
}

export function validateStep(
  step: OnboardingStep,
  draft: VendorOnboardingDraftV1,
  runtime: OnboardingRuntimeState,
  maxCategories: number = ONBOARDING_CONFIG.maxCategories,
  measurementCatalog: MeasurementCatalog = [],
  catalog: CatalogEnforcement = {},
): ValidationIssue[] {
  const account = catalog.account ?? EMPTY_ACCOUNT
  const maxProducts = catalog.maxProducts ?? ONBOARDING_CONFIG.maxProducts
  const maxSkus = catalog.maxSkus ?? ONBOARDING_CONFIG.maxSkus
  if (step === 1) {
    return isValidIndianMobile(runtime.phone)
      ? []
      : [issue(1, 'phone', 'Enter a valid 10-digit Indian mobile number beginning with 6-9.')]
  }
  if (step === 2) {
    return draft.mobileVerified
      ? []
      : [issue(2, 'otp-0', 'Enter and verify the four-digit prototype code.')]
  }
  if (step === 3) {
    return draft.business.businessType
      ? []
      : [issue(3, 'business-type', 'Choose a business type.')]
  }
  if (step === 4) {
    if (!draft.categories.length) return [issue(4, 'categories', 'Choose at least one category.')]
    return categoryLimitIssue(account.categoryIds, draft.categories.map((category) => category.id), maxCategories)
  }
  if (step === 5) {
    if (!draft.products.length) return [issue(5, 'products', 'Choose at least one product to continue.')]
    return productLimitIssue(account.productIds, draft.products.map((product) => product.id), maxProducts)
  }
  if (step === 6) {
    // Projected post-save size count: account sizes plus new local ones, an edit net-zero.
    const issues: ValidationIssue[] = skuLimitIssue(account.skuIds, draft.skus, maxSkus)
    for (const product of draft.products) {
      const productSkus = draft.skus.filter((sku) => sku.productId === product.id)
      // The measurement every size of this product must carry. Undefined when no catalog has
      // loaded to resolve it, so the guard stays quiet rather than resolving to COUNT.
      const expectedMeasurement = expectedMeasurementFor(product, measurementCatalog)
      const validActiveSkus = productSkus.filter(
        (sku) => sku.active && validateDraftSku(sku, productSkus, expectedMeasurement).length === 0,
      )
      if (!validActiveSkus.length) {
        issues.push(issue(6, `product-${product.id}`, `${product.name} needs at least one size with a price.`))
      }
      for (const sku of productSkus) issues.push(...validateDraftSku(sku, productSkus, expectedMeasurement))
    }
    return issues
  }
  if (step === 7) return validateDelivery(draft.delivery)
  if (step === 8) return validatePayments(draft.payments, runtime.paymentDetails)
  if (step === 9) {
    const issues: ValidationIssue[] = []
    if (draft.storefront.storeName.trim().length < 3) issues.push(issue(9, 'store-name', 'Enter at least 3 characters for the store name.'))
    if (draft.storefront.storeName.trim().length > 100) issues.push(issue(9, 'store-name', 'Keep the store name under 100 characters.'))
    if (draft.business.ownerName.trim().length < 3) issues.push(issue(9, 'owner-name', 'Enter at least 3 characters for the owner name.'))
    if (draft.business.contactPerson.trim().length < 3) issues.push(issue(9, 'contact-person', 'Enter at least 3 characters for the contact person.'))
    if (draft.storefront.tagline.length > 120) issues.push(issue(9, 'tagline', 'Keep the tagline under 120 characters.'))
    if (!draft.storefront.businessLocation.trim()) issues.push(issue(9, 'business-location', 'Enter a business location.'))
    if (draft.storefront.businessLocation.length > 100) issues.push(issue(9, 'business-location', 'Keep the business location under 100 characters.'))
    if (!isValidE164(runtime.orderWhatsapp)) issues.push(issue(9, 'order-whatsapp', 'Enter the order WhatsApp number in E.164 format, such as +919876543210.'))
    if (runtime.supportWhatsapp.trim() && !isValidE164(runtime.supportWhatsapp)) issues.push(issue(9, 'support-whatsapp', 'Enter the support WhatsApp number in E.164 format.'))
    if (!validateInstagram(draft.storefront.instagram)) issues.push(issue(9, 'instagram', 'Enter an Instagram handle or an https://instagram.com URL.'))
    if (draft.storefront.instagram.length > 200) issues.push(issue(9, 'instagram', 'Keep the Instagram value under 200 characters.'))
    if (draft.storefront.welcomeMessage.length > 160) issues.push(issue(9, 'welcome-message', 'Keep the welcome message under 160 characters.'))
    if (draft.storefront.announcementBar.length > 100) issues.push(issue(9, 'announcement-bar', 'Keep the announcement under 100 characters.'))
    for (const [field, color] of [
      ['primary-color', draft.storefront.primaryColor],
      ['accent-color', draft.storefront.accentColor],
      ['background-color', draft.storefront.backgroundColor],
      ['text-color', draft.storefront.textColor],
    ] as const) {
      if (!isValidHex(color)) issues.push(issue(9, field, 'Use a six-digit hex color.'))
    }
    if (
      isValidHex(draft.storefront.textColor) &&
      isValidHex(draft.storefront.backgroundColor) &&
      contrastRatio(draft.storefront.textColor, draft.storefront.backgroundColor) < 4.5
    ) {
      issues.push(issue(9, 'text-color', 'Store text needs at least 4.5:1 contrast against the background.'))
    }
    return issues
  }
  return readinessIssues(draft, runtime, maxCategories)
}

/**
 * Step 10 re-checks every earlier step before go-live.
 *
 * `maxCategories` has to be the live plan limit, not the fallback. Step 4 accepts up to
 * the vendor's real limit and writes those categories to the account, so re-checking here
 * against `ONBOARDING_CONFIG.maxCategories` reports a violation the vendor cannot fix —
 * categories already on the account cannot be unassigned (403, Admin only), so go-live
 * would be blocked permanently for anyone on a plan above the fallback.
 */
export function readinessIssues(
  draft: VendorOnboardingDraftV1,
  runtime: OnboardingRuntimeState,
  maxCategories: number = ONBOARDING_CONFIG.maxCategories,
  measurementCatalog: MeasurementCatalog = [],
  catalog: CatalogEnforcement = {},
): ValidationIssue[] {
  return ([3, 4, 5, 6, 7, 8, 9] as OnboardingStep[]).flatMap((step) =>
    validateStep(step, draft, runtime, maxCategories, measurementCatalog, catalog),
  )
}

/**
 * What a submitted store may still validate on Steps 4-5: only the additive delta.
 *
 * A submitted store is with an administrator, so the whole-store readiness checks in
 * `validateStep` do not apply here — reporting "every product needs a size" on a store
 * that is already submitted blocks the vendor on a problem they were never asked to fix
 * and cannot (existing entries are read-only). This gates the one thing a submitted store
 * can still do wrong: push its catalog past a plan limit. Sizes are excluded — Step 6 is
 * read-only while under review, because the backend rejects a new size (417) until the
 * store is approved. See `CONTEXT.md` ("Submitted", "Plan limit").
 */
export function additiveCatalogIssues(
  step: OnboardingStep,
  draft: VendorOnboardingDraftV1,
  maxCategories: number = ONBOARDING_CONFIG.maxCategories,
  catalog: CatalogEnforcement = {},
): ValidationIssue[] {
  const account = catalog.account ?? EMPTY_ACCOUNT
  const maxProducts = catalog.maxProducts ?? ONBOARDING_CONFIG.maxProducts
  if (step === 4) {
    return categoryLimitIssue(account.categoryIds, draft.categories.map((category) => category.id), maxCategories)
  }
  if (step === 5) {
    return productLimitIssue(account.productIds, draft.products.map((product) => product.id), maxProducts)
  }
  return []
}

export function normalizeDraftSlug(value: string): string {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return normalized || 'my-local-store'
}

export function mapFutureCheckoutOptions(
  delivery: DeliveryDraft,
  payments: PaymentOptionDraft[],
) {
  if (payments.some((payment) => payment.enabled && (payment.type === 'PRE_PAID' || payment.type === 'ONLINE'))) {
    throw new Error('UPI and bank-account checkout details require confirmed backend keys before they can be mapped.')
  }
  const hasHomeDelivery = delivery.fulfillmentType !== 'STORE_PICKUP'
  const schedulingConfig =
    delivery.schedulingStrategy === 'FIXED_WINDOW'
      ? { min_delivery_days: delivery.fixedWindow.minDeliveryDays, max_delivery_days: delivery.fixedWindow.maxDeliveryDays }
      : delivery.schedulingStrategy === 'CUSTOMER_SELECT_DATE'
        ? { min_advance_booking_days: delivery.customerSelectDate.minAdvanceBookingDays, max_advance_booking_days: delivery.customerSelectDate.maxAdvanceBookingDays, cutoff_time: delivery.customerSelectDate.cutoffTime }
        : delivery.schedulingStrategy === 'PREDEFINED_DAYS'
          ? { available_delivery_days: delivery.predefinedDays.days, max_orders_per_day: delivery.predefinedDays.maxOrdersPerDay }
          : { min_prep_time_minutes: delivery.instant.minPrepTimeMinutes, max_prep_time_minutes: delivery.instant.maxPrepTimeMinutes, operating_until: delivery.instant.operatingUntil, order_cutoff_time: delivery.instant.orderCutoffTime }

  return {
    fulfillment_type: delivery.fulfillmentType,
    customer_consent_title: delivery.consentTitle || undefined,
    customer_consent_text: delivery.consentText || undefined,
    scheduling_strategy: hasHomeDelivery ? delivery.schedulingStrategy : undefined,
    scheduling_config: hasHomeDelivery ? schedulingConfig : undefined,
    shipping_strategy_type: hasHomeDelivery ? delivery.shippingStrategy : undefined,
    shipping_config: hasHomeDelivery
      ? delivery.shippingStrategy === 'FLAT'
        ? { charge: delivery.shipping.charge }
        : { delivery_charge: delivery.shipping.charge, free_delivery_threshold: delivery.shipping.freeDeliveryThreshold }
      : undefined,
    order_acceptance_policy: delivery.orderAcceptancePolicy,
    delivery_slots: hasHomeDelivery
      ? delivery.slots.map((slot) => `${slot.startTime}-${slot.endTime}`)
      : [],
    payment_options: payments
      .filter((payment) => payment.enabled)
      .map((payment, index) => ({
        type: payment.type,
        label:
          payment.type === 'PRE_PAID'
            ? 'UPI'
            : payment.type === 'ONLINE'
              ? 'Bank Account'
              : 'Cash on Delivery',
        is_default: payment.isDefault,
        display_order: index + 1,
      })),
  }
}
