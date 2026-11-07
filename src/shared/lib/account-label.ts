import type { User } from '@/shared/types'

/** What `sessionDisplayName` puts in `user.name` when the API has no usable name. */
const PLACEHOLDER_NAMES = new Set(['User', 'Vendor'])

/**
 * The account menu's label: the selected store's name for a vendor session, the real API
 * name for a customer, otherwise nothing. Never a role placeholder or a phone number.
 */
export function accountLabel(user: User): string {
  if (user.role === 'vendor') {
    return user.vendors.find((vendor) => vendor.vendorId === user.vendorId)?.name?.trim() ?? ''
  }
  const name = user.name.trim()
  return PLACEHOLDER_NAMES.has(name) ? '' : name
}
