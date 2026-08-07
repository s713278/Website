import type {
  ApiEnvelope,
  BusinessTypeDTO,
  CatalogPage,
  CategoryDTO,
  GetBusinessTypesQuery,
  GetCategoriesQuery,
} from '@mithra/api-client';
import { catalogService } from '@mithra/api-client';
import {
  BUSINESS_TYPE_PAGE_SIZE,
  BUSINESS_TYPES,
  categoriesForBusiness,
} from '@/features/onboarding/data/constants';
import { env } from '@/shared/lib/env';

export type OnboardingBusinessType = {
  id: number | string;
  label: string;
  icon: string;
};

export type OnboardingCategory = {
  id: number | string;
  name: string;
  businessTypeId?: number | string;
  imagePath?: string;
  description?: string;
};

export type CatalogResult<T> = {
  items: T[];
  total: number;
  lastPage: boolean;
  pageNumber: number;
  pageSize: number;
  /** True when local demo catalog was used (API off or request failed). */
  fromFallback: boolean;
};

function unwrapPage<T>(envelope: ApiEnvelope<CatalogPage<T>> | CatalogPage<T>): CatalogPage<T> {
  if (envelope && typeof envelope === 'object' && 'data' in envelope) {
    return (envelope.data || {}) as CatalogPage<T>;
  }
  return (envelope || {}) as CatalogPage<T>;
}

function asBusinessType(row: BusinessTypeDTO): OnboardingBusinessType | null {
  if (row.id == null || !row.type) return null;
  return {
    id: row.id,
    label: row.type,
    icon: row.icon || '✨',
  };
}

function asCategory(
  row: CategoryDTO & { business_type_id?: number; type?: string },
): OnboardingCategory | null {
  if (row.id == null || !row.name) return null;
  return {
    id: row.id,
    name: row.name,
    businessTypeId: row.business_type_id,
    imagePath: row.image_path,
    description: row.description,
  };
}

function localBusinessTypes(params?: GetBusinessTypesQuery): CatalogResult<OnboardingBusinessType> {
  const keyword = (params?.keyword || '').trim().toLowerCase();
  const pageNumber = params?.pageNumber ?? 0;
  const pageSize = params?.pageSize ?? BUSINESS_TYPE_PAGE_SIZE;
  const filtered = BUSINESS_TYPES.filter((b) => {
    if (!keyword) return true;
    const hay = `${b.label} ${b.keywords} ${b.id}`.toLowerCase();
    return hay.includes(keyword);
  });
  const start = pageNumber * pageSize;
  const slice = filtered.slice(start, start + pageSize);
  return {
    items: slice.map((b) => ({ id: b.id, label: b.label, icon: b.icon })),
    total: filtered.length,
    lastPage: start + pageSize >= filtered.length,
    pageNumber,
    pageSize,
    fromFallback: true,
  };
}

function localCategories(businessTypeKey: string): CatalogResult<OnboardingCategory> {
  const items = categoriesForBusiness(businessTypeKey).map((c) => ({
    id: c.id,
    name: c.name,
    businessTypeId: businessTypeKey,
  }));
  const fallback = items.length
    ? items
    : categoriesForBusiness('others').map((c) => ({
        id: c.id,
        name: c.name,
        businessTypeId: businessTypeKey || 'others',
      }));
  return {
    items: fallback,
    total: fallback.length,
    lastPage: true,
    pageNumber: 0,
    pageSize: fallback.length,
    fromFallback: true,
  };
}

async function fetchBusinessTypesFromApi(
  params?: GetBusinessTypesQuery,
): Promise<CatalogResult<OnboardingBusinessType>> {
  const pageNumber = params?.pageNumber ?? 0;
  const pageSize = params?.pageSize ?? BUSINESS_TYPE_PAGE_SIZE;
  const res = await catalogService.getBusinessTypes({
    pageNumber,
    pageSize,
    keyword: params?.keyword || undefined,
    sortBy: params?.sortBy ?? 'id',
    sortOrder: params?.sortOrder ?? 'asc',
  });
  const page = unwrapPage(res);
  const items = (page.result || [])
    .map(asBusinessType)
    .filter((x): x is OnboardingBusinessType => x != null);
  return {
    items,
    total: page.total_elements ?? items.length,
    lastPage: page.last_page ?? true,
    pageNumber: page.page_number ?? pageNumber,
    pageSize: page.page_size ?? pageSize,
    fromFallback: false,
  };
}

async function fetchCategoriesFromApi(
  params?: GetCategoriesQuery,
): Promise<CatalogResult<OnboardingCategory>> {
  const pageNumber = params?.pageNumber ?? 0;
  const pageSize = params?.pageSize ?? 48;
  const res = await catalogService.getCategories({
    pageNumber,
    pageSize,
    business_type_id: params?.business_type_id,
    sortBy: params?.sortBy,
    sortOrder: params?.sortOrder,
  });
  const page = unwrapPage(res);
  const items = (page.result || [])
    .map(asCategory)
    .filter((x): x is OnboardingCategory => x != null);
  return {
    items,
    total: page.total_elements ?? items.length,
    lastPage: page.last_page ?? true,
    pageNumber: page.page_number ?? pageNumber,
    pageSize: page.page_size ?? pageSize,
    fromFallback: false,
  };
}

/**
 * GET /v1/business-types/ — pageSize 9, sortBy=id, sortOrder=asc by default.
 * Falls back to local BUSINESS_TYPES when API is off or the request fails.
 */
export async function fetchOnboardingBusinessTypes(
  params?: GetBusinessTypesQuery,
): Promise<CatalogResult<OnboardingBusinessType>> {
  const query: GetBusinessTypesQuery = {
    pageNumber: params?.pageNumber ?? 0,
    pageSize: params?.pageSize ?? BUSINESS_TYPE_PAGE_SIZE,
    keyword: params?.keyword?.trim() || undefined,
    sortBy: params?.sortBy ?? 'id',
    sortOrder: params?.sortOrder ?? 'asc',
  };

  if (!env.useApi) return localBusinessTypes(query);

  try {
    return await fetchBusinessTypesFromApi(query);
  } catch {
    return localBusinessTypes(query);
  }
}

/**
 * Fetch + map categories.
 * `businessTypeKey` may be a numeric API id or a local slug (e.g. "dairy").
 */
export async function fetchOnboardingCategories(
  businessTypeKey: string,
  params?: Omit<GetCategoriesQuery, 'business_type_id'>,
): Promise<CatalogResult<OnboardingCategory>> {
  const numericId = Number(businessTypeKey);
  const isNumericId =
    Number.isFinite(numericId) &&
    numericId > 0 &&
    String(numericId) === String(businessTypeKey).trim();

  if (!env.useApi || !isNumericId) {
    return localCategories(businessTypeKey || 'others');
  }

  try {
    return await fetchCategoriesFromApi({
      ...params,
      business_type_id: numericId,
    });
  } catch {
    return localCategories(businessTypeKey);
  }
}
