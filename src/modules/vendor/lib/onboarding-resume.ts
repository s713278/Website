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
import { isValidIndianMobile } from './onboarding-validation'
import { isStoreSubmitted } from './onboarding-account-status'
import { loadMeasurementCatalog, peekMeasurementCatalog } from './measurement-catalog-cache'
import { seedBusinessTypeFirstPage } from './onboarding-catalog-cache'
import { loadOnboardingResource, type OnboardingResourceData } from './onboarding-resource-cache'
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
  productMeasurementCatalog: MeasurementCatalog
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
  // Step 5 shows each product's measurement, and saved sizes are rebuilt against it. A
  // vendor who enters earlier gets it on reaching a step that uses it, through
  // `loadPlatformMeasurements`, instead of paying for it on Steps 3-4.
  ['measurements', 5],
  ['skus', 6],
  ['checkout', 7],
]

/** A vendor's saved setup data, read and cached one resource at a time. */
export type OnboardingResource =
  | 'profile'
  | 'businessTypes'
  | 'categories'
  | 'products'
  | 'skus'
  | 'checkout'

const CATALOG_CHAIN: readonly OnboardingResource[] = ['profile', 'businessTypes', 'categories', 'products', 'skus']

/**
 * The account resources a step needs to show and save, and whether it needs the platform units.
 *
 * `businessTypes` is listed where the step needs it, but it is a dependent read: callers
 * start it only once the profile shows a saved type. A submitted store's review screen
 * shows status only, so it needs the profile alone.
 */
export function stepResources(
  step: OnboardingStep,
  options: { submitted: boolean },
): { account: readonly OnboardingResource[]; units: boolean } {
  switch (step) {
    case 1:
    case 2:
      return { account: [], units: false }
    case 3:
    case 9:
      return { account: CATALOG_CHAIN.slice(0, 2), units: false }
    case 4:
      return { account: CATALOG_CHAIN.slice(0, 3), units: false }
    case 5:
      return { account: CATALOG_CHAIN.slice(0, 4), units: true }
    case 6:
      return { account: CATALOG_CHAIN, units: true }
    case 7:
    case 8:
      return { account: ['checkout'], units: false }
    case 10:
      return options.submitted
        ? { account: ['profile'], units: false }
        : { account: [...CATALOG_CHAIN, 'checkout'], units: true }
  }
}

/** Steps whose screen or validation reads the measurement catalog: products, sizes, review. */
export function stepUsesMeasurementCatalog(step: OnboardingStep): boolean {
  return step === 5 || step === 6 || step === 10
}

/** The platform measurement catalog, read at most once per session. */
export function loadPlatformMeasurements(): Promise<MeasurementCatalog> {
  return loadMeasurementCatalog(() => vendorOnboardingService.getMeasurements())
}

/** Server resources needed to rebuild saved work and continue from the resume step. */
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

/** Preserve Step 6's usable fallback without presenting fallback units as product metadata. */
export function measurementCatalogsForResume(measurements: MeasurementCatalog | null): {
  measurements: MeasurementCatalog
  productMeasurementCatalog: MeasurementCatalog
} {
  return {
    measurements: measurements ?? SAMPLE_MEASUREMENT_CATALOG,
    productMeasurementCatalog: measurements ?? [],
  }
}

/**
 * One account resource through the per-vendor resource cache: an in-flight or resolved read
 * is shared, and a failed one is dropped so the next caller retries.
 */
export function loadAccountResource<R extends OnboardingResource>(
  vendorId: string,
  resource: R,
): Promise<OnboardingResourceData[R]> {
  return loadOnboardingResource(vendorId, resource, () => readAccountResource(vendorId, resource))
}

function readAccountResource<R extends OnboardingResource>(
  vendorId: string,
  resource: R,
): Promise<OnboardingResourceData[R]> {
  const reads: { [K in OnboardingResource]: () => Promise<OnboardingResourceData[K]> } = {
    profile: () => vendorOnboardingService.getVendorProfile(vendorId),
    // A successful read also files Step 3's first page, so revisiting it costs no request.
    businessTypes: () => vendorOnboardingService
      .getBusinessTypes({ pageNumber: 0, pageSize: 100, sortBy: 'id', sortOrder: 'ASC' })
      .then((page) => {
        seedBusinessTypeFirstPage('account', page)
        return page.items
      }),
    categories: () => vendorOnboardingService.getVendorCategories(vendorId),
    products: () => vendorOnboardingService.getVendorProducts(vendorId),
    skus: () => vendorOnboardingService.getVendorSkus(vendorId),
    // A first-time vendor legitimately 404s here; the service already maps that to null.
    checkout: () => vendorOnboardingService.getCheckoutOptions(vendorId),
  }
  return reads[resource]()
}

