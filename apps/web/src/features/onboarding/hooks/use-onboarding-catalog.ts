import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { GetCategoriesQuery } from '@mithra/api-client';
import {
  fetchOnboardingBusinessTypes,
  fetchOnboardingCategories,
} from '@/features/onboarding/api/catalog';
import { BUSINESS_TYPE_PAGE_SIZE } from '@/features/onboarding/data/constants';
import { queryKeys } from '@/shared/api/query-keys';

type BusinessTypesFilters = {
  keyword?: string;
  pageSize?: number;
};

/**
 * Paginated business types — GET /v1/business-types/
 * pageSize=9, sortBy=id, sortOrder=asc. Call fetchNextPage when hasNextPage.
 */
export function useOnboardingBusinessTypes(filters?: BusinessTypesFilters) {
  const keyword = filters?.keyword?.trim() || undefined;
  const pageSize = filters?.pageSize ?? BUSINESS_TYPE_PAGE_SIZE;

  return useInfiniteQuery({
    queryKey: queryKeys.catalog.businessTypes({
      keyword,
      pageSize,
      sortBy: 'id',
      sortOrder: 'asc',
    }),
    queryFn: ({ pageParam }) =>
      fetchOnboardingBusinessTypes({
        pageNumber: pageParam,
        pageSize,
        keyword,
        sortBy: 'id',
        sortOrder: 'asc',
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.lastPage ? undefined : lastPage.pageNumber + 1,
    staleTime: 60_000,
    retry: 1,
  });
}

/**
 * Categories for the selected business type.
 * `businessTypeKey` may be a numeric API id or a local slug.
 */
export function useOnboardingCategories(
  businessTypeKey: string | null | undefined,
  params?: Omit<GetCategoriesQuery, 'business_type_id'>,
) {
  const key = (businessTypeKey || '').trim();
  const query = {
    pageNumber: params?.pageNumber ?? 0,
    pageSize: params?.pageSize ?? 48,
    business_type_id: key,
  };

  return useQuery({
    queryKey: queryKeys.catalog.categories(query),
    queryFn: () => fetchOnboardingCategories(key, params),
    enabled: key.length > 0,
    staleTime: 60_000,
    retry: 1,
  });
}
