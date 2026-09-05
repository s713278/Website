import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { StorefrontHeader } from '@/modules/storefront/components/StorefrontHeader'
import { StorePageStates } from '@/modules/storefront/components/StorePageStates'
import { useStorePage } from '@/modules/storefront/hooks/useStorePage'
import { storeCartPath, storePath } from '@/modules/storefront/lib/store-paths'
import { useCartStore } from '@/modules/storefront/store/cart-store'
import { LocationMap } from '@/shared/components/LocationMap'
import { saveLocation } from '@/shared/lib/customer-location'
import { useDeliveryAddressStore } from '@/shared/store/delivery-address-store'

export function LocationMapPage() {
  const { storeId = 'r1' } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { store, loading, error, wrapperRef } = useStorePage(storeId)
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
    <StorePageStates
      wrapperRef={wrapperRef}
      loading={loading}
      error={error}
      ready={Boolean(store)}
      loadingLabel="Loading map…"
      emptyTitle="Store not found"
      emptyDescription="This store may be offline."
      backHref={from}
    >
      {store ? (
        <div className="flex min-h-screen flex-col">
          <StorefrontHeader
            storeName={store.name}
            logoUrl={store.theme?.logoImage}
            cartCount={cartCount}
            cartHref={storeCartPath(store.id)}
            searchOpen={false}
            onToggleSearch={() => navigate(from)}
            pageTitle={editing ? 'Update location' : 'Set delivery location'}
            onBack={() => navigate(from)}
          />
          <LocationMap
            initial={editing}
            confirmLabel={editing ? 'Update location' : 'Confirm location'}
            onConfirm={saveAndBack}
          />
        </div>
      ) : null}
    </StorePageStates>
  )
}
