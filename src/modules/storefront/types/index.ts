export type ProductVariant = {
  id: string
  /** Pack size shown on the card, e.g. "250 g", "500 g", "1 kg". */
  unit: string
  price: number
}

export type Product = {
  id: string
  name: string
  description: string
  /** List price when there are no variants; otherwise the default variant price. */
  price: number
  veg: boolean
  popular?: boolean
  imageUrl?: string
  category?: string
  rating?: number
  reviewCount?: number
  spiceLevel?: string
  ingredients?: string
  inStock?: boolean
  /** Gallery images — falls back to `imageUrl`. */
  images?: string[]
  /** Single-SKU unit label when `variants` is omitted. */
  unit?: string
  /** Weight / pack options — Blinkit-style multi-SKU demo. */
  variants?: ProductVariant[]
}

export type StoreCategory = {
  id: string
  label: string
  imagePath?: string
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
  /** Short subtitle under the store name — falls back to `category` in UI when omitted. */
  tagline?: string
  category: string
  rating: number
  etaMins: number
  distanceKm: number
  image: string
  heroImage?: string
  offer?: string
  phone?: string
  theme?: StoreTheme
  categories?: StoreCategory[]
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
