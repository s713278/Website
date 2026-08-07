import type { OrderStatus, ProductStatus, VendorStatus } from '@/features/dashboard/types';

export { formatDate, formatDateTime, formatInr } from '@/shared/lib/format';

export function orderStatusLabel(status: OrderStatus) {
  if (status === 'out') return 'Out for delivery';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function productStatusLabel(status: ProductStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function vendorStatusLabel(status: VendorStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function statusTone(status: string): string {
  switch (status) {
    case 'new':
    case 'pending':
      return 'bg-amber-100 text-amber-900';
    case 'confirmed':
    case 'active':
      return 'bg-[color-mix(in_srgb,var(--store-theme)_18%,#fff)] text-[color-mix(in_srgb,var(--store-theme)_85%,#000)]';
    case 'out':
      return 'bg-sky-100 text-sky-900';
    case 'delivered':
      return 'bg-emerald-100 text-emerald-900';
    case 'cancelled':
    case 'suspended':
    case 'archived':
      return 'bg-rose-100 text-rose-900';
    case 'draft':
      return 'bg-slate-100 text-slate-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}
