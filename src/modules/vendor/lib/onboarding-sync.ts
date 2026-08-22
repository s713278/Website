import {
  getErrorMessage,
  vendorOnboardingService,
  vendorProductIdByPlatformId,
  type CheckoutDeliveryInput,
  type CheckoutPaymentInput,
  type StorefrontConfigInput,
  type VendorSkuRef,
} from '@/shared/api'
import type {
  DraftSku,
  OnboardingRuntimeState,
  OnboardingStep,
  VendorOnboardingDraftV1,
} from '../types/onboarding'
import { serverSkuIdOf } from './onboarding-sku-id'

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

export type SkuWritePlan = {
  creates: Array<{ sku: DraftSku; vendorProductId: number }>
  /** Server SKU IDs to delete. */
  deletes: number[]
}

/** Everything a SKU row carries that the vendor can change. */
function draftFingerprint(sku: DraftSku): string {
  return [
    sku.name.trim().toLowerCase(),
    sku.quantity ?? '',
    sku.unit.trim().toLowerCase(),
    sku.listPrice ?? '',
    sku.salePrice ?? '',
    sku.active,
    sku.description.trim(),
  ].join('|')
}

function accountFingerprint(sku: VendorSkuRef): string {
  return [
    sku.displayName.trim().toLowerCase(),
    sku.quantity ?? '',
    sku.unit.trim().toLowerCase(),
    sku.listPrice ?? '',
    sku.salePrice ?? '',
    sku.isActive,
    sku.description.trim(),
  ].join('|')
}

/**
 * Reconcile the draft's SKUs against the account's.
 *
 * Creating is not enough. A vendor who removes a SKU, drops a price or renames one gets
 * their old row back on the next resume unless the account is told, because the resume
 * rebuilds the draft from the account.
 *
 * Edits are expressed as delete + create rather than an update: `PATCH /skus/{id}` covers
 * only name, description and is_active — never price or size — and currently fails with a
 * JDBC 417 regardless. See docs/API_GAPS.md.
 *
 * SKUs belonging to a product that is not in the draft are left alone. A vendor cannot
 * unassign a product (403, Admin only), so that state means the account holds a product
 * the wizard is not showing — deleting its rows would destroy data the vendor never
 * asked to lose.
 */
export function planSkuWrites(
  draft: Pick<VendorOnboardingDraftV1, 'products' | 'skus'>,
  serverSkus: VendorSkuRef[],
  vendorProductIdByPlatform: Map<number, number>,
): SkuWritePlan {
  const draftSkus = draft.skus
  const creates: SkuWritePlan['creates'] = []
  const deletes: number[] = []

  // Scoped to the products the wizard is showing, not to the SKUs it holds: removing a
  // product's last SKU still has to delete the account row.
  const draftProductIds = new Set(
    draft.products
      .map((product) => vendorProductIdByPlatform.get(product.id))
      .filter((id): id is number => id != null),
  )
  const serverById = new Map(serverSkus.map((sku) => [sku.skuId, sku]))
  const keptServerIds = new Set<number>()

  for (const sku of draftSkus) {
    if (sku.quantity == null || sku.listPrice == null || sku.salePrice == null) continue
    const vendorProductId = vendorProductIdByPlatform.get(sku.productId)
    if (!vendorProductId) {
      throw new Error(
        `“${sku.name}” could not be saved because its product is not in your store yet. Go back to Products and continue again.`,
      )
    }

    const serverId = serverSkuIdOf(sku.id)
    const existing = serverId == null ? undefined : serverById.get(serverId)

    if (!existing) {
      creates.push({ sku, vendorProductId })
      continue
    }
    if (draftFingerprint(sku) === accountFingerprint(existing)) {
      keptServerIds.add(existing.skuId)
      continue
    }
    // Changed: the row has to be replaced, because it cannot be updated in place.
    deletes.push(existing.skuId)
    creates.push({ sku, vendorProductId })
  }

  for (const sku of serverSkus) {
    if (keptServerIds.has(sku.skuId) || deletes.includes(sku.skuId)) continue
    // Only reconcile products the wizard is actually showing.
    if (!draftProductIds.has(sku.vendorProductId)) continue
    deletes.push(sku.skuId)
  }

  return { creates, deletes }
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
  const [products, serverSkus] = await Promise.all([
    vendorOnboardingService.getVendorProducts(vendorId),
    vendorOnboardingService.getVendorSkus(vendorId),
  ])
  const vendorProductIds = vendorProductIdByPlatformId(products)
  const plan = planSkuWrites(draft, serverSkus, vendorProductIds)
  const nameOnAccount = new Set(serverSkus.map((sku) => `${sku.vendorProductId}::${sku.name}`))

  // Deletions first: an edit is delete-then-create, and creating first would collide with
  // the row being replaced on the (name, weight, vendor_product_id) unique constraint.
  for (const skuId of plan.deletes) {
    await vendorOnboardingService.deleteSku(vendorId, skuId)
    const removed = serverSkus.find((sku) => sku.skuId === skuId)
    if (removed) nameOnAccount.delete(`${removed.vendorProductId}::${removed.name}`)
  }

  for (const { sku, vendorProductId } of plan.creates) {
    if (sku.quantity == null || sku.listPrice == null || sku.salePrice == null) continue
    const key = `${vendorProductId}::${serverSkuName(sku.name, sku.quantity, sku.unit)}`
    if (nameOnAccount.has(key)) continue

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
      nameOnAccount.add(key)
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
