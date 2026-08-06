export const queryKeys = {
  root: ['mithra'] as const,
  auth: {
    all: ['mithra', 'auth'] as const,
    profile: () => ['mithra', 'auth', 'profile'] as const,
  },
  vendors: {
    all: ['mithra', 'vendors'] as const,
    detail: (id: number | string) => ['mithra', 'vendors', String(id)] as const,
    products: (id: number | string) => ['mithra', 'vendors', String(id), 'products'] as const,
    skus: (id: number | string) => ['mithra', 'vendors', String(id), 'skus'] as const,
    orders: (id: number | string) => ['mithra', 'vendors', String(id), 'orders'] as const,
    storefront: (id: number | string) => ['mithra', 'vendors', String(id), 'storefront'] as const,
    cart: (id: number | string) => ['mithra', 'vendors', String(id), 'cart'] as const,
    subs: (id: number | string) => ['mithra', 'vendors', String(id), 'subs'] as const,
  },
  catalog: {
    all: ['mithra', 'catalog'] as const,
    categories: () => ['mithra', 'catalog', 'categories'] as const,
    grouped: () => ['mithra', 'catalog', 'categories', 'grouped'] as const,
    businessTypes: () => ['mithra', 'catalog', 'business-types'] as const,
    products: (categoryId: number | string) =>
      ['mithra', 'catalog', 'categories', String(categoryId), 'products'] as const,
  },
  users: {
    detail: (id: number | string) => ['mithra', 'users', String(id)] as const,
    dashboard: (id: number | string) => ['mithra', 'users', String(id), 'dashboard'] as const,
    orders: (id: number | string) => ['mithra', 'users', String(id), 'orders'] as const,
  },
  orders: {
    detail: (id: number | string) => ['mithra', 'orders', String(id)] as const,
  },
  platform: {
    faqs: () => ['mithra', 'platform', 'faqs'] as const,
    measurements: () => ['mithra', 'platform', 'measurements'] as const,
  },
} as const;
