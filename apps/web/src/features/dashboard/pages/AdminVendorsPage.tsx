import { useMemo } from 'react';
import { BulkActionBar } from '@/features/dashboard/components/BulkActionBar';
import { DataTable, type DataColumn } from '@/features/dashboard/components/DataTable';
import { ExportButton } from '@/features/dashboard/components/ExportButton';
import { FiltersBar } from '@/features/dashboard/components/FiltersBar';
import { StatusBadge } from '@/features/dashboard/components/StatusBadge';
import { TableSkeleton } from '@/features/dashboard/components/Skeletons';
import { useDashboardVendors } from '@/features/dashboard/hooks/use-dashboard-vendors';
import {
  filterByTableState,
  paginateRows,
  useTableState,
} from '@/features/dashboard/hooks/use-table-state';
import { formatDate, vendorStatusLabel } from '@/features/dashboard/lib/format';
import { canAdminBulkVendors, canViewVendors } from '@/features/dashboard/lib/permissions';
import type { DashboardVendor, VendorStatus } from '@/features/dashboard/types';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'suspended', label: 'Suspended' },
];

export function AdminVendorsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const allowed = canViewVendors(role);
  const canBulk = canAdminBulkVendors(role);
  const { vendors, isLoading, updateStatus, usingDemo } = useDashboardVendors();
  const table = useTableState();

  const filtered = useMemo(
    () =>
      filterByTableState(vendors, table.filters, {
        getSearchText: (v) => `${v.name} ${v.phone} ${v.location}`,
        getStatus: (v) => v.status,
        getDate: (v) => v.createdAt,
      }),
    [vendors, table.filters],
  );
  const pageData = paginateRows(filtered, table.page, table.pageSize);

  if (!allowed) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Admin role required to manage vendors.
        </CardContent>
      </Card>
    );
  }

  const columns: Array<DataColumn<DashboardVendor>> = [
    {
      id: 'name',
      header: 'Vendor',
      cell: (v) => (
        <div>
          <strong>{v.name}</strong>
          <div className="text-xs text-muted-foreground">{v.phone}</div>
        </div>
      ),
    },
    { id: 'location', header: 'Location', cell: (v) => v.location },
    { id: 'products', header: 'Products', cell: (v) => String(v.productCount) },
    {
      id: 'status',
      header: 'Status',
      cell: (v) => <StatusBadge status={v.status} label={vendorStatusLabel(v.status)} />,
    },
    {
      id: 'created',
      header: 'Joined',
      cell: (v) => <span className="text-muted-foreground">{formatDate(v.createdAt)}</span>,
    },
  ];

  const apply = (status: VendorStatus) => {
    updateStatus.mutate(
      { ids: table.selectedIds, status },
      { onSuccess: () => table.clearSelection() },
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Vendors</CardTitle>
          <p className="text-sm text-muted-foreground">
            {usingDemo ? 'Demo vendor directory' : 'Platform vendors from API'}
          </p>
        </div>
        <ExportButton
          filename="vendors"
          columns={[
            { key: 'name', header: 'Name' },
            { key: 'phone', header: 'Phone' },
            { key: 'location', header: 'Location' },
            { key: 'status', header: 'Status' },
            { key: 'productCount', header: 'Products' },
            { key: 'createdAt', header: 'Joined' },
          ]}
          rows={filtered as unknown as Array<Record<string, unknown>>}
        />
      </CardHeader>
      <CardContent className="space-y-4">
        <FiltersBar
          search={table.search}
          onSearchChange={table.setSearch}
          searchPlaceholder="Search vendors…"
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
              id: 'active',
              label: 'Activate',
              disabled: !canBulk || updateStatus.isPending,
              onClick: () => apply('active'),
            },
            {
              id: 'pending',
              label: 'Mark pending',
              disabled: !canBulk || updateStatus.isPending,
              onClick: () => apply('pending'),
            },
            {
              id: 'suspend',
              label: 'Suspend',
              variant: 'destructive',
              disabled: !canBulk || updateStatus.isPending,
              onClick: () => apply('suspended'),
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
            selectable={canBulk}
          />
        )}
      </CardContent>
    </Card>
  );
}