/**
 * The account snapshot for the resume step, built from per-resource cache entries. `config`
 * applies to the context read only: resource reads are shared across callers.
 */
export async function loadServerOnboardingState(
  vendorId: string,
  config: LoadConfig = {},
  knownContext?: VendorContext | Promise<VendorContext>,
): Promise<ServerOnboardingState> {
  // Start both universal reads before awaiting context. The dependent fan-out can then
  // begin as soon as context reveals the resume step, without waiting for the profile.
  // A context the caller just read, or is already reading, is reused.
  const contextPromise = knownContext
    ? Promise.resolve(knownContext)
    : vendorOnboardingService.getVendorContext(vendorId, config)
  const profilePromise = optional(loadAccountResource(vendorId, 'profile'))
  // One page covers the catalog (30 types); needed only to turn a saved business type's
  // display string back into the reference object Step 3 stores. A vendor who has not
  // chosen one yet, like every new vendor on Step 3, skips it: the step lists its own page.
  const businessTypesPromise = profilePromise.then((profile) => savedBusinessType(profile)
    ? optional(loadAccountResource(vendorId, 'businessTypes'))
    : null)

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
    reads.has('categories') ? optional(loadAccountResource(vendorId, 'categories')) : null,
    reads.has('products') ? optional(loadAccountResource(vendorId, 'products')) : null,
    reads.has('skus') ? optional(loadAccountResource(vendorId, 'skus')) : null,
    reads.has('checkout') ? optional(loadAccountResource(vendorId, 'checkout')) : null,
    // Authoritative units for Step 6. A dead read falls back to the sample catalog,
    // which mirrors the backend shape, so a size still opens with real units rather
    // than an empty dropdown.
    // A catalog this session already read is reused at any step, so the snapshot never
    // replaces real units with the sample fallback.
    reads.has('measurements')
      ? optional(loadPlatformMeasurements())
      : peekMeasurementCatalog(),
  ])

  return {
    context,
    profile,
    categories: categories ?? [],
    products: products ?? [],
    skus: skus ?? [],
    checkout,
    businessTypes: businessTypes ?? [],
    ...measurementCatalogsForResume(measurements),
  }
}

/** The profile's business type, or `null` while the vendor has not chosen one. */
export function savedBusinessType(profile: VendorProfile | null): string | null {
  const type = profile?.businessType?.trim()
  return type && type !== UNSET_BUSINESS_TYPE ? type : null
}

