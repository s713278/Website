import type { components } from '@mithra/api-client'

export type ReferencePage<T> = {
  items: T[]
  pageNumber: number
  pageSize: number
  totalElements: number
  totalPages: number
  lastPage: boolean
}

export type BusinessTypeReference = {
  id: number
  name: string
  icon: string | null
  displayOrder: number | null
}

export type CategoryReference = {
  id: number
  name: string
  /**
   * `null` only on resume, when the business-type lookup failed and the category cannot
   * be attributed. The catalog read still requires a real id — see `mapCategoryPage`.
   */
  businessTypeId: number | null
  description: string | null
  imageUrl: string | null
  displayOrder: number | null
}

export type ProductReference = {
  id: number
  name: string
  description: string | null
  imageUrl: string | null
  measurementId: number | null
  measurementName: string | null
}

export type StorefrontConfigInput = {
  storeName: string
  tagline: string
  businessLocation: string
  instagram: string
  orderWhatsapp: string
  supportWhatsapp: string
  welcomeMessage: string
  announcementBar: string
  heroBadges: string[]
  trustStrip: Array<{
    icon: string
    title: string
    subtitle: string
    enabled: boolean
  }>
  theme: {
    primaryColor: string
    accentColor: string
    backgroundColor: string
    textColor: string
    fontFamily: string
    buttonShape: 'PILL' | 'ROUNDED' | 'SQUARE'
    cardStyle: 'FLAT' | 'SHADOW' | 'BORDER'
    themePreset: 'WARM' | 'FRESH' | 'MINIMAL' | 'BOLD' | null
  }
  uploadedLogoUrl?: string | null
  uploadedBannerUrl?: string | null
}

export type StorefrontConfigRequest =
  components['schemas']['SaveStorefrontConfigRequest']

export class InvalidReferencePayloadError extends Error {
  constructor() {
    super('The catalog returned data in an unsupported format. Please retry or use the sample catalog.')
    this.name = 'InvalidReferencePayloadError'
  }
}

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function requiredPositiveInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new InvalidReferencePayloadError()
  }
  return value
}

function requiredString(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new InvalidReferencePayloadError()
  }
  return value.trim()
}

function optionalString(value: unknown): string | null {
  if (value == null || value === '') return null
  if (typeof value !== 'string') throw new InvalidReferencePayloadError()
  return value.trim() || null
}

function optionalInteger(value: unknown): number | null {
  if (value == null) return null
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new InvalidReferencePayloadError()
  }
  return value
}

function requiredNonNegativeInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new InvalidReferencePayloadError()
  }
  return value
}

function deduplicateById<T extends { id: number }>(items: T[]): T[] {
  const seen = new Set<number>()
  return items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

function mapPage<T>(payload: unknown, mapItem: (item: UnknownRecord) => T): ReferencePage<T> {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    throw new InvalidReferencePayloadError()
  }

  const page = payload.data
  if (!Array.isArray(page.result)) throw new InvalidReferencePayloadError()
  if (typeof page.last_page !== 'boolean') throw new InvalidReferencePayloadError()

  const pageNumber = requiredNonNegativeInteger(page.page_number)
  const totalPages = requiredNonNegativeInteger(page.total_pages)
  const mapped = page.result.map((item) => {
    if (!isRecord(item)) throw new InvalidReferencePayloadError()
    return mapItem(item)
  })
  const items = deduplicateById(mapped as Array<T & { id: number }>) as T[]

  return {
    items,
    pageNumber,
    pageSize:
      page.page_size == null ? items.length : requiredNonNegativeInteger(page.page_size),
    totalElements:
      page.total_elements == null
        ? Math.max(items.length, totalPages * items.length)
        : requiredNonNegativeInteger(page.total_elements),
    totalPages,
    lastPage: page.last_page,
  }
}

export function mapBusinessTypePage(payload: unknown): ReferencePage<BusinessTypeReference> {
  return mapPage(payload, (item) => ({
    id: requiredPositiveInteger(item.id),
    name: requiredString(item.type),
    icon: optionalString(item.icon),
    displayOrder: optionalInteger(item.display_order),
  }))
}

export function mapCategoryPage(payload: unknown): ReferencePage<CategoryReference> {
  return mapPage(payload, (item) => ({
    id: requiredPositiveInteger(item.id),
    name: requiredString(item.name),
    businessTypeId: requiredPositiveInteger(item.business_type_id),
    description: optionalString(item.description),
    imageUrl: optionalString(item.image_path),
    displayOrder: optionalInteger(item.display_order),
  }))
}

export function mapProductPage(payload: unknown): ReferencePage<ProductReference> {
  return mapPage(payload, (item) => ({
    id: requiredPositiveInteger(item.id),
    name: requiredString(item.name),
    description: optionalString(item.description),
    imageUrl: optionalString(item.image_path),
    measurementId: optionalInteger(item.measurement_id),
    measurementName: optionalString(item.measurement_name),
  }))
}

