import {
  ONBOARDING_CONFIG,
  ONBOARDING_DRAFT_VERSION,
  type DeliveryDraft,
  type DraftSku,
  type LocalPreviewSnapshotV1,
  type OnboardingStep,
  type PaymentOptionDraft,
  type PersistedOnboardingDraftV1,
  type SelectedProduct,
  type StorefrontBadgeDraft,
  type StorefrontDraft,
  type VendorOnboardingDraftV1,
  type VendorOnboardingPersistedEnvelopeV1,
} from '../types/onboarding'

export const ONBOARDING_DRAFT_STORAGE_KEY = 'md-vendor-onboarding-draft-v2'

type UnknownRecord = Record<string, unknown>
type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  cancelIdleCallback?: (handle: number) => void
}

export type DraftReadResult =
  | { kind: 'empty' }
  | { kind: 'valid'; envelope: VendorOnboardingPersistedEnvelopeV1 }
  | { kind: 'corrupt' }
  | { kind: 'unavailable' }

const STEPS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
const MEASUREMENTS = new Set(['WEIGHT', 'VOLUME', 'COUNT'])
const FULFILLMENT_TYPES = new Set(['HOME_DELIVERY', 'STORE_PICKUP', 'BOTH'])
const ACCEPTANCE_POLICIES = new Set(['AUTO_ACCEPT', 'MANUAL_APPROVAL'])
const SCHEDULING_STRATEGIES = new Set([
  'FIXED_WINDOW',
  'CUSTOMER_SELECT_DATE',
  'PREDEFINED_DAYS',
  'INSTANT',
])
const SHIPPING_STRATEGIES = new Set(['FLAT', 'ORDER_AMOUNT_THRESHOLD'])
const PAYMENT_TYPES = new Set(['PRE_PAID', 'ONLINE', 'CASH_ON_DELIVERY'])
const WEEKDAYS = new Set([
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
])
const THEME_PRESETS = new Set(['WARM', 'FRESH', 'MINIMAL', 'BOLD'])
const BUTTON_SHAPES = new Set(['PILL', 'ROUNDED', 'SQUARE'])
const CARD_STYLES = new Set(['FLAT', 'SHADOW', 'BORDER'])

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasOnlyKeys(value: UnknownRecord, keys: readonly string[]): boolean {
  const allowed = new Set(keys)
  return Object.keys(value).every((key) => allowed.has(key))
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value)
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value)
}

function isReferenceId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value !== 0
}

function isStep(value: unknown): value is OnboardingStep {
  return typeof value === 'number' && STEPS.has(value)
}

function isIsoDate(value: unknown): value is string {
  return isString(value) && value.length > 0 && !Number.isNaN(Date.parse(value))
}

function isSafeAssetUrl(value: unknown): value is string | null {
  if (value === null) return true
  return isString(value) && !/^(?:blob|data):/i.test(value.trim())
}

function isBusinessTypeReference(
  value: unknown,
): value is NonNullable<VendorOnboardingDraftV1['business']['businessType']> {
  return isRecord(value) &&
    hasOnlyKeys(value, ['id', 'name', 'icon', 'displayOrder']) &&
    isReferenceId(value.id) &&
    isString(value.name) &&
    isSafeAssetUrl(value.icon) &&
    (value.displayOrder === null || Number.isSafeInteger(value.displayOrder))
}

function isCategoryReference(
  value: unknown,
): value is VendorOnboardingDraftV1['categories'][number] {
  return isRecord(value) &&
    hasOnlyKeys(value, ['id', 'name', 'businessTypeId', 'description', 'imageUrl', 'displayOrder']) &&
    isReferenceId(value.id) &&
    isString(value.name) &&
    isReferenceId(value.businessTypeId) &&
    isNullableString(value.description) &&
    isSafeAssetUrl(value.imageUrl) &&
    (value.displayOrder === null || Number.isSafeInteger(value.displayOrder))
}

function isSelectedProduct(value: unknown): value is SelectedProduct {
  return isRecord(value) &&
    hasOnlyKeys(value, [
      'id',
      'name',
      'description',
      'imageUrl',
      'measurementId',
      'measurementName',
      'categoryId',
    ]) &&
    isReferenceId(value.id) &&
    isString(value.name) &&
    isNullableString(value.description) &&
    isSafeAssetUrl(value.imageUrl) &&
    (value.measurementId === null || Number.isSafeInteger(value.measurementId)) &&
    isNullableString(value.measurementName) &&
    isReferenceId(value.categoryId)
}

