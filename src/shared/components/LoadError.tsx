import type { ReactNode } from 'react'
import { CircleAlertIcon, RotateCcwIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './ui'

/** A load-failure notice with a retry and optional contextual copy/actions. */
export function LoadError({
  onRetry,
  children,
  className,
  message = 'Something went wrong',
  retryLabel = 'Try again',
}: {
  onRetry: () => void
  children?: ReactNode
  className?: string
  message?: string
  retryLabel?: string
}) {
  return (
    <div role="alert" className={cn('grid gap-3', className)}>
      <div className="flex gap-2.5 rounded-lg border-l-2 border-l-amber-500 bg-amber-50 py-2.5 pr-3 pl-3 text-sm leading-5 dark:bg-amber-950/35">
        <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
        <p className="text-amber-900 dark:text-amber-100">{message}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onRetry}>
          <RotateCcwIcon /> {retryLabel}
        </Button>
        {children}
      </div>
    </div>
  )
}
