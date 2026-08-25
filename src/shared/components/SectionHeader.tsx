import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type SectionHeaderProps = {
  title: string
  actionLabel?: string
  onAction?: () => void
  className?: string
  titleClassName?: string
  /** Smaller title + tighter spacing — e.g. Shop by Category. */
  compact?: boolean
}

function cleanActionLabel(label: string) {
  return label.replace(/\s*[>›→]\s*$/, '').trim()
}

/** Section title row — reuse across storefront grids and category rails. */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
  className,
  titleClassName,
  compact = false,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3',
        compact ? 'mb-4' : 'mb-5',
        className,
      )}
    >
      <h2
        className={cn(
          'font-display font-bold tracking-tight text-slate-900',
          compact ? 'text-base sm:text-[1.05rem]' : 'text-xl sm:text-[1.35rem]',
          titleClassName,
        )}
      >
        {title}
      </h2>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-[var(--store-theme,var(--md-green-700))] transition hover:text-[var(--md-green-800)] hover:underline hover:underline-offset-4 sm:text-sm"
        >
          {cleanActionLabel(actionLabel)}
          <ChevronRight className="size-3.5 opacity-70 sm:size-4" strokeWidth={2.25} aria-hidden />
        </button>
      ) : null}
    </div>
  )
}
