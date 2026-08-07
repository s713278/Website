import { useMemo, useState } from 'react';
import { BulkActionBar } from '@/features/dashboard/components/BulkActionBar';
import { CrudDialog } from '@/features/dashboard/components/CrudDialog';
import { DataTable, type DataColumn } from '@/features/dashboard/components/DataTable';
import { ExportButton } from '@/features/dashboard/components/ExportButton';
import { FiltersBar } from '@/features/dashboard/components/FiltersBar';
import { ProductFormFields } from '@/features/dashboard/components/ProductFormFields';
import { StatusBadge } from '@/features/dashboard/components/StatusBadge';
import { TableSkeleton } from '@/features/dashboard/components/Skeletons';
import { useDashboardProducts } from '@/features/dashboard/hooks/use-dashboard-products';
import {
  filterByTableState,
  paginateRows,
  useTableState,
} from '@/features/dashboard/hooks/use-table-state';
import { formatDate, formatInr, productStatusLabel } from '@/features/dashboard/lib/format';
import { canDeleteProducts, canManageProducts } from '@/features/dashboard/lib/permissions';
import {
  productFormSchema,
  type ProductFormValues,
} from '@/features/dashboard/schemas/product-schema';
import type { DashboardProduct } from '@/features/dashboard/types';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useZodForm } from '@/shared/forms/use-zod-form';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
];

function newProductId() {
  return `p-${Date.now().toString(36)}`;
}

