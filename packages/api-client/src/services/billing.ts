import { apiGet, apiPost } from '../client/http';
import type { ApiEnvelope, RequestConfig } from '../client/types';
import type { components } from '../schema';

/** Vendor billing (tag 21) + paid platform plans. Responses are the generic envelope. */
export const vendorBillingService = {
  getSubscription: (vendorId: number | string, config?: Pick<RequestConfig, 'signal'>) =>
    apiGet<ApiEnvelope>(`/v1/vendors/${vendorId}/subscription`, config),
  subscribe: (
    vendorId: number | string,
    body: components['schemas']['VendorSubscriptionSubscribeRequest'],
  ) => apiPost<ApiEnvelope>(`/v1/vendors/${vendorId}/subscription`, body),
  confirm: (
    vendorId: number | string,
    body: components['schemas']['VendorSubscriptionConfirmRequest'],
  ) => apiPost<ApiEnvelope>(`/v1/vendors/${vendorId}/subscription/confirm`, body),
  cancel: (vendorId: number | string) =>
    apiPost<ApiEnvelope>(`/v1/vendors/${vendorId}/subscription/cancel`),
  getHistory: (vendorId: number | string, config?: Pick<RequestConfig, 'signal'>) =>
    apiGet<ApiEnvelope>(`/v1/vendors/${vendorId}/subscription/history`, config),
  listPaidPlans: (config?: Pick<RequestConfig, 'signal'>) =>
    apiGet<ApiEnvelope>('/v1/subscription-plans', config),
};
