import { apiRequest, getHttp } from '../client/http';
import type { ApiEnvelope } from '../client/types';
import type { components } from '../schema';
import { vendorsService } from './vendors';
import { catalogService } from './catalog';
import { cartService } from './cart';
import { ordersService } from './orders';
import { storefrontService } from './storefront';
import { imagesService } from './platform';

export type StorefrontProduct = {
  id?: number;
  name?: string;
  description?: string;
  measurement_unit_id?: number;
  image_path?: string;
  category_id?: number;
  popular?: boolean;
};

export type VendorStorefront = {
  vendor_id?: number;
  store_identifier?: string;
  business_name?: string;
  description?: string;
  banner_image?: string;
  thumbnail_image?: string;
  verified?: boolean;
  theme?: import('./storefront').StorefrontTheme;
  hero_badges?: string[];
  fulfillment?: import('./storefront').StorefrontFulfillment;
  categories?: import('./storefront').StorefrontCategory[];
  products?: StorefrontProduct[];
  trust_strip?: import('./storefront').StorefrontBadge[];
  share_link?: string;
  support_whatsapp_number?: string;
};

export type DeliveryEligibility = {
  vendor_id?: number;
  business_name?: string;
  deliverable?: boolean;
  matched_by?: 'ZIPCODE' | 'GEO_POLYGON' | 'GLOBAL_GEO' | 'NONE' | string;
  reason?: string;
};

export type CreateOrderFromCartRequest = {
  vendor_id: number;
  delivery_method: string;
  address_id?: number;
  delivery_date?: string;
  payment_type_id?: number;
  clear_cart?: boolean;
  notes?: string;
  customer_id?: number;
  order_source?: string;
  order_timing_type?: string;
  pickup_address_id?: number;
  pickup_slot?: string;
};

/** ——— Backward-compatible function exports (existing apps) ——— */

export async function createVendor(body: Record<string, unknown>) {
  return vendorsService.create(body);
}

export async function getVendor(vendorId: number | string) {
  return vendorsService.getById(vendorId);
}

export async function updateVendor(vendorId: number | string, body: Record<string, unknown>) {
  return vendorsService.update(vendorId, body);
}

export async function patchVendorStatus(vendorId: number | string, body: Record<string, unknown>) {
  return vendorsService.patchStatus(vendorId, body);
}

export async function putCheckoutOptions(vendorId: number | string, body: Record<string, unknown>) {
  return vendorsService.saveCheckoutOptions(vendorId, body);
}

export async function getCheckoutOptions(vendorId: number | string) {
  return vendorsService.getCheckoutOptions(vendorId);
}

export async function getVendorProducts(vendorId: number | string) {
  return vendorsService.getProducts(vendorId);
}

export async function getVendorProductSkus(vendorId: number | string) {
  return vendorsService.getProductSkus(vendorId);
}

export async function searchVendorSkus(vendorId: number | string, q?: string) {
  return vendorsService.searchSkus(vendorId, q);
}

export async function getVendorStorefront(vendorId: number | string) {
  return storefrontService.get(vendorId) as Promise<ApiEnvelope<VendorStorefront>>;
}

export async function checkDeliveryEligibility(
  vendorId: number | string,
  address: Record<string, string>,
) {
  return storefrontService.checkDeliveryEligibility(vendorId, address) as Promise<
    ApiEnvelope<DeliveryEligibility>
  >;
}

export async function uploadVendorImage(vendorId: number | string, formData: FormData) {
  return imagesService.upload(vendorId, formData);
}

export async function createSku(
  vendorId: number | string,
  body: components['schemas']['ItemSkuCreateRequest'],
) {
  return vendorsService.createSku(vendorId, body);
}

export async function getCart(vendorId: number | string) {
  return cartService.get(vendorId);
}

export async function addCartItem(vendorId: number | string, body: Record<string, unknown>) {
  return cartService.addItem(vendorId, body);
}

export async function upsertCartItem(vendorId: number | string, body: Record<string, unknown>) {
  return cartService.upsertItem(vendorId, body);
}

export async function updateCartItem(
  vendorId: number | string,
  cartItemId: number | string,
  body: Record<string, unknown>,
) {
  return cartService.updateItemQty(vendorId, cartItemId, body);
}

export async function removeCartItem(vendorId: number | string, cartItemId: number | string) {
  return cartService.removeItem(vendorId, cartItemId);
}

export async function clearCart(vendorId: number | string) {
  return cartService.clear(vendorId);
}

export async function createOrderFromCart(body: CreateOrderFromCartRequest) {
  return ordersService.createFromCart({
    ...body,
    order_source: body.order_source || 'WHATSAPP_DEEPLINK',
  });
}

export async function getOrder(orderId: number | string) {
  return ordersService.get(orderId);
}

export async function getVendorOrders(vendorId: number | string) {
  return ordersService.listByVendor(vendorId);
}

export async function getCategories() {
  return catalogService.getCategories();
}

export async function getCategoriesGrouped() {
  return catalogService.getCategoriesGrouped();
}

export async function getPublicStoreBySlug(slug: string) {
  return storefrontService.get(slug);
}

export async function loadVendorStorefront(vendorId: number | string): Promise<VendorStorefront> {
  const res = await getVendorStorefront(vendorId);
  return (res.data || (res as unknown as VendorStorefront)) as VendorStorefront;
}

export { apiRequest, getHttp, imagesService };
