import {
  getErrorMessage,
  vendorOnboardingService,
  vendorProductIdByPlatformId,
  type CheckoutDeliveryInput,
  type CheckoutPaymentInput,
  type StorefrontConfigInput,
} from '@/shared/api'
import type {
  OnboardingRuntimeState,
  OnboardingStep,
  VendorOnboardingDraftV1,
} from '../types/onboarding'

/**
 * Steps written to the vendor account on Continue.
 *
 * Step 10 is absent because go-live is not a "save" — the wizard runs it explicitly
 * and then reconciles the returned approval state.
 */
export const LIVE_PERSISTED_STEPS: readonly OnboardingStep[] = [3, 4, 5, 6, 7, 8, 9]

export function isLivePersistedStep(step: OnboardingStep): boolean {
  return LIVE_PERSISTED_STEPS.includes(step)
}

/** Field to focus when a save for this step fails. */
export function stepErrorField(step: OnboardingStep): string {
  if (step === 3) return 'business-type'
  if (step === 4) return 'categories'
  if (step === 5) return 'products'
  if (step === 6) return 'skus'
  if (step === 7) return 'fulfillment'
  if (step === 8) return 'payments'
  return 'store-name'
}

/**
 * Removing a product is Admin/Customer_Care only — `PATCH /delete/products` returns
 * 403 for a vendor — so assignment is additive. Surfaced to the vendor rather than
 * silently doing nothing.
 */
export const PRODUCT_REMOVAL_UNSUPPORTED =
  'Products already added to your store cannot be removed here yet. Contact support to remove one.'

function toStorefrontInput(
  draft: VendorOnboardingDraftV1,
  runtime: OnboardingRuntimeState,
): StorefrontConfigInput {
  return {
    storeName: draft.storefront.storeName,
    tagline: draft.storefront.tagline,
    businessLocation: draft.storefront.businessLocation,
    instagram: draft.storefront.instagram,
    orderWhatsapp: runtime.orderWhatsapp,
    supportWhatsapp: runtime.supportWhatsapp,
    welcomeMessage: draft.storefront.welcomeMessage,
    announcementBar: draft.storefront.announcementBar,
    heroBadges: draft.storefront.heroBadges,
    trustStrip: draft.storefront.trustStrip,
    theme: {
      primaryColor: draft.storefront.primaryColor,
      accentColor: draft.storefront.accentColor,
      backgroundColor: draft.storefront.backgroundColor,
      textColor: draft.storefront.textColor,
      fontFamily: draft.storefront.fontFamily,
      buttonShape: draft.storefront.buttonShape,
      cardStyle: draft.storefront.cardStyle,
      themePreset: draft.storefront.themePreset,
    },
    // Image upload stays out until the wizard uploads through the images endpoint;
    // a local object URL must never be sent.
    uploadedLogoUrl: null,
    uploadedBannerUrl: null,
  }
}

function toDeliveryInput(draft: VendorOnboardingDraftV1): CheckoutDeliveryInput {
  const d = draft.delivery
  return {
    fulfillmentType: d.fulfillmentType,
    orderAcceptancePolicy: d.orderAcceptancePolicy,
    schedulingStrategy: d.schedulingStrategy,
    fixedWindow: d.fixedWindow,
    customerSelectDate: d.customerSelectDate,
    predefinedDays: { days: d.predefinedDays.days, maxOrdersPerDay: d.predefinedDays.maxOrdersPerDay },
    instant: d.instant,
    shippingStrategy: d.shippingStrategy,
    shipping: {
      charge: d.shipping.charge,
      freeDeliveryThreshold: d.shipping.freeDeliveryThreshold,
    },
    slots: d.slots.map((slot) => ({ startTime: slot.startTime, endTime: slot.endTime })),
    consentTitle: d.consentTitle,
    consentText: d.consentText,
  }
}

function toPaymentInput(
  draft: VendorOnboardingDraftV1,
  runtime: OnboardingRuntimeState,
): CheckoutPaymentInput {
  return {
    options: draft.payments.map((option) => ({
      type: option.type,
      enabled: option.enabled,
      isDefault: option.isDefault,
    })),
    details: runtime.paymentDetails,
  }
}

/** The backend stores a SKU as `<name>-<value> <unit>`; match that to detect duplicates. */
function serverSkuName(name: string, quantity: number, unit: string): string {
  return `${name.trim()}-${quantity} ${unit}`
}

