import type { ReactNode } from 'react'
import { AlertTriangleIcon, CheckIcon, DatabaseIcon, RefreshCwIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, LoadingSkeleton } from '@/shared/components/ui'
import type { ValidationIssue } from '../../types/onboarding'
import type { ConfirmDialogState } from './ConfirmDialog'

export type RequestConfirmation = (
  request: Omit<ConfirmDialogState, 'open'>,
) => void

export function FieldError({ issues, field }: { issues: ValidationIssue[]; field: string }) {
  const message = issues.find((item) => item.field === field)?.message
  return message ? <p id={`${field}-error`} className="mt-1.5 text-xs text-destructive">{message}</p> : null
}

export function FieldLabel({ htmlFor, children, optional }: { htmlFor?: string; children: ReactNode; optional?: boolean }) {
  const content = (
    <>
      {children}
      {optional ? <span className="ml-1 font-normal text-muted-foreground">(optional)</span> : null}
    </>
  )
  return htmlFor ? (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-foreground/90">{content}</label>
  ) : (
    <span className="mb-1.5 block text-sm font-semibold text-foreground/90">{content}</span>
  )
}

export function ChoiceCard({
  selected,
  title,
  description,
  onClick,
  disabled,
  id,
  leading,
}: {
  selected: boolean
  title: string
  description?: string | null
  onClick: () => void
  disabled?: boolean
  id?: string
  leading?: ReactNode
}) {
  return (
    <button
      id={id}
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'group relative min-h-16 w-full rounded-xl border p-3 text-left outline-none transition-[border-color,background-color,box-shadow,transform] focus-visible:ring-3 focus-visible:ring-primary/25 active:scale-[0.99] motion-reduce:transform-none',
        selected
          ? 'border-primary/40 bg-primary/[0.08] shadow-sm hover:bg-primary/[0.1]'
          : 'border-border/60 bg-card/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-primary/30 hover:bg-card hover:shadow-sm',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span className="flex min-w-0 items-center gap-3 pr-7">
        {leading ? <span className="shrink-0">{leading}</span> : null}
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{title}</span>
          {description ? <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span> : null}
        </span>
      </span>
      <span
        className={cn(
          'absolute top-3 right-3 grid size-5 place-items-center rounded-full transition-[background-color,color,opacity]',
          selected
            ? 'bg-primary text-primary-foreground opacity-100'
            : 'bg-transparent opacity-0',
        )}
        aria-hidden="true"
      >
        {selected ? <CheckIcon className="size-3" /> : null}
      </span>
    </button>
  )
}

export function CatalogLoading({
  count = 6,
  cardClassName,
}: {
  count?: number
  cardClassName?: string
}) {
  return (
    <div className="grid gap-3 @min-[32rem]:grid-cols-2">
      {Array.from({ length: count }, (_, index) => (
        <LoadingSkeleton key={index} className={cn('h-24 rounded-lg', cardClassName)} />
      ))}
    </div>
  )
}

export function CatalogError({
  message,
  onRetry,
  onUseSample,
}: {
  message: string
  onRetry: () => void
  onUseSample: () => void
}) {
  return (
    <div className="rounded-xl bg-amber-50/90 p-4 text-amber-950 dark:bg-amber-950/35 dark:text-amber-100" role="alert">
      <div className="flex gap-3">
        <AlertTriangleIcon className="mt-0.5 size-5 shrink-0" />
        <div>
          <h3 className="text-sm font-semibold">Live catalog unavailable</h3>
          <p className="mt-1 text-sm leading-6">{message}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCwIcon /> Retry live catalog
        </Button>
        <Button size="sm" onClick={onUseSample}>
          <DatabaseIcon /> Use sample catalog
        </Button>
      </div>
    </div>
  )
}
