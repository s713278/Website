import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/query-keys';
import {
  createVendorSku,
  deleteVendorSku,
  fetchVendorProducts,
  patchVendorProduct,
} from '@/features/dashboard/api/fetch-dashboard';
import {
  useDashboardVendorId,
  useVendorApiEnabled,
} from '@/features/dashboard/hooks/use-dashboard-vendor';
import { useAuditLog } from '@/features/dashboard/hooks/use-audit-log';
import { useDemoDataStore } from '@/features/dashboard/store/demo-data-store';
import type { DashboardProduct, ProductStatus } from '@/features/dashboard/types';

export function useDashboardProducts() {
  const vendorId = useDashboardVendorId();
  const apiOn = useVendorApiEnabled();
  const demoProducts = useDemoDataStore((s) => s.products);
  const upsertProduct = useDemoDataStore((s) => s.upsertProduct);
  const deleteProducts = useDemoDataStore((s) => s.deleteProducts);
  const setProductStatus = useDemoDataStore((s) => s.setProductStatus);
  const { log } = useAuditLog();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.vendors.products(vendorId),
    queryFn: () => fetchVendorProducts(vendorId),
    enabled: apiOn,
  });

  const products = apiOn ? (query.data ?? []) : demoProducts;

  const saveProduct = useMutation({
    mutationFn: async (product: DashboardProduct) => {
      if (!apiOn) {
        upsertProduct({ ...product, updatedAt: new Date().toISOString() });
        return product;
      }
      const body = {
        name: product.name,
        price: product.price,
        status: product.status,
        stock: product.stock,
        category: product.category,
      };
      const exists = products.some((p) => p.id === product.id);
      if (exists) {
        await patchVendorProduct(vendorId, product.id, body);
      } else {
        await createVendorSku(vendorId, { ...body, label: product.name });
      }
      return product;
    },
    onSuccess: (product, input) => {
      const isNew = !products.some((p) => p.id === input.id);
      log({
        action: isNew ? 'create' : 'update',
        entity: 'product',
        entityId: product.id,
        summary: `${isNew ? 'Created' : 'Updated'} product ${product.name}`,
      });
    },
    onSettled: () => {
      if (apiOn) void qc.invalidateQueries({ queryKey: queryKeys.vendors.products(vendorId) });
    },
  });

  const removeProducts = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!apiOn) {
        deleteProducts(ids);
        return;
      }
      await Promise.all(ids.map((id) => deleteVendorSku(vendorId, id).catch(() => undefined)));
    },
    onMutate: async (ids) => {
      if (!apiOn) return;
      await qc.cancelQueries({ queryKey: queryKeys.vendors.products(vendorId) });
      const prev = qc.getQueryData(queryKeys.vendors.products(vendorId));
      qc.setQueryData(queryKeys.vendors.products(vendorId), (old: typeof products | undefined) =>
        (old ?? []).filter((p) => !ids.includes(p.id)),
      );
      return { prev };
    },
    onError: (_err, _ids, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.vendors.products(vendorId), ctx.prev);
    },
    onSuccess: (_data, ids) => {
      log({
        action: ids.length > 1 ? 'bulk_delete' : 'delete',
        entity: 'product',
        entityId: ids.join(','),
        summary: `Deleted ${ids.length} product(s)`,
      });
    },
    onSettled: () => {
      if (apiOn) void qc.invalidateQueries({ queryKey: queryKeys.vendors.products(vendorId) });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: ProductStatus }) => {
      if (!apiOn) {
        setProductStatus(ids, status);
        return;
      }
      await Promise.all(
        ids.map((id) => patchVendorProduct(vendorId, id, { status }).catch(() => undefined)),
      );
    },
    onSuccess: (_data, { ids, status }) => {
      log({
        action: ids.length > 1 ? 'bulk_update' : 'status_change',
        entity: 'product',
        entityId: ids.join(','),
        summary: `Set ${ids.length} product(s) to ${status}`,
      });
    },
    onSettled: () => {
      if (apiOn) void qc.invalidateQueries({ queryKey: queryKeys.vendors.products(vendorId) });
    },
  });

  return {
    products,
    isLoading: apiOn && query.isLoading,
    isError: apiOn && query.isError,
    saveProduct,
    removeProducts,
    updateStatus,
    usingDemo: !apiOn,
  };
}
