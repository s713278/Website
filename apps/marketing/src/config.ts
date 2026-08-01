/** Cross-app URLs for local monorepo / production. */
export const VENDOR_APP_URL = import.meta.env.VITE_VENDOR_APP_URL || 'http://localhost:5174';
export const STOREFRONT_URL = import.meta.env.VITE_STOREFRONT_URL || 'http://localhost:5175';
export const SAMPLE_STORE_PATH = '/sai-ram-home-foods';

export function vendorOnboardingUrl() {
  return `${VENDOR_APP_URL}/onboarding`;
}

export function sampleStoreUrl(view?: string) {
  const base = `${STOREFRONT_URL}${SAMPLE_STORE_PATH}`;
  return view ? `${base}?view=${view}` : base;
}
