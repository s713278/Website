import type {
  BusinessTypeReference,
  CategoryReference,
  ProductReference,
} from '@/shared/api'

export const ONBOARDING_DRAFT_VERSION = 4 as const
export const ONBOARDING_CONFIG = {
  /** Fallback only. The real limit comes from vendor context subscription limits. */
  maxCategories: 2,
  /**
   * Fallbacks only, used when the vendor context omits a live product/size limit (and in
   * demo mode, which has no subscription). Deliberately generous: a real plan always sends
   * its own numbers, so these never bite a live vendor, and they must not newly cap the
   * demo/first-time flow that has never had a product or size limit.
   */
  maxProducts: 50,
  maxSkus: 200,
  /** Structural sanity bound for a stored draft — not a plan limit. */
  maxPersistedCategories: 50,
  businessTypePageSize: 6,
  businessTypeSearchDebounceMs: 650,
  draftSaveDelayMs: 1200,
} as const

export type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
/**
 * Which catalog a vendor is choosing from. `live` survives only as a transport name
 * (`isLiveApi`, `LIVE_PERSISTED_STEPS`); it never names a catalog source. See `CONTEXT.md`.
 */
export type CatalogSource = 'account' | 'sample'
export type MeasurementType =
  | 'WEIGHT'
  | 'VOLUME'
  | 'COUNT'
  | 'AREA'
  | 'SERVICE_UNIT'
  | 'DURATION'
  | 'PER_PERSON'
  | 'SLOT'
export type FulfillmentType = 'HOME_DELIVERY' | 'STORE_PICKUP' | 'BOTH'
export type OrderAcceptancePolicy = 'AUTO_ACCEPT' | 'MANUAL_APPROVAL'
export type SchedulingStrategy =
  | 'FIXED_WINDOW'
  | 'CUSTOMER_SELECT_DATE'
  | 'PREDEFINED_DAYS'
  | 'INSTANT'
export type ShippingStrategy = 'FLAT' | 'ORDER_AMOUNT_THRESHOLD'
export type PaymentType = 'PRE_PAID' | 'ONLINE' | 'CASH_ON_DELIVERY'
export type OtpDigits = [string, string, string, string]
export type StorefrontThemePreset = 'WARM' | 'FRESH' | 'MINIMAL' | 'BOLD'
export type StorefrontButtonShape = 'PILL' | 'ROUNDED' | 'SQUARE'
export type StorefrontCardStyle = 'FLAT' | 'SHADOW' | 'BORDER'
export type Weekday =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY'

/**
 * A vendor-authored entry that exists only in the draft and has not yet been created in
 * the platform catalog. It carries a negative id from the pending band (see
 * `onboarding-pending-id.ts`) so draft-internal references keep working, and `pending: true`
 * so the persistence invariant can tell it from an account entry. On a successful create the
 * negative id is replaced by the returned positive one and `pending` is dropped.
 */
export type PendingEntry = {
  pending?: true
}

export type DraftCategory = CategoryReference & PendingEntry

export type SelectedProduct = ProductReference &
  PendingEntry & {
    categoryId: number
  }

export type DraftSku = {
  id: string
  productId: number
  name: string
  description: string
  skuType: 'ITEM'
  measurementType: MeasurementType
  unit: string
  quantity: number | null
  listPrice: number | null
  salePrice: number | null
  active: boolean
  homeDelivery: boolean
  storePickup: boolean
}

export type DeliverySlot = {
  id: string
  startTime: string
  endTime: string
}

export type DeliveryDraft = {
  fulfillmentType: FulfillmentType
  orderAcceptancePolicy: OrderAcceptancePolicy
  schedulingStrategy: SchedulingStrategy
  fixedWindow: {
    minDeliveryDays: number
    maxDeliveryDays: number
  }
  customerSelectDate: {
    minAdvanceBookingDays: number
    maxAdvanceBookingDays: number
    cutoffTime: string
  }
  predefinedDays: {
    days: Weekday[]
    maxOrdersPerDay: number
  }
  instant: {
    minPrepTimeMinutes: number
    maxPrepTimeMinutes: number
    operatingUntil: string
    orderCutoffTime: string
  }
  shippingStrategy: ShippingStrategy
  shipping: {
    charge: number
    freeDeliveryThreshold: number
  }
  slots: DeliverySlot[]
  consentTitle: string
  consentText: string
}

export type PaymentOptionDraft = {
  type: PaymentType
  enabled: boolean
  isDefault: boolean
}

export type PaymentDetailsRuntime = {
  upiId: string
  upiAccountHolderName: string
  bankAccountHolderName: string
  bankAccountNumber: string
  bankIfscCode: string
  bankName: string
}

export type StorefrontBadgeDraft = {
  id: string
  icon: string
  title: string
  subtitle: string
  enabled: boolean
}

export type StorefrontDraft = {
  storeName: string
  tagline: string
  businessLocation: string
  instagram: string
  primaryColor: string
  accentColor: string
  backgroundColor: string
  textColor: string
  fontFamily: string
  themePreset: StorefrontThemePreset | null
  buttonShape: StorefrontButtonShape
  cardStyle: StorefrontCardStyle
  welcomeMessage: string
  announcementBar: string
  heroBadges: string[]
  trustStrip: StorefrontBadgeDraft[]
}

