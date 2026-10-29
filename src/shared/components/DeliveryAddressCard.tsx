import { MapPin, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DeliveryAddress } from '@/shared/types/delivery-address'

type DeliveryAddressCardProps = {
  address: DeliveryAddress
  selected?: boolean
  onSelect?: () => void
  onEdit?: () => void
  changeLabel?: string
  className?: string
}

export function DeliveryAddressCard({
  address,
  selected = false,
  onSelect,
  onEdit,
  changeLabel = 'Change',
  className,
}: DeliveryAddressCardProps) {
  const Tag = onSelect ? 'label' : 'div'

  return (
    <Tag
      className={cn(
        'flex items-start gap-3 rounded-xl border p-4',
        onSelect && 'cursor-pointer transition',
        selected || !onSelect
          ? 'border-[var(--store-theme,var(--md-green-600))] bg-[var(--store-theme-soft,rgba(16,185,129,0.08))]'
          : 'border-slate-200 hover:border-slate-300',
        !onSelect && 'bg-white',
        className,
      )}
    >
      {onSelect ? (
        <input
          type="radio"
          name="delivery-address"
          checked={selected}
          onChange={onSelect}
          className="mt-3 accent-[var(--store-theme,var(--md-green-600))]"
        />
      ) : null}

      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--store-theme-soft,rgba(16,185,129,0.14))] text-[var(--store-theme,var(--md-green-700))]">
        <MapPin className="size-4" strokeWidth={2} aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-900">Delivery location</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{address.location}</p>
      </div>

      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-[var(--store-theme,var(--md-green-700))] hover:underline"
        >
          <Pencil className="size-3.5" aria-hidden />
          {changeLabel}
        </button>
      ) : null}
    </Tag>
  )
}