function optionalTrimmed(value: string): string | undefined {
  return value.trim() || undefined
}

/** India's country calling code. The wizard collects ten national digits; the backend
 *  contract wants E.164, so the code is added here — once — just before the request goes out. */
const INDIA_DIALING_CODE = '+91'

function toIndianE164(nationalNumber: string): string {
  return `${INDIA_DIALING_CODE}${nationalNumber.trim()}`
}

/** An omitted optional number stays omitted rather than becoming a bare `+91`. */
function optionalIndianE164(value: string): string | undefined {
  return value.trim() ? toIndianE164(value) : undefined
}

function normalizeInstagram(value: string): string | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed
}

function uploadedImageUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('Storefront image URLs must come from a completed HTTP upload.')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Local object URLs cannot be sent to the storefront API.')
  }
  return url.toString()
}

/**
 * Pure future mapper for the protected storefront-save contract. The local prototype deliberately
 * does not call the endpoint; this keeps wire naming and enum alignment reviewable in one place.
 */
export function mapStorefrontConfigRequest(
  input: StorefrontConfigInput,
): StorefrontConfigRequest {
  return {
    business_name: input.storeName.trim(),
    tagline: optionalTrimmed(input.tagline),
    business_location: optionalTrimmed(input.businessLocation),
    order_whatsapp_number: toIndianE164(input.orderWhatsapp),
    instagram_url: normalizeInstagram(input.instagram),
    support_whatsapp_number: optionalIndianE164(input.supportWhatsapp),
    welcome_message: optionalTrimmed(input.welcomeMessage),
    announcement_bar: optionalTrimmed(input.announcementBar),
    hero_badges: input.heroBadges.map((badge) => badge.trim()).filter(Boolean),
    trust_strip: input.trustStrip
      .filter((badge) => badge.enabled)
      .map((badge) => ({
        icon: badge.icon.trim(),
        title: badge.title.trim(),
        subtitle: badge.subtitle.trim(),
      })),
    theme: {
      primary_color: input.theme.primaryColor,
      accent_color: input.theme.accentColor,
      background_color: input.theme.backgroundColor,
      text_color: input.theme.textColor,
      font_family: input.theme.fontFamily,
      logo_image: uploadedImageUrl(input.uploadedLogoUrl),
      banner_image: uploadedImageUrl(input.uploadedBannerUrl),
      button_shape: input.theme.buttonShape,
      card_style: input.theme.cardStyle,
      theme_preset: input.theme.themePreset ?? undefined,
    },
  }
}

/* -------------------------------------------------------------------------
 * Vendor context
 *
 * `GET /v1/vendors/{vendor_id}/context` is declared as a generic APIResponse,
 * so nothing about `data` is guaranteed by the contract. Everything below is
 * validated leniently: only `vendor_id` is fatal, because without it there is
 * no vendor to scope calls to. Missing optional fields become null rather than
 * throwing, so a backend that adds or omits a field cannot break the wizard.
 * ---------------------------------------------------------------------- */

export type VendorOnboardingStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'UNKNOWN'

export type VendorSubscriptionLimits = {
  maxCategories: number | null
  maxProducts: number | null
  maxSkus: number | null
  maxImages: number | null
}

export type VendorSubscriptionUsage = {
  categories: number | null
  products: number | null
  skus: number | null
  images: number | null
}

export type VendorContext = {
  vendorId: string
  businessName: string | null
  storeIdentifier: string | null
  vendorStatus: string | null
  approvalStatus: string | null
  /** Membership role within the store, e.g. OWNER. Not an authentication role. */
  membershipRole: string | null
  onboarding: {
    status: VendorOnboardingStatus
    description: string | null
    /**
     * 1-based over the ten wizard steps; `11` means setup is complete.
     *
     * The checked-in OpenAPI *example* omits this field, which is why it was once
     * believed not to exist — but the deployed API returns it from both
     * `GET /v1/vendors/{id}/context` and `POST /v1/auth/verify-otp` (per vendor, under
     * `vendors[].onboarding`), with identical values. It is the authoritative resume
     * position: see `backendResumeStep` in `modules/vendor/lib/onboarding-resume.ts`,
     * and docs/API_GAPS.md for the verification that settled it. Resource-derived
     * resume is a fallback for this field disappearing, not a second opinion.
     */
    nextStep: number | null
  }
  subscription: {
    tier: string | null
    planName: string | null
    status: string | null
    limits: VendorSubscriptionLimits
    usage: VendorSubscriptionUsage
  }
  eligibleFeatures: string[]
}

export class InvalidVendorContextError extends Error {
  constructor() {
    super('The vendor account could not be loaded. Please retry.')
    this.name = 'InvalidVendorContextError'
  }
}

/** Lenient: anything that is not a usable string becomes null. */
function lenientString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return value.trim() || null
}

/** Lenient: accepts a number or a numeric string, otherwise null. */
function lenientInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return Number(value.trim())
  return null
}

function lenientStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(lenientString).filter((entry): entry is string => entry !== null)
}

function mapOnboardingStatus(value: unknown): VendorOnboardingStatus {
  const raw = lenientString(value)?.toUpperCase()
  if (raw === 'NOT_STARTED' || raw === 'IN_PROGRESS' || raw === 'COMPLETED') return raw
  return 'UNKNOWN'
}

export function mapVendorContext(payload: unknown): VendorContext {
  if (!isRecord(payload) || !isRecord(payload.data)) throw new InvalidVendorContextError()

  const data = payload.data
  const vendorId = lenientInteger(data.vendor_id) ?? lenientString(data.vendor_id)
  if (vendorId == null || String(vendorId).trim() === '') throw new InvalidVendorContextError()

  const onboarding = isRecord(data.onboarding) ? data.onboarding : {}
  const subscription = isRecord(data.subscription) ? data.subscription : {}
  const limits = isRecord(subscription.limits) ? subscription.limits : {}
  const usage = isRecord(subscription.usage) ? subscription.usage : {}

  return {
    vendorId: String(vendorId),
    businessName: lenientString(data.business_name),
    storeIdentifier: lenientString(data.store_identifier),
    vendorStatus: lenientString(data.vendor_status),
    approvalStatus: lenientString(data.approval_status),
    membershipRole: lenientString(data.role),
    onboarding: {
      status: mapOnboardingStatus(onboarding.status),
      description: lenientString(onboarding.description),
      nextStep: lenientInteger(onboarding.next_step),
    },
    subscription: {
      tier: lenientString(subscription.tier),
      planName: lenientString(subscription.plan_name),
      status: lenientString(subscription.status),
      limits: {
        maxCategories: lenientInteger(limits.max_categories),
        maxProducts: lenientInteger(limits.max_products),
        maxSkus: lenientInteger(limits.max_skus),
        maxImages: lenientInteger(limits.max_images),
      },
      usage: {
        categories: lenientInteger(usage.categories),
        products: lenientInteger(usage.products),
        skus: lenientInteger(usage.skus),
        images: lenientInteger(usage.images),
      },
    },
    eligibleFeatures: lenientStringList(data.eligible_features),
  }
}

/* -------------------------------------------------------------------------
 * Vendor-scoped write payloads
 *
 * Request shapes come from the generated schemas plus verified live behavior.
 * Generic write envelopes are not used to infer assigned IDs; IDs needed by a
 * follow-up write are resolved through the strict vendor-scoped read mappers below.
 * ---------------------------------------------------------------------- */

export type BusinessTypeSaveInput = {
  /** The exact backend `type` value, not the display label. */
  businessType: string
  businessName?: string
  ownerName?: string
  contactPerson?: string
}

export type BusinessTypeSaveRequest = components['schemas']['VendorBusinessTypeRequest']
export type AssignCategoriesRequest = components['schemas']['AssignCategoriesRequest']

export function mapBusinessTypeRequest(input: BusinessTypeSaveInput): BusinessTypeSaveRequest {
  return {
    business_type: input.businessType.trim(),
    business_name: optionalTrimmed(input.businessName ?? ''),
    owner_name: optionalTrimmed(input.ownerName ?? ''),
    contact_person: optionalTrimmed(input.contactPerson ?? ''),
  }
}

export function mapAssignCategoriesRequest(categoryIds: number[]): AssignCategoriesRequest {
  const unique = Array.from(new Set(categoryIds))
  for (const id of unique) {
    if (!Number.isSafeInteger(id) || id <= 0) throw new InvalidReferencePayloadError()
  }
  return { category_ids: unique }
}

/* -------------------------------------------------------------------------
 * Vendor-scoped resources
 *
 * The backend keeps two separate ID spaces and every onboarding write depends on
 * using the right one. Verified against the live API:
 *
 *   GET /v1/vendors/{id}/categories -> { id: <vendor cat>, ref_id: <platform cat> }
 *   GET /v1/vendors/{id}/products   -> { id: <vendor product>, ref_id: <platform product> }
 *
 * `ref_id` always points back at the platform catalog. SKUs are keyed by the
 * vendor product ID (`vendor_product_id`), never the platform one.
 * ---------------------------------------------------------------------- */

export type VendorCategoryRef = {
  vendorCategoryId: number
  platformCategoryId: number
  name: string
  imageUrl: string | null
}

export type VendorProductRef = {
  vendorProductId: number
  platformProductId: number
  platformCategoryId: number
  name: string
  measurementId: number | null
}

export type VendorSkuRef = {
  vendorProductId: number
  skuId: number
  /** Server-side name; it appends the size, e.g. "Cow Milk 1L-1 L". */
  name: string
  size: string
  /** `name` with the size suffix removed — what the vendor actually typed. */
  displayName: string
  description: string
  isActive: boolean
  listPrice: number | null
  salePrice: number | null
  /** Parsed back out of `size`: "1 L" -> 1 and "L". */
  quantity: number | null
  unit: string
}

