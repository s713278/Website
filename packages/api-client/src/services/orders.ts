import { apiGet, apiPatch, apiPost } from '../client/http';
import type { ApiEnvelope } from '../client/types';

/** Orders — customer (04), vendor (09), generic (15) */
export const ordersService = {
  create: (body: Record<string, unknown>) => apiPost<ApiEnvelope>('/v1/orders', body),
  createFromCart: (body: Record<string, unknown>) =>
    apiPost<ApiEnvelope>('/v1/orders/from-cart', body),
  get: (orderId: number | string) => apiGet<ApiEnvelope>(`/v1/orders/${orderId}`),
  update: (orderId: number | string, body: Record<string, unknown>) =>
    apiPatch<ApiEnvelope>(`/v1/orders/${orderId}`, body),

  placeForVendor: (vendorId: number | string, body: Record<string, unknown>) =>
    apiPost<ApiEnvelope>(`/v1/vendors/${vendorId}/orders/`, body),
  listByVendor: (vendorId: number | string, params?: Record<string, unknown>) =>
    apiGet<ApiEnvelope>(`/v1/vendors/${vendorId}/orders/`, { params }),
  getByVendor: (vendorId: number | string, orderId: number | string) =>
    apiGet<ApiEnvelope>(`/v1/vendors/${vendorId}/orders/${orderId}`),
  updateByVendor: (
    vendorId: number | string,
    orderId: number | string,
    body: Record<string, unknown>,
  ) => apiPatch<ApiEnvelope>(`/v1/vendors/${vendorId}/orders/${orderId}`, body),
  cancel: (vendorId: number | string, orderId: number | string, body?: Record<string, unknown>) =>
    apiPatch<ApiEnvelope>(`/v1/vendors/${vendorId}/orders/${orderId}/cancel`, body),
  getItems: (vendorId: number | string, orderId: number | string) =>
    apiGet<ApiEnvelope>(`/v1/vendors/${vendorId}/orders/${orderId}/items`),
  addTracking: (
    vendorId: number | string,
    orderId: number | string,
    body: Record<string, unknown>,
  ) => apiPost<ApiEnvelope>(`/v1/vendors/${vendorId}/orders/${orderId}/tracking`, body),
  bulkStatusUpdate: (vendorId: number | string, body: Record<string, unknown>) =>
    apiPost<ApiEnvelope>(`/v1/vendors/${vendorId}/orders/bulk-status-update`, body),

  userHistory: (userId: number | string, params?: Record<string, unknown>) =>
    apiGet<ApiEnvelope>(`/v1/users/${userId}/orders/history`, { params }),
  userHistoryPaged: (userId: number | string, params?: Record<string, unknown>) =>
    apiGet<ApiEnvelope>(`/v1/users/${userId}/orders/history/paged`, { params }),
  userOrderDetail: (userId: number | string, orderId: number | string) =>
    apiGet<ApiEnvelope>(`/v1/users/${userId}/orders/${orderId}`),
};
