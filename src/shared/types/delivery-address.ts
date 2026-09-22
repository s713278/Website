export type DeliveryAddress = {
  id: string
  location: string
  lat: number
  lng: number
  city?: string
  country?: string
  zipCode?: string
  backendAddressId?: number
}

export type DeliveryAddressInput = Omit<DeliveryAddress, 'id'>
