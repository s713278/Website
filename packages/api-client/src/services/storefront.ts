import { apiGet, apiPost } from '../client/http';
import type { ApiEnvelope } from '../client/types';

export type StorefrontTheme = {
  primary_color?: string;
  accent_color?: string;
  logo_image?: string;
};

export type StorefrontBadge = {
  icon?: string;
  title?: string;
  subtitle?: string;
};

export type StorefrontFulfillment = {
  delivery_methods?: string[];
  home_delivery_available?: boolean;
  store_pickup_available?: boolean;
  delivery_message?: string;
  pickup_message?: string;
};

export type StorefrontCategory = {
  id?: number;
  name?: string;
  image?: string;
};

/** Vendor storefront public API (tag 20) */
export const storefrontService = {
  get: (vendorId: number | string) =>
    apiGet<ApiEnvelope>(`/v1/vendors/${vendorId}/storefront`, { skipAuth: true }),
  checkDeliveryEligibility: (vendorId: number | string, body: Record<string, unknown>) =>
    apiPost<ApiEnvelope>(`/v1/vendors/${vendorId}/delivery-eligibility`, body, { skipAuth: true }),
};
