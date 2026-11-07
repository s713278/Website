/** Re-export error helpers from `@mithra/api-client`. */
export {
  ApiError,
  apiErrorFromResponse,
  assertApiSuccess,
  getErrorMessage,
  isApiError,
  logApiError,
  setApiErrorLogger,
  toApiError,
  toLoggableApiError,
} from '@mithra/api-client'
export type { ApiErrorKind, ApiErrorLogger } from '@mithra/api-client'
