import type {
  AuditLogEntry,
  DashboardOrder,
  DashboardProduct,
  DashboardVendor,
  StoreShareInfo,
} from '@/features/dashboard/types';
import { DEMO_DAIRY_PRODUCTS } from '@/shared/data/demo-dairy-products';

export const DEMO_VENDOR_ID = 'demo-vendor-1';

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  d.setHours(10 + (offset % 6), 15, 0, 0);
  return d.toISOString();
};

export const DEMO_STORE: StoreShareInfo = {
  storeName: 'Green Valley Dairy',
  slug: 'green-valley-dairy',
  storeUrl: `${typeof window !== 'undefined' ? window.location.origin : ''}/store`,
  whatsapp: '9876543210',
  location: 'Hyderabad',
  themeColor: '#10b981',
  planLabel: 'Free plan',
};

export const DEMO_ORDERS: DashboardOrder[] = [
  {
    id: 'ORD-1042',
    customer: 'Ananya R.',
    phone: '98XXXX3210',
    items: 'Cow Milk × 1',
    itemCount: 1,
    amount: 60,
    status: 'new',
    createdAt: day(0),
  },
  {
    id: 'ORD-1041',
    customer: 'Ravi K.',
    phone: '99XXXX8844',
    items: '2 items',
    itemCount: 2,
    amount: 130,
    status: 'confirmed',
    createdAt: day(0),
  },
  {
    id: 'ORD-1038',
    customer: 'Sneha M.',
    phone: '97XXXX1122',
    items: 'Cow Milk × 2',
    itemCount: 2,
    amount: 120,
    status: 'out',
    createdAt: day(0),
  },
  {
    id: 'ORD-1031',
    customer: 'Karthik P.',
    phone: '96XXXX5566',
    items: 'Gift pack',
    itemCount: 1,
    amount: 249,
    status: 'delivered',
    createdAt: day(1),
  },
  {
    id: 'ORD-1028',
    customer: 'Meera S.',
    phone: '95XXXX7788',
    items: 'Plain Curd × 3',
    itemCount: 3,
    amount: 120,
    status: 'delivered',
    createdAt: day(2),
  },
  {
    id: 'ORD-1022',
    customer: 'Arjun V.',
    phone: '94XXXX3344',
    items: 'Buffalo Milk × 1',
    itemCount: 1,
    amount: 70,
    status: 'cancelled',
    createdAt: day(3),
  },
  {
    id: 'ORD-1019',
    customer: 'Divya N.',
    phone: '93XXXX2211',
    items: 'Paneer 200g × 2',
    itemCount: 2,
    amount: 180,
    status: 'delivered',
    createdAt: day(4),
  },
  {
    id: 'ORD-1015',
    customer: 'Vikram T.',
    phone: '92XXXX6677',
    items: 'Ghee 500ml × 1',
    itemCount: 1,
    amount: 320,
    status: 'confirmed',
    createdAt: day(5),
  },
];

export const DEMO_PRODUCTS: DashboardProduct[] = DEMO_DAIRY_PRODUCTS.map((p, i) => ({
  id: p.id,
  name: p.name,
  category: p.category,
  price: p.price,
  stock: p.stock,
  status: p.status,
  sku: p.sku,
  updatedAt: day(i === DEMO_DAIRY_PRODUCTS.length - 1 ? 6 : Math.min(i, 3)),
}));

export const DEMO_VENDORS: DashboardVendor[] = [
  {
    id: 'v-1',
    name: 'Green Valley Dairy',
    phone: '9876543210',
    location: 'Hyderabad',
    status: 'active',
    productCount: 7,
    createdAt: day(30),
  },
  {
    id: 'v-2',
    name: 'Sunrise Kirana',
    phone: '9865432109',
    location: 'Secunderabad',
    status: 'active',
    productCount: 42,
    createdAt: day(45),
  },
  {
    id: 'v-3',
    name: 'Fresh Farm Hub',
    phone: '9854321098',
    location: 'Gachibowli',
    status: 'pending',
    productCount: 3,
    createdAt: day(2),
  },
  {
    id: 'v-4',
    name: 'City Spices Co',
    phone: '9843210987',
    location: 'Madhapur',
    status: 'suspended',
    productCount: 15,
    createdAt: day(60),
  },
];

export const DEMO_AUDIT_SEED: AuditLogEntry[] = [
  {
    id: 'aud-1',
    actor: 'vendor@demo',
    actorRole: 'vendor',
    action: 'update',
    entity: 'product',
    entityId: 'p-milk-cow',
    summary: 'Updated price for Cow Milk',
    timestamp: day(0),
  },
  {
    id: 'aud-2',
    actor: 'admin@demo',
    actorRole: 'admin',
    action: 'status_change',
    entity: 'vendor',
    entityId: 'v-3',
    summary: 'Marked Fresh Farm Hub as pending review',
    timestamp: day(1),
  },
  {
    id: 'aud-3',
    actor: 'vendor@demo',
    actorRole: 'vendor',
    action: 'status_change',
    entity: 'order',
    entityId: 'ORD-1041',
    summary: 'Order ORD-1041 confirmed',
    timestamp: day(1),
  },
];
