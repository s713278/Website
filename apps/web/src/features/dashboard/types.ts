export type OrderStatus = 'new' | 'confirmed' | 'out' | 'delivered' | 'cancelled';

export type ProductStatus = 'active' | 'draft' | 'archived';

export type VendorStatus = 'active' | 'pending' | 'suspended';

export type DashboardOrder = {
  id: string;
  customer: string;
  phone: string;
  items: string;
  itemCount: number;
  amount: number;
  status: OrderStatus;
  createdAt: string;
};

export type DashboardProduct = {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  status: ProductStatus;
  sku?: string;
  updatedAt: string;
};

export type DashboardVendor = {
  id: string;
  name: string;
  phone: string;
  location: string;
  status: VendorStatus;
  productCount: number;
  createdAt: string;
};

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'bulk_update'
  | 'bulk_delete'
  | 'export'
  | 'status_change';

export type AuditEntity = 'order' | 'product' | 'vendor' | 'settings' | 'table';

export type AuditLogEntry = {
  id: string;
  actor: string;
  actorRole: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  summary: string;
  timestamp: string;
};

export type TableFilters = {
  search: string;
  status: string;
  dateFrom: string;
  dateTo: string;
};

export type DashboardNavItem = {
  to: string;
  label: string;
  icon: string;
  roles?: Array<'vendor' | 'admin'>;
  badgeKey?: 'orders';
};

export type StoreShareInfo = {
  storeName: string;
  slug: string;
  storeUrl: string;
  whatsapp: string;
  location: string;
  themeColor: string;
  planLabel: string;
};
