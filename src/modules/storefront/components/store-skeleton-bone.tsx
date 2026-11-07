import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

/** Themed pulse block — picks up `--store-theme-soft` from the store shell. */
export function StoreBone({ className }: { className?: string }) {
  return (
    <Skeleton
      className={cn('bg-[var(--store-theme-soft,rgba(16,185,129,0.14))]', className)}
    />
  )
}
