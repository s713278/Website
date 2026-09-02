export type DeliveryAddress = {
  id: string
  location: string
  lat: number
  lng: number
}

export type DeliveryAddressInput = Omit<DeliveryAddress, 'id'>
