import { useQuery } from '@tanstack/react-query';
import type { GetBusinessTypesQuery, GetCategoriesQuery } from '@mithra/api-client';
import {
  fetchOnboardingBusinessTypes,
  fetchOnboardingCategories,
} from '@/features/onboarding/api/catalog';
import { queryKeys } from '@/shared/api/query-keys';

export function useOnboardingBusinessTypes(params?: GetBusinessTypesQuery) {
  const query: GetBusinessTypesQuery = {
    pageNumber: params?.pageNumber ?? 0,
    pageSize: params?.pageSize ?? 24,
    keyword: params?.keyword?.trim() || undefined,
  };

  return useQuery({
    queryKey: queryKeys.catalog.businessTypes(query),
    queryFn: () => fetchOnboardingBusinessTypes(query),
  });
}

export function useOnboardingCategories(
  businessTypeId: number | null | undefined,
  params?: Omit<GetCategoriesQuery, 'business_type_id'>,
) {
  const query: GetCategoriesQuery = {
    pageNumber: params?.pageNumber ?? 0,
    pageSize: params?.pageSize ?? 48,
    business_type_id: businessTypeId ?? undefined,
  };

  return useQuery({
    queryKey: queryKeys.catalog.categories(query),
    queryFn: () => fetchOnboardingCategories(query),
    enabled: businessTypeId != null && businessTypeId > 0,
  });
}
