import {
  schedulingConfigList,
  schedulingConfigNumber,
  schedulingConfigString,
  vendorOnboardingService,
  type BusinessTypeReference,
  type CheckoutOptionsSnapshot,
  type MeasurementCatalog,
  type VendorCategoryRef,
  type VendorContext,
  type VendorProductRef,
  type VendorProfile,
  type VendorSkuRef,
} from '@/shared/api'
import { createEmptyOnboardingDraft } from '../data/onboarding-defaults'
import { isStoreSubmitted } from './onboarding-account-status'
import { accountSkuId } from './onboarding-sku-id'
import { measurementFromProduct, reconcileUnitForMeasurement } from './onboarding-measurement'
import { SAMPLE_MEASUREMENT_CATALOG } from '../data/onboarding-measurement-sample'
import type {
  DraftSku,
  OnboardingRuntimeState,
  OnboardingStep,
  PaymentType,
  SelectedProduct,
  VendorOnboardingDraftV1,
  Weekday,
} from '../types/onboarding'

/**
 * Rebuilding a vendor's onboarding from their account.
 *
 * The local draft is a pre-submit buffer, not the record. A vendor who signs in from a
 * different browser — or who has just switched numbers — has no draft, so their earlier
 * selections have to come back from the server.
 *
 * Step 9 is the exception: `GET /{identifier}/storefront` is the only read that carries
 * branding and it returns 404 until an admin approves the store, so a vendor still in the
 * wizard can never read it. Branding therefore falls back to defaults.
 */
export type ServerOnboardingState = {
  context: VendorContext
  profile: VendorProfile | null
  categories: VendorCategoryRef[]
  products: VendorProductRef[]
  skus: VendorSkuRef[]
  checkout: CheckoutOptionsSnapshot | null
  businessTypes: BusinessTypeReference[]
  measurements: MeasurementCatalog
}

/** A never-configured vendor reports this, so it cannot be read as a real choice. */
const UNSET_BUSINESS_TYPE = 'Others'

const WEEKDAYS = new Set<Weekday>([
  'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY',
])

type LoadConfig = { signal?: AbortSignal }

export type OnboardingAccountRead =
  | 'categories'
  | 'products'
  | 'measurements'
  | 'skus'
  | 'checkout'

const ACCOUNT_READ_START_STEP: readonly [OnboardingAccountRead, OnboardingStep][] = [
  ['categories', 4],
  ['products', 5],
  ['measurements', 5],
  ['skus', 6],
  ['checkout', 7],
]

/** Account resources needed to rebuild every saved step before the resume step. */
export function accountReadsForResumeStep(step: OnboardingStep): OnboardingAccountRead[] {
  return ACCOUNT_READ_START_STEP
    .filter(([, startStep]) => step >= startStep)
    .map(([read]) => read)
}

/** Resolves to `null` instead of rejecting, so one dead read cannot sink the resume. */
async function optional<T>(work: Promise<T>): Promise<T | null> {
  try {
    return await work
  } catch {
    return null
  }
}

