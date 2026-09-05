import { apiDelete, apiGet, apiPost, apiPut } from '../client/http';
import type { ApiEnvelope } from '../client/types';

/** Multi-item cart (tag 06) */
export const cartService = {
  get: (vendorId: number | string) => apiGet<ApiEnvelope>(`/v1/vendors/${vendorId}/cart`),
  clear: (vendorId: number | string) => apiDelete<ApiEnvelope>(`/v1/vendors/${vendorId}/cart`),
  addItem: (vendorId: number | string, body: Record<string, unknown>) =>
    apiPost<ApiEnvelope>(`/v1/vendors/${vendorId}/cart/items`, body),
  upsertItem: (vendorId: number | string, body: Record<string, unknown>) =>
    apiPut<ApiEnvelope>(`/v1/vendors/${vendorId}/cart/items`, body),
  updateItemQty: (
    vendorId: number | string,
    cartItemId: number | string,
    body: Record<string, unknown>,
  ) => apiPut<ApiEnvelope>(`/v1/vendors/${vendorId}/cart/items/${cartItemId}`, body),
  removeItem: (vendorId: number | string, cartItemId: number | string) =>
    apiDelete<ApiEnvelope>(`/v1/vendors/${vendorId}/cart/items/${cartItemId}`),
};
