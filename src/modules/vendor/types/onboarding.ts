import type {
  BusinessTypeReference,
  CategoryReference,
  ProductReference,
} from '@/shared/api'

export const ONBOARDING_DRAFT_VERSION = 2 as const
export const ONBOARDING_CONFIG = {
  /** Fallback only. The real limit comes from vendor context subscription limits. */
  maxCategories: 2,
  /** Structural sanity bound for a stored draft — not a plan limit. */
  maxPersistedCategories: 50,
  businessTypePageSize: 6,
  businessTypeSearchDebounceMs: 650,
  draftSaveDelayMs: 1200,
} as const

export type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
export type ReferenceMode = 'live' | 'sample'
export type MeasurementType = 'WEIGHT' | 'VOLUME' | 'COUNT'
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

export type SelectedProduct = ProductReference & {
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

export type PublicationDraft = {
  state: 'draft' | 'prototype-complete'
  draftSlug: string | null
  completedAt: string | null
}

export type VendorOnboardingDraftV1 = {
  version: typeof ONBOARDING_DRAFT_VERSION
  currentStep: OnboardingStep
  completedSteps: OnboardingStep[]
  referenceMode: ReferenceMode
  maskedPhone: string | null
  mobileVerified: boolean
  business: {
    businessType: BusinessTypeReference | null
    businessName: string
    ownerName: string
    contactPerson: string
  }
  categories: CategoryReference[]
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
  furthestVisitedStep: OnboardingStep
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
  { step: 6, short: 'Prices', title: 'Set SKUs and prices', description: 'Every selected product needs at least one active SKU.' },
  { step: 7, short: 'Delivery', title: 'Set delivery and pickup', description: 'Choose how and when orders are fulfilled.' },
  { step: 8, short: 'Payments', title: 'Choose payment methods', description: 'Offer at least one method and choose a default.' },
  { step: 9, short: 'Store', title: 'Add your store details', description: 'Name your store, add its contacts, and make the preview yours.' },
  { step: 10, short: 'Review', title: 'Review your store', description: 'Resolve readiness items, then preview your store.' },
]