export function ProductsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const canManage = canManageProducts(role);
  const canDelete = canDeleteProducts(role);
  const { products, isLoading, saveProduct, removeProducts, updateStatus, usingDemo } =
    useDashboardProducts();
  const table = useTableState({ pageSize: 8 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DashboardProduct | null>(null);
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);

  const form = useZodForm(productFormSchema, {
    defaultValues: {
      name: '',
      category: '',
      price: 0,
      stock: 0,
      status: 'active',
      sku: '',
    },
  });

  const filtered = useMemo(
    () =>
      filterByTableState(products, table.filters, {
        getSearchText: (p) => `${p.name} ${p.category} ${p.sku ?? ''}`,
        getStatus: (p) => p.status,
        getDate: (p) => p.updatedAt,
      }),
    [products, table.filters],
  );
  const pageData = paginateRows(filtered, table.page, table.pageSize);

  const openCreate = () => {
    setEditing(null);
    form.reset({ name: '', category: '', price: 0, stock: 0, status: 'active', sku: '' });
    setDialogOpen(true);
  };

  const openEdit = (product: DashboardProduct) => {
    setEditing(product);
    form.reset({
      name: product.name,
      category: product.category,
      price: product.price,
      stock: product.stock,
      status: product.status,
      sku: product.sku ?? '',
    });
    setDialogOpen(true);
  };

  const onSave = form.handleSubmit((values: ProductFormValues) => {
    const product: DashboardProduct = {
      id: editing?.id ?? newProductId(),
      name: values.name,
      category: values.category,
      price: values.price,
      stock: values.stock,
      status: values.status,
      sku: values.sku || undefined,
      updatedAt: new Date().toISOString(),
    };
    saveProduct.mutate(product, {
      onSuccess: () => {
        setDialogOpen(false);
        setEditing(null);
      },
    });
  });

  const columns: Array<DataColumn<DashboardProduct>> = [
    {
      id: 'name',
      header: 'Product',
      cell: (p) => (
        <div>
          <strong>{p.name}</strong>
          <div className="text-xs text-muted-foreground">{p.sku || 'No SKU'}</div>
        </div>
      ),
    },
    { id: 'category', header: 'Category', cell: (p) => p.category },
    { id: 'price', header: 'Price', cell: (p) => formatInr(p.price) },
    { id: 'stock', header: 'Stock', cell: (p) => String(p.stock) },
    {
      id: 'status',
      header: 'Status',
      cell: (p) => <StatusBadge status={p.status} label={productStatusLabel(p.status)} />,
    },
    {
      id: 'updated',
      header: 'Updated',
      cell: (p) => <span className="text-muted-foreground">{formatDate(p.updatedAt)}</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: (p) =>
        canManage ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => openEdit(p)}>
            Edit
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Your catalog</CardTitle>
            <p className="text-sm text-muted-foreground">
              {usingDemo ? 'Demo catalog — edits persist locally' : 'Vendor products from API'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExportButton
              filename="products"
              columns={[
                { key: 'name', header: 'Name' },
                { key: 'category', header: 'Category' },
                { key: 'price', header: 'Price' },
                { key: 'stock', header: 'Stock' },
                { key: 'status', header: 'Status' },
                { key: 'sku', header: 'SKU' },
              ]}
              rows={filtered as unknown as Array<Record<string, unknown>>}
            />
            {canManage ? (
              <Button type="button" size="sm" onClick={openCreate}>
                Add product
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <FiltersBar
            search={table.search}
            onSearchChange={table.setSearch}
            searchPlaceholder="Search products…"
            status={table.status}
            onStatusChange={table.setStatus}
            statusOptions={STATUS_OPTIONS}
            dateFrom={table.dateFrom}
            dateTo={table.dateTo}
            onDateFromChange={table.setDateFrom}
            onDateToChange={table.setDateTo}
          />
          <BulkActionBar
            selectedCount={table.selectedIds.length}
            onClear={table.clearSelection}
            actions={[
              {
                id: 'activate',
                label: 'Activate',
                disabled: !canManage || updateStatus.isPending,
                onClick: () =>
                  updateStatus.mutate(
                    { ids: table.selectedIds, status: 'active' },
                    { onSuccess: () => table.clearSelection() },
                  ),
              },
              {
                id: 'archive',
                label: 'Archive',
                disabled: !canManage || updateStatus.isPending,
                onClick: () =>
                  updateStatus.mutate(
                    { ids: table.selectedIds, status: 'archived' },
                    { onSuccess: () => table.clearSelection() },
                  ),
              },
              {
                id: 'delete',
                label: 'Delete',
                variant: 'destructive',
                disabled: !canDelete || removeProducts.isPending,
                onClick: () => setDeleteIds([...table.selectedIds]),
              },
            ]}
          />
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <DataTable
              columns={columns}
              rows={pageData.rows}
              selectedIds={table.selectedIds}
              onToggleRow={table.toggleSelect}
              onToggleAll={table.setAllSelected}
              page={pageData.page}
              pageCount={pageData.pageCount}
              total={pageData.total}
              onPageChange={table.setPage}
              selectable={canManage}
            />
          )}
        </CardContent>
      </Card>

      <CrudDialog
        open={dialogOpen}
        title={editing ? 'Edit product' : 'Add product'}
        description="Prices and stock update your catalog for customers."
        onClose={() => setDialogOpen(false)}
        onSubmit={onSave}
        submitLabel={saveProduct.isPending ? 'Saving…' : 'Save product'}
        submitDisabled={saveProduct.isPending || !canManage}
      >
        <ProductFormFields form={form} />
      </CrudDialog>

      <CrudDialog
        open={Boolean(deleteIds?.length)}
        title="Delete products?"
        description={`This removes ${deleteIds?.length ?? 0} product(s) from your catalog.`}
        onClose={() => setDeleteIds(null)}
        onSubmit={() => {
          if (!deleteIds?.length) return;
          removeProducts.mutate(deleteIds, {
            onSuccess: () => {
              setDeleteIds(null);
              table.clearSelection();
            },
          });
        }}
        submitLabel={removeProducts.isPending ? 'Deleting…' : 'Delete'}
        submitDisabled={!canDelete || removeProducts.isPending}
        danger
      >
        <p className="text-sm text-muted-foreground">This action is logged in audit history.</p>
      </CrudDialog>
    </>
  );
}