export async function loadServerOnboardingState(
  vendorId: string,
  config: LoadConfig = {},
): Promise<ServerOnboardingState> {
  // Start all three universal reads before awaiting context. The dependent fan-out can
  // then begin as soon as context reveals the resume step, without waiting for either
  // of the other universal reads to finish.
  const contextPromise = vendorOnboardingService.getVendorContext(vendorId, config)
  const profilePromise = optional(vendorOnboardingService.getVendorProfile(vendorId, config))
  // One page covers the catalog (30 types); needed to turn the profile's display
  // string back into the reference object Step 3 stores.
  const businessTypesPromise = optional(vendorOnboardingService.getBusinessTypes(
    { pageNumber: 0, pageSize: 100, sortBy: 'id', sortOrder: 'ASC' },
    config,
  ))

  // Deliberately not optional. Context decides liveness, limits and whether a resume
  // happens at all, so losing it is a real failure the vendor has to be told about —
  // not an empty wizard with no explanation.
  const context = await contextPromise

  // A submitted vendor must still be able to navigate back through the complete account.
  // If the backend ever omits its pointer, load everything so resource-derived resume can
  // remain the safe fallback rather than deriving from an intentionally partial snapshot.
  const step = isStoreSubmitted({ context })
    ? 10
    : (backendResumeStep(context) ?? 10)
  const reads = new Set(accountReadsForResumeStep(step))

  const [profile, businessTypes, categories, products, skus, checkout, measurements] = await Promise.all([
    profilePromise,
    businessTypesPromise,
    reads.has('categories')
      ? optional(vendorOnboardingService.getVendorCategories(vendorId, config))
      : null,
    reads.has('products')
      ? optional(vendorOnboardingService.getVendorProducts(vendorId, config))
      : null,
    reads.has('skus')
      ? optional(vendorOnboardingService.getVendorSkus(vendorId, config))
      : null,
    // A first-time vendor legitimately 404s here; the service already maps that to null.
    reads.has('checkout')
      ? optional(vendorOnboardingService.getCheckoutOptions(vendorId, config))
      : null,
    // Authoritative units for Step 6. A dead read falls back to the sample catalog,
    // which mirrors the backend shape, so a size still opens with real units rather
    // than an empty dropdown.
    reads.has('measurements')
      ? optional(vendorOnboardingService.getMeasurements(config))
      : null,
  ])

  return {
    context,
    profile,
    categories: categories ?? [],
    products: products ?? [],
    skus: skus ?? [],
    checkout,
    businessTypes: businessTypes?.items ?? [],
    measurements: measurements ?? SAMPLE_MEASUREMENT_CATALOG,
  }
}

export function hasBusinessType(state: ServerOnboardingState): boolean {
  const type = state.profile?.businessType?.trim()
  return Boolean(type) && type !== UNSET_BUSINESS_TYPE
}

/** Every assigned product carries at least one SKU. */
function everyProductPriced(state: ServerOnboardingState): boolean {
  if (!state.products.length) return false
  const priced = new Set(state.skus.map((sku) => sku.vendorProductId))
  return state.products.every((product) => priced.has(product.vendorProductId))
}

// Defined in a leaf module so the login screens can ask "is this store submitted?" without
// pulling this file's dependency graph into the initial bundle. Re-exported here because
// this is where callers expect to find them.
export { isStoreSubmitted, isVendorApproved } from './onboarding-account-status'

/**
 * The first step that is genuinely unfinished, judged by what is actually saved.
 *
 * Deliberately not `onboarding.next_step`: that value is derived and moves backwards.
 * A vendor who has submitted still reports `IN_PROGRESS` with `next_step` pointing at
 * Step 5 whenever any assigned product lacks a SKU.
 */
export function earliestIncompleteStep(state: ServerOnboardingState): OnboardingStep {
  if (!hasBusinessType(state)) return 3
  if (!state.categories.length) return 4
  if (!state.products.length) return 5
  if (!everyProductPriced(state)) return 6
  if (!state.checkout?.schedulingStrategy) return 7
  if (!state.checkout?.payments.length) return 8
  // Step 9 branding cannot be read back, so a resuming vendor always re-confirms it.
  if (!isStoreSubmitted(state)) return 9
  return 10
}

/**
 * The furthest step the account shows real evidence for.
 *
 * Distinct from `earliestIncompleteStep`, which finds the first *gap*. A gap behind the
 * vendor must not drag them back: products cannot be unassigned (403, Admin only), so a
 * single leftover unpriced product would otherwise reopen Step 6 forever and silently
 * discard the delivery, payment and storefront work already saved.
 *
 * Step 9 has no readable evidence — branding 404s until approval — so the highest this
 * reports for a vendor still in setup is 8.
 */
