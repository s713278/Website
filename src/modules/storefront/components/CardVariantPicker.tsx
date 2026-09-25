import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { VariantSelectSheet } from '@/modules/storefront/components/VariantSelectSheet'
import {
  duplicateVariantUnits,
  findVariantBySelection,
  formatVariantLabel,
  variantSelectKey,
} from '@/modules/storefront/lib/product-variants'
import type { ProductVariant } from '@/modules/storefront/types'

const PREVIEW_LIMIT = 6

type CardVariantPickerProps = {
  variants: ProductVariant[]
  selectedId: string
  onSelect: (id: string) => void
  className?: string
  /** True while that pack size is still writing to the cart. */
  isPending?: (variantId: string) => boolean
}

export function CardVariantPicker({
  variants,
  selectedId,
  onSelect,
  className,
  isPending,
}: CardVariantPickerProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const preview = variants.slice(0, PREVIEW_LIMIT)
  const selected = findVariantBySelection(variants, selectedId)
  const selectedOutside =
    Boolean(selected) &&
    !preview.some(
      (variant) => variantSelectKey(variant) === selectedId || variant.id === selectedId,
    )
  const chips = selectedOutside && selected ? [...preview, selected] : preview
  const moreCount = Math.max(0, variants.length - preview.length)
  const dupes = duplicateVariantUnits(variants)

  return (
    <div
      className={cn(className)}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
    >
       <div className="flex flex-wrap gap-1.5" role="group" aria-label="Choose pack size">
        {chips.map((variant) => {
          const key = variantSelectKey(variant)
          const active = selectedId === key || selectedId === variant.id
          const pending = isPending?.(variant.id) ?? false
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              aria-pressed={active}
              aria-busy={pending}
              className={cn(
                'inline-flex min-h-9 items-center gap-1 rounded-full border px-3 py-2 text-[11px] font-semibold transition',
                active
                  ? 'border-[var(--store-accent,#f97316)] bg-[var(--store-accent-soft,rgba(249,115,22,0.16))] text-[var(--store-accent,#ea580c)]'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
              )}
            >
              {formatVariantLabel(variant, dupes.has(variant.unit || variant.id))}
              {pending ? <Loader2 className="size-3 animate-spin" aria-hidden /> : null}
            </button>
          )
        })}
      </div>

      {moreCount > 0 ? (
        <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
          <span className="font-medium text-slate-500">
            +{moreCount} more size{moreCount === 1 ? '' : 's'}
          </span>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="min-h-9 py-2 font-semibold text-[var(--store-accent,#ea580c)] hover:underline"
          >
            View all
          </button>
        </div>
      ) : null}

      <VariantSelectSheet
        open={sheetOpen}
        variants={variants}
        selectedId={selectedId}
        onClose={() => setSheetOpen(false)}
        onConfirm={onSelect}
      />
    </div>
  )
}
