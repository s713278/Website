import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../client/http';
import type { ApiEnvelope } from '../client/types';

/** FAQs, measurements, SKU price (tag 12, 14) */
export const platformService = {
  listFaqs: () => apiGet<ApiEnvelope>('/v1/faqs', { skipAuth: true }),
  createFaq: (body: Record<string, unknown>) => apiPost<ApiEnvelope>('/v1/faqs', body),
  updateFaq: (id: number | string, body: Record<string, unknown>) =>
    apiPut<ApiEnvelope>(`/v1/faqs/${id}`, body),
  deleteFaq: (id: number | string) => apiDelete<ApiEnvelope>(`/v1/faqs/${id}`),
  faqsByAudience: (targetAudience: string) =>
    apiGet<ApiEnvelope>(`/v1/faqs/${encodeURIComponent(targetAudience)}`, { skipAuth: true }),

  listMeasurements: () => apiGet<ApiEnvelope>('/v1/measurements/', { skipAuth: true }),
  getMeasurement: (id: number | string) =>
    apiGet<ApiEnvelope>(`/v1/measurements/${id}`, { skipAuth: true }),

  getSkuPrice: (skuId: number | string) =>
    apiGet<ApiEnvelope>(`/v1/sku/price/${skuId}`, { skipAuth: true }),
  updateSkuPrice: (priceId: number | string, body: Record<string, unknown>) =>
    apiPut<ApiEnvelope>(`/v1/sku/price/${priceId}`, body),
};

export const imagesService = {
  list: (vendorId: number | string, params?: Record<string, unknown>) =>
    apiGet<ApiEnvelope>(`/v1/vendors/${vendorId}/images`, { params }),
  upload: (vendorId: number | string, body: FormData) =>
    apiPost<ApiEnvelope>(`/v1/vendors/${vendorId}/images`, body),
};

export const pricesService = {
  getSkuPrice: platformService.getSkuPrice,
  updateSkuPrice: platformService.updateSkuPrice,
};

export const courierService = {
  listActive: () => apiGet<ApiEnvelope>('/v1/courier-partners', { skipAuth: true }),
  getById: (id: number | string) =>
    apiGet<ApiEnvelope>(`/v1/courier-partners/${id}`, { skipAuth: true }),
  adminList: () => apiGet<ApiEnvelope>('/v1/admin/courier-partners'),
  adminCreate: (body: Record<string, unknown>) =>
    apiPost<ApiEnvelope>('/v1/admin/courier-partners', body),
  adminUpdate: (id: number | string, body: Record<string, unknown>) =>
    apiPut<ApiEnvelope>(`/v1/admin/courier-partners/${id}`, body),
  adminDelete: (id: number | string) =>
    apiDelete<ApiEnvelope>(`/v1/admin/courier-partners/${id}`),
  activate: (id: number | string) =>
    apiPatch<ApiEnvelope>(`/v1/admin/courier-partners/${id}/activate`),
  deactivate: (id: number | string) =>
    apiPatch<ApiEnvelope>(`/v1/admin/courier-partners/${id}/deactivate`),
};
