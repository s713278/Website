import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../client/http';
import type { ApiEnvelope, RequestConfig } from '../client/types';
import type { components } from '../schema';

/** Vendor profile + catalog assignment (tag 07) + public listing (tag 02) */
export const vendorsService = {
  list: () => apiGet<ApiEnvelope>('/v1/vendors/'),
  create: (body: Record<string, unknown>) => apiPost<ApiEnvelope>('/v1/vendors/', body),
  getById: (vendorId: number | string) => apiGet<ApiEnvelope>(`/v1/vendors/${vendorId}`),
  update: (vendorId: number | string, body: Record<string, unknown>) =>
    apiPut<ApiEnvelope>(`/v1/vendors/${vendorId}`, body),
  getByMobile: (params?: Record<string, unknown>) =>
    apiGet<ApiEnvelope>('/v1/vendors/search', { params }),
  patchStatus: (vendorId: number | string, body: Record<string, unknown>) =>
    apiPatch<ApiEnvelope>(`/v1/vendors/${vendorId}/vendor_status`, body),
  patchApproval: (vendorId: number | string, body: Record<string, unknown>) =>
    apiPatch<ApiEnvelope>(`/v1/vendors/${vendorId}/approval_status`, body),
  addLegalDetails: (vendorId: number | string, body: Record<string, unknown>) =>
    apiPatch<ApiEnvelope>(`/v1/vendors/${vendorId}/legal_details`, body),

  updateBusinessType: (
    vendorId: number | string,
    body: components['schemas']['VendorBusinessTypeRequest'],
  ) => apiPatch<ApiEnvelope>(`/v1/vendors/${vendorId}/business-type`, body),
  getContext: (vendorId: number | string, config?: Pick<RequestConfig, 'signal'>) =>
    apiGet<ApiEnvelope>(`/v1/vendors/${vendorId}/context`, config),
  saveStorefront: (
    vendorId: number | string,
    body: components['schemas']['SaveStorefrontConfigRequest'],
  ) => apiPut<ApiEnvelope>(`/v1/vendors/${vendorId}/storefront`, body),
  goLive: (vendorId: number | string) =>
    apiPost<ApiEnvelope>(`/v1/vendors/${vendorId}/go-live`),

  getCheckoutOptions: (vendorId: number | string) =>
    apiGet<ApiEnvelope>(`/v1/vendors/${vendorId}/checkout_options`),
  saveCheckoutOptions: (
    vendorId: number | string,
    body: components['schemas']['SaveVendorDeliveryConfigRequest'],
  ) => apiPut<ApiEnvelope>(`/v1/vendors/${vendorId}/checkout_options`, body),

  getProducts: (vendorId: number | string, config?: Pick<RequestConfig, 'signal'>) =>
    apiGet<ApiEnvelope>(`/v1/vendors/${vendorId}/products`, { ...config, skipAuth: true }),
  getProductSkus: (vendorId: number | string, config?: Pick<RequestConfig, 'signal'>) =>
    apiGet<ApiEnvelope>(`/v1/vendors/${vendorId}/products/skus`, { ...config, skipAuth: true }),
  searchSkus: (vendorId: number | string, q?: string) =>
    apiGet<ApiEnvelope>(`/v1/vendors/${vendorId}/skus/search`, {
      skipAuth: true,
      params: q ? { q } : undefined,
    }),
  getProduct: (vendorId: number | string, productId: number | string) =>
    apiGet<ApiEnvelope>(`/v1/vendors/${vendorId}/products/${productId}`),
  updateProduct: (vendorId: number | string, productId: number | string, body: Record<string, unknown>) =>
    apiPatch<ApiEnvelope>(`/v1/vendors/${vendorId}/products/${productId}`, body),
  assignProducts: (
    vendorId: number | string,
    body: components['schemas']['AssignProductsRequest'],
  ) => apiPatch<ApiEnvelope>(`/v1/vendors/${vendorId}/assign/products`, body),
  unassignProducts: (vendorId: number | string, body: Record<string, unknown>) =>
    apiPatch<ApiEnvelope>(`/v1/vendors/${vendorId}/delete/products`, body),

  createSku: (
    vendorId: number | string,
    body: components['schemas']['ItemSkuCreateRequest'],
  ) => apiPost<ApiEnvelope>(`/v1/vendors/${vendorId}/skus`, body),
  getSku: (vendorId: number | string, skuId: number | string) =>
    apiGet<ApiEnvelope>(`/v1/vendors/${vendorId}/skus/${skuId}`),
  updateSku: (vendorId: number | string, skuId: number | string, body: Record<string, unknown>) =>
    apiPatch<ApiEnvelope>(`/v1/vendors/${vendorId}/skus/${skuId}`, body),
  deleteSku: (vendorId: number | string, skuId: number | string) =>
    apiDelete<ApiEnvelope>(`/v1/vendors/${vendorId}/skus/${skuId}`),

  getCategories: (vendorId: number | string, config?: Pick<RequestConfig, 'signal'>) =>
    apiGet<ApiEnvelope>(`/v1/vendors/${vendorId}/categories`, config),
  assignCategories: (
    vendorId: number | string,
    body: components['schemas']['AssignCategoriesRequest'],
  ) => apiPatch<ApiEnvelope>(`/v1/vendors/${vendorId}/categories`, body),

  getServiceArea: (vendorId: number | string) =>
    apiGet<ApiEnvelope>(`/v1/vendors/${vendorId}/geo/service_area`),
  updateServiceArea: (vendorId: number | string, body: Record<string, unknown>) =>
    apiPatch<ApiEnvelope>(`/v1/vendors/${vendorId}/geo/service_area`, body),

  getCustomers: (vendorId: number | string) =>
    apiGet<ApiEnvelope>(`/v1/vendors/${vendorId}/customers`),
  createCustomers: (vendorId: number | string, body: unknown) =>
    apiPost<ApiEnvelope>(`/v1/vendors/${vendorId}/customers`, body),
  inviteCustomer: (vendorId: number | string, body: Record<string, unknown>) =>
    apiPost<ApiEnvelope>(`/v1/vendors/${vendorId}/customers/invite`, body),

  searchByServiceArea: (serviceArea: string) =>
    apiGet<ApiEnvelope>(`/v1/vendors/search/${encodeURIComponent(serviceArea)}`, { skipAuth: true }),
  searchByKeyword: (params?: Record<string, unknown>) =>
    apiGet<ApiEnvelope>('/v1/vendors/search/keyword', { skipAuth: true, params }),
  categoriesByZip: (params?: Record<string, unknown>) =>
    apiGet<ApiEnvelope>('/v1/vendors/categories', { skipAuth: true, params }),
  home: (params?: Record<string, unknown>) =>
    apiGet<ApiEnvelope>('/v1/home', { skipAuth: true, params }),
};
