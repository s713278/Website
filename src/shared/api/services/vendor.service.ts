import type { VendorInsights, VendorStoreProfile } from '@/modules/vendor/types/dashboard'
import { apiGet } from '../client'
import { demoVendorInsights, demoVendorStoreProfile } from '../fixtures/vendor-dashboard'
import { mapVendorInsights, mapVendorStoreProfile } from '../mappers/vendor-dashboard'
import { isLiveApi } from '../mode'
import { demoDelay } from './demo-delay'

/**
 * Vendor-level insights.
 *
 * Keyed on the **user** id, not the vendor id — despite serving vendor figures, the path
 * is `/v1/users/{user_id}/dashboard`, and passing a vendor id returns 403 (verified).
 * `user.id` in the auth store already holds the backend's `user_id`.
 *
 * The response omits empty groups rather than zeroing them, which is why it goes through
 * a mapper instead of being read field by field.
 */
export async function getVendorInsights(userId: string | number): Promise<VendorInsights> {
  if (!isLiveApi()) {
    await demoDelay()
    return mapVendorInsights(demoVendorInsights())
  }
  return mapVendorInsights(await apiGet(`/v1/users/${userId}/dashboard`))
}

/**
 * The vendor's own store details, for Settings.
 *
 * Read-only here only because the editor is not built yet. `PUT /v1/vendors/{id}` works —
 * verified on both a gone-live store and a never-submitted one, for the business name,
 * contact fields and the structured address. The earlier claim that it failed for every
 * body shape was measured against a malformed request.
 *
 * Two behaviors the editor has to be written around: the write is a **partial merge that
 * silently ignores explicit `null`**, so no field can be cleared, and `assign_categories`
 * is declared required but is not enforced. The success message sits at `data.data`.
 */
export async function getVendorStoreProfile(
  vendorId: string | number,
): Promise<VendorStoreProfile> {
  if (!isLiveApi()) {
    await demoDelay()
    return mapVendorStoreProfile(demoVendorStoreProfile(vendorId))
  }
  return mapVendorStoreProfile(await apiGet(`/v1/vendors/${vendorId}`))
}

export const vendorService = {
  getInsights: getVendorInsights,
  getStoreProfile: getVendorStoreProfile,
}