export function furthestSavedStep(state: ServerOnboardingState): OnboardingStep | null {
  if (isStoreSubmitted(state)) return 10
  if (state.checkout?.payments.length) return 8
  if (state.checkout?.schedulingStrategy) return 7
  if (state.skus.length) return 6
  if (state.products.length) return 5
  if (state.categories.length) return 4
  if (hasBusinessType(state)) return 3
  return null
}

/**
 * The step the backend says comes next.
 *
 * `onboarding.next_step` is 1-based over the ten wizard steps and reports 11 once setup
 * is finished. It is returned by both `POST /v1/auth/verify-otp` (per vendor, under
 * `vendors[].onboarding`) and `GET /v1/vendors/{id}/context`, with identical values.
 *
 * Steps 1-2 are identity. Anyone this is being computed for is already signed in, so a
 * value below 3 means "the start of setup", not "ask for the number again".
 */
export function backendResumeStep(context: VendorContext): OnboardingStep | null {
  const next = context.onboarding.nextStep
  if (next == null || !Number.isInteger(next)) return null
  if (next > 10) return 10
  if (next < 3) return 3
  return next as OnboardingStep
}

/**
 * Where the wizard opens.
 *
 * The backend's own pointer is authoritative. It tracks what the vendor actually
 * completed rather than what the account happens to hold, which is the difference that
 * matters: a vendor who finished Step 8 but has one unpriced product left over reports
 * `next_step: 9`, while deriving from resources reports 6 and throws away their
 * delivery, payment and storefront work on every visit.
 *
 * `derivedResumeStep` is a fallback for one case only — the contract dropping the field.
 * It is not a second opinion, and nothing should prefer it.
 */
export function resumeStep(state: ServerOnboardingState): OnboardingStep {
  if (isStoreSubmitted(state)) return 10
  return backendResumeStep(state.context) ?? derivedResumeStep(state)
}

/** Resource-derived fallback. Only reachable if `next_step` stops being returned. */
export function derivedResumeStep(state: ServerOnboardingState): OnboardingStep {
  const saved = furthestSavedStep(state)
  if (saved === 10) return 10
  const earliest = earliestIncompleteStep(state)
  if (saved === null) return earliest
  // Step 9 is always re-confirmed, so it is the ceiling before submission.
  const next = Math.min(saved + 1, 9) as OnboardingStep
  return Math.max(earliest, next) as OnboardingStep
}

function businessTypeReference(state: ServerOnboardingState): BusinessTypeReference | null {
  const name = state.profile?.businessType?.trim()
  if (!name || name === UNSET_BUSINESS_TYPE) return null
  return state.businessTypes.find((item) => item.name === name) ?? null
}

function selectedProducts(state: ServerOnboardingState): SelectedProduct[] {
  return state.products.map((product) => ({
    id: product.platformProductId,
    name: product.name,
    // The vendor-scoped read carries no description, image or measurement name; the
    // reference catalog owns those and Step 5 re-fetches it when the vendor opens it.
    description: null,
    imageUrl: null,
    measurementId: product.measurementId,
    measurementName: null,
    categoryId: product.platformCategoryId,
  }))
}

function draftSkus(state: ServerOnboardingState): DraftSku[] {
  const measurementByVendorProduct = new Map(
    state.products.map((product) => [product.vendorProductId, product.measurementId]),
  )
  const platformByVendorProduct = new Map(
    state.products.map((product) => [product.vendorProductId, product.platformProductId]),
  )

  return state.skus.flatMap((sku) => {
    const productId = platformByVendorProduct.get(sku.vendorProductId)
    if (productId == null) return []
    const measurementId = measurementByVendorProduct.get(sku.vendorProductId)
    // A size's measurement is its product's, so it is derived here rather than read off the
    // account SKU. The stored unit is kept only while the product's measurement still offers
    // it; a unit that no longer fits falls back to a valid one for the measurement.
    const measurementType = measurementFromProduct(measurementId ?? null, null, state.measurements)
    return [{
      // Server id, so a resumed SKU is never re-created as a duplicate.
      id: accountSkuId(sku.skuId),
      productId,
      name: sku.displayName,
      description: sku.description,
      skuType: 'ITEM' as const,
      measurementType,
      unit: reconcileUnitForMeasurement(measurementType, sku.unit, state.measurements),
      quantity: sku.quantity,
      listPrice: sku.listPrice,
      salePrice: sku.salePrice,
      active: sku.isActive,
      // No read exposes these per-SKU flags; the wizard's own defaults stand.
      homeDelivery: true,
      storePickup: true,
    }]
  })
}

