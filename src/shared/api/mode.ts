import { getClientConfig } from './config'
import { isApiEnabled } from './config'

/** Prefer live HTTP when VITE_USE_API is enabled. */
export function isLiveApi() {
  return getClientConfig().useApi || isApiEnabled()
}
