import { Button } from '@/shared/components/ui/button';
import { exportTableCsv } from '@/features/dashboard/lib/csv';
import { canExport } from '@/features/dashboard/lib/permissions';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useAuditLog } from '@/features/dashboard/hooks/use-audit-log';

type Props = {
  filename: string;
  columns: Array<{ key: string; header: string }>;
  rows: Array<Record<string, unknown>>;
  disabled?: boolean;
};

export function ExportButton({ filename, columns, rows, disabled }: Props) {
  const role = useAuthStore((s) => s.user?.role);
  const allowed = canExport(role);
  const { log } = useAuditLog();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={!allowed || disabled || rows.length === 0}
      title={!allowed ? 'Export requires vendor or admin role' : undefined}
      onClick={() => {
        exportTableCsv(filename, columns, rows);
        log({
          action: 'export',
          entity: 'table',
          summary: `Exported ${rows.length} row(s) to ${filename}`,
        });
      }}
    >
      Export CSV
    </Button>
  );
}
