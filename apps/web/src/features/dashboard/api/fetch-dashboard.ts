import { ordersService, vendorsService, unwrapData } from '@mithra/api-client';
import { mapApiOrders } from '@/features/dashboard/api/map-orders';
import { mapApiProducts } from '@/features/dashboard/api/map-products';
import { mapApiVendors } from '@/features/dashboard/api/map-vendors';
import type { DashboardOrder, DashboardProduct, DashboardVendor } from '@/features/dashboard/types';

export async function fetchVendorOrders(vendorId: string | number): Promise<DashboardOrder[]> {
  const res = await ordersService.listByVendor(vendorId);
  return mapApiOrders(unwrapData(res) ?? res);
}

export async function fetchVendorProducts(vendorId: string | number): Promise<DashboardProduct[]> {
  const res = await vendorsService.getProducts(vendorId);
  return mapApiProducts(unwrapData(res) ?? res);
}

export async function fetchVendorsList(): Promise<DashboardVendor[]> {
  const res = await vendorsService.list();
  return mapApiVendors(unwrapData(res) ?? res);
}

export async function patchOrderStatus(
  vendorId: string | number,
  orderId: string,
  status: string,
) {
  return ordersService.updateByVendor(vendorId, orderId, { status });
}

export async function bulkPatchOrderStatus(
  vendorId: string | number,
  orderIds: string[],
  status: string,
) {
  return ordersService.bulkStatusUpdate(vendorId, { order_ids: orderIds, status });
}

export async function patchVendorProduct(
  vendorId: string | number,
  productId: string,
  body: Record<string, unknown>,
) {
  return vendorsService.updateProduct(vendorId, productId, body);
}

export async function createVendorSku(vendorId: string | number, body: Record<string, unknown>) {
  return vendorsService.createSku(vendorId, body);
}

export async function deleteVendorSku(vendorId: string | number, skuId: string) {
  return vendorsService.deleteSku(vendorId, skuId);
}
