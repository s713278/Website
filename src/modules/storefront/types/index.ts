export type Product = {
  id: string
  name: string
  description: string
  price: number
  veg: boolean
  popular?: boolean
}

export type StoreTheme = {
  primaryColor: string
  accentColor: string
  logoImage?: string
  /** Hex matched against BG_PRESETS; anything off-list resolves to the default swatch. */
  backgroundColor?: string
  /** CSS family name as sent by the API, e.g. "DM Sans". Matched against FONT_PRESETS. */
  fontFamily?: string
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
  theme?: StoreTheme
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
