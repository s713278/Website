import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "../client/http";
import type { ApiEnvelope, RequestConfig } from "../client/types";
import type { operations } from "../schema";

export type BusinessTypeQuery = NonNullable<
    operations["getBusinessTypes"]["parameters"]["query"]
>;
export type CategoryQuery = NonNullable<
    operations["getCategories"]["parameters"]["query"]
>;
export type ProductsByCategoryQuery = NonNullable<
    operations["getProductsByCategory"]["parameters"]["query"]
>;

export type PublicCatalogRequestConfig = Pick<RequestConfig, "signal">;

/** Platform catalog (tag 11) */
export const catalogService = {
    getBusinessTypes: (
        params: BusinessTypeQuery = {},
        config: PublicCatalogRequestConfig = {},
    ) =>
        apiGet<ApiEnvelope>("/v1/business-types/", {
            ...config,
            params,
            skipAuth: true,
        }),
    getCategories: (
        params: CategoryQuery = {},
        config: PublicCatalogRequestConfig = {},
    ) =>
        apiGet<ApiEnvelope>("/v1/categories/", {
            ...config,
            params,
            skipAuth: true,
        }),
    getCategoriesGrouped: () =>
        apiGet<ApiEnvelope>("/v1/categories/grouped", { skipAuth: true }),
    createCategory: (body: Record<string, unknown>) =>
        apiPost<ApiEnvelope>("/v1/categories/", body),
    getCategory: (categoryId: number | string) =>
        apiGet<ApiEnvelope>(`/v1/categories/${categoryId}`, { skipAuth: true }),
    updateCategory: (
        categoryId: number | string,
        body: Record<string, unknown>,
    ) => apiPatch<ApiEnvelope>(`/v1/categories/${categoryId}`, body),
    deleteCategory: (categoryId: number | string) =>
        apiDelete<ApiEnvelope>(`/v1/categories/${categoryId}`),

    getProductsByCategory: (
        categoryId: number | string,
        params: ProductsByCategoryQuery = {},
        config: PublicCatalogRequestConfig = {},
    ) =>
        apiGet<ApiEnvelope>(`/v1/categories/${categoryId}/products`, {
            ...config,
            params,
            skipAuth: true,
        }),
    searchProducts: (
        categoryId: number | string,
        params?: Record<string, unknown>,
    ) =>
        apiGet<ApiEnvelope>(`/v1/categories/${categoryId}/products/search`, {
            skipAuth: true,
            params,
        }),
    addProduct: (categoryId: number | string, body: Record<string, unknown>) =>
        apiPost<ApiEnvelope>(`/v1/categories/${categoryId}/products/`, body),
    getProduct: (categoryId: number | string, productId: number | string) =>
        apiGet<ApiEnvelope>(
            `/v1/categories/${categoryId}/products/${productId}`,
            { skipAuth: true },
        ),
    updateProduct: (
        categoryId: number | string,
        productId: number | string,
        body: Record<string, unknown>,
    ) =>
        apiPatch<ApiEnvelope>(
            `/v1/categories/${categoryId}/products/${productId}`,
            body,
        ),
    deleteProduct: (categoryId: number | string, productId: number | string) =>
        apiDelete<ApiEnvelope>(
            `/v1/categories/${categoryId}/products/${productId}`,
        ),
    updateProductImage: (
        categoryId: number | string,
        productId: number | string,
        body: unknown,
    ) =>
        apiPut<ApiEnvelope>(
            `/v1/categories/${categoryId}/products/${productId}/image`,
            body,
        ),
};