/** The DB unique constraint on (name, weight, vendor_product_id) surfaces as a 417. */
function isDuplicateSkuError(error: unknown): boolean {
  return /duplicate key|tb_sku_unique/i.test(getErrorMessage(error, ''))
}

async function persistProducts(
  vendorId: string,
  draft: VendorOnboardingDraftV1,
): Promise<void> {
  const existing = await vendorOnboardingService.getVendorProducts(vendorId)
  const assigned = new Set(existing.map((product) => product.platformProductId))

  // `category_id` here is the PLATFORM category, despite the endpoint description.
  const byCategory = new Map<number, number[]>()
  for (const product of draft.products) {
    if (assigned.has(product.id)) continue
    const bucket = byCategory.get(product.categoryId) ?? []
    bucket.push(product.id)
    byCategory.set(product.categoryId, bucket)
  }

  for (const [platformCategoryId, productIds] of byCategory) {
    await vendorOnboardingService.assignProducts(vendorId, platformCategoryId, productIds)
  }
}

async function persistSkus(vendorId: string, draft: VendorOnboardingDraftV1): Promise<void> {
  const [products, skus] = await Promise.all([
    vendorOnboardingService.getVendorProducts(vendorId),
    vendorOnboardingService.getVendorSkus(vendorId),
  ])
  const vendorProductIds = vendorProductIdByPlatformId(products)
  const existing = new Set(skus.map((sku) => `${sku.vendorProductId}::${sku.name}`))

  for (const sku of draft.skus) {
    if (sku.quantity == null || sku.listPrice == null || sku.salePrice == null) continue

    const vendorProductId = vendorProductIds.get(sku.productId)
    if (!vendorProductId) {
      throw new Error(
        `“${sku.name}” could not be saved because its product is not in your store yet. Go back to Products and continue again.`,
      )
    }

    const key = `${vendorProductId}::${serverSkuName(sku.name, sku.quantity, sku.unit)}`
    if (existing.has(key)) continue

    try {
      await vendorOnboardingService.createSku(
        vendorId,
        {
          name: sku.name,
          description: sku.description,
          measurementType: sku.measurementType,
          unit: sku.unit,
          quantity: sku.quantity,
          listPrice: sku.listPrice,
          salePrice: sku.salePrice,
          active: sku.active,
          homeDelivery: sku.homeDelivery,
          storePickup: sku.storePickup,
        },
        vendorProductId,
      )
    } catch (error) {
      // Already on the account under a slightly different local name — not a failure.
      if (!isDuplicateSkuError(error)) throw error
    }
  }
}

/**
 * Persist one step to the vendor account. Throws on failure so the caller keeps the
 * vendor on the step — a failed write must never be reported as local success.
 */
export async function persistStep(
  step: OnboardingStep,
  vendorId: string,
  draft: VendorOnboardingDraftV1,
  runtime: OnboardingRuntimeState,
): Promise<void> {
  if (step === 3) {
    const businessType = draft.business.businessType
    if (!businessType) return
    // `name` holds the exact backend `type` value, not a display label.
    await vendorOnboardingService.saveBusinessType(vendorId, { businessType: businessType.name })
    return
  }

  if (step === 4) {
    await vendorOnboardingService.saveCategories(
      vendorId,
      draft.categories.map((category) => category.id),
    )
    return
  }

  if (step === 5) return persistProducts(vendorId, draft)
  if (step === 6) return persistSkus(vendorId, draft)

  // Steps 7 and 8 share one payload, and payment_options replaces the existing set,
  // so both always send the complete current configuration.
  if (step === 7 || step === 8) {
    await vendorOnboardingService.saveCheckoutOptions(
      vendorId,
      toDeliveryInput(draft),
      toPaymentInput(draft, runtime),
    )
    return
  }

  if (step === 9) {
    await vendorOnboardingService.saveStorefront(vendorId, toStorefrontInput(draft, runtime))
    // owner_name and contact_person have no home in the storefront config, so they
    // ride along on the business-type record where the contract defines them.
    const businessType = draft.business.businessType
    if (businessType) {
      await vendorOnboardingService.saveBusinessType(vendorId, {
        businessType: businessType.name,
        businessName: draft.storefront.storeName,
        ownerName: draft.business.ownerName,
        contactPerson: draft.business.contactPerson,
      })
    }
  }
}
