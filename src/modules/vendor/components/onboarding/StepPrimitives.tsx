import type { ReactNode, ToggleEvent } from 'react'
import { AlertTriangleIcon, CheckIcon, ChevronRightIcon, DatabaseIcon, RefreshCwIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, LoadingSkeleton } from '@/shared/components/ui'
import type { ValidationIssue } from '../../types/onboarding'
import type { ConfirmDialogState } from './ConfirmDialog'

export type RequestConfirmation = (
  request: Omit<ConfirmDialogState, 'open'>,
) => void

export function FieldError({ issues, field }: { issues: ValidationIssue[]; field: string }) {
  const message = issues.find((item) => item.field === field)?.message
  return message ? <p id={`${field}-error`} className="mt-1.5 text-xs font-medium text-destructive">{message}</p> : null
}

/**
 * A form-field label.
 *
 * Deliberately not the `ob-eyebrow` treatment: that is the wizard's structural voice —
 * stage names, ledger keys, section markers — and applying it to eight fields in a grid
 * turns a form into a wall of capitals. This matches the shared `Input` label instead,
 * so a step that mixes both kinds of field reads as one form.
 */
export function FieldLabel({ htmlFor, children, optional }: { htmlFor?: string; children: ReactNode; optional?: boolean }) {
  const content = (
    <>
      {children}
      {optional ? <span className="ml-1.5 font-normal text-[var(--ob-ink-soft)]">(optional)</span> : null}
    </>
  )
  const className = 'mb-1.5 block text-sm font-medium text-[var(--ob-ink)]'
  return htmlFor ? (
    <label htmlFor={htmlFor} className={className}>{content}</label>
  ) : (
    <span className={className}>{content}</span>
  )
}

/**
 * A titled block of related settings inside a step.
 *
 * Steps 6-9 ask for a lot at once, and an undivided run of inputs makes a vendor read
 * every one to find the thing they came to change. The section is a hairline-ruled
 * band rather than a nested card: cards inside a card is the look the redesign is
 * getting rid of.
 */
