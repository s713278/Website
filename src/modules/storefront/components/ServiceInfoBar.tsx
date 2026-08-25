import { Clock, Leaf, MapPin, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DeliveryAddressPicker } from '@/shared/components/DeliveryAddressPicker'
import { useDeliveryLocation } from '@/shared/hooks/useDeliveryLocation'

type ServiceInfoBarProps = {
  storeId: string
  className?: string
}

/** Delivery + trust strip on store home. */
export function ServiceInfoBar({ storeId, className }: ServiceInfoBarProps) {
  const { selected, pickerProps, openChange } = useDeliveryLocation(storeId)

  const items: Array<{
    icon: typeof MapPin
    title: string
    value: string
    action?: string
    onClick?: () => void
  }> = [
    {
      icon: MapPin,
      title: 'Delivering to',
      value: selected?.location ?? 'Add delivery location',
      action: selected ? 'Change' : 'Add location',
      onClick: openChange,
    },
    { icon: Clock, title: 'Estimated delivery', value: '2–3 business days' },
    { icon: Leaf, title: '100% Natural Ingredients', value: 'Pure & chemical-free' },
    { icon: ShieldCheck, title: 'Secure Payments', value: 'Safe & trusted checkout' },
  ]

  return (
    <>
      <div
        className={cn(
          'overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_24px_-12px_rgba(15,23,42,0.08)]',
          className,
        )}
      >
        <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
          {items.map(({ icon: Icon, title, value, action, onClick }) => (
            <div
              key={title}
              className="flex items-center gap-3.5 px-5 py-4 sm:border-t sm:border-slate-100 sm:py-5 lg:border-t-0 lg:px-6 [&:nth-child(n+3)]:sm:border-t"
            >
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100/90">
                <Icon className="size-5" strokeWidth={1.75} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-500">{title}</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">{value}</p>
                {action && onClick ? (
                  <button
                    type="button"
                    onClick={onClick}
                    className="mt-1 text-xs font-semibold text-[var(--store-theme,var(--md-green-700))] hover:underline"
                  >
                    {action}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <DeliveryAddressPicker {...pickerProps} />
    </>
  )
}
