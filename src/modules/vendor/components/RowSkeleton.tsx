import { Skeleton } from '@/shared/components'
import { cn } from '@/shared/lib/utils'

/** The one list skeleton of the vendor console: ruled-row placeholders under one sr-only status. */
export function RowSkeleton({
  label,
  rows = 4,
  className,
  rowClassName,
}: {
  label: string
  rows?: number
  className?: string
  /** Each row's height; pass a full responsive height, since it replaces the default. */
  rowClassName?: string
}) {
  return (
    <div aria-busy="true" className={cn('grid gap-2', className)}>
      <span role="status" aria-label={label} className="sr-only">
        {label}
      </span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={cn('w-full rounded-[var(--vc-radius)]', rowClassName ?? 'h-64 xl:h-[4.5rem]')} />
      ))}
    </div>
  )
}
