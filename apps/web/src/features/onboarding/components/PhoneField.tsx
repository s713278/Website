import { cn } from '@/shared/lib/utils';

type PhoneFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  errorId?: string;
  className?: string;
};

export function PhoneField({
  id,
  value,
  onChange,
  label,
  placeholder = '10-digit mobile',
  errorId,
  className,
}: PhoneFieldProps) {
  return (
    <div className={cn('max-w-md', className)}>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="flex gap-2">
        <span className="inline-flex items-center rounded-xl border border-gray-200 bg-gray-50 px-3 font-medium text-gray-600">
          +91
        </span>
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          maxLength={10}
          value={value}
          placeholder={placeholder}
          aria-describedby={errorId}
          aria-invalid={!!errorId}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
          className="flex-1 rounded-xl border border-gray-200 px-4 py-3 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
      </div>
    </div>
  );
}
