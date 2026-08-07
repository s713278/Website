import { statusTone } from '@/features/dashboard/lib/format';
import { cn } from '@/shared/lib/utils';

type Props = {
  status: string;
  label?: string;
  className?: string;
};

export function StatusBadge({ status, label, className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold capitalize',
        statusTone(status),
        className,
      )}
    >
      {label ?? status}
    </span>
  );
}
