export type SkuType = 'ITEM' | 'SERVICE' | 'DIGITAL'

export type ProductVariant = {
  id: string              // sku_id as string
  unit: string            // sku_size
  price: number           // sale_price
  listPrice?: number
  onSale: boolean         // on_sale
  skuType: SkuType        // sku_type
  discount?: number
  active?: boolean
}

export type Product = {
  id: string  // vendor_product_id
  name: string
  description: string
  /** List price when there are no variants; otherwise the default variant price. */
  price: number  // default variant sale_price (for cart fallback)
  veg: boolean
  popular?: boolean
  imageUrl?: string
  /** Single-SKU demo products without a variants array. */
  unit?: string
  images?: string[]
  rating?: number
  reviewCount?: number
  spiceLevel?: string
  ingredients?: string
  inStock?: boolean
  category?: string       // category_name — display + name filter
  categoryId?: number     // category_id — numeric filter + API ?category_id=
  minPrice?: number       // min_sale_price
  maxPrice?: number       // max_sale_price
  startingAt?: number     // starting_at
  defaultVariantId?: string  // default_sku_id
  variantsCount?: number
  variants?: ProductVariant[]
}

export type ProductPage = {
  items: Product[]
  pageNumber: number
  pageSize: number
  totalElements: number
  totalPages: number
  lastPage: boolean
}

export type StoreCategory = {
  label: string
  imagePath?: string
  categoryId?: number
}

export type StoreTheme = {
  primaryColor: string
  accentColor: string
  logoImage?: string
  /** Hex matched against BG_PRESETS; anything off-list resolves to the default swatch. */
  backgroundColor?: string
  /** CSS family name as sent by the API, e.g. "DM Sans". Matched against FONT_PRESETS. */
  fontFamily?: string
  textColor?: string
  buttonShape?: 'PILL' | 'ROUNDED' | 'SQUARE'
  cardStyle?: 'FLAT' | 'SHADOW' | 'BORDER'
  /** API label only — colors come from hex fields, not this preset name. */
  themePreset?: string
}
export type StoreTrustItem = {
  icon: string
  title: string
  subtitle: string
}

export type StoreFulfillment = {
  homeDeliveryAvailable: boolean
  storePickupAvailable: boolean
}

export type Store = {
  id: string
  name: string
  tagline?: string
  description?: string
  /** City / area line for the hero (from business_location when present). */
  location?: string
  heroBadges?: string[]
  trustStrip?: StoreTrustItem[]
  fulfillment?: StoreFulfillment
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
