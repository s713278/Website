export type VendorOrderStatus = 'new' | 'accepted' | 'preparing' | 'ready' | 'completed'

export type VendorOrder = {
  id: string
  customerName: string
  items: Array<{ name: string; qty: number }>
  total: number
  status: VendorOrderStatus
  placedAt: string
}

export type VendorProduct = {
  id: string
  name: string
  price: number
  available: boolean
  veg: boolean
}
