import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEMO_AUDIT_SEED } from '@/features/dashboard/data/demo-dashboard';
import type { AuditAction, AuditEntity, AuditLogEntry } from '@/features/dashboard/types';

type AppendInput = {
  actor: string;
  actorRole: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  summary: string;
};

type AuditLogState = {
  entries: AuditLogEntry[];
  append: (input: AppendInput) => void;
  clear: () => void;
};

function uid() {
  return `aud-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useAuditLogStore = create<AuditLogState>()(
  persist(
    (set, get) => ({
      entries: DEMO_AUDIT_SEED,
      append: (input) => {
        const entry: AuditLogEntry = {
          id: uid(),
          ...input,
          timestamp: new Date().toISOString(),
        };
        set({ entries: [entry, ...get().entries].slice(0, 200) });
      },
      clear: () => set({ entries: [] }),
    }),
    {
      name: 'mithra_web_audit_logs',
      partialize: (state) => ({ entries: state.entries }),
    },
  ),
);
