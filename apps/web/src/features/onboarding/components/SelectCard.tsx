import { cn } from '@/shared/lib/utils';

type SelectCardProps = {
  selected?: boolean;
  onSelect: () => void;
  icon?: string;
  label: string;
  role?: 'option' | 'checkbox';
  'aria-checked'?: boolean;
};

function isIconUrl(icon: string) {
  return /^https?:\/\//i.test(icon) || icon.startsWith('data:');
}

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
      className={cn('select-card', selected && 'selected')}
    >
      <span className="check" aria-hidden="true">
        ✓
      </span>
      {icon ? (
        isIconUrl(icon) ? (
          <img src={icon} alt="" className="mx-auto mb-2 h-8 w-8 object-contain" />
        ) : (
          <span className="icon-emoji" aria-hidden="true">
            {icon}
          </span>
        )
      ) : null}
      <span className="text-sm font-semibold text-gray-800">{label}</span>
    </button>
  );
}
