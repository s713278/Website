import { X } from 'lucide-react'
import { DeliveryAddressCard } from '@/shared/components/DeliveryAddressCard'
import { Button } from '@/shared/components'
import { useDeliveryAddressStore } from '@/shared/store/delivery-address-store'

type DeliveryAddressPickerProps = {
  open: boolean
  onClose: () => void
  onAdd: () => void
  onEdit: (id: string) => void
}

export function DeliveryAddressPicker({ open, onClose, onAdd, onEdit }: DeliveryAddressPickerProps) {
  const addresses = useDeliveryAddressStore((s) => s.addresses)
  const selectedId = useDeliveryAddressStore((s) => s.selectedId)
  const selectAddress = useDeliveryAddressStore((s) => s.selectAddress)

  if (!open) return null

  const activeId = selectedId ?? addresses[0]?.id

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
      <button type="button" className="absolute inset-0 bg-slate-900/45" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Delivery location</h2>
            <p className="mt-1 text-sm text-slate-500">Choose a saved pin or add one on the map.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3">
          {addresses.map((address) => (
            <DeliveryAddressCard
              key={address.id}
              address={address}
              selected={activeId === address.id}
              onSelect={() => {
                selectAddress(address.id)
                onClose()
              }}
              onEdit={() => onEdit(address.id)}
              changeLabel="Edit"
            />
          ))}
          <Button type="button" variant="outline" fullWidth className="rounded-lg" onClick={onAdd}>
            Add new location
          </Button>
        </div>
      </div>
    </div>
  )
}
