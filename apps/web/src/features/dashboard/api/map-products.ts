import type { DashboardProduct, ProductStatus } from '@/features/dashboard/types';
import { asRecord, pickNumber, pickString, unwrapList } from '@/shared/lib/map-utils';

function normalizeStatus(raw: string, stock: number): ProductStatus {
  const s = raw.toLowerCase();
  if (s.includes('archiv')) return 'archived';
  if (s.includes('draft') || s.includes('inactive')) return 'draft';
  if (!raw && stock <= 0) return 'draft';
  return 'active';
}

export function mapApiProduct(raw: unknown, index = 0): DashboardProduct {
  const o = asRecord(raw);
  const variants = Array.isArray(o.variants) ? o.variants : Array.isArray(o.skus) ? o.skus : [];
  const firstVariant = asRecord(variants[0]);
  const price =
    pickNumber(o, ['price', 'min_price', 'minPrice', 'base_price']) ||
    pickNumber(firstVariant, ['price', 'sale_price'], 0);
  const stock =
    pickNumber(o, ['stock', 'quantity', 'inventory']) ||
    pickNumber(firstVariant, ['stock', 'quantity'], 0);
  const statusRaw = pickString(o, ['status', 'product_status'], '');

  return {
    id: pickString(o, ['id', 'product_id', 'productId'], `p-${index + 1}`),
    name: pickString(o, ['name', 'product_name', 'title'], `Product ${index + 1}`),
    category: pickString(o, ['category', 'category_name', 'categoryName'], 'General'),
    price,
    stock,
    status: normalizeStatus(statusRaw, stock),
    sku: pickString(o, ['sku', 'sku_code']) || pickString(firstVariant, ['id', 'sku', 'label']) || undefined,
    updatedAt: pickString(o, ['updated_at', 'updatedAt', 'created_at', 'createdAt'], new Date().toISOString()),
  };
}

export function mapApiProducts(payload: unknown): DashboardProduct[] {
  return unwrapList(payload, ['products']).map((item, i) => mapApiProduct(item, i));
}
