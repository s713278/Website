export const USE_API = import.meta.env.VITE_USE_API === 'true';
export const SAMPLE_VENDOR_ID = Number(import.meta.env.VITE_SAMPLE_VENDOR_ID || 0);
export const CHECKOUT_CHANNEL = import.meta.env.VITE_CHECKOUT_CHANNEL || 'DEEPLINK';
export const MARKETING_URL = import.meta.env.VITE_MARKETING_URL || 'http://localhost:5173';
export const VENDOR_APP_URL = import.meta.env.VITE_VENDOR_APP_URL || 'http://localhost:5174';
