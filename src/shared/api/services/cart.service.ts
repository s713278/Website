import { apiDelete, apiGet, apiPost, apiPut } from '../client'
import { isLiveApi } from '../mode'
import type { ApiEnvelope } from '../types'

/** Remote cart sync — local Zustand remains source of truth in demo mode. */
export const cartService = {
  async get(vendorId: string | number) {
    if (!isLiveApi()) return { items: [] }
    return apiGet<ApiEnvelope>(`/v1/vendors/${vendorId}/cart`)
  },

  async clear(vendorId: string | number) {
    if (!isLiveApi()) return { success: true }
    return apiDelete<ApiEnvelope>(`/v1/vendors/${vendorId}/cart`)
  },

  async addItem(vendorId: string | number, body: Record<string, unknown>) {
    if (!isLiveApi()) return { success: true, data: body }
    return apiPost<ApiEnvelope>(`/v1/vendors/${vendorId}/cart/items`, body)
  },

  async upsertItem(vendorId: string | number, body: Record<string, unknown>) {
    if (!isLiveApi()) return { success: true, data: body }
    return apiPut<ApiEnvelope>(`/v1/vendors/${vendorId}/cart/items`, body)
  },

  async updateItemQty(
    vendorId: string | number,
    cartItemId: string | number,
    body: Record<string, unknown>,
  ) {
    if (!isLiveApi()) return { success: true, data: body }
    return apiPut<ApiEnvelope>(`/v1/vendors/${vendorId}/cart/items/${cartItemId}`, body)
  },

  async removeItem(vendorId: string | number, cartItemId: string | number) {
    if (!isLiveApi()) return { success: true }
    return apiDelete<ApiEnvelope>(`/v1/vendors/${vendorId}/cart/items/${cartItemId}`)
  },
}