/**
 * Account-confirmed submission. Never persisted: approval state belongs to the server,
 * and a stale local copy would let the wizard claim a store is public when it is not.
 */
export type StoreSubmission = {
  storeIdentifier: string | null
  approvalStatus: string | null
  vendorStatus: string | null
}

export type PublicationDraft = {
  state: 'draft' | 'prototype-complete'
  draftSlug: string | null
  completedAt: string | null
}

export type VendorOnboardingDraftV1 = {
  version: typeof ONBOARDING_DRAFT_VERSION
  currentStep: OnboardingStep
  completedSteps: OnboardingStep[]
  catalogSource: CatalogSource
  maskedPhone: string | null
  mobileVerified: boolean
  business: {
    businessType: BusinessTypeReference | null
    businessName: string
    ownerName: string
    contactPerson: string
  }
  categories: DraftCategory[]
  products: SelectedProduct[]
  skus: DraftSku[]
  delivery: DeliveryDraft
  payments: PaymentOptionDraft[]
  storefront: StorefrontDraft
  publication: PublicationDraft
}

export type OnboardingRuntimeState = {
  phone: string
  otpDigits: OtpDigits
  orderWhatsapp: string
  supportWhatsapp: string
  paymentDetails: PaymentDetailsRuntime
  logoFile: File | null
  logoUrl: string | null
  bannerFile: File | null
  bannerUrl: string | null
}

export type PersistedOnboardingDraftV1 = Omit<VendorOnboardingDraftV1, 'maskedPhone'>

export type LocalPreviewSnapshotV1 = {
  slug: string
  completedAt: string
  draft: PersistedOnboardingDraftV1
}

export type VendorOnboardingPersistedEnvelopeV1 = {
  version: typeof ONBOARDING_DRAFT_VERSION
  revision: number
  updatedAt: string
  /**
   * Vendor this draft belongs to, or `null` before verification.
   *
   * A draft is private to one signed-in vendor. Anything read back under a different
   * identity — including no session at all — is discarded rather than adopted, so one
   * vendor can never resume, see, or submit another vendor's selections.
   */
  ownerId: string | null
  furthestVisitedStep: OnboardingStep
  /**
   * The draft holds edits that have not been written to the vendor account.
   *
   * The account is the record; this browser only buffers what has not reached it yet.
   * When nothing is buffered the wizard re-reads the account on entry, so a stale or
   * malformed local copy can never outlive one visit. When something is, the vendor's
   * unsaved work wins and the account copy is left alone.
   *
   * Absent on envelopes written before this field existed — read those as `true`, which
   * preserves whatever they hold rather than overwriting it.
   */
  hasLocalEdits?: boolean
  draft: PersistedOnboardingDraftV1
  previewSnapshot: LocalPreviewSnapshotV1 | null
}

export type OnboardingPersistenceStatus =
  | 'loading'
  | 'idle'
  | 'saving'
  | 'saved'
  | 'unavailable'
  | 'conflict'
  | 'corrupt'
  /**
   * A draft exists in this browser but no one is signed in to claim it.
   *
   * It is neither shown nor written to, and it is not deleted: an expired session is
   * not a decision to abandon work. Signing in as its owner restores it; signing in as
   * anyone else discards it.
   */
  | 'deferred'

export type ValidationIssue = {
  step: OnboardingStep
  field: string
  message: string
}

export const ONBOARDING_STEPS: ReadonlyArray<{
  step: OnboardingStep
  short: string
  title: string
  description: string
}> = [
  { step: 1, short: 'Phone', title: 'Your WhatsApp number', description: 'Start with the number customers know.' },
  { step: 2, short: 'Verify', title: 'Verify your number', description: 'Enter the code we sent on WhatsApp.' },
  { step: 3, short: 'Business', title: 'Choose your business type', description: 'Pick the closest match for your catalog.' },
  { step: 4, short: 'Categories', title: 'Choose your categories', description: 'Pick the categories your store sells.' },
  { step: 5, short: 'Products', title: 'Choose products to sell', description: 'Build a focused starting catalog.' },
  { step: 6, short: 'Prices', title: 'Set sizes and prices', description: 'Every product you sell needs at least one size with a price.' },
  { step: 7, short: 'Delivery', title: 'Set delivery and pickup', description: 'Choose how and when orders are fulfilled.' },
  { step: 8, short: 'Payments', title: 'Choose payment methods', description: 'Offer at least one method and choose a default.' },
  { step: 9, short: 'Store', title: 'Add your store details', description: 'Name your store, add its contacts, and make the preview yours.' },
  { step: 10, short: 'Review', title: 'Review your store', description: 'Resolve readiness items, then preview your store.' },
]

/**
 * The three catalog steps a submitted store can still grow: choose or author categories
 * (4), choose or author products (5), and create sizes (6). A submitted store is read-only
 * everywhere else, but these keep taking additive writes within plan limits — nothing on
 * the store may be changed or removed, only added. See `CONTEXT.md` ("Submitted", "Plan
 * limit").
 */
export const ADDITIVE_CATALOG_STEPS = [4, 5, 6] as const satisfies readonly OnboardingStep[]

export function isAdditiveCatalogStep(step: OnboardingStep): boolean {
  return (ADDITIVE_CATALOG_STEPS as readonly OnboardingStep[]).includes(step)
}