/** SKU price measurements, matching the backend's measurement_type enum. */
export type SkuMeasurementType =
  | 'WEIGHT'
  | 'VOLUME'
  | 'COUNT'
  | 'AREA'
  | 'SERVICE_UNIT'
  | 'DURATION'
  | 'PER_PERSON'
  | 'SLOT'

const MEASUREMENT_TYPES = new Set<SkuMeasurementType>([
  'WEIGHT',
  'VOLUME',
  'COUNT',
  'AREA',
  'SERVICE_UNIT',
  'DURATION',
  'PER_PERSON',
  'SLOT',
])

function measurementTypeOf(value: unknown): SkuMeasurementType | null {
  return typeof value === 'string' && MEASUREMENT_TYPES.has(value as SkuMeasurementType)
    ? (value as SkuMeasurementType)
    : null
}

/** One platform measurement: its id, type, the units it is priced in, and quantity suggestions. */
export type MeasurementCatalogEntry = {
  id: number
  type: SkuMeasurementType
  units: string[]
  unitOptions: number[]
}

export type MeasurementCatalog = MeasurementCatalogEntry[]

function mapMeasurementRow(value: unknown): MeasurementCatalogEntry | null {
  if (!isRecord(value)) return null
  const id = optionalInteger(value.id)
  const type = measurementTypeOf(value.measurement_type ?? value.type ?? value.name)
  if (id == null || type == null) return null
  const units =
    typeof value.unit === 'string'
      ? value.unit.split(',').map((unit) => unit.trim()).filter((unit) => unit.length > 0)
      : []
  const unitOptions = Array.isArray(value.unit_options)
    ? value.unit_options.filter(
        (option): option is number => typeof option === 'number' && Number.isFinite(option),
      )
    : []
  return { id, type, units, unitOptions }
}

/**
 * Maps `GET /v1/measurements/`. The operation is typed as a bare `APIResponseObject`, so this
 * reads the shape verified live on 2026-08-28 defensively: `id`, a `measurement_type` enum, a
 * comma-separated `unit`, and an optional numeric `unit_options`. Identifiers are not
 * contiguous and are never assumed. An entry missing an id or a recognised type is dropped
 * rather than guessed at — a measurement the frontend cannot place is worse than one it omits.
 */
export function mapMeasurementCatalog(payload: unknown): MeasurementCatalog {
  if (!isRecord(payload)) return []
  const data = payload.data
  const rows = Array.isArray(data)
    ? data
    : isRecord(data) && Array.isArray(data.result)
      ? data.result
      : []
  const catalog: MeasurementCatalog = []
  for (const row of rows) {
    const entry = mapMeasurementRow(row)
    if (entry) catalog.push(entry)
  }
  return catalog
}

/**
 * Enrich list rows with `GET /v1/measurements/{id}` payloads.
 *
 * The deployed list omits `unit_options` even though its OpenAPI description says it includes
 * them. Detail reads are therefore required before Step 6 can offer quantity suggestions.
 */
export function mergeMeasurementCatalogDetails(
  catalog: MeasurementCatalog,
  detailPayloads: unknown[],
): MeasurementCatalog {
  const detailsById = new Map<number, MeasurementCatalogEntry>()
  for (const payload of detailPayloads) {
    if (!isRecord(payload)) continue
    const detail = mapMeasurementRow(payload.data)
    if (detail) detailsById.set(detail.id, detail)
  }
  return catalog.map((entry) => detailsById.get(entry.id) ?? entry)
}

/** Accepts `data: []` and `data: { result: [] }`; both occur on vendor resources. */
function vendorList(payload: unknown): UnknownRecord[] {
  if (!isRecord(payload)) throw new InvalidVendorContextError()
  const data = payload.data
  if (Array.isArray(data)) return data.filter(isRecord)
  if (isRecord(data) && Array.isArray(data.result)) return data.result.filter(isRecord)
  throw new InvalidVendorContextError()
}

function requiredId(value: unknown): number {
  const id = lenientInteger(value)
  if (id == null || id <= 0) throw new InvalidVendorContextError()
  return id
}

export function mapVendorCategories(payload: unknown): VendorCategoryRef[] {
  return vendorList(payload).map((item) => ({
    vendorCategoryId: requiredId(item.id),
    platformCategoryId: requiredId(item.ref_id),
    name: lenientString(item.name) ?? '',
    imageUrl: lenientString(item.image_path),
  }))
}

export function mapVendorProducts(payload: unknown): VendorProductRef[] {
  return vendorList(payload).map((item) => ({
    vendorProductId: requiredId(item.id),
    platformProductId: requiredId(item.ref_id),
    platformCategoryId: requiredId(item.category_id),
    name: lenientString(item.name) ?? '',
    measurementId: lenientInteger(item.measurement_id),
  }))
}

