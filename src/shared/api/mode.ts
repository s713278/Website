import { getClientConfig } from './config'
import { isApiEnabled } from './config'

/** Prefer live HTTP when VITE_USE_API is enabled. */
export function isLiveApi() {
  return getClientConfig().useApi || isApiEnabled()
}

/**
 * Plan and the console chrome show Live API billing: from the backend, or in local development demo
 * mode from the local Razorpay Test helper that stands in for it (`npm run dev:billing-helper`).
 */
export function usesLiveBilling() {
  return isLiveApi() || import.meta.env.DEV
}
