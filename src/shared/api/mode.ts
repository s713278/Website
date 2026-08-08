import { getClientConfig, isApiEnabled } from './config'

/** Prefer live HTTP when VITE_USE_API is enabled. */
export function useLiveApi() {
  return getClientConfig().useApi || isApiEnabled()
}
