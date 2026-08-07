export type StoreCategory = {
  id: string;
  name: string;
  image?: string;
  icon?: string;
};

export type StoreSku = {
  id: string;
  label: string;
  price: number;
  listPrice?: number;
  active: boolean;
  inStock: boolean;
};

export type StoreProduct = {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  image: string;
  images: string[];
  color: string;
  icon: string;
  rating: number;
  reviewCount: number;
  popular: boolean;
  skus: StoreSku[];
  ingredients?: string;
  nutrition?: string;
  storage?: string;
  deliveryInfo?: string;
  inStock: boolean;
  minPrice: number;
};

export type StoreReview = {
  id: string;
  author: string;
  rating: number;
  body: string;
  date: string;
};

export type StoreMeta = {
  vendorId: string | null;
  storeName: string;
  tagline: string;
  location: string;
  whatsapp: string;
  themeColor: string;
  logoUrl: string;
  bannerUrl: string;
  shareLink?: string;
};

export type CartLine = {
  productId: string;
  skuId: string;
  name: string;
  label: string;
  price: number;
  image: string;
  icon: string;
  color: string;
  qty: number;
  /** Remote cart line id when synced via cartService */
  remoteItemId?: string | number;
};

export type ProductSort = 'popular' | 'price-asc' | 'price-desc' | 'name';

export type ProductFilters = {
  categoryId: string;
  search: string;
  minPrice: number;
  maxPrice: number;
  inStockOnly: boolean;
  sort: ProductSort;
};

export type BrowseMode = 'infinite' | 'pages';

export type StoreCatalog = {
  meta: StoreMeta;
  categories: StoreCategory[];
  products: StoreProduct[];
  source: 'api' | 'demo' | 'draft';
};
