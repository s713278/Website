import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/query-keys';
import {
  bulkPatchOrderStatus,
  fetchVendorOrders,
  patchOrderStatus,
} from '@/features/dashboard/api/fetch-dashboard';
import {
  useDashboardVendorId,
  useVendorApiEnabled,
} from '@/features/dashboard/hooks/use-dashboard-vendor';
import { useAuditLog } from '@/features/dashboard/hooks/use-audit-log';
import { useDemoDataStore } from '@/features/dashboard/store/demo-data-store';
import type { OrderStatus } from '@/features/dashboard/types';

export function useDashboardOrders() {
  const vendorId = useDashboardVendorId();
  const apiOn = useVendorApiEnabled();
  const demoOrders = useDemoDataStore((s) => s.orders);
  const setOrderStatus = useDemoDataStore((s) => s.setOrderStatus);
  const { log } = useAuditLog();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.vendors.orders(vendorId),
    queryFn: () => fetchVendorOrders(vendorId),
    enabled: apiOn,
  });

  const orders = apiOn ? (query.data ?? []) : demoOrders;

  const updateStatus = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: OrderStatus }) => {
      if (!apiOn) {
        setOrderStatus(ids, status);
        return;
      }
      if (ids.length === 1) {
        await patchOrderStatus(vendorId, ids[0], status);
      } else {
        await bulkPatchOrderStatus(vendorId, ids, status);
      }
    },
    onMutate: async ({ ids, status }) => {
      if (!apiOn) return;
      await qc.cancelQueries({ queryKey: queryKeys.vendors.orders(vendorId) });
      const prev = qc.getQueryData(queryKeys.vendors.orders(vendorId));
      qc.setQueryData(queryKeys.vendors.orders(vendorId), (old: typeof orders | undefined) =>
        (old ?? []).map((o) => (ids.includes(o.id) ? { ...o, status } : o)),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.vendors.orders(vendorId), ctx.prev);
    },
    onSuccess: (_data, { ids, status }) => {
      log({
        action: ids.length > 1 ? 'bulk_update' : 'status_change',
        entity: 'order',
        entityId: ids.join(','),
        summary: `Updated ${ids.length} order(s) to ${status}`,
      });
    },
    onSettled: () => {
      if (apiOn) void qc.invalidateQueries({ queryKey: queryKeys.vendors.orders(vendorId) });
    },
  });

  return {
    orders,
    isLoading: apiOn && query.isLoading,
    isError: apiOn && query.isError,
    updateStatus,
    usingDemo: !apiOn,
  };
}
