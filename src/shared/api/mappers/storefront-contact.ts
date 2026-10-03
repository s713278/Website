export type StoreContactAddress = {
  address1?: string
  address2?: string
  locality?: string
  district?: string
  city?: string
  state?: string
  country?: string
  zipCode?: string
  latitude?: string
  longitude?: string
}

export type StoreContactLink = {
  id: string
  platform: string
  url: string
}

/** Fields from `GET /v1/vendors/{id}/storefront/contact-us`. */
export type StoreContact = {
  businessName: string
  storeIdentifier?: string
  ownerName?: string
  contactNumber?: string
  mainAddress?: StoreContactAddress
  addresses: StoreContactAddress[]
  socialLinks: StoreContactLink[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function text(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

function httpUrl(value: unknown): string | undefined {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return undefined
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

function mapAddress(raw: unknown): StoreContactAddress | undefined {
  const rec = asRecord(raw)
  if (!rec) return undefined

  const address: StoreContactAddress = {}
  const fields = [
    ['address1', rec.address1],
    ['address2', rec.address2],
    ['locality', rec.locality],
    ['district', rec.district],
    ['city', rec.city],
    ['state', rec.state],
    ['country', rec.country],
    ['zipCode', rec.zipCode],
    ['latitude', rec.latitude],
    ['longitude', rec.longitude],
  ] as const

  for (const [key, value] of fields) {
    const cleaned = text(value)
    if (cleaned) address[key] = cleaned
  }

  return Object.keys(address).length ? address : undefined
}

function mapSocialLinks(raw: unknown): StoreContactLink[] {
  if (!Array.isArray(raw)) return []

  const drafts = raw.flatMap((item, index) => {
    const rec = asRecord(item)
    if (!rec) return []
    const url = httpUrl(rec.url)
    const platform = text(rec.platform)
    if (!url || !platform) return []
    const order = typeof rec.display_order === 'number' ? rec.display_order : index
    return [
      {
        id: text(rec.id) ?? `${platform}-${index}`,
        platform,
        url,
        order,
      },
    ]
  })

  drafts.sort((a, b) => a.order - b.order)
  return drafts.map((item) => ({
    id: item.id,
    platform: item.platform,
    url: item.url,
  }))
}

export function hasStoreContactContent(contact: StoreContact | null | undefined): boolean {
  if (!contact) return false
  return Boolean(
    contact.contactNumber ||
      contact.ownerName ||
      contact.storeIdentifier ||
      contact.mainAddress ||
      contact.addresses.length ||
      contact.socialLinks.length,
  )
}

export function mapStorefrontContact(raw: unknown): StoreContact | null {
  const rec = asRecord(raw)
  if (!rec) return null

  return {
    businessName: text(rec.business_name) ?? 'Store',
    storeIdentifier: text(rec.store_identifier),
    ownerName: text(rec.owner_name),
    contactNumber: text(rec.contact_number),
    mainAddress: mapAddress(rec.main_address),
    addresses: Array.isArray(rec.addresses)
      ? rec.addresses.map(mapAddress).filter((address): address is StoreContactAddress => Boolean(address))
      : [],
    socialLinks: mapSocialLinks(rec.social_links),
  }
}
