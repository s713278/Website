import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DeliveryAddress, DeliveryAddressInput } from '@/shared/types/delivery-address'

type State = {
  addresses: DeliveryAddress[]
  selectedId: string | null
  addAddress: (input: DeliveryAddressInput) => string
  updateAddress: (id: string, input: DeliveryAddressInput) => void
  selectAddress: (id: string) => void
}

function createId() {
  return `addr-${Date.now().toString(36)}`
}

function isPin(value: unknown): value is DeliveryAddress {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<DeliveryAddress>
  return (
    typeof item.id === 'string' &&
    typeof item.location === 'string' &&
    typeof item.lat === 'number' &&
    typeof item.lng === 'number'
  )
}

export const useDeliveryAddressStore = create<State>()(
  persist(
    (set) => ({
      addresses: [],
      selectedId: null,
      addAddress(input) {
        const id = createId()
        set((state) => ({
          addresses: [...state.addresses, { id, ...input }],
          selectedId: id,
        }))
        return id
      },
      updateAddress(id, input) {
        set((state) => ({
          addresses: state.addresses.map((address) =>
            address.id === id ? { ...address, ...input } : address,
          ),
        }))
      },
      selectAddress(id) {
        set({ selectedId: id })
      },
    }),
    {
      name: 'md-delivery-addresses',
      version: 2,
      // Drop old form-based addresses that lack lat/lng.
      migrate: (persisted) => {
        const data = (persisted || {}) as { addresses?: unknown[]; selectedId?: string | null }
        const addresses = (data.addresses ?? []).filter(isPin)
        const selectedId = addresses.some((a) => a.id === data.selectedId)
          ? data.selectedId ?? null
          : addresses[0]?.id ?? null
        return { addresses, selectedId }
      },
    },
  ),
)

export function getSelectedAddress(
  addresses: DeliveryAddress[],
  selectedId: string | null,
) {
  if (!addresses.length) return null
  return addresses.find((address) => address.id === selectedId) ?? addresses[0]
}
