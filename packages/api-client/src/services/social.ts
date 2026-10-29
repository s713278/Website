import { apiDelete, apiGet, apiPost } from '../client/http';
import type { ApiEnvelope } from '../client/types';

/** Social media integration (tag 17) */
export const socialService = {
  getAuthUrl: (platform: string, params?: Record<string, unknown>) =>
    apiGet<ApiEnvelope>(`/v1/social/${platform}/auth/url`, { params }),
  handleCallback: (platform: string, params?: Record<string, unknown>) =>
    apiGet<ApiEnvelope>(`/v1/social/${platform}/auth/callback`, { params }),
  getAccount: (platform: string, vendorId: number | string) =>
    apiGet<ApiEnvelope>(`/v1/social/${platform}/account/${vendorId}`),
  disconnect: (platform: string, vendorId: number | string) =>
    apiDelete<ApiEnvelope>(`/v1/social/${platform}/account/${vendorId}`),
  listAccounts: (vendorId: number | string) =>
    apiGet<ApiEnvelope>(`/v1/social/${vendorId}/accounts`),
  getProfile: (platform: string, vendorId: number | string) =>
    apiGet<ApiEnvelope>(`/v1/social/${platform}/profile/${vendorId}`),
  getMedia: (platform: string, vendorId: number | string) =>
    apiGet<ApiEnvelope>(`/v1/social/${platform}/media/${vendorId}`),
  getVideos: (platform: string, vendorId: number | string) =>
    apiGet<ApiEnvelope>(`/v1/social/${platform}/media/${vendorId}/videos`),
  triggerSync: (platform: string, vendorId: number | string) =>
    apiPost<ApiEnvelope>(`/v1/social/${platform}/sync/${vendorId}`),
};
