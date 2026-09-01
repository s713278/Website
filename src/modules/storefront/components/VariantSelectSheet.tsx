import { useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  duplicateVariantUnits,
  formatVariantLabel,
} from '@/modules/storefront/lib/product-variants'
import type { ProductVariant } from '@/modules/storefront/types'
import { formatCurrency } from '@/shared/lib/utils'
import { Button } from '@/shared/components/ui'

type VariantSelectSheetProps = {
  open: boolean
  variants: ProductVariant[]
  selectedId: string
  onClose: () => void
  onConfirm: (variantId: string) => void
  title?: string
}

/** Size picker — bottom sheet on mobile, right drawer from `sm` up. */
export function VariantSelectSheet({
  open,
  variants,
  selectedId,
  onClose,
  onConfirm,
  title = 'Select Size',
}: VariantSelectSheetProps) {
  const [draftId, setDraftId] = useState(selectedId)
  const [query, setQuery] = useState('')
  const dupes = useMemo(() => duplicateVariantUnits(variants), [variants])

  useEffect(() => {
    if (!open) return
    setDraftId(selectedId)
    setQuery('')
  }, [open, selectedId])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return variants
    return variants.filter((variant) =>
      `${variant.unit} ${variant.price}`.toLowerCase().includes(q),
    )
  }, [query, variants])

  const draft = variants.find((variant) => variant.id === draftId) ?? variants[0]

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-stretch sm:justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 flex w-full max-h-[min(88dvh,100%)] flex-col rounded-t-2xl bg-white shadow-[0_-12px_40px_rgba(15,23,42,0.18)] sm:h-full sm:max-h-none sm:max-w-[24rem] sm:rounded-none sm:shadow-[-12px_0_40px_rgba(15,23,42,0.18)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="border-b border-slate-100 px-5 py-3">
          <label className="relative block">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search size…"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[var(--store-accent,#f97316)] focus:bg-white focus:ring-2 focus:ring-[var(--store-accent-soft,rgba(249,115,22,0.35))]"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-slate-500">
              No sizes match “{query.trim()}”.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {filtered.map((variant) => {
                const active = draftId === variant.id
                return (
                  <li key={variant.id}>
                    <button
                      type="button"
                      onClick={() => setDraftId(variant.id)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition',
                        active
                          ? 'bg-[var(--store-accent-soft,rgba(249,115,22,0.14))]'
                          : 'hover:bg-slate-50',
                      )}
                    >
                      <span
                        className={cn(
                          'grid size-5 shrink-0 place-items-center rounded-full border-2',
                          active ? 'border-[var(--store-accent,#f97316)]' : 'border-slate-300',
                        )}
                        aria-hidden
                      >
                        {active ? (
                          <span className="size-2.5 rounded-full bg-[var(--store-accent,#f97316)]" />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-semibold text-slate-900">
                        {formatVariantLabel(variant, dupes.has(variant.unit || variant.id))}
                      </span>
                      <span className="shrink-0 text-sm font-bold text-slate-800">
                        {formatCurrency(variant.price)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-slate-100 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Selected</p>
            <p className="truncate text-sm font-semibold text-slate-900">
              {draft ? (
                <>
                  {draft.unit || 'Size'}{' '}
                  <span className="text-[var(--store-accent,#ea580c)]">
                    {formatCurrency(draft.price)}
                  </span>
                </>
              ) : (
                '—'
              )}
            </p>
          </div>
          <Button
            type="button"
            disabled={!draft}
            onClick={() => {
              if (!draft) return
              onConfirm(draft.id)
              onClose()
            }}
            className="h-11 min-w-[7.5rem] rounded-xl bg-[var(--store-accent,#f97316)] px-5 text-sm font-bold text-white hover:opacity-90"
          >
            Confirm
          </Button>
        </div>
      </div>
    </div>
  )
}
