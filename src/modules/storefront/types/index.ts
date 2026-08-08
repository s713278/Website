export type Product = {
  id: string
  name: string
  description: string
  price: number
  veg: boolean
  popular?: boolean
}

export type Store = {
  id: string
  name: string
  category: string
  rating: number
  etaMins: number
  distanceKm: number
  image: string
  offer?: string
  products: Product[]
}

export type CartLine = {
  itemId: string
  storeId: string
  storeName: string
  name: string
  price: number
  qty: number
}
