import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../client/http';
import type { ApiEnvelope } from '../client/types';

/** Vendor subscriptions (08) + SKU plans (10) + platform subscription plans */
export const subscriptionsService = {
  listByVendor: (vendorId: number | string) =>
    apiGet<ApiEnvelope>(`/v1/vendors/${vendorId}/subs`),
  createOnBehalf: (vendorId: number | string, body: Record<string, unknown>) =>
    apiPost<ApiEnvelope>(`/v1/vendors/${vendorId}/subs`, body),
  getById: (vendorId: number | string, subId: number | string) =>
    apiGet<ApiEnvelope>(`/v1/vendors/${vendorId}/subs/${subId}`),
  getByUserAndVendor: (vendorId: number | string, userId: number | string) =>
    apiGet<ApiEnvelope>(`/v1/vendors/${vendorId}/users/${userId}`),
  updateStatus: (
    userId: number | string,
    subId: number | string,
    body: Record<string, unknown>,
  ) => apiPatch<ApiEnvelope>(`/v1/vendors/users/${userId}/subs/${subId}`, body),

  listSkuPlans: (vendorId: number | string, skuId: number | string) =>
    apiGet<ApiEnvelope>(`/v1/vendors/${vendorId}/skus/${skuId}/subscription-plans`),
  addSkuPlan: (vendorId: number | string, skuId: number | string, body: Record<string, unknown>) =>
    apiPost<ApiEnvelope>(`/v1/vendors/${vendorId}/skus/${skuId}/subscription-plans`, body),
  removeSkuPlan: (vendorId: number | string, skuId: number | string, id: number | string) =>
    apiDelete<ApiEnvelope>(`/v1/vendors/${vendorId}/skus/${skuId}/subscription-plans/${id}`),

  listPlans: () => apiGet<ApiEnvelope>('/v1/api/subscription-plans'),
  createPlan: (body: Record<string, unknown>) =>
    apiPost<ApiEnvelope>('/v1/api/subscription-plans', body),
  getPlan: (id: number | string) => apiGet<ApiEnvelope>(`/v1/api/subscription-plans/${id}`),
  updatePlan: (id: number | string, body: Record<string, unknown>) =>
    apiPut<ApiEnvelope>(`/v1/api/subscription-plans/${id}`, body),
};