/** Splits the server's `sku_size` ("1 L", "500 ml", "12 pcs") into quantity and unit. */
function parseSkuSize(size: string): { quantity: number | null; unit: string } {
  const match = size.trim().match(/^([\d.]+)\s*(.*)$/)
  if (!match) return { quantity: null, unit: size.trim() }
  const quantity = Number.parseFloat(match[1])
  return {
    quantity: Number.isFinite(quantity) ? quantity : null,
    unit: match[2].trim(),
  }
}

/**
 * `mapSkuCreateRequest` sends `name` and the server stores `"<name>-<size>"`, so the
 * suffix is stripped to recover what the vendor typed. Anything that does not match
 * the convention is left alone rather than guessed at.
 */
function stripSizeSuffix(name: string, size: string): string {
  const suffix = `-${size}`
  return size && name.endsWith(suffix) ? name.slice(0, -suffix.length) : name
}

function lenientNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function mapVendorSkus(payload: unknown): VendorSkuRef[] {
  return vendorList(payload).map((item) => {
    const name = lenientString(item.sku_name) ?? ''
    const size = lenientString(item.sku_size) ?? ''
    const { quantity, unit } = parseSkuSize(size)
    return {
      vendorProductId: requiredId(item.vendor_product_id),
      skuId: requiredId(item.sku_id),
      name,
      size,
      displayName: stripSizeSuffix(name, size),
      description: lenientString(item.description) ?? '',
      // Absent means active: the write path only ever creates active SKUs.
      isActive: item.is_active !== false,
      listPrice: lenientNumber(item.list_price),
      salePrice: lenientNumber(item.sale_price),
      quantity,
      unit,
    }
  })
}

export type VendorProfile = {
  businessName: string
  /** Display string, e.g. "Beverages & Juice Center" — not an id. */
  businessType: string | null
  ownerName: string
  contactPerson: string
  contactNumber: string
}

/**
 * `GET /v1/vendors/{id}`.
 *
 * Typed as a bare `APIResponseObject` in the contract, but the deployed API returns the
 * profile fields below — this is the only read that exposes `business_type`, which Step 3
 * needs. Verified live; do not "simplify" it away because the schema looks empty.
 */
export function mapVendorProfile(payload: unknown): VendorProfile {
  if (!isRecord(payload) || !isRecord(payload.data)) throw new InvalidVendorContextError()
  const data = payload.data
  return {
    businessName: lenientString(data.business_name) ?? '',
    businessType: lenientString(data.business_type),
    ownerName: lenientString(data.owner_name) ?? '',
    contactPerson: lenientString(data.contact_person) ?? '',
    contactNumber: lenientString(data.contact_number) ?? '',
  }
}

/** platform product ID -> vendor product ID, the lookup every SKU write needs. */
export function vendorProductIdByPlatformId(products: VendorProductRef[]): Map<number, number> {
  return new Map(products.map((p) => [p.platformProductId, p.vendorProductId]))
}

/* -------------------------------------------------------------------------
 * Vendor catalog + checkout writes
 *
 * Shapes below are verified against the live API, not inferred from the schema.
 * Where behaviour contradicts the published contract it is called out inline,
 * so nobody "corrects" it back to the documented-but-broken form.
 * ---------------------------------------------------------------------- */

export type AssignProductsRequest = components['schemas']['AssignProductsRequest']
export type SkuCreateRequest = components['schemas']['ItemSkuCreateRequest']
export type CheckoutOptionsRequest = components['schemas']['SaveVendorDeliveryConfigRequest']

/**
 * The endpoint description says `category_id` is the vendor category ID from
 * `/{vendor_id}/categories`. It is not — passing that returns
 * `400 Invalid vendor category id`. The API requires the PLATFORM category ID.
 */
export function mapAssignProductsRequest(
  platformCategoryId: number,
  platformProductIds: number[],
): AssignProductsRequest {
  return {
    category_id: platformCategoryId,
    selected_products: platformProductIds.map((product_id) => ({ product_id })),
  }
}

export type CategoryCreateInput = {
  businessTypeId: number
  name: string
  description?: string | null
}

export type ProductCreateInput = {
  name: string
  measurementUnitId: number
  description?: string | null
}

/**
 * POST /v1/categories/ — author a platform category.
 *
 * The published `CategoryDTO` names the business type as a string (`business_type`), but the
 * deployed API keys a new category by `business_type_id` — which is what the draft carries.
 * A name would force a reverse lookup the wizard does not have.
 */
export function mapCategoryCreateRequest(input: CategoryCreateInput): Record<string, unknown> {
  const name = input.name.trim()
  if (!name) throw new InvalidReferencePayloadError()
  if (!Number.isSafeInteger(input.businessTypeId) || input.businessTypeId <= 0) {
    throw new InvalidReferencePayloadError()
  }
  return {
    business_type_id: input.businessTypeId,
    name,
    description: optionalTrimmed(input.description ?? ''),
  }
}