function resumeDelivery(
  checkout: CheckoutOptionsSnapshot,
  base: VendorOnboardingDraftV1['delivery'],
): VendorOnboardingDraftV1['delivery'] {
  const config = checkout.schedulingConfig
  const charge = checkout.shippingConfig.deliveryCharge
  const threshold = checkout.shippingConfig.freeDeliveryThreshold
  const days = schedulingConfigList(config, 'delivery_days', 'available_delivery_days')

  return {
    ...base,
    fulfillmentType: checkout.fulfillmentType ?? base.fulfillmentType,
    orderAcceptancePolicy: checkout.orderAcceptancePolicy ?? base.orderAcceptancePolicy,
    schedulingStrategy: checkout.schedulingStrategy ?? base.schedulingStrategy,
    fixedWindow: {
      minDeliveryDays: schedulingConfigNumber(config, 'min_delivery_days') ?? base.fixedWindow.minDeliveryDays,
      maxDeliveryDays: schedulingConfigNumber(config, 'max_delivery_days') ?? base.fixedWindow.maxDeliveryDays,
    },
    customerSelectDate: {
      minAdvanceBookingDays:
        schedulingConfigNumber(config, 'min_advance_booking_days') ?? base.customerSelectDate.minAdvanceBookingDays,
      maxAdvanceBookingDays:
        schedulingConfigNumber(config, 'max_advance_booking_days') ?? base.customerSelectDate.maxAdvanceBookingDays,
      cutoffTime: schedulingConfigString(config, 'cutoff_time') ?? base.customerSelectDate.cutoffTime,
    },
    predefinedDays: {
      days: days.filter((day: string): day is Weekday => WEEKDAYS.has(day as Weekday)),
      maxOrdersPerDay: schedulingConfigNumber(config, 'max_orders_per_day') ?? base.predefinedDays.maxOrdersPerDay,
    },
    instant: {
      // The response has echoed both casings back; accept either.
      minPrepTimeMinutes:
        schedulingConfigNumber(config, 'min_prep_time_minutes', 'minPrepTimeMinutes') ?? base.instant.minPrepTimeMinutes,
      maxPrepTimeMinutes:
        schedulingConfigNumber(config, 'max_prep_time_minutes', 'maxPrepTimeMinutes') ?? base.instant.maxPrepTimeMinutes,
      operatingUntil:
        schedulingConfigString(config, 'operating_until', 'operatingUntil') ?? base.instant.operatingUntil,
      orderCutoffTime:
        schedulingConfigString(config, 'order_cutoff_time', 'orderCutoffTime') ?? base.instant.orderCutoffTime,
    },
    // Everything is written as ORDER_AMOUNT_THRESHOLD because the other strategies are
    // unimplemented server-side, so a zero threshold is what a flat charge looks like.
    shippingStrategy: threshold ? 'ORDER_AMOUNT_THRESHOLD' : 'FLAT',
    shipping: {
      charge: charge ?? base.shipping.charge,
      freeDeliveryThreshold: threshold ?? base.shipping.freeDeliveryThreshold,
    },
    slots: checkout.slots.map((slot, index) => ({ id: `slot-${index + 1}`, ...slot })),
    consentTitle: checkout.consentTitle || base.consentTitle,
    consentText: checkout.consentText || base.consentText,
  }
}

