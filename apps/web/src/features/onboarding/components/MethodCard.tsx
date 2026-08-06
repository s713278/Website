import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

type MethodCardProps = {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  badge?: string;
  children?: ReactNode;
  id: string;
};

export function MethodCard({
  title,
  description,
  checked,
  onCheckedChange,
  badge,
  children,
  id,
}: MethodCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border-2 bg-white transition',
        checked ? 'border-emerald-500 bg-emerald-50/40' : 'border-gray-200',
      )}
    >
      <label
        htmlFor={id}
        className="flex cursor-pointer items-start gap-3 p-4"
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-400"
        />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-gray-900">{title}</div>
          <div className="text-sm text-gray-500">{description}</div>
        </div>
        {badge ? (
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
            {badge}
          </span>
        ) : null}
      </label>
      {checked && children ? (
        <div className="border-t border-emerald-100 px-4 pb-4 pt-3">{children}</div>
      ) : null}
    </div>
  );
}