function isDraftSku(value: unknown): value is DraftSku {
  return isRecord(value) &&
    hasOnlyKeys(value, [
      'id',
      'productId',
      'name',
      'description',
      'skuType',
      'measurementType',
      'unit',
      'quantity',
      'listPrice',
      'salePrice',
      'active',
      'homeDelivery',
      'storePickup',
    ]) &&
    isString(value.id) &&
    isReferenceId(value.productId) &&
    isString(value.name) &&
    isString(value.description) &&
    value.skuType === 'ITEM' &&
    isString(value.measurementType) &&
    MEASUREMENTS.has(value.measurementType) &&
    isString(value.unit) &&
    isNullableFiniteNumber(value.quantity) &&
    isNullableFiniteNumber(value.listPrice) &&
    isNullableFiniteNumber(value.salePrice) &&
    isBoolean(value.active) &&
    isBoolean(value.homeDelivery) &&
    isBoolean(value.storePickup)
}

function isDelivery(value: unknown): value is DeliveryDraft {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'fulfillmentType',
    'orderAcceptancePolicy',
    'schedulingStrategy',
    'fixedWindow',
    'customerSelectDate',
    'predefinedDays',
    'instant',
    'shippingStrategy',
    'shipping',
    'slots',
    'consentTitle',
    'consentText',
  ])) return false
  if (!isString(value.fulfillmentType) || !FULFILLMENT_TYPES.has(value.fulfillmentType)) return false
  if (!isString(value.orderAcceptancePolicy) || !ACCEPTANCE_POLICIES.has(value.orderAcceptancePolicy)) return false
  if (!isString(value.schedulingStrategy) || !SCHEDULING_STRATEGIES.has(value.schedulingStrategy)) return false
  if (!isString(value.shippingStrategy) || !SHIPPING_STRATEGIES.has(value.shippingStrategy)) return false

  const fixed = value.fixedWindow
  const customer = value.customerSelectDate
  const predefined = value.predefinedDays
  const instant = value.instant
  const shipping = value.shipping
  if (!isRecord(fixed) || !hasOnlyKeys(fixed, ['minDeliveryDays', 'maxDeliveryDays']) ||
    !isFiniteNumber(fixed.minDeliveryDays) || !isFiniteNumber(fixed.maxDeliveryDays)) return false
  if (!isRecord(customer) || !hasOnlyKeys(customer, ['minAdvanceBookingDays', 'maxAdvanceBookingDays', 'cutoffTime']) ||
    !isFiniteNumber(customer.minAdvanceBookingDays) || !isFiniteNumber(customer.maxAdvanceBookingDays) || !isString(customer.cutoffTime)) return false
  if (!isRecord(predefined) || !hasOnlyKeys(predefined, ['days', 'maxOrdersPerDay']) ||
    !Array.isArray(predefined.days) || !predefined.days.every((day) => isString(day) && WEEKDAYS.has(day)) ||
    !isFiniteNumber(predefined.maxOrdersPerDay)) return false
  if (!isRecord(instant) || !hasOnlyKeys(instant, ['minPrepTimeMinutes', 'maxPrepTimeMinutes', 'operatingUntil', 'orderCutoffTime']) ||
    !isFiniteNumber(instant.minPrepTimeMinutes) || !isFiniteNumber(instant.maxPrepTimeMinutes) ||
    !isString(instant.operatingUntil) || !isString(instant.orderCutoffTime)) return false
  if (!isRecord(shipping) || !hasOnlyKeys(shipping, ['charge', 'freeDeliveryThreshold']) ||
    !isFiniteNumber(shipping.charge) || !isFiniteNumber(shipping.freeDeliveryThreshold)) return false
  if (!Array.isArray(value.slots) || !value.slots.every((slot) =>
    isRecord(slot) && hasOnlyKeys(slot, ['id', 'startTime', 'endTime']) &&
    isString(slot.id) && isString(slot.startTime) && isString(slot.endTime))) return false
  return isString(value.consentTitle) && isString(value.consentText)
}

