import type { DashboardVendor, VendorStatus } from '@/features/dashboard/types';
import { asRecord, pickNumber, pickString, unwrapList } from '@/shared/lib/map-utils';

function normalizeStatus(raw: string): VendorStatus {
  const s = raw.toLowerCase();
  if (s.includes('suspend') || s.includes('reject') || s.includes('block')) return 'suspended';
  if (s.includes('pend') || s.includes('review')) return 'pending';
  return 'active';
}

export function mapApiVendor(raw: unknown, index = 0): DashboardVendor {
  const o = asRecord(raw);
  return {
    id: pickString(o, ['id', 'vendor_id', 'vendorId'], `v-${index + 1}`),
    name: pickString(o, ['store_name', 'storeName', 'name', 'business_name'], `Vendor ${index + 1}`),
    phone: pickString(o, ['phone', 'mobile', 'whatsapp'], '—'),
    location: pickString(o, ['location', 'city', 'service_area', 'address'], '—'),
    status: normalizeStatus(pickString(o, ['status', 'vendor_status', 'approval_status'], 'active')),
    productCount: pickNumber(o, ['product_count', 'productCount', 'products_count'], 0),
    createdAt: pickString(o, ['created_at', 'createdAt'], new Date().toISOString()),
  };
}

export function mapApiVendors(payload: unknown): DashboardVendor[] {
  return unwrapList(payload, ['vendors']).map((item, i) => mapApiVendor(item, i));
}
