import type {
  ApiEnvelope,
  BusinessTypeDTO,
  CatalogPage,
  CategoryDTO,
  GetBusinessTypesQuery,
  GetCategoriesQuery,
} from '@mithra/api-client';
import { catalogService } from '@mithra/api-client';

export type OnboardingBusinessType = {
  id: number;
  label: string;
  icon: string;
};

export type OnboardingCategory = {
  id: number;
  name: string;
  businessTypeId?: number;
  imagePath?: string;
  description?: string;
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

/** Fetch + map business types (OpenAPI getBusinessTypes). */
export async function fetchOnboardingBusinessTypes(
  params?: GetBusinessTypesQuery,
): Promise<{ items: OnboardingBusinessType[]; total: number; lastPage: boolean }> {
  const res = await catalogService.getBusinessTypes({
    pageNumber: params?.pageNumber ?? 0,
    pageSize: params?.pageSize ?? 24,
    keyword: params?.keyword || undefined,
    sortBy: params?.sortBy,
    sortOrder: params?.sortOrder,
  });
  const page = unwrapPage(res);
  const items = (page.result || [])
    .map(asBusinessType)
    .filter((x): x is OnboardingBusinessType => x != null);
  return {
    items,
    total: page.total_elements ?? items.length,
    lastPage: page.last_page ?? true,
  };
}

/** Fetch + map categories (OpenAPI getCategories / CategoryDTO). */
export async function fetchOnboardingCategories(
  params?: GetCategoriesQuery,
): Promise<{ items: OnboardingCategory[]; total: number; lastPage: boolean }> {
  const res = await catalogService.getCategories({
    pageNumber: params?.pageNumber ?? 0,
    pageSize: params?.pageSize ?? 48,
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
  };
}
