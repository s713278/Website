import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

export type BulkAction = {
  id: string;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'destructive' | 'secondary';
  disabled?: boolean;
};

type Props = {
  selectedCount: number;
  actions: BulkAction[];
  onClear: () => void;
  className?: string;
};

export function BulkActionBar({ selectedCount, actions, onClear, className }: Props) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--store-theme)_28%,var(--md-border))] bg-[color-mix(in_srgb,var(--store-theme-soft)_70%,#fff)] px-3 py-2',
        className,
      )}
      role="region"
      aria-label="Bulk actions"
    >
      <p className="text-sm font-semibold text-secondary-foreground">
        {selectedCount} selected
      </p>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.id}
            type="button"
            size="sm"
            variant={action.variant ?? 'secondary'}
            disabled={action.disabled}
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        ))}
        <Button type="button" size="sm" variant="ghost" onClick={onClear}>
          Clear
        </Button>
      </div>
    </div>
  );
}
