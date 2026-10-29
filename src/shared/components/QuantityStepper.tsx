import { Loader2, Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

type QuantityStepperProps = {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  label?: string
  className?: string
  /** Show a small spinner while qty API is in flight. */
  pending?: boolean
  /** Disable taps without qty spinner (e.g. row is removing). */
  disabled?: boolean
}

/** +/- quantity control — cart, PDP, etc. */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  label = 'Quantity',
  className,
  pending = false,
  disabled = false,
}: QuantityStepperProps) {
  const locked = pending || disabled

  function step(delta: number) {
    if (locked) return
    onChange(Math.min(max, Math.max(min, value + delta)))
  }

  return (
    <div className={cn('overflow-visible', className)}>
      {label ? <p className="mb-2 text-sm font-semibold text-slate-800">{label}</p> : null}
      <div
        className="inline-flex overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm"
        aria-busy={pending}
      >
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={locked || value <= min}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-l-xl text-slate-600 transition hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40"
          aria-label="Decrease quantity"
        >
          <Minus className="size-4" strokeWidth={2.25} />
        </button>
        <span
          className="flex min-w-11 shrink-0 items-center justify-center border-x border-slate-200 px-2 text-sm font-bold text-slate-900"
          aria-live="polite"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin text-[var(--store-theme,var(--md-green-700))]" aria-hidden />
          ) : (
            value
          )}
        </span>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={locked || value >= max}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-r-xl text-slate-600 transition hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40"
          aria-label="Increase quantity"
        >
          <Plus className="size-4" strokeWidth={2.25} />
        </button>
      </div>
    </div>
  )
}
