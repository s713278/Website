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
  businessTypeId: number
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

export type FutureStorefrontConfigInput = {
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

export type FutureStorefrontConfigRequest =
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
export function mapFutureStorefrontConfig(
  input: FutureStorefrontConfigInput,
): FutureStorefrontConfigRequest {
  return {
    business_name: input.storeName.trim(),
    tagline: optionalTrimmed(input.tagline),
    business_location: optionalTrimmed(input.businessLocation),
    order_whatsapp_number: input.orderWhatsapp.trim(),
    instagram_url: normalizeInstagram(input.instagram),
    support_whatsapp_number: optionalTrimmed(input.supportWhatsapp),
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