function isPayment(value: unknown): value is PaymentOptionDraft {
  return isRecord(value) &&
    hasOnlyKeys(value, ['type', 'enabled', 'isDefault']) &&
    isString(value.type) &&
    PAYMENT_TYPES.has(value.type) &&
    isBoolean(value.enabled) &&
    isBoolean(value.isDefault)
}

function isTrustBadge(value: unknown): value is StorefrontBadgeDraft {
  return isRecord(value) &&
    hasOnlyKeys(value, ['id', 'icon', 'title', 'subtitle', 'enabled']) &&
    isString(value.id) &&
    isString(value.icon) &&
    isString(value.title) &&
    isString(value.subtitle) &&
    isBoolean(value.enabled)
}

function isStorefront(value: unknown): value is StorefrontDraft {
  return isRecord(value) &&
    hasOnlyKeys(value, [
      'storeName',
      'tagline',
      'businessLocation',
      'instagram',
      'primaryColor',
      'accentColor',
      'backgroundColor',
      'textColor',
      'fontFamily',
      'themePreset',
      'buttonShape',
      'cardStyle',
      'welcomeMessage',
      'announcementBar',
      'heroBadges',
      'trustStrip',
    ]) &&
    isString(value.storeName) &&
    isString(value.tagline) &&
    isString(value.businessLocation) &&
    isString(value.instagram) &&
    isString(value.primaryColor) &&
    isString(value.accentColor) &&
    isString(value.backgroundColor) &&
    isString(value.textColor) &&
    isString(value.fontFamily) &&
    (value.themePreset === null || (isString(value.themePreset) && THEME_PRESETS.has(value.themePreset))) &&
    isString(value.buttonShape) && BUTTON_SHAPES.has(value.buttonShape) &&
    isString(value.cardStyle) && CARD_STYLES.has(value.cardStyle) &&
    isString(value.welcomeMessage) &&
    isString(value.announcementBar) &&
    Array.isArray(value.heroBadges) && value.heroBadges.every(isString) &&
    Array.isArray(value.trustStrip) && value.trustStrip.every(isTrustBadge)
}

function isPublication(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, ['state', 'draftSlug', 'completedAt'])) return false
  if (value.state === 'draft') return value.draftSlug === null && value.completedAt === null
  return value.state === 'prototype-complete' && isString(value.draftSlug) &&
    value.draftSlug.length > 0 && isIsoDate(value.completedAt)
}

function isPersistedDraft(value: unknown): value is PersistedOnboardingDraftV1 {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'version',
    'currentStep',
    'completedSteps',
    'referenceMode',
    'mobileVerified',
    'business',
    'categories',
    'products',
    'skus',
    'delivery',
    'payments',
    'storefront',
    'publication',
  ])) return false
  if (value.version !== ONBOARDING_DRAFT_VERSION || !isStep(value.currentStep)) return false
  if (!Array.isArray(value.completedSteps) || !value.completedSteps.every(isStep)) return false
  if (value.referenceMode !== 'live' && value.referenceMode !== 'sample') return false
  if (!isBoolean(value.mobileVerified)) return false
  if (!isRecord(value.business) || !hasOnlyKeys(value.business, ['businessType', 'businessName', 'ownerName', 'contactPerson'])) return false
  if (value.business.businessType !== null && !isBusinessTypeReference(value.business.businessType)) return false
  if (!isString(value.business.businessName) || !isString(value.business.ownerName) || !isString(value.business.contactPerson)) return false
  if (!Array.isArray(value.categories) || value.categories.length > ONBOARDING_CONFIG.maxPersistedCategories || !value.categories.every(isCategoryReference)) return false
  if (!Array.isArray(value.products) || !value.products.every(isSelectedProduct)) return false
  if (!Array.isArray(value.skus) || !value.skus.every(isDraftSku)) return false
  if (!isDelivery(value.delivery)) return false
  if (!Array.isArray(value.payments) || value.payments.length !== PAYMENT_TYPES.size || !value.payments.every(isPayment)) return false
  if (new Set(value.payments.map((payment) => payment.type)).size !== PAYMENT_TYPES.size) return false
  if (!isStorefront(value.storefront) || !isPublication(value.publication)) return false

  const business = value.business as PersistedOnboardingDraftV1['business']
  const categories = value.categories as PersistedOnboardingDraftV1['categories']
  const products = value.products as PersistedOnboardingDraftV1['products']
  const skus = value.skus as PersistedOnboardingDraftV1['skus']
  const selectedIds = [
    business.businessType?.id,
    ...categories.map((category) => category.id),
    ...products.map((product) => product.id),
  ].filter((id): id is number => typeof id === 'number')
  if (value.referenceMode === 'sample' && selectedIds.some((id) => id > 0)) return false
  if (value.referenceMode === 'live' && selectedIds.some((id) => id < 0)) return false
  if (business.businessType && categories.some(
    (category) => category.businessTypeId !== business.businessType?.id,
  )) return false
  const categoryIds = new Set(categories.map((category) => category.id))
  if (products.some((product) => !categoryIds.has(product.categoryId))) return false
  const productIds = new Set(products.map((product) => product.id))
  if (skus.some((sku) => !productIds.has(sku.productId))) return false
  return true
}