/**
 * POST /v1/categories/{category_id}/products/ — author a platform product.
 *
 * `measurement_unit_id` is required: a product with no unit cannot be priced at Step 6. The
 * name must be at least three characters. `description` defaults to the name so the field is
 * never sent empty. The category is the PLATFORM id and rides in the path, not this body — by
 * the time a product is minted the pending category it belongs to already has a platform id.
 */
export function mapProductCreateRequest(input: ProductCreateInput): Record<string, unknown> {
  const name = input.name.trim()
  if (name.length < 3) throw new InvalidReferencePayloadError()
  if (!Number.isSafeInteger(input.measurementUnitId) || input.measurementUnitId <= 0) {
    throw new InvalidReferencePayloadError()
  }
  return {
    name,
    measurement_unit_id: input.measurementUnitId,
    description: (input.description ?? '').trim() || name,
  }
}

/**
 * The positive platform id a create echoed back, read from the envelope's `data`.
 *
 * It is recorded into the draft before the assign that follows, so a create that lands then
 * an assign that fails never mints a second, undeletable copy. A response with no usable id
 * is a contract violation, not something to paper over — see `mithra-openapi-unreliable`.
 */
function createdId(payload: unknown): number {
  if (!isRecord(payload)) throw new InvalidReferencePayloadError()
  const data = payload.data
  if (typeof data === 'number') return requiredPositiveInteger(data)
  if (isRecord(data)) return requiredPositiveInteger(data.id)
  throw new InvalidReferencePayloadError()
}

export function mapCreatedCategory(payload: unknown): number {
  return createdId(payload)
}

export function mapCreatedProduct(payload: unknown): number {
  return createdId(payload)
}

export type SkuCreateInput = {
  name: string
  description: string
  measurementType: SkuMeasurementType
  unit: string
  quantity: number
  listPrice: number
  salePrice: number
  active: boolean
  homeDelivery: boolean
  storePickup: boolean
}

/**
 * `eligible_sub_plans` is effectively required: omitting it crashes the backend
 * validator (`HV000028`, HTTP 417) rather than returning a validation error, and an
 * empty array is rejected with "SKU must have at least one eligible subscription
 * plan". Onboarding does not collect subscription plans, so every SKU gets the
 * one-time/flexible plan.
 */
export function mapSkuCreateRequest(
  input: SkuCreateInput,
  vendorProductId: number,
  effectiveDate = new Date().toISOString().slice(0, 10),
): SkuCreateRequest {
  return {
    product_id: vendorProductId,
    name: input.name.trim(),
    description: optionalTrimmed(input.description),
    sku_type: 'ITEM',
    is_active: input.active,
    home_delivery: input.homeDelivery,
    store_pickup: input.storePickup,
    price_list: [
      {
        measurement_type: input.measurementType,
        unit: input.unit,
        value: String(input.quantity),
        effective_date: effectiveDate,
        list_price: input.listPrice,
        sale_price: input.salePrice,
        shipping_price: 0,
      },
    ],
    eligible_sub_plans: [
      { sub_plan_id: 4, sub_frequency: 'ONE_TIME', delivery_mode: 'FLEXIBLE' },
    ],
  }
}

export type CheckoutDeliveryInput = {
  fulfillmentType: 'HOME_DELIVERY' | 'STORE_PICKUP' | 'BOTH'
  orderAcceptancePolicy: 'AUTO_ACCEPT' | 'MANUAL_APPROVAL'
  schedulingStrategy: 'FIXED_WINDOW' | 'CUSTOMER_SELECT_DATE' | 'PREDEFINED_DAYS' | 'INSTANT'
  fixedWindow: { minDeliveryDays: number; maxDeliveryDays: number }
  customerSelectDate: {
    minAdvanceBookingDays: number
    maxAdvanceBookingDays: number
    cutoffTime: string
  }
  predefinedDays: { days: string[]; maxOrdersPerDay: number }
  instant: {
    minPrepTimeMinutes: number
    maxPrepTimeMinutes: number
    operatingUntil: string
    orderCutoffTime: string
  }
  shippingStrategy: 'FLAT' | 'ORDER_AMOUNT_THRESHOLD'
  shipping: { charge: number; freeDeliveryThreshold: number }
  slots: Array<{ startTime: string; endTime: string }>
  consentTitle: string
  consentText: string
}

export type CheckoutPaymentInput = {
  options: Array<{
    type: 'PRE_PAID' | 'ONLINE' | 'CASH_ON_DELIVERY'
    enabled: boolean
    isDefault: boolean
  }>
  details: {
    upiId: string
    upiAccountHolderName: string
    bankAccountHolderName: string
    bankAccountNumber: string
    bankIfscCode: string
    bankName: string
  }
}

const PAYMENT_LABEL: Record<CheckoutPaymentInput['options'][number]['type'], string> = {
  PRE_PAID: 'UPI',
  ONLINE: 'Bank transfer',
  CASH_ON_DELIVERY: 'Cash on delivery',
}