export function hasBusinessType(state: ServerOnboardingState): boolean {
  return savedBusinessType(state.profile) !== null
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
 * This resource-derived fallback is used only when the backend omits its resume pointer.
 * Unpriced leftover products must never override an explicit `onboarding.next_step`.
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

/** The reference object for the profile's saved business type, or `null` when unmatched. */
export function resolveBusinessType(
  profile: VendorProfile | null,
  businessTypes: BusinessTypeReference[],
): BusinessTypeReference | null {
  const name = savedBusinessType(profile)
  if (!name) return null
  return businessTypes.find((item) => item.name === name) ?? null
}

function selectedProducts(products: VendorProductRef[]): SelectedProduct[] {
  return products.map((product) => ({
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

function draftSkus(
  skus: VendorSkuRef[],
  products: VendorProductRef[],
  measurements: MeasurementCatalog,
): DraftSku[] {
  const measurementByVendorProduct = new Map(
    products.map((product) => [product.vendorProductId, product.measurementId]),
  )
  const platformByVendorProduct = new Map(
    products.map((product) => [product.vendorProductId, product.platformProductId]),
  )

  return skus.flatMap((sku) => {
    const productId = platformByVendorProduct.get(sku.vendorProductId)
    if (productId == null) return []
    const measurementId = measurementByVendorProduct.get(sku.vendorProductId)
    // A size's measurement is its product's, so it is derived here rather than read off the
    // account SKU. The stored unit is kept only while the product's measurement still offers
    // it; a unit that no longer fits falls back to a valid one for the measurement.
    const measurementType = measurementFromProduct(measurementId ?? null, null, measurements)
    return [{
      // Server id, so a resumed SKU is never re-created as a duplicate.
      id: accountSkuId(sku.skuId),
      productId,
      name: sku.displayName,
      description: sku.description,
      skuType: 'ITEM' as const,
      measurementType,
      unit: reconcileUnitForMeasurement(measurementType, sku.unit, measurements),
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
  /** Step 9's order number, as the ten-digit national number its control shows. */
  orderWhatsapp: string
}

/**
 * The vendor record stores the contact number in whatever form it was registered with;
 * Step 9 shows a plain ten-digit national number. This strips an Indian `+91`/`0` prefix
 * and keeps only a valid Indian mobile. Nothing else can supply this on resume — runtime
 * state is never persisted and the storefront read 404s until approval — so an
 * unconvertible number yields an empty string and the vendor simply re-enters it.
 */
function toNationalMobile(contactNumber: string | null | undefined): string {
  const digits = (contactNumber ?? '').replace(/\D/g, '')
  const national =
    digits.length === 12 && digits.startsWith('91')
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith('0')
        ? digits.slice(1)
        : digits
  return isValidIndianMobile(national) ? national : ''
}

/**
 * Which steps hold unsaved local edits, and whether the account says the store was
 * submitted. An applier leaves a section owned by an edited step alone, unless the store
 * is submitted: then the account wins everywhere, as the vendor must see what was sent.
 */
export type ResumeApplyOptions = {
  edited: ReadonlySet<OnboardingStep>
  submitted: boolean
}

function keepsLocal(step: OnboardingStep, options: ResumeApplyOptions): boolean {
  return !options.submitted && options.edited.has(step)
}

/**
 * Where the draft stands: the open step, the steps counted as done and every field no
 * account resource owns. Applied only when nothing is edited or the store is submitted.
 */
export function applyResumeFrame(
  draft: VendorOnboardingDraftV1,
  openAt: OnboardingStep,
  options: ResumeApplyOptions,
): VendorOnboardingDraftV1 {
  if (options.edited.size && !options.submitted) return draft
  const base = createEmptyOnboardingDraft()
  return {
    ...draft,
    version: base.version,
    catalogSource: base.catalogSource,
    maskedPhone: base.maskedPhone,
    publication: base.publication,
    currentStep: openAt,
    // Steps 1-2 are settled by the session that got us here; everything before the first
    // unfinished step is saved on the account, so it counts as done.
    completedSteps: ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as OnboardingStep[]).filter((step) => step < openAt),
    mobileVerified: true,
  }
}

/** Step 9's part of the profile: the business names and the store name. */
export function applyProfile(
  draft: VendorOnboardingDraftV1,
  profile: VendorProfile | null,
  options: ResumeApplyOptions,
): VendorOnboardingDraftV1 {
  if (keepsLocal(9, options)) return draft
  const base = createEmptyOnboardingDraft()
  return {
    ...draft,
    business: {
      ...draft.business,
      businessName: profile?.businessName ?? base.business.businessName,
      ownerName: profile?.ownerName ?? base.business.ownerName,
      contactPerson: profile?.contactPerson ?? base.business.contactPerson,
    },
    // Branding is unreadable until approval, so Step 9 keeps its defaults and the
    // store name is the one field the vendor record can supply.
    storefront: { ...base.storefront, storeName: profile?.businessName ?? '' },
  }
}

/** Step 3: the saved business type, resolved by `resolveBusinessType`. */
export function applyBusinessType(
  draft: VendorOnboardingDraftV1,
  businessType: BusinessTypeReference | null,
  options: ResumeApplyOptions,
): VendorOnboardingDraftV1 {
  if (keepsLocal(3, options)) return draft
  return { ...draft, business: { ...draft.business, businessType } }
}

/** Step 4, attributed to the resolved business type. */
export function applyCategories(
  draft: VendorOnboardingDraftV1,
  categories: VendorCategoryRef[],
  businessType: BusinessTypeReference | null,
  options: ResumeApplyOptions,
): VendorOnboardingDraftV1 {
  if (keepsLocal(4, options)) return draft
  return {
    ...draft,
    categories: categories.map((category) => ({
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
  }
}

/** Step 5. */
export function applyProducts(
  draft: VendorOnboardingDraftV1,
  products: VendorProductRef[],
  options: ResumeApplyOptions,
): VendorOnboardingDraftV1 {
  if (keepsLocal(5, options)) return draft
  return { ...draft, products: selectedProducts(products) }
}

/** Step 6, rebuilt against the products read and the units catalog. */
export function applySkus(
  draft: VendorOnboardingDraftV1,
  skus: VendorSkuRef[],
  products: VendorProductRef[],
  measurements: MeasurementCatalog,
  options: ResumeApplyOptions,
): VendorOnboardingDraftV1 {
  if (keepsLocal(6, options)) return draft
  return { ...draft, skus: draftSkus(skus, products, measurements) }
}

/** Steps 7 (delivery) and 8 (payments), which share one read. */
export function applyCheckout(
  draft: VendorOnboardingDraftV1,
  checkout: CheckoutOptionsSnapshot | null,
  options: ResumeApplyOptions,
): VendorOnboardingDraftV1 {
  const base = createEmptyOnboardingDraft()
  return {
    ...draft,
    delivery: keepsLocal(7, options)
      ? draft.delivery
      : checkout ? resumeDelivery(checkout, base.delivery) : base.delivery,
    payments: keepsLocal(8, options)
      ? draft.payments
      : checkout ? resumePayments(checkout, base.payments) : base.payments,
  }
}

/** Step 9's order number from the profile; runtime state, never part of the draft. */
export function resumeOrderWhatsapp(profile: VendorProfile | null): string {
  return toNationalMobile(profile?.contactNumber)
}

/** Every applier in dependency order over a full account snapshot. */
export function applyResumeState(
  state: ServerOnboardingState,
  draft: VendorOnboardingDraftV1,
  options: ResumeApplyOptions,
): ResumeResult {
  const openAt = resumeStep(state)
  const businessType = resolveBusinessType(state.profile, state.businessTypes)
  let next = applyResumeFrame(draft, openAt, options)
  next = applyProfile(next, state.profile, options)
  next = applyBusinessType(next, businessType, options)
  next = applyCategories(next, state.categories, businessType, options)
  next = applyProducts(next, state.products, options)
  next = applySkus(next, state.skus, state.products, state.measurements, options)
  next = applyCheckout(next, state.checkout, options)
  return {
    openAt,
    furthestVisitedStep: openAt,
    orderWhatsapp: resumeOrderWhatsapp(state.profile),
    draft: next,
  }
}

export function buildResumeDraft(state: ServerOnboardingState): ResumeResult {
  return applyResumeState(state, createEmptyOnboardingDraft(), {
    edited: new Set(),
    submitted: isStoreSubmitted(state),
  })
}

/** Where one resource's read stands in the current wizard visit. */
export type ResourceStatus = 'idle' | 'loading' | 'loaded' | 'failed'

/**
 * Whether a step can show its form: every account resource it lists has loaded and, where
 * it uses them, the units have settled. A units failure is not a block: the sample units
 * stand in. A failed resource fails the step even while another still loads, so the vendor
 * can retry at once. A submitted store's Step 10 shows status only and never blocks: a
 * failed profile just leaves the store name to its fallback.
 */
export function stepLoadState(
  step: OnboardingStep,
  options: {
    submitted: boolean
    resources: Readonly<Record<OnboardingResource, ResourceStatus>>
    units: ResourceStatus
  },
): 'loading' | 'failed' | 'loaded' {
  const needs = stepResources(step, { submitted: options.submitted })
  const statuses = needs.account.map((resource) => options.resources[resource])
  if (step === 10 && options.submitted) {
    return statuses.every((status) => status === 'loaded' || status === 'failed') ? 'loaded' : 'loading'
  }
  if (statuses.includes('failed')) return 'failed'
  if (statuses.some((status) => status !== 'loaded')) return 'loading'
  if (needs.units && (options.units === 'idle' || options.units === 'loading')) return 'loading'
  return 'loaded'
}

/**
 * The account as `derivedResumeStep` reads it, from resources read one at a time. Only for
 * a context without a usable resume pointer, once every account resource has been read.
 */
export function accountResumeState(
  context: VendorContext,
  values: OnboardingResourceData,
): ServerOnboardingState {
  return { context, ...values, ...measurementCatalogsForResume(null) }
}
