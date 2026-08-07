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
    <div className={cn('method-card', checked && 'selected')}>
      <label htmlFor={id} className="method-card-head">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-[var(--store-theme,var(--md-green))] focus:ring-[var(--store-theme,var(--md-green))]"
        />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-gray-900">{title}</div>
          <div className="text-sm text-gray-500">{description}</div>
        </div>
        {badge ? (
          <span className="rounded-full bg-[var(--md-green-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--md-green-deep)]">
            {badge}
          </span>
        ) : null}
      </label>
      {checked && children ? (
        <div className="border-t border-[color-mix(in_srgb,var(--store-theme)_20%,#e5e7eb)] px-4 pb-4 pt-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}