/**
 * `openapi-typescript` renders Spring's free-form `JsonNode` as `Record<string, never>`,
 * which cannot hold any real value. The generated files must never be hand-edited, so the
 * cast is confined to this one boundary rather than leaking into callers.
 */
type GeneratedJsonNode = NonNullable<CheckoutOptionsRequest['scheduling_config']>

function asJsonNode(value: Record<string, unknown>): GeneratedJsonNode {
  return value as unknown as GeneratedJsonNode
}

function schedulingConfig(input: CheckoutDeliveryInput): Record<string, unknown> {
  if (input.schedulingStrategy === 'FIXED_WINDOW') {
    return {
      min_delivery_days: input.fixedWindow.minDeliveryDays,
      max_delivery_days: input.fixedWindow.maxDeliveryDays,
    }
  }
  if (input.schedulingStrategy === 'CUSTOMER_SELECT_DATE') {
    return {
      min_advance_booking_days: input.customerSelectDate.minAdvanceBookingDays,
      max_advance_booking_days: input.customerSelectDate.maxAdvanceBookingDays,
      cutoff_time: input.customerSelectDate.cutoffTime,
    }
  }
  if (input.schedulingStrategy === 'PREDEFINED_DAYS') {
    return {
      delivery_days: input.predefinedDays.days,
      max_orders_per_day: input.predefinedDays.maxOrdersPerDay,
    }
  }
  return {
    min_prep_time_minutes: input.instant.minPrepTimeMinutes,
    max_prep_time_minutes: input.instant.maxPrepTimeMinutes,
    operating_until: input.instant.operatingUntil,
    order_cutoff_time: input.instant.orderCutoffTime,
  }
}

function mapPaymentDetails(
  type: CheckoutPaymentInput['options'][number]['type'],
  details: CheckoutPaymentInput['details'],
): GeneratedJsonNode | undefined {
  const value = paymentDetails(type, details)
  return value ? asJsonNode(value) : undefined
}

function paymentDetails(
  type: CheckoutPaymentInput['options'][number]['type'],
  details: CheckoutPaymentInput['details'],
): Record<string, string> | undefined {
  if (type === 'PRE_PAID') {
    const upi = details.upiId.trim()
    if (!upi) return undefined
    const holder = details.upiAccountHolderName.trim()
    return { upi_account: upi, ...(holder ? { account_holder_name: holder } : {}) }
  }
  if (type === 'ONLINE') {
    const account = details.bankAccountNumber.trim()
    if (!account) return undefined
    return {
      account_holder_name: details.bankAccountHolderName.trim(),
      account_number: account,
      ifsc_code: details.bankIfscCode.trim(),
      bank_name: details.bankName.trim(),
    }
  }
  return undefined
}

/**
 * Steps 7 and 8 share one payload, and `payment_options` replaces the existing set,
 * so both steps always send the complete current configuration.
 *
 * Only ORDER_AMOUNT_THRESHOLD and ZIPCODE_THRESHOLD are actually implemented
 * server-side; FLAT, ZIPCODE_TIERED and WEIGHT_BASED all return "No validator
 * registered" despite being in the enum. A flat charge is therefore expressed as
 * ORDER_AMOUNT_THRESHOLD with a zero threshold, which means nothing is ever free —
 * a genuine flat charge, not a workaround.
 */
export function mapCheckoutOptionsRequest(
  delivery: CheckoutDeliveryInput,
  payments: CheckoutPaymentInput,
): CheckoutOptionsRequest {
  const enabled = payments.options.filter((option) => option.enabled)
  return {
    fulfillment_type: delivery.fulfillmentType,
    order_acceptance_policy: delivery.orderAcceptancePolicy,
    scheduling_strategy: delivery.schedulingStrategy,
    scheduling_config: asJsonNode(schedulingConfig(delivery)),
    shipping_strategy_type: 'ORDER_AMOUNT_THRESHOLD',
    shipping_config: asJsonNode({
      delivery_charge: delivery.shipping.charge,
      free_delivery_threshold:
        delivery.shippingStrategy === 'FLAT' ? 0 : delivery.shipping.freeDeliveryThreshold,
    }),
    delivery_slots: delivery.slots
      .filter((slot) => slot.startTime && slot.endTime)
      .map((slot) => `${slot.startTime} - ${slot.endTime}`),
    customer_consent_title: optionalTrimmed(delivery.consentTitle),
    customer_consent_text: optionalTrimmed(delivery.consentText),
    payment_options: enabled.map((option, index) => ({
      type: option.type,
      label: PAYMENT_LABEL[option.type],
      // The request field is `is_default`; the response echoes it back as `default`.
      is_default: option.isDefault,
      display_order: index + 1,
      details: mapPaymentDetails(option.type, payments.details),
    })),
  }
}

/* -------------------------------------------------------------------------
 * Checkout options read-back
 *
 * `GET /checkout_options` returns considerably more than its five OpenAPI examples
 * show: `payment_options` (with UPI/bank `details`), `order_acceptance_policy`,
 * `delivery_slots` and both consent fields all come back. Verified live against a
 * configured vendor. This is the inverse of `mapCheckoutOptionsRequest`.
 * ---------------------------------------------------------------------- */

