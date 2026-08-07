import { useCallback } from 'react';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useAuditLogStore } from '@/features/dashboard/store/audit-log-store';
import type { AuditAction, AuditEntity } from '@/features/dashboard/types';

export function useAuditLog() {
  const user = useAuthStore((s) => s.user);
  const entries = useAuditLogStore((s) => s.entries);
  const append = useAuditLogStore((s) => s.append);
  const clear = useAuditLogStore((s) => s.clear);

  const log = useCallback(
    (input: {
      action: AuditAction;
      entity: AuditEntity;
      entityId?: string;
      summary: string;
    }) => {
      append({
        actor: user?.phone || user?.name || user?.id || 'demo-user',
        actorRole: user?.role || 'vendor',
        ...input,
      });
    },
    [append, user],
  );

  return { entries, log, clear };
}
