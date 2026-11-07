import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { locationMapPath } from '@/modules/storefront/lib/store-paths'
import {
  getSelectedAddress,
  useDeliveryAddressStore,
} from '@/shared/store/delivery-address-store'

/** Shared add / change location flow for store home and checkout. */
export function useDeliveryLocation(storeId: string) {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const addresses = useDeliveryAddressStore((s) => s.addresses)
  const selectedId = useDeliveryAddressStore((s) => s.selectedId)
  const selected = getSelectedAddress(addresses, selectedId)
  const [pickerOpen, setPickerOpen] = useState(false)

  function openMap(editId?: string) {
    setPickerOpen(false)
    navigate(locationMapPath(storeId, { from: `${pathname}${search}`, editId }))
  }

  return {
    selected,
    openMap,
    openChange: () => (selected ? setPickerOpen(true) : openMap()),
    pickerProps: {
      open: pickerOpen,
      onClose: () => setPickerOpen(false),
      onAdd: () => openMap(),
      onEdit: openMap,
    },
  }
}
