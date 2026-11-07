import { parseLocationParts } from '@/shared/api/mappers/storefront-order'

export type CheckoutAddressForm = {
  name: string
  contactNumber: string
  address1: string
  address2: string
  city: string
  district: string
  state: string
  zipCode: string
}
export const CHECKOUT_ADDRESS_MAP_ENABLED = false

const PLACEHOLDER_NAMES = new Set(['User', 'Vendor'])

function usableName(value?: string | null) {
  const name = value?.trim() ?? ''
  if (!name || PLACEHOLDER_NAMES.has(name)) return ''
  return name
}

function contactDigits(value?: string | null) {
  const raw = (value ?? '').replace(/\D/g, '')
  if (raw.length >= 10) return raw.slice(-10)
  return raw
}

function streetFromPin(location: string) {
  const parts = location
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  const placeParts = parts
    .map((part) => part.replace(/\b\d{6}\b/g, '').trim())
    .filter((part) => part && !/^india$/i.test(part))
  if (placeParts.length >= 3) {
    const street = placeParts.slice(0, -2)
    return {
      address1: street.join(', '),
      address2: '',
    }
  }
  return { address1: location.trim(), address2: '' }
}

function looksLikeFullAddress(value: string) {
  return /\b\d{6}\b/.test(value) || /,\s*[^,]+,\s*[^,]+/.test(value)
}

export function checkoutAddressFormFromPin(input: {
  userName?: string | null
  userPhone?: string | null
  location: string
  city?: string | null
  state?: string | null
  zipCode?: string | null
  recipientName?: string | null
  contactNumber?: string | null
  address1?: string | null
  address2?: string | null
  district?: string | null
}): CheckoutAddressForm {
  const location = input.location.trim()
  const savedStreet = [input.address1?.trim(), input.address2?.trim()].filter(Boolean).join(', ')
  const parsed = parseLocationParts(savedStreet || location)

  const city = input.city?.trim() || parsed.city || ''
  const state = input.state?.trim() || parsed.state || ''
  const zipCode = (input.zipCode?.replace(/\D/g, '') || parsed.zipCode || '').slice(0, 6)
  const district = input.district?.trim() ?? ''

  // Prefer structured street. If the only saved line is a full Google-style label,
  // or city/ZIP are still missing, split so City / State / ZIP are not left blank.
  const shouldSplit =
    (!savedStreet && Boolean(location)) ||
    (!city && Boolean(savedStreet || location)) ||
    (!zipCode && Boolean(savedStreet || location)) ||
    (Boolean(savedStreet) && looksLikeFullAddress(savedStreet) && (!city || !zipCode || !state))

  const street = shouldSplit
    ? streetFromPin(savedStreet || location)
    : { address1: savedStreet || streetFromPin(location).address1, address2: '' }

  return {
    name: usableName(input.recipientName) || usableName(input.userName),
    contactNumber: contactDigits(input.contactNumber) || contactDigits(input.userPhone),
    address1: street.address1,
    address2: street.address2,
    city,
    district,
    state,
    zipCode,
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/** Name from GET /v1/users/{id}. Ignores the placeholder session names. */
export function customerNameFromProfile(payload: unknown) {
  const root = asRecord(payload)
  const data = asRecord(root?.data) ?? root
  const raw = data?.name ?? data?.user_name ?? data?.full_name
  const name = typeof raw === 'string' ? raw.trim() : ''
  if (!name || PLACEHOLDER_NAMES.has(name)) return ''
  return name
}

/** One validation message at a time, in field order. */
export function checkoutAddressError(
  form: CheckoutAddressForm,
  options?: { mapEnabled?: boolean; mapPinned?: boolean },
) {
  if (!form.name.trim()) return 'Enter the name for this delivery.'
  if (!/^\d{10}$/.test(form.contactNumber.trim())) return 'Enter a 10-digit phone number.'
  if (!form.address1.trim()) return 'Enter the address.'
  if (!form.city.trim()) return 'Enter the city.'
  if (!form.district.trim()) return 'Enter the district.'
  if (!form.state.trim()) return 'Enter the state.'
  if (!/^\d{6}$/.test(form.zipCode.trim())) return 'Enter a 6-digit ZIP code.'
  if (options?.mapEnabled && !options.mapPinned) return 'Pin this address on Google Map.'
  return ''
}

export function isCheckoutAddressComplete(
  form: CheckoutAddressForm,
  options?: { mapEnabled?: boolean; mapPinned?: boolean },
) {
  return checkoutAddressError(form, options) === ''
}

/** One line the shop and WhatsApp message can show after the form is saved. */
export function formatCheckoutAddress(form: CheckoutAddressForm) {
  const street = [form.address1.trim(), form.address2.trim()].filter(Boolean).join(', ')
  const area = [form.city.trim(), form.district.trim(), form.state.trim()].filter(Boolean).join(', ')
  const pin = form.zipCode.trim()
  return [street, [area, pin].filter(Boolean).join(' ')].filter(Boolean).join(', ')
}
