import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ordersService, vendorsService, storefrontService } from '@mithra/api-client';
import { queryKeys } from '@/shared/api/query-keys';

export function useVendor(vendorId: number | string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.vendors.detail(vendorId || 'unknown'),
    queryFn: () => vendorsService.getById(vendorId!),
    enabled: vendorId != null && vendorId !== '',
  });
}

export function useVendorProducts(vendorId: number | string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.vendors.products(vendorId || 'unknown'),
    queryFn: () => vendorsService.getProducts(vendorId!),
    enabled: vendorId != null && vendorId !== '',
  });
}

export function useVendorProductSkus(vendorId: number | string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.vendors.skus(vendorId || 'unknown'),
    queryFn: () => vendorsService.getProductSkus(vendorId!),
    enabled: vendorId != null && vendorId !== '',
  });
}

export function useVendorStorefront(vendorId: number | string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.vendors.storefront(vendorId || 'unknown'),
    queryFn: () => storefrontService.get(vendorId!),
    enabled: vendorId != null && vendorId !== '',
  });
}

export function useVendorOrders(vendorId: number | string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.vendors.orders(vendorId || 'unknown'),
    queryFn: () => ordersService.listByVendor(vendorId!),
    enabled: vendorId != null && vendorId !== '',
  });
}

export function useCreateVendorMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => vendorsService.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.vendors.all }),
  });
}

export function useUpdateVendorMutation(vendorId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => vendorsService.update(vendorId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.vendors.detail(vendorId) });
      void qc.invalidateQueries({ queryKey: queryKeys.vendors.storefront(vendorId) });
    },
  });
}

export function useDeliveryEligibilityMutation(vendorId: number | string) {
  return useMutation({
    mutationFn: (address: Record<string, unknown>) =>
      storefrontService.checkDeliveryEligibility(vendorId, address),
  });
}
