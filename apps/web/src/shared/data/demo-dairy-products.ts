/**
 * Shared offline dairy SKU ids/prices so storefront + dashboard demos stay aligned.
 * Feature fixtures adapt these into their own view models.
 */
export type DemoDairyProductSeed = {
  id: string;
  name: string;
  category: string;
  price: number;
  sku: string;
  stock: number;
  status: 'active' | 'draft' | 'archived';
};

export const DEMO_DAIRY_PRODUCTS: DemoDairyProductSeed[] = [
  {
    id: 'p-milk-cow',
    name: 'Cow Milk',
    category: 'Milk',
    price: 60,
    sku: 'sku-cow-1l',
    stock: 48,
    status: 'active',
  },
  {
    id: 'p-milk-buffalo',
    name: 'Buffalo Milk',
    category: 'Milk',
    price: 70,
    sku: 'sku-buf-1l',
    stock: 32,
    status: 'active',
  },
  {
    id: 'p-curd-plain',
    name: 'Plain Curd',
    category: 'Curd',
    price: 40,
    sku: 'sku-curd-400',
    stock: 60,
    status: 'active',
  },
  {
    id: 'p-paneer',
    name: 'Fresh Paneer',
    category: 'Paneer',
    price: 90,
    sku: 'sku-pan-200',
    stock: 18,
    status: 'active',
  },
  {
    id: 'p-ghee',
    name: 'Cow Ghee',
    category: 'Ghee',
    price: 320,
    sku: 'sku-ghee-500',
    stock: 12,
    status: 'active',
  },
  {
    id: 'p-lassi',
    name: 'Sweet Lassi',
    category: 'Beverages',
    price: 35,
    sku: 'sku-lassi-250',
    stock: 0,
    status: 'draft',
  },
  {
    id: 'p-butter',
    name: 'White Butter',
    category: 'Butter',
    price: 55,
    sku: 'sku-butter-100',
    stock: 8,
    status: 'archived',
  },
];
