import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../client/http';
import type { ApiEnvelope } from '../client/types';

/** Platform catalog (tag 11) */
export const catalogService = {
  getBusinessTypes: () => apiGet<ApiEnvelope>('/v1/business-types/', { skipAuth: true }),
  getCategories: () => apiGet<ApiEnvelope>('/v1/categories/', { skipAuth: true }),
  getCategoriesGrouped: () => apiGet<ApiEnvelope>('/v1/categories/grouped', { skipAuth: true }),
  createCategory: (body: Record<string, unknown>) => apiPost<ApiEnvelope>('/v1/categories/', body),
  getCategory: (categoryId: number | string) =>
    apiGet<ApiEnvelope>(`/v1/categories/${categoryId}`, { skipAuth: true }),
  updateCategory: (categoryId: number | string, body: Record<string, unknown>) =>
    apiPatch<ApiEnvelope>(`/v1/categories/${categoryId}`, body),
  deleteCategory: (categoryId: number | string) =>
    apiDelete<ApiEnvelope>(`/v1/categories/${categoryId}`),

  getProductsByCategory: (categoryId: number | string) =>
    apiGet<ApiEnvelope>(`/v1/categories/${categoryId}/products`, { skipAuth: true }),
  searchProducts: (categoryId: number | string, params?: Record<string, unknown>) =>
    apiGet<ApiEnvelope>(`/v1/categories/${categoryId}/products/search`, {
      skipAuth: true,
      params,
    }),
  addProduct: (categoryId: number | string, body: Record<string, unknown>) =>
    apiPost<ApiEnvelope>(`/v1/categories/${categoryId}/products/`, body),
  getProduct: (categoryId: number | string, productId: number | string) =>
    apiGet<ApiEnvelope>(`/v1/categories/${categoryId}/products/${productId}`, { skipAuth: true }),
  updateProduct: (
    categoryId: number | string,
    productId: number | string,
    body: Record<string, unknown>,
  ) => apiPatch<ApiEnvelope>(`/v1/categories/${categoryId}/products/${productId}`, body),
  deleteProduct: (categoryId: number | string, productId: number | string) =>
    apiDelete<ApiEnvelope>(`/v1/categories/${categoryId}/products/${productId}`),
  updateProductImage: (
    categoryId: number | string,
    productId: number | string,
    body: unknown,
  ) => apiPut<ApiEnvelope>(`/v1/categories/${categoryId}/products/${productId}/image`, body),
};
