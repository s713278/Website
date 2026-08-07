import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { vendorsService } from '@mithra/api-client';
import { queryKeys } from '@/shared/api/query-keys';
import { fetchVendorsList } from '@/features/dashboard/api/fetch-dashboard';
import { useApiEnabled } from '@/features/dashboard/hooks/use-dashboard-vendor';
import { useAuditLog } from '@/features/dashboard/hooks/use-audit-log';
import { useDemoDataStore } from '@/features/dashboard/store/demo-data-store';
import type { VendorStatus } from '@/features/dashboard/types';

export function useDashboardVendors() {
  const apiOn = useApiEnabled();
  const demoVendors = useDemoDataStore((s) => s.vendors);
  const setVendorStatus = useDemoDataStore((s) => s.setVendorStatus);
  const { log } = useAuditLog();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.vendors.all,
    queryFn: () => fetchVendorsList(),
    enabled: apiOn,
  });

  const vendors = apiOn ? (query.data ?? []) : demoVendors;

  const updateStatus = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: VendorStatus }) => {
      if (!apiOn) {
        setVendorStatus(ids, status);
        return;
      }
      await Promise.all(
        ids.map((id) =>
          vendorsService.patchStatus(id, { vendor_status: status }).catch(() => undefined),
        ),
      );
    },
    onSuccess: (_data, { ids, status }) => {
      log({
        action: ids.length > 1 ? 'bulk_update' : 'status_change',
        entity: 'vendor',
        entityId: ids.join(','),
        summary: `Set ${ids.length} vendor(s) to ${status}`,
      });
    },
    onSettled: () => {
      if (apiOn) void qc.invalidateQueries({ queryKey: queryKeys.vendors.all });
    },
  });

  return {
    vendors,
    isLoading: apiOn && query.isLoading,
    isError: apiOn && query.isError,
    updateStatus,
    usingDemo: !apiOn,
  };
}
