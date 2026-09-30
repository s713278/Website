import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { StorefrontHeader } from '@/modules/storefront/components/StorefrontHeader'
import { useStorePage } from '@/modules/storefront/hooks/useStorePage'
import { storePath } from '@/modules/storefront/lib/store-paths'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import { LocationMap } from '@/shared/components/LocationMap'
import { saveLocation } from '@/shared/lib/customer-location'
import { useDeliveryAddressStore } from '@/shared/store/delivery-address-store'

export function LocationMapPage() {
  const { storeId = 'r1' } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { store, wrapperRef } = useStorePage(storeId, { network: 'cache-first' })
  const cartCount = useCartStore((s) => s.itemCount(storeId))
  const addresses = useDeliveryAddressStore((s) => s.addresses)
  const addAddress = useDeliveryAddressStore((s) => s.addAddress)
  const updateAddress = useDeliveryAddressStore((s) => s.updateAddress)

  const from = params.get('from') || storePath(storeId)
  const editing = addresses.find((address) => address.id === params.get('edit'))

  function saveAndBack(pin: { lat: number; lng: number; location: string }) {
    if (editing) updateAddress(editing.id, pin)
    else addAddress(pin)

    saveLocation({
      serviceArea: pin.location,
      latitude: pin.lat,
      longitude: pin.lng,
      label: pin.location,
    })
    navigate(from, { replace: true })
  }

  return (
    <div ref={wrapperRef} className="flex min-h-screen flex-col bg-[var(--store-bg,#f8fafc)]">
      <StorefrontHeader store={store} storeId={storeId} cartCount={cartCount} />
      <LocationMap
        initial={editing}
        confirmLabel={editing ? 'Update location' : 'Confirm location'}
        onConfirm={saveAndBack}
      />
    </div>
  )
}
