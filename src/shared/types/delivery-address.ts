export type DeliveryAddress = {
  id: string
  location: string
  lat: number
  lng: number
  city?: string
  country?: string
  zipCode?: string
  state?: string
  district?: string
  address1?: string
  address2?: string
  recipientName?: string
  contactNumber?: string
  backendAddressId?: number
}

export type DeliveryAddressInput = Omit<DeliveryAddress, 'id'>
