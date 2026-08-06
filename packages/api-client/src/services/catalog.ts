import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../client/http';
import type { ApiEnvelope } from '../client/types';
import type {
  ApiResponseObject,
  CatalogPage,
  CategoryDTO,
  GetBusinessTypesQuery,
  GetCategoriesQuery,
  BusinessTypeDTO,
} from '../schema-types';

function asEnvelope<T>(res: ApiEnvelope<T> | ApiResponseObject): ApiEnvelope<T> {
  return res as ApiEnvelope<T>;
}

/** Platform catalog (OpenAPI tag 11) */
export const catalogService = {
  getBusinessTypes: (params?: GetBusinessTypesQuery) =>
    apiGet<ApiEnvelope<CatalogPage<BusinessTypeDTO>>>('/v1/business-types/', {
      skipAuth: true,
      params,
    }).then((res) => asEnvelope<CatalogPage<BusinessTypeDTO>>(res)),

  getCategories: (params?: GetCategoriesQuery) =>
    apiGet<ApiEnvelope<CatalogPage<CategoryDTO & { business_type_id?: number; type?: string }>>>(
      '/v1/categories/',
      { skipAuth: true, params },
    ),

  getCategoriesGrouped: () =>
    apiGet<ApiEnvelope>('/v1/categories/grouped', { skipAuth: true }),

  createCategory: (body: CategoryDTO) => apiPost<ApiEnvelope>('/v1/categories/', body),

  getCategory: (categoryId: number | string) =>
    apiGet<ApiEnvelope<CategoryDTO>>(`/v1/categories/${categoryId}`, { skipAuth: true }),

  updateCategory: (categoryId: number | string, body: CategoryDTO) =>
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