export function StepSection({
  title,
  description,
  aside,
  children,
  className,
  id,
}: {
  title: string
  description?: ReactNode
  aside?: ReactNode
  children: ReactNode
  className?: string
  id?: string
}) {
  const headingId = id ? `${id}-heading` : undefined
  return (
    <section aria-labelledby={headingId} className={cn('mt-6 border-t border-[var(--ob-line)] pt-6 first:mt-0 first:border-t-0 first:pt-0', className)}>
      <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h3 id={headingId} className="font-display text-[0.9375rem] leading-5 font-semibold tracking-[-0.01em] text-[var(--ob-ink)]">
            {title}
          </h3>
          {description ? <p className="mt-1 text-sm leading-5 text-[var(--ob-ink-soft)]">{description}</p> : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
      {children}
    </section>
  )
}

/**
 * A short aside that is not an error: what a field is for, what happens next, what
 * demo mode is doing. Kept to one visual form with a tone, so a vendor learns to read
 * these once instead of per step.
 */
export function Hint({
  tone = 'neutral',
  icon,
  children,
  className,
}: {
  tone?: 'neutral' | 'brand' | 'warning'
  icon?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex gap-2.5 rounded-lg border-l-2 py-2.5 pr-3 pl-3 text-sm leading-5',
        tone === 'neutral' && 'border-l-[var(--ob-line)] bg-[var(--ob-canvas)] text-[var(--ob-ink-soft)]',
        tone === 'brand' && 'border-l-[var(--ob-brand)] bg-[var(--ob-brand-soft)] text-[var(--ob-ink)]',
        tone === 'warning' && 'border-l-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950/35 dark:text-amber-100',
        className,
      )}
    >
      {icon ? <span className="mt-0.5 shrink-0" aria-hidden="true">{icon}</span> : null}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/**
 * A category's collapsible panel, after the design reference's `.ob-cat-panel`: a left chevron
 * disc, the name and a short status line, and a count pill, with a thin brand outline while open.
 * Steps 5 and 6 share it so the two catalog steps read as one place.
 *
 * Deliberately still a `<details>`: the wizard's `focusField` reopens a collapsed group by
 * setting `open` on the nearest one (`closest('details')`), and native disclosure keeps the keyboard and
 * screen-reader behaviour that a hand-rolled version would have to reproduce.
 */
export function CategoryPanel({
  id,
  open,
  onToggle,
  name,
  meta,
  count,
  children,
}: {
  id: string
  open: boolean
  onToggle: (event: ToggleEvent<HTMLDetailsElement>) => void
  name: string
  meta: string
  count: number
  children: ReactNode
}) {
  return (
    <details
      id={id}
      open={open}
      onToggle={onToggle}
      className="group overflow-hidden rounded-2xl border border-[var(--ob-line)] bg-[var(--ob-sheet)] shadow-xs transition-[border-color,box-shadow] open:border-[color-mix(in_srgb,var(--ob-brand)_35%,var(--ob-line))] open:shadow-[0_0_0_1px_color-mix(in_srgb,var(--ob-brand)_18%,transparent)] motion-reduce:transition-none"
    >
      <summary className="grid cursor-pointer list-none grid-cols-[auto_1fr_auto] items-center gap-2.5 px-3.5 py-3 outline-none transition-colors hover:bg-[var(--ob-brand-soft)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ob-brand)] motion-reduce:transition-none [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className="inline-flex size-[1.35rem] shrink-0 items-center justify-center rounded-full bg-[var(--ob-brand-soft)] text-[var(--ob-brand)] transition-transform group-open:rotate-90 group-open:bg-[var(--ob-brand)] group-open:text-white motion-reduce:transition-none"
        >
          <ChevronRightIcon className="size-3.5" strokeWidth={2.6} />
        </span>
        <div className="min-w-0">
          <h3 className="truncate font-display text-[0.9375rem] font-semibold tracking-[-0.01em] text-[var(--ob-ink)]">{name}</h3>
          <p className="mt-0.5 text-xs text-[var(--ob-ink-soft)]">{meta}</p>
        </div>
        <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-bold text-[var(--ob-ink-soft)] group-open:bg-[var(--ob-brand-soft)] group-open:text-[color-mix(in_srgb,var(--ob-brand)_80%,var(--ob-ink))]">
          {count}
        </span>
      </summary>
      <div className="border-t border-[var(--ob-line-soft)] px-3 pt-3 pb-3.5 max-[30rem]:px-2">{children}</div>
    </details>
  )
}

/** The one input shell every text field in the wizard uses. */
export const fieldShell =
  'h-11 w-full rounded-lg border border-[var(--ob-line)] bg-[var(--ob-sheet)] px-3 text-sm text-[var(--ob-ink)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--ob-pending)] focus:border-[var(--ob-brand)] focus:ring-3 focus:ring-[var(--ob-brand-soft)] disabled:opacity-60'

/** Two tiles a row on phones, three once the form column is tablet-wide. */
export const choiceGrid = 'grid grid-cols-2 gap-3 @min-[30rem]:grid-cols-3 @min-[30rem]:gap-x-2'

export function ChoiceCard({
  selected,
  title,
  description,
  onClick,
  disabled,
  inactive,
  id,
  leading,
  footer,
}: {
  selected: boolean
  title: string
  description?: string | null
  onClick: () => void
  disabled?: boolean
  /** Looks unavailable but stays clickable, so the step can explain why. */
  inactive?: boolean
  id?: string
  leading?: ReactNode
  /** Extra detail under the title, such as a product's measurement chips. */
  footer?: ReactNode
}) {
  const muted = disabled || inactive
  return (
    <button
      id={id}
      type="button"
      aria-pressed={selected}
      aria-disabled={inactive || undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        // Chosen is an emerald outline plus a mint fill, as in the design reference.
        // Every pick control in the wizard wears the same mark so a vendor learns it once.
        'relative flex min-h-32 w-full cursor-pointer flex-col items-center justify-center gap-2.5 rounded-xl border px-3 py-4 text-center @min-[30rem]:min-h-26 @min-[30rem]:gap-2 @min-[30rem]:py-3.5 outline-none transition-[border-color,background-color,box-shadow,translate] duration-200 ease-out focus-visible:ring-3 focus-visible:ring-[var(--ob-brand-soft)] motion-reduce:transition-none',
        selected
          ? 'border-[var(--ob-brand)] bg-[var(--ob-brand-soft)] ring-3 ring-[var(--ob-brand-soft)]'
          : 'border-[var(--ob-line)] bg-[var(--ob-sheet)]',
        !selected && !muted && 'hover:-translate-y-0.5 hover:border-[var(--ob-brand)] motion-reduce:hover:translate-y-0',
        muted && 'cursor-not-allowed opacity-50',
      )}
    >
      {leading}
      <span className="min-w-0">
        <span className={cn('line-clamp-2 text-sm leading-5 font-semibold text-[var(--ob-ink)]', selected && 'text-[var(--md-green-800)] dark:text-[var(--ob-ink)]')}>{title}</span>
        {description ? <span className="mt-1 line-clamp-2 block text-xs leading-4 text-[var(--ob-ink-soft)]">{description}</span> : null}
      </span>
      {footer}
      <span
        className={cn(
          'absolute top-2 right-2 grid size-5 place-items-center rounded-full transition-opacity',
          selected ? 'bg-[var(--ob-brand)] text-white opacity-100' : 'opacity-0',
        )}
        aria-hidden="true"
      >
        {selected ? <CheckIcon className="size-3 stroke-[3]" /> : null}
      </span>
    </button>
  )
}

export function CatalogLoading({
  count = 6,
  cardClassName,
  className = 'grid gap-3 @min-[32rem]:grid-cols-2',
}: {
  count?: number
  cardClassName?: string
  className?: string
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, index) => (
        <LoadingSkeleton key={index} className={cn('h-24 rounded-xl', cardClassName)} />
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
  onUseSample?: () => void
}) {
  return (
    <div className="rounded-xl border-l-2 border-l-amber-500 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/35 dark:text-amber-100" role="alert">
      <div className="flex gap-3">
        <AlertTriangleIcon className="mt-0.5 size-5 shrink-0" />
        <div>
          <h3 className="font-display text-sm font-semibold">Live catalog unavailable</h3>
          <p className="mt-1 text-sm leading-6">{message}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCwIcon /> Retry live catalog
        </Button>
        {onUseSample ? (
          <Button size="sm" onClick={onUseSample}>
            <DatabaseIcon /> Use sample catalog
          </Button>
        ) : null}
      </div>
    </div>
  )
}
