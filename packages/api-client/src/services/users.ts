import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../client/http';
import type { ApiEnvelope } from '../client/types';

/** User profile (tag 05) + user subscriptions (tag 03) */
export const usersService = {
  list: (params?: Record<string, unknown>) => apiGet<ApiEnvelope>('/v1/users/', { params }),
  get: (userId: number | string) => apiGet<ApiEnvelope>(`/v1/users/${userId}`),
  update: (userId: number | string, body: Record<string, unknown>) =>
    apiPut<ApiEnvelope>(`/v1/users/${userId}`, body),
  patchProfile: (userId: number | string, body: Record<string, unknown>) =>
    apiPatch<ApiEnvelope>(`/v1/users/${userId}`, body),
  updateMobile: (userId: number | string, body: Record<string, unknown>) =>
    apiPatch<ApiEnvelope>(`/v1/users/${userId}/mobile`, body),
  updateDeliveryInstructions: (userId: number | string, body: Record<string, unknown>) =>
    apiPatch<ApiEnvelope>(`/v1/users/${userId}/del_instructions`, body),
  deleteAddress: (userId: number | string, addressId: number | string) =>
    apiDelete<ApiEnvelope>(`/v1/users/${userId}/address/${addressId}`),
  dashboard: (userId: number | string) =>
    apiGet<ApiEnvelope>(`/v1/users/${userId}/dashboard`),
  getPreferences: (userId: number | string) =>
    apiGet<ApiEnvelope>(`/v1/users/preferences/${userId}`),
  updatePreferences: (userId: number | string, body: Record<string, unknown>) =>
    apiPatch<ApiEnvelope>(`/v1/users/preferences/${userId}`, body),

  listSubscriptions: (userId: number | string) =>
    apiGet<ApiEnvelope>(`/v1/users/${userId}/subs/`),
  createSubscription: (userId: number | string, body: Record<string, unknown>) =>
    apiPost<ApiEnvelope>(`/v1/users/${userId}/subs/`, body),
  updateSubscription: (
    userId: number | string,
    subId: number | string,
    body: Record<string, unknown>,
  ) => apiPatch<ApiEnvelope>(`/v1/users/${userId}/subs/${subId}`, body),
};
