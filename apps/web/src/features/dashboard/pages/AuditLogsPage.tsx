import { useMemo } from 'react';
import { AuditLogList } from '@/features/dashboard/components/AuditLogList';
import { ExportButton } from '@/features/dashboard/components/ExportButton';
import { FiltersBar } from '@/features/dashboard/components/FiltersBar';
import { useAuditLog } from '@/features/dashboard/hooks/use-audit-log';
import {
  filterByTableState,
  useTableState,
} from '@/features/dashboard/hooks/use-table-state';
import { canViewAuditLogs } from '@/features/dashboard/lib/permissions';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All actions' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'bulk_update', label: 'Bulk update' },
  { value: 'bulk_delete', label: 'Bulk delete' },
  { value: 'status_change', label: 'Status change' },
  { value: 'export', label: 'Export' },
];

export function AuditLogsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const allowed = canViewAuditLogs(role);
  const { entries, clear } = useAuditLog();
  const table = useTableState();

  const filtered = useMemo(() => {
    const withId = entries.map((e) => ({ ...e, status: e.action }));
    return filterByTableState(withId, table.filters, {
      getSearchText: (e) => `${e.actor} ${e.summary} ${e.entity} ${e.entityId ?? ''}`,
      getStatus: (e) => e.action,
      getDate: (e) => e.timestamp,
    });
  }, [entries, table.filters]);

  if (!allowed) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          You do not have permission to view audit logs.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Audit logs</CardTitle>
          <p className="text-sm text-muted-foreground">
            Local development trail for CRUD and bulk actions (persisted in this browser).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButton
            filename="audit-logs"
            columns={[
              { key: 'timestamp', header: 'Timestamp' },
              { key: 'actor', header: 'Actor' },
              { key: 'actorRole', header: 'Role' },
              { key: 'action', header: 'Action' },
              { key: 'entity', header: 'Entity' },
              { key: 'entityId', header: 'Entity ID' },
              { key: 'summary', header: 'Summary' },
            ]}
            rows={filtered as unknown as Array<Record<string, unknown>>}
          />
          <Button type="button" size="sm" variant="outline" onClick={() => clear()}>
            Clear logs
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <FiltersBar
          search={table.search}
          onSearchChange={table.setSearch}
          searchPlaceholder="Search actor, summary…"
          status={table.status}
          onStatusChange={table.setStatus}
          statusOptions={STATUS_OPTIONS}
          dateFrom={table.dateFrom}
          dateTo={table.dateTo}
          onDateFromChange={table.setDateFrom}
          onDateToChange={table.setDateTo}
        />
        <AuditLogList entries={filtered} />
      </CardContent>
    </Card>
  );
}