function isPreviewSnapshot(value: unknown): value is LocalPreviewSnapshotV1 {
  return isRecord(value) &&
    hasOnlyKeys(value, ['slug', 'completedAt', 'draft']) &&
    isString(value.slug) &&
    isIsoDate(value.completedAt) &&
    isPersistedDraft(value.draft) &&
    value.draft.publication.state === 'prototype-complete' &&
    value.draft.publication.draftSlug === value.slug &&
    value.draft.publication.completedAt === value.completedAt
}

export function parsePersistedEnvelope(value: unknown): VendorOnboardingPersistedEnvelopeV1 | null {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'version',
    'revision',
    'updatedAt',
    'furthestVisitedStep',
    'draft',
    'previewSnapshot',
  ])) return null
  if (value.version !== ONBOARDING_DRAFT_VERSION) return null
  if (!Number.isSafeInteger(value.revision) || Number(value.revision) < 0) return null
  if (!isIsoDate(value.updatedAt) || !isStep(value.furthestVisitedStep)) return null
  if (!isPersistedDraft(value.draft)) return null
  if (value.previewSnapshot !== null && !isPreviewSnapshot(value.previewSnapshot)) return null
  return value as VendorOnboardingPersistedEnvelopeV1
}

function safeAssetUrl(value: string | null): string | null {
  return isSafeAssetUrl(value) ? value : null
}

export function toPersistedDraft(draft: VendorOnboardingDraftV1): PersistedOnboardingDraftV1 {
  return {
    version: ONBOARDING_DRAFT_VERSION,
    currentStep: draft.currentStep,
    completedSteps: [...draft.completedSteps],
    referenceMode: draft.referenceMode,
    mobileVerified: draft.mobileVerified,
    business: {
      businessType: draft.business.businessType
        ? { ...draft.business.businessType, icon: safeAssetUrl(draft.business.businessType.icon) }
        : null,
      businessName: draft.business.businessName,
      ownerName: draft.business.ownerName,
      contactPerson: draft.business.contactPerson,
    },
    categories: draft.categories.map((category) => ({
      ...category,
      imageUrl: safeAssetUrl(category.imageUrl),
    })),
    products: draft.products.map((product) => ({
      ...product,
      imageUrl: safeAssetUrl(product.imageUrl),
    })),
    skus: draft.skus.map((sku) => ({ ...sku })),
    delivery: {
      ...draft.delivery,
      fixedWindow: { ...draft.delivery.fixedWindow },
      customerSelectDate: { ...draft.delivery.customerSelectDate },
      predefinedDays: {
        ...draft.delivery.predefinedDays,
        days: [...draft.delivery.predefinedDays.days],
      },
      instant: { ...draft.delivery.instant },
      shipping: { ...draft.delivery.shipping },
      slots: draft.delivery.slots.map((slot) => ({ ...slot })),
    },
    payments: draft.payments.map((payment) => ({ ...payment })),
    storefront: {
      ...draft.storefront,
      heroBadges: [...draft.storefront.heroBadges],
      trustStrip: draft.storefront.trustStrip.map((badge) => ({ ...badge })),
    },
    publication: { ...draft.publication },
  }
}

export function hydratePersistedDraft(
  draft: PersistedOnboardingDraftV1,
): VendorOnboardingDraftV1 {
  const safe = toPersistedDraft({ ...draft, maskedPhone: null })
  return { ...safe, maskedPhone: null }
}

