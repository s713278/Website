import { useQuery } from '@tanstack/react-query';
import { catalogService } from '@mithra/api-client';
import { queryKeys } from '@/shared/api/query-keys';

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.catalog.categories(),
    queryFn: () => catalogService.getCategories(),
  });
}

export function useCategoriesGrouped() {
  return useQuery({
    queryKey: queryKeys.catalog.grouped(),
    queryFn: () => catalogService.getCategoriesGrouped(),
  });
}

export function useBusinessTypes() {
  return useQuery({
    queryKey: queryKeys.catalog.businessTypes(),
    queryFn: () => catalogService.getBusinessTypes(),
  });
}

export function useCategoryProducts(categoryId: number | string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.catalog.products(categoryId || 'unknown'),
    queryFn: () => catalogService.getProductsByCategory(categoryId!),
    enabled: categoryId != null && categoryId !== '',
  });
}
