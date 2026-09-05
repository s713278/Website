import { cn } from '@/lib/utils'
import { Search } from 'lucide-react'

type SearchFieldProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  inputClassName?: string
  'aria-label'?: string
  autoFocus?: boolean
}

/** Premium search bar — reusable across storefront and vendor admin. */
export function SearchField({
  value,
  onChange,
  placeholder = 'Search products…',
  className,
  inputClassName,
  'aria-label': ariaLabel = 'Search',
  autoFocus,
}: SearchFieldProps) {
  return (
    <label
      className={cn(
        'flex h-11 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 transition-colors',
        'focus-within:border-slate-300',
        className,
      )}
    >
      <Search className="size-4 shrink-0 text-slate-400" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        className={cn(
          'min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400',
          inputClassName,
        )}
      />
    </label>
  )
}
