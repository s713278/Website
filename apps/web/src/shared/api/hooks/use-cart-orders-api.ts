import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cartService, ordersService, type CreateOrderFromCartRequest } from '@mithra/api-client';
import { queryKeys } from '@/shared/api/query-keys';

export function useCart(vendorId: number | string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.vendors.cart(vendorId || 'unknown'),
    queryFn: () => cartService.get(vendorId!),
    enabled: vendorId != null && vendorId !== '',
  });
}

export function useAddCartItemMutation(vendorId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => cartService.addItem(vendorId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.vendors.cart(vendorId) }),
  });
}

export function useUpdateCartItemMutation(vendorId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      cartItemId,
      body,
    }: {
      cartItemId: number | string;
      body: Record<string, unknown>;
    }) => cartService.updateItemQty(vendorId, cartItemId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.vendors.cart(vendorId) }),
  });
}

export function useRemoveCartItemMutation(vendorId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cartItemId: number | string) => cartService.removeItem(vendorId, cartItemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.vendors.cart(vendorId) }),
  });
}

export function useClearCartMutation(vendorId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => cartService.clear(vendorId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.vendors.cart(vendorId) }),
  });
}

export function useCreateOrderFromCartMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateOrderFromCartRequest) => ordersService.createFromCart(body),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.vendors.cart(vars.vendor_id) });
      void qc.invalidateQueries({ queryKey: queryKeys.vendors.orders(vars.vendor_id) });
    },
  });
}

export function useOrder(orderId: number | string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.orders.detail(orderId || 'unknown'),
    queryFn: () => ordersService.get(orderId!),
    enabled: orderId != null && orderId !== '',
  });
}
