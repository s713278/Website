import { useState } from 'react'
import { cn } from '@/lib/utils'
import { VariantSelectSheet } from '@/modules/storefront/components/VariantSelectSheet'
import {
  duplicateVariantUnits,
  formatVariantLabel,
} from '@/modules/storefront/lib/product-variants'
import type { ProductVariant } from '@/modules/storefront/types'

const PREVIEW_LIMIT = 6

type CardVariantPickerProps = {
  variants: ProductVariant[]
  selectedId: string
  onSelect: (id: string) => void
  className?: string
}

export function CardVariantPicker({
  variants,
  selectedId,
  onSelect,
  className,
}: CardVariantPickerProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const preview = variants.slice(0, PREVIEW_LIMIT)
  const selected = variants.find((variant) => variant.id === selectedId)
  const selectedOutside =
    Boolean(selected) && !preview.some((variant) => variant.id === selectedId)
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
      <p className="text-[11px] font-medium text-slate-500">
        Size · {variants.length} size{variants.length === 1 ? '' : 's'} available
      </p>

      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Choose pack size">
        {chips.map((variant) => {
          const active = selectedId === variant.id
          return (
            <button
              key={variant.id}
              type="button"
              onClick={() => onSelect(variant.id)}
              aria-pressed={active}
              className={cn(
                'min-h-9 rounded-full border px-3 py-2 text-[11px] font-semibold transition',
                active
                  ? 'border-[var(--store-accent,#f97316)] bg-[var(--store-accent-soft,rgba(249,115,22,0.16))] text-[var(--store-accent,#ea580c)]'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
              )}
            >
              {formatVariantLabel(variant, dupes.has(variant.unit || variant.id))}
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
