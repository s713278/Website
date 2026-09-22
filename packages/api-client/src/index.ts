export type ApiEnvelope<T = unknown> = {
  message?: string;
  timestamp?: string;
  success?: boolean;
  status?: number;
  data?: T;
};

const TOKEN_KEY = 'mithra_access_token';
const REFRESH_KEY = 'mithra_refresh_token';

export function getApiBaseUrl(): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
  return (env?.VITE_API_BASE_URL || 'https://subscriptionapp-wgf8.onrender.com/api').replace(
    /\/$/,
    '',
  );
}

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function setTokens(access?: string | null, refresh?: string | null) {
  try {
    if (access) localStorage.setItem(TOKEN_KEY, access);
    else localStorage.removeItem(TOKEN_KEY);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
    else if (refresh === null) localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* ignore */
  }
}

export function clearTokens() {
  setTokens(null, null);
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

async function tryRefresh(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  const res = await fetch(`${getApiBaseUrl()}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!res.ok) {
    clearTokens();
    return false;
  }
  const json = (await res.json()) as ApiEnvelope<{
    access_token?: string;
    refresh_token?: string;
    token?: string;
  }>;
  const data = json.data || (json as unknown as Record<string, string>);
  const access = data.access_token || data.token;
  const nextRefresh = data.refresh_token || refresh;
  if (access) setTokens(access, nextRefresh);
  return !!access;
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.auth !== false) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const url = path.startsWith('http') ? path : `${getApiBaseUrl()}${path.startsWith('/') ? '' : '/'}${path}`;
  let res = await fetch(url, {
    method: options.method || (options.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  if (res.status === 401 && options.auth !== false) {
    const ok = await tryRefresh();
    if (ok) {
      const token = getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      res = await fetch(url, {
        method: options.method || (options.body !== undefined ? 'POST' : 'GET'),
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: options.signal,
      });
    }
  }

  const text = await res.text();
  let body: unknown = undefined;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const msg =
      typeof body === 'object' && body && 'message' in body
        ? String((body as { message: string }).message)
        : `API ${res.status}`;
    throw new ApiError(msg, res.status, body);
  }

  return body as T;
}

export async function unwrapData<T>(envelope: ApiEnvelope<T> | T): Promise<T> {
  if (envelope && typeof envelope === 'object' && 'data' in (envelope as object)) {
    return (envelope as ApiEnvelope<T>).data as T;
  }
  return envelope as T;
}

/* ——— Auth ——— */

export type MobileSignUpRequest = {
  country_code: string;
  mobile_number: string;
  reg_platform: string;
  user_role?: string;
};

export type OTPVerificationRequest = {
  country_code: string;
  mobile_number: number | string;
  otp: string;
};

export async function requestOtp(body: MobileSignUpRequest) {
  return apiRequest<ApiEnvelope>('/v1/auth/request-otp', { method: 'POST', body, auth: false });
}

export async function verifyOtp(body: OTPVerificationRequest) {
  const res = await apiRequest<
    ApiEnvelope<{ access_token?: string; refresh_token?: string; token?: string; user?: unknown }>
  >('/v1/auth/verify-otp', { method: 'POST', body, auth: false });
  const data = res.data || (res as unknown as Record<string, string>);
  const access = (data as { access_token?: string; token?: string }).access_token || (data as { token?: string }).token;
  const refresh = (data as { refresh_token?: string }).refresh_token;
  if (access) setTokens(access, refresh || null);
  return res;
}

export async function getProfile() {
  return apiRequest<ApiEnvelope>('/v1/auth/profile');
}

export async function signOut() {
  try {
    await apiRequest('/v1/auth/signout', { method: 'POST' });
  } finally {
    clearTokens();
  }
}

/* ——— Vendors ——— */

export async function createVendor(body: Record<string, unknown>) {
  return apiRequest<ApiEnvelope>('/v1/vendors/', { method: 'POST', body });
}

export async function getVendor(vendorId: number | string) {
  return apiRequest<ApiEnvelope>(`/v1/vendors/${vendorId}`);
}

export async function updateVendor(vendorId: number | string, body: Record<string, unknown>) {
  return apiRequest<ApiEnvelope>(`/v1/vendors/${vendorId}`, { method: 'PUT', body });
}

export async function patchVendorStatus(vendorId: number | string, body: Record<string, unknown>) {
  return apiRequest<ApiEnvelope>(`/v1/vendors/${vendorId}/vendor_status`, {
    method: 'PATCH',
    body,
  });
}

export async function putCheckoutOptions(vendorId: number | string, body: Record<string, unknown>) {
  return apiRequest<ApiEnvelope>(`/v1/vendors/${vendorId}/checkout_options`, {
    method: 'PUT',
    body,
  });
}

export async function getCheckoutOptions(vendorId: number | string) {
  return apiRequest<ApiEnvelope>(`/v1/vendors/${vendorId}/checkout_options`, { auth: false });
}

export async function getVendorProducts(vendorId: number | string) {
  return apiRequest<ApiEnvelope>(`/v1/vendors/${vendorId}/products`, { auth: false });
}

export async function getVendorProductSkus(vendorId: number | string) {
  return apiRequest<ApiEnvelope>(`/v1/vendors/${vendorId}/products/skus`, { auth: false });
}

export async function searchVendorSkus(vendorId: number | string, q?: string) {
  const qs = q ? `?q=${encodeURIComponent(q)}` : '';
  return apiRequest<ApiEnvelope>(`/v1/vendors/${vendorId}/skus/search${qs}`, { auth: false });
}

/* ——— Vendor Storefront API (tag 20) ——— */

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
  business_type?: string;
  image_path?: string;
  description?: string;
};

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
  theme?: StorefrontTheme;
  hero_badges?: string[];
  fulfillment?: StorefrontFulfillment;
  categories?: StorefrontCategory[];
  products?: StorefrontProduct[];
  trust_strip?: StorefrontBadge[];
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

/** Complete public storefront payload for one vendor. */
export async function getVendorStorefront(vendorId: number | string) {
  return apiRequest<ApiEnvelope<VendorStorefront>>(
    `/v1/vendors/${vendorId}/storefront`,
    { auth: false },
  );
}

/** Check if vendor can deliver to an address (pincode and/or lat/lng). */
export async function checkDeliveryEligibility(
  vendorId: number | string,
  address: Record<string, string>,
) {
  return apiRequest<ApiEnvelope<DeliveryEligibility>>(
    `/v1/vendors/${vendorId}/delivery-eligibility`,
    { method: 'POST', body: address, auth: false },
  );
}

export async function uploadVendorImage(vendorId: number | string, formData: FormData) {
  const token = getAccessToken();
  const res = await fetch(`${getApiBaseUrl()}/v1/vendors/${vendorId}/images`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });
  if (!res.ok) throw new ApiError('Image upload failed', res.status, await res.text());
  return res.json();
}

export async function createSku(vendorId: number | string, body: Record<string, unknown>) {
  return apiRequest<ApiEnvelope>(`/v1/vendors/${vendorId}/skus`, { method: 'POST', body });
}

/* ——— Cart & orders ——— */

export async function getCart(vendorId: number | string) {
  return apiRequest<ApiEnvelope>(`/v1/vendors/${vendorId}/cart`);
}

export async function addCartItem(vendorId: number | string, body: Record<string, unknown>) {
  return apiRequest<ApiEnvelope>(`/v1/vendors/${vendorId}/cart/items`, { method: 'POST', body });
}

export async function upsertCartItem(vendorId: number | string, body: Record<string, unknown>) {
  return apiRequest<ApiEnvelope>(`/v1/vendors/${vendorId}/cart/items`, { method: 'PUT', body });
}

export async function updateCartItem(
  vendorId: number | string,
  cartItemId: number | string,
  body: Record<string, unknown>,
) {
  return apiRequest<ApiEnvelope>(`/v1/vendors/${vendorId}/cart/items/${cartItemId}`, {
    method: 'PUT',
    body,
  });
}

export async function removeCartItem(vendorId: number | string, cartItemId: number | string) {
  return apiRequest<ApiEnvelope>(`/v1/vendors/${vendorId}/cart/items/${cartItemId}`, {
    method: 'DELETE',
  });
}

export async function clearCart(vendorId: number | string) {
  return apiRequest<ApiEnvelope>(`/v1/vendors/${vendorId}/cart`, { method: 'DELETE' });
}

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

export async function createOrderFromCart(body: CreateOrderFromCartRequest) {
  return apiRequest<ApiEnvelope>(`/v1/orders/from-cart`, {
    method: 'POST',
    body: { ...body, order_source: body.order_source || 'WHATSAPP_DEEPLINK' },
  });
}

export async function getOrder(orderId: number | string) {
  return apiRequest<ApiEnvelope>(`/v1/orders/${orderId}`);
}

export async function getVendorOrders(vendorId: number | string) {
  return apiRequest<ApiEnvelope>(`/v1/vendors/${vendorId}/orders/`);
}

export async function getCategories() {
  return apiRequest<ApiEnvelope>(`/v1/categories/`, { auth: false });
}

export async function getCategoriesGrouped() {
  return apiRequest<ApiEnvelope>(`/v1/categories/grouped`, { auth: false });
}

/**
 * Resolve store by public slug.
 * Prefer GET /v1/vendors/{id}/storefront once vendor_id is known.
 * Public slug-only lookup is still a backend gap — use vendor_id / env map.
 */
export async function getPublicStoreBySlug(slug: string) {
  return apiRequest<ApiEnvelope>(`/v1/public/stores/${encodeURIComponent(slug)}`, { auth: false });
}

/** Load storefront by vendor id and unwrap envelope data. */
export async function loadVendorStorefront(vendorId: number | string): Promise<VendorStorefront> {
  const res = await getVendorStorefront(vendorId);
  return (res.data || (res as unknown as VendorStorefront)) as VendorStorefront;
}

export type { paths, components, operations } from './schema';
