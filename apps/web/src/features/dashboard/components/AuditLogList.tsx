import { formatDateTime } from '@/features/dashboard/lib/format';
import type { AuditLogEntry } from '@/features/dashboard/types';
import { cn } from '@/shared/lib/utils';

type Props = {
  entries: AuditLogEntry[];
  limit?: number;
  className?: string;
};

export function AuditLogList({ entries, limit, className }: Props) {
  const list = typeof limit === 'number' ? entries.slice(0, limit) : entries;

  if (!list.length) {
    return (
      <p className={cn('rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground', className)}>
        No audit events yet. Product and order changes will appear here.
      </p>
    );
  }

  return (
    <ul className={cn('divide-y divide-border rounded-xl border border-border bg-white', className)}>
      {list.map((entry) => (
        <li key={entry.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-foreground">{entry.summary}</p>
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-secondary-foreground">{entry.actor}</span>
              {' · '}
              {entry.actorRole}
              {' · '}
              {entry.action}
              {' · '}
              {entry.entity}
              {entry.entityId ? ` #${entry.entityId}` : ''}
            </p>
          </div>
          <time
            className="shrink-0 text-xs font-medium text-muted-foreground"
            dateTime={entry.timestamp}
          >
            {formatDateTime(entry.timestamp)}
          </time>
        </li>
      ))}
    </ul>
  );
}