export type CheckoutPaymentSnapshot = {
  type: 'PRE_PAID' | 'ONLINE' | 'CASH_ON_DELIVERY'
  isDefault: boolean
  details: Record<string, string>
}

export type CheckoutOptionsSnapshot = {
  fulfillmentType: CheckoutDeliveryInput['fulfillmentType'] | null
  orderAcceptancePolicy: CheckoutDeliveryInput['orderAcceptancePolicy'] | null
  schedulingStrategy: CheckoutDeliveryInput['schedulingStrategy'] | null
  schedulingConfig: UnknownRecord
  shippingConfig: { deliveryCharge: number | null; freeDeliveryThreshold: number | null }
  slots: Array<{ startTime: string; endTime: string }>
  consentTitle: string
  consentText: string
  payments: CheckoutPaymentSnapshot[]
}

const FULFILLMENT_TYPES = new Set(['HOME_DELIVERY', 'STORE_PICKUP', 'BOTH'])
const ACCEPTANCE_POLICIES = new Set(['AUTO_ACCEPT', 'MANUAL_APPROVAL'])
const SCHEDULING_STRATEGIES = new Set([
  'FIXED_WINDOW',
  'CUSTOMER_SELECT_DATE',
  'PREDEFINED_DAYS',
  'INSTANT',
])
const PAYMENT_TYPES = new Set(['PRE_PAID', 'ONLINE', 'CASH_ON_DELIVERY'])

function oneOf<T extends string>(value: unknown, allowed: Set<string>): T | null {
  const text = lenientString(value)
  return text && allowed.has(text) ? (text as T) : null
}

/** "09:00 - 12:00" back into its two halves; anything else is dropped. */
function parseSlot(value: unknown): { startTime: string; endTime: string } | null {
  const text = lenientString(value)
  if (!text) return null
  const [startTime, endTime] = text.split('-').map((part) => part.trim())
  return startTime && endTime ? { startTime, endTime } : null
}

/** Every value in `details` coerced to a string; the wire type is free-form JSON. */
function stringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {}
  const entries = Object.entries(value)
    .map(([key, item]) => [key, lenientString(item) ?? ''] as const)
    .filter(([, item]) => item !== '')
  return Object.fromEntries(entries)
}

export function mapCheckoutOptionsResponse(payload: unknown): CheckoutOptionsSnapshot | null {
  if (!isRecord(payload)) return null
  const data = isRecord(payload.data) ? payload.data : null
  if (!data) return null

  const delivery = isRecord(data.delivery_options) ? data.delivery_options : {}
  const shipping = isRecord(delivery.shipping_config) ? delivery.shipping_config : {}
  const scheduling = isRecord(delivery.scheduling_config) ? delivery.scheduling_config : {}
  const payments = Array.isArray(data.payment_options) ? data.payment_options.filter(isRecord) : []

  return {
    fulfillmentType: oneOf(data.fulfillment_type, FULFILLMENT_TYPES),
    orderAcceptancePolicy: oneOf(data.order_acceptance_policy, ACCEPTANCE_POLICIES),
    schedulingStrategy: oneOf(delivery.scheduling_strategy, SCHEDULING_STRATEGIES),
    // Kept raw: the keys differ per strategy, and the response casing does not always
    // match what we write (`min_prep_time_minutes` out, `minPrepTimeMinutes` back).
    schedulingConfig: scheduling,
    shippingConfig: {
      deliveryCharge: lenientNumber(shipping.delivery_charge ?? shipping.charge),
      freeDeliveryThreshold: lenientNumber(shipping.free_delivery_threshold),
    },
    slots: Array.isArray(data.delivery_slots)
      ? data.delivery_slots.map(parseSlot).filter((slot) => slot !== null)
      : [],
    consentTitle: lenientString(data.customer_consent_title) ?? '',
    consentText: lenientString(data.customer_consent_text) ?? '',
    payments: payments.flatMap((option) => {
      const type = oneOf<CheckoutPaymentSnapshot['type']>(option.type, PAYMENT_TYPES)
      if (!type) return []
      return [{
        type,
        // The request field is `is_default`; the response echoes it back as `default`.
        isDefault: option.default === true || option.is_default === true,
        details: stringRecord(option.details),
      }]
    }),
  }
}

/** Reads a scheduling-config value under any of the casings the API has used. */
export function schedulingConfigNumber(config: UnknownRecord, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = lenientNumber(config[key])
    if (value != null) return value
  }
  return null
}

export function schedulingConfigString(config: UnknownRecord, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = lenientString(config[key])
    if (value) return value
  }
  return null
}

export function schedulingConfigList(config: UnknownRecord, ...keys: string[]): string[] {
  for (const key of keys) {
    if (Array.isArray(config[key])) return lenientStringList(config[key])
  }
  return []
}
