/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_APP_ENV: string
  readonly VITE_USE_API: string
  readonly VITE_GOOGLE_MAPS_API_KEY: string
  readonly VITE_PUBLIC_SITE_URL: string
  readonly VITE_RAZORPAY_TEST_KEY_ID?: string
  readonly VITE_RAZORPAY_TEST_SUBSCRIPTION_ID?: string
  readonly VITE_RAZORPAY_TEST_FUTURE_SUBSCRIPTION_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
