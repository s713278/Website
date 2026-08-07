import type { DashboardOrder, OrderStatus } from '@/features/dashboard/types';
import { asRecord, pickNumber, pickString, unwrapList } from '@/shared/lib/map-utils';

function normalizeStatus(raw: string): OrderStatus {
  const s = raw.toLowerCase();
  if (s.includes('cancel')) return 'cancelled';
  if (s.includes('deliver')) return 'delivered';
  if (s.includes('out') || s.includes('ship')) return 'out';
  if (s.includes('confirm') || s.includes('accept') || s.includes('process')) return 'confirmed';
  return 'new';
}

export function mapApiOrder(raw: unknown, index = 0): DashboardOrder {
  const o = asRecord(raw);
  const customerObj = asRecord(o.customer);
  const id = pickString(o, ['id', 'order_id', 'orderId', 'order_number'], `ORD-${index + 1}`);
  const statusRaw = pickString(o, ['status', 'order_status', 'orderStatus'], 'new');
  const items = Array.isArray(o.items) ? o.items : [];
  const itemLabel =
    pickString(o, ['items_label', 'itemsLabel', 'summary']) ||
    (items.length ? `${items.length} items` : 'Items');

  return {
    id,
    customer:
      pickString(o, ['customer_name', 'customerName', 'name']) ||
      pickString(customerObj, ['name', 'full_name'], 'Customer'),
    phone:
      pickString(o, ['customer_phone', 'phone', 'mobile']) ||
      pickString(customerObj, ['phone', 'mobile'], '—'),
    items: itemLabel,
    itemCount: pickNumber(o, ['item_count', 'itemCount'], items.length || 1),
    amount: pickNumber(o, ['amount', 'total', 'grand_total', 'order_total'], 0),
    status: normalizeStatus(statusRaw),
    createdAt: pickString(o, ['created_at', 'createdAt', 'ordered_at', 'timestamp'], new Date().toISOString()),
  };
}

export function mapApiOrders(payload: unknown): DashboardOrder[] {
  return unwrapList(payload, ['orders']).map((item, i) => mapApiOrder(item, i));
}
