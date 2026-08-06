/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string;
  readonly VITE_APP_ENV?: 'development' | 'staging' | 'production';
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_USE_API?: string;
  readonly VITE_MARKETING_URL?: string;
  readonly VITE_STOREFRONT_URL?: string;
  readonly VITE_VENDOR_APP_URL?: string;
  readonly VITE_ENABLE_QUERY_DEVTOOLS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
