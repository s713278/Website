import { useMemo } from 'react';
import { BulkActionBar } from '@/features/dashboard/components/BulkActionBar';
import { DataTable, type DataColumn } from '@/features/dashboard/components/DataTable';
import { ExportButton } from '@/features/dashboard/components/ExportButton';
import { FiltersBar } from '@/features/dashboard/components/FiltersBar';
import { StatusBadge } from '@/features/dashboard/components/StatusBadge';
import { TableSkeleton } from '@/features/dashboard/components/Skeletons';
import { useDashboardOrders } from '@/features/dashboard/hooks/use-dashboard-orders';
import {
  filterByTableState,
  paginateRows,
  useTableState,
} from '@/features/dashboard/hooks/use-table-state';
import { formatDateTime, formatInr, orderStatusLabel } from '@/features/dashboard/lib/format';
import { canUpdateOrders } from '@/features/dashboard/lib/permissions';
import type { DashboardOrder, OrderStatus } from '@/features/dashboard/types';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'out', label: 'Out for delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function OrdersPage() {
  const role = useAuthStore((s) => s.user?.role);
  const canEdit = canUpdateOrders(role);
  const { orders, isLoading, updateStatus, usingDemo } = useDashboardOrders();
  const table = useTableState();

  const filtered = useMemo(
    () =>
      filterByTableState(orders, table.filters, {
        getSearchText: (o) => `${o.id} ${o.customer} ${o.phone} ${o.items}`,
        getStatus: (o) => o.status,
        getDate: (o) => o.createdAt,
      }),
    [orders, table.filters],
  );
  const pageData = paginateRows(filtered, table.page, table.pageSize);

  const columns: Array<DataColumn<DashboardOrder>> = [
    {
      id: 'order',
      header: 'Order',
      cell: (o) => (
        <div>
          <strong>{o.id}</strong>
          <div className="text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</div>
        </div>
      ),
    },
    {
      id: 'customer',
      header: 'Customer',
      cell: (o) => (
        <div>
          {o.customer}
          <div className="text-xs text-muted-foreground">{o.phone}</div>
        </div>
      ),
    },
    { id: 'items', header: 'Items', cell: (o) => o.items },
    { id: 'amount', header: 'Amount', cell: (o) => formatInr(o.amount) },
    {
      id: 'status',
      header: 'Status',
      cell: (o) => <StatusBadge status={o.status} label={orderStatusLabel(o.status)} />,
    },
  ];

  const applyStatus = (status: OrderStatus) => {
    if (!canEdit || !table.selectedIds.length) return;
    updateStatus.mutate(
      { ids: table.selectedIds, status },
      { onSuccess: () => table.clearSelection() },
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>All orders</CardTitle>
          <p className="text-sm text-muted-foreground">
            {usingDemo ? 'Demo sample data' : 'Vendor orders from API'}
          </p>
        </div>
        <ExportButton
          filename="orders"
          columns={[
            { key: 'id', header: 'Order' },
            { key: 'customer', header: 'Customer' },
            { key: 'phone', header: 'Phone' },
            { key: 'items', header: 'Items' },
            { key: 'amount', header: 'Amount' },
            { key: 'status', header: 'Status' },
            { key: 'createdAt', header: 'Created' },
          ]}
          rows={filtered as unknown as Array<Record<string, unknown>>}
        />
      </CardHeader>
      <CardContent className="space-y-4">
        <FiltersBar
          search={table.search}
          onSearchChange={table.setSearch}
          searchPlaceholder="Search order, customer…"
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
              id: 'confirm',
              label: 'Mark confirmed',
              disabled: !canEdit || updateStatus.isPending,
              onClick: () => applyStatus('confirmed'),
            },
            {
              id: 'out',
              label: 'Out for delivery',
              disabled: !canEdit || updateStatus.isPending,
              onClick: () => applyStatus('out'),
            },
            {
              id: 'delivered',
              label: 'Mark delivered',
              disabled: !canEdit || updateStatus.isPending,
              onClick: () => applyStatus('delivered'),
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
            selectable={canEdit}
          />
        )}
      </CardContent>
    </Card>
  );
}