function resumePayments(
  checkout: CheckoutOptionsSnapshot,
  base: VendorOnboardingDraftV1['payments'],
): VendorOnboardingDraftV1['payments'] {
  const saved = new Map<PaymentType, CheckoutOptionsSnapshot['payments'][number]>(
    checkout.payments.map((option) => [option.type, option]),
  )
  return base.map((option) => {
    const match = saved.get(option.type)
    return match
      ? { type: option.type, enabled: true, isDefault: match.isDefault }
      : { type: option.type, enabled: false, isDefault: false }
  })
}

/**
 * Bank and UPI details are runtime-only locally — they are never written to the browser
 * draft. The server does return them, so a resume is the one path that can repopulate
 * the fields without the vendor retyping them.
 */
export function resumePaymentDetails(
  checkout: CheckoutOptionsSnapshot | null,
  base: OnboardingRuntimeState['paymentDetails'],
): OnboardingRuntimeState['paymentDetails'] {
  if (!checkout) return base
  const upi = checkout.payments.find((option) => option.type === 'PRE_PAID')?.details ?? {}
  const bank = checkout.payments.find((option) => option.type === 'ONLINE')?.details ?? {}
  return {
    upiId: upi.upi_account ?? base.upiId,
    upiAccountHolderName: upi.account_holder_name ?? base.upiAccountHolderName,
    bankAccountHolderName: bank.account_holder_name ?? base.bankAccountHolderName,
    bankAccountNumber: bank.account_number ?? base.bankAccountNumber,
    bankIfscCode: bank.ifsc_code ?? base.bankIfscCode,
    bankName: bank.bank_name ?? base.bankName,
  }
}

export type ResumeResult = {
  draft: VendorOnboardingDraftV1
  furthestVisitedStep: OnboardingStep
  openAt: OnboardingStep
  /** Step 9's order number, in the E.164 form its validator expects. */
  orderWhatsapp: string
}

/**
 * The vendor record stores the contact number in whatever form it was registered with;
 * Step 9 validates E.164. Nothing else can supply this on resume — runtime state is
 * never persisted and the storefront read 404s until approval — so an unconvertible
 * number yields an empty string and the vendor simply re-enters it.
 */
function toE164(contactNumber: string | null | undefined): string {
  const digits = (contactNumber ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 10) return `+91${digits}`
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`
  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : ''
}

export function buildResumeDraft(state: ServerOnboardingState): ResumeResult {
  const base = createEmptyOnboardingDraft()
  const openAt = resumeStep(state)
  // Steps 1-2 are settled by the session that got us here; everything before the first
  // unfinished step is saved on the account, so it counts as done.
  const completedSteps = ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as OnboardingStep[])
    .filter((step) => step < openAt)

  const businessType = businessTypeReference(state)

  return {
    openAt,
    furthestVisitedStep: openAt,
    orderWhatsapp: toE164(state.profile?.contactNumber),
    draft: {
      ...base,
      currentStep: openAt,
      completedSteps,
      mobileVerified: true,
      business: {
        businessType,
        businessName: state.profile?.businessName ?? base.business.businessName,
        ownerName: state.profile?.ownerName ?? base.business.ownerName,
        contactPerson: state.profile?.contactPerson ?? base.business.contactPerson,
      },
      categories: state.categories.map((category) => ({
        id: category.platformCategoryId,
        name: category.name,
        imageUrl: category.imageUrl,
        // Never 0: the draft validator rejects a zero reference id, so synthesizing one
        // here turned a failed business-type lookup into an unloadable draft on the next
        // reload. Unknown attribution is recorded as unknown.
        businessTypeId: businessType?.id ?? null,
        description: null,
        displayOrder: null,
      })),
      products: selectedProducts(state),
      skus: draftSkus(state),
      delivery: state.checkout ? resumeDelivery(state.checkout, base.delivery) : base.delivery,
      payments: state.checkout ? resumePayments(state.checkout, base.payments) : base.payments,
      // Branding is unreadable until approval, so Step 9 keeps its defaults and the
      // store name is the one field the vendor record can supply.
      storefront: { ...base.storefront, storeName: state.profile?.businessName ?? '' },
    },
  }
}
