import { cn } from '@/lib/utils'
import type { ProductVariant } from '@/modules/storefront/types'

type VariantPickerProps = {
  variants: ProductVariant[]
  selectedId: string
  onSelect: (id: string) => void
  label?: string
  /** Card pills vs PDP filled buttons */
  tone?: 'soft' | 'solid'
  className?: string
}

/** Pack size selector — shared by product card and PDP. */
export function VariantPicker({
  variants,
  selectedId,
  onSelect,
  label = 'Size',
  tone = 'soft',
  className,
}: VariantPickerProps) {
  return (
    <div className={cn(className)}>
      {label ? <p className="mb-2 text-sm font-semibold text-slate-800">{label}</p> : null}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Choose pack size">
        {variants.map((variant) => {
          const active = selectedId === variant.id
          return (
            <button
              key={variant.id}
              type="button"
              onClick={() => onSelect(variant.id)}
              aria-pressed={active}
              className={cn(
                'min-h-10 rounded-full border px-4 py-2 text-sm font-semibold transition duration-150',
                tone === 'solid'
                  ? active
                    ? 'border-[var(--store-theme,var(--md-green-800))] bg-[var(--store-theme,var(--md-green-800))] text-white'
                    : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
                  : active
                    ? 'border-[var(--store-theme,var(--md-green-600))] bg-[var(--store-theme-soft,rgba(16,185,129,0.14))] text-[var(--store-theme,var(--md-green-700))]'
                    : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300',
                tone === 'soft' && 'min-h-9 flex-1 text-xs',
              )}
            >
              {variant.unit}
            </button>
          )
        })}
      </div>
    </div>
  )
}
