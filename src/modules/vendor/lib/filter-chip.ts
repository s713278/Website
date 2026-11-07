import { cn } from '@/shared/lib/utils'

/**
 * Shared presentation for vendor-list filters.
 *
 * From `design-reference/dashboard.css` — `.dash-chip`. The selected chip takes the
 * console's emerald wash and its tinted edge; an earlier pass filled it with ink to keep
 * emerald for actions, which the shared design supersedes. Nothing is lost by the change:
 * a filled chip beside outlined ones still reads as the chosen one, and the console's
 * actions are buttons, which no chip is mistaken for.
 */
export function vendorFilterChipClass(active: boolean) {
  return cn(
    'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
    active
      ? 'border-[var(--vc-tint-line)] bg-[var(--vc-tint)] text-[var(--vc-tint-ink)]'
      : 'border-[var(--vc-edge)] bg-white text-slate-600 hover:border-[var(--vc-tint-line)] hover:text-[var(--md-ink)]',
  )
}
