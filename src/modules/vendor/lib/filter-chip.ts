import { cn } from '@/shared/lib/utils'

/**
 * Shared presentation for vendor-list filters.
 *
 * The selected chip describes the current view, so it uses a neutral ink fill rather than the
 * emerald reserved for actions that advance work.
 */
export function vendorFilterChipClass(active: boolean) {
  return cn(
    'rounded-full border px-3 py-1.5 text-sm transition',
    active
      ? 'border-transparent bg-[var(--md-ink)] font-medium text-white'
      : 'border-[var(--vc-edge)] bg-white text-slate-600 hover:border-slate-300 hover:text-[var(--md-ink)]',
  )
}
