import { Leaf, Lock, MapPin, ShieldCheck, Store, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DeliveryAddressPicker } from '@/shared/components/DeliveryAddressPicker'
import { useDeliveryLocation } from '@/shared/hooks/useDeliveryLocation'
import type { StoreFulfillment, StoreTrustItem } from '@/modules/storefront/types'

type ServiceInfoBarProps = {
  storeId: string
  trustStrip?: StoreTrustItem[]
  fulfillment?: StoreFulfillment
  className?: string
}

const TRUST_ICONS = {
  shield: ShieldCheck,
  leaf: Leaf,
  truck: Truck,
  lock: Lock,
} as const

function trustIcon(name: string) {
  return TRUST_ICONS[name as keyof typeof TRUST_ICONS] ?? ShieldCheck
}

/** Labels from API booleans — no delivery_message string. */
function fulfillmentOptions(fulfillment?: StoreFulfillment) {
  const options: Array<{ label: string; icon: typeof Truck }> = []
  if (fulfillment?.homeDeliveryAvailable) {
    options.push({ label: 'Home delivery', icon: Truck })
  }
  if (fulfillment?.storePickupAvailable) {
    options.push({ label: 'Store pickup', icon: Store })
  }
  return options
}

/** Delivery location + fulfillment modes + API trust_strip — one joined bar. */
export function ServiceInfoBar({
  storeId,
  trustStrip,
  fulfillment,
  className,
}: ServiceInfoBarProps) {
  const { selected, pickerProps, openChange } = useDeliveryLocation(storeId)
  const modes = fulfillmentOptions(fulfillment)

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
    ...(trustStrip ?? []).map((item) => ({
      icon: trustIcon(item.icon),
      title: item.title,
      value: item.subtitle,
    })),
  ]

  return (
    <>
      <div
        className={cn(
          'overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_24px_-12px_rgba(15,23,42,0.08)]',
          className,
        )}
      >
        <div
          className={cn(
            'grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-y-0 lg:divide-x lg:divide-y-0',
            items.length <= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-5',
          )}
        >
          {items.map(({ icon: Icon, title, value, action, onClick }, index) => (
            <div
              key={`${title}-${index}`}
              className="flex items-center gap-3.5 px-5 py-4 sm:border-t sm:border-slate-100 sm:py-5 lg:border-t-0 lg:px-6 [&:nth-child(n+3)]:sm:border-t"
            >
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-900">
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
                {index === 0 && modes.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {modes.map(({ label, icon: ModeIcon }) => (
                      <span
                        key={label}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700"
                      >
                        <ModeIcon className="size-3" strokeWidth={2} aria-hidden />
                        {label}
                      </span>
                    ))}
                  </div>
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