export function reconcilePersistedDraft(
  persisted: PersistedOnboardingDraftV1,
  persistedFurthestStep: OnboardingStep,
): { draft: VendorOnboardingDraftV1; furthestVisitedStep: OnboardingStep } {
  const draft = hydratePersistedDraft(persisted)
  if (!draft.mobileVerified) {
    return {
      draft: {
        ...draft,
        currentStep: 1,
        completedSteps: [],
        publication: { state: 'draft', draftSlug: null, completedAt: null },
      },
      furthestVisitedStep: 1,
    }
  }

  const needsPaymentDetails = draft.payments.some(
    (payment) => payment.enabled && (payment.type === 'PRE_PAID' || payment.type === 'ONLINE'),
  )
  const reopenAt: OnboardingStep = needsPaymentDetails ? 8 : 9
  const requestedStep = Math.max(3, draft.currentStep) as OnboardingStep
  const currentStep = Math.min(requestedStep, reopenAt) as OnboardingStep
  const furthestVisitedStep = Math.min(
    Math.max(3, persistedFurthestStep),
    reopenAt,
  ) as OnboardingStep
  return {
    draft: {
      ...draft,
      currentStep: Math.min(currentStep, furthestVisitedStep) as OnboardingStep,
      completedSteps: draft.completedSteps.filter((step) => step < reopenAt),
      publication: { state: 'draft', draftSlug: null, completedAt: null },
    },
    furthestVisitedStep,
  }
}

function parseSerializedEnvelope(raw: string): VendorOnboardingPersistedEnvelopeV1 | null {
  try {
    return parsePersistedEnvelope(JSON.parse(raw))
  } catch {
    return null
  }
}

export const onboardingDraftStorage = {
  read(): DraftReadResult {
    if (typeof window === 'undefined') return { kind: 'unavailable' }
    try {
      const raw = window.localStorage.getItem(ONBOARDING_DRAFT_STORAGE_KEY)
      if (raw === null) return { kind: 'empty' }
      const envelope = parseSerializedEnvelope(raw)
      return envelope ? { kind: 'valid', envelope } : { kind: 'corrupt' }
    } catch {
      return { kind: 'unavailable' }
    }
  },

  write(envelope: VendorOnboardingPersistedEnvelopeV1): void {
    window.localStorage.setItem(ONBOARDING_DRAFT_STORAGE_KEY, JSON.stringify(envelope))
  },

  clear(): void {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(ONBOARDING_DRAFT_STORAGE_KEY)
  },

  subscribe(listener: (envelope: VendorOnboardingPersistedEnvelopeV1) => void): () => void {
    if (typeof window === 'undefined') return () => undefined
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== ONBOARDING_DRAFT_STORAGE_KEY || !event.newValue) return
      const envelope = parseSerializedEnvelope(event.newValue)
      if (envelope) listener(envelope)
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  },
}

let delayHandle: number | null = null
let idleHandle: number | null = null
let pendingTask: (() => void) | null = null

export function cancelScheduledDraftSave(): void {
  if (typeof window !== 'undefined') {
    if (delayHandle !== null) window.clearTimeout(delayHandle)
    if (idleHandle !== null) (window as IdleWindow).cancelIdleCallback?.(idleHandle)
  }
  delayHandle = null
  idleHandle = null
  pendingTask = null
}

function runPendingTask(): void {
  const task = pendingTask
  pendingTask = null
  delayHandle = null
  idleHandle = null
  task?.()
}

export function scheduleDraftSave(task: () => void): void {
  cancelScheduledDraftSave()
  pendingTask = task
  if (typeof window === 'undefined') return
  delayHandle = window.setTimeout(() => {
    delayHandle = null
    const idleWindow = window as IdleWindow
    if (idleWindow.requestIdleCallback) {
      idleHandle = idleWindow.requestIdleCallback(runPendingTask, { timeout: 500 })
    } else {
      delayHandle = window.setTimeout(runPendingTask, 0)
    }
  }, ONBOARDING_CONFIG.draftSaveDelayMs)
}

export function flushScheduledDraftSave(task?: () => void): void {
  if (task) pendingTask = task
  if (!pendingTask) return
  if (typeof window !== 'undefined') {
    if (delayHandle !== null) window.clearTimeout(delayHandle)
    if (idleHandle !== null) (window as IdleWindow).cancelIdleCallback?.(idleHandle)
  }
  runPendingTask()
}
