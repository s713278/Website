import type { components, operations } from './schema';

/** OpenAPI schema aliases — prefer these over hand-rolled DTOs. */
export type ApiResponseObject = components['schemas']['APIResponseObject'];
export type CategoryDTO = components['schemas']['CategoryDTO'];
export type MobileSignUpRequest = components['schemas']['MobileSignUpRequest'];
export type OTPVerificationRequest = components['schemas']['OTPVerificationRequest'];
export type RefreshTokenRequest = components['schemas']['RefreshTokenRequest'];

export type GetBusinessTypesQuery = NonNullable<
  operations['getBusinessTypes']['parameters']['query']
>;
export type GetCategoriesQuery = NonNullable<operations['getCategories']['parameters']['query']>;

/** Paginated payload used by catalog list endpoints (data envelope). */
export type CatalogPage<T> = {
  result?: T[];
  page_number?: number;
  page_size?: number;
  total_elements?: number;
  total_pages?: number;
  last_page?: boolean;
};

/**
 * Business-type row from GET /v1/business-types/.
 * OpenAPI returns APIResponseObject; fields match the live contract.
 */
export type BusinessTypeDTO = {
  id?: number;
  type?: string;
  icon?: string;
  display_order?: number;
};
