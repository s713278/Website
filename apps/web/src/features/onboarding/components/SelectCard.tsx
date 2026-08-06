import { cn } from '@/shared/lib/utils';

type SelectCardProps = {
  selected?: boolean;
  onSelect: () => void;
  icon?: string;
  label: string;
  role?: 'option' | 'checkbox';
  'aria-checked'?: boolean;
};

export function SelectCard({
  selected,
  onSelect,
  icon,
  label,
  role = 'option',
  'aria-checked': ariaChecked,
}: SelectCardProps) {
  return (
    <button
      type="button"
      role={role}
      aria-selected={role === 'option' ? !!selected : undefined}
      aria-checked={role === 'checkbox' ? (ariaChecked ?? !!selected) : undefined}
      onClick={onSelect}
      className={cn(
        'relative rounded-2xl border-2 bg-white p-4 text-center transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
        selected
          ? 'border-emerald-500 bg-emerald-50 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]'
          : 'border-gray-200 hover:border-emerald-200',
      )}
    >
      {selected ? (
        <span
          className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[0.7rem] text-white"
          aria-hidden="true"
        >
          ✓
        </span>
      ) : null}
      {icon ? (
        <span className="mb-2 block text-2xl" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="text-sm font-semibold text-gray-800">{label}</span>
    </button>
  );
}
