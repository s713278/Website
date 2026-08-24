# @mithra/api-client

Typed Axios client for MithraDirect OpenAPI (`/api/v3/api-docs`).

## Structure

```
src/
  schema.d.ts          # generated from openapi.json
  client/              # axios, tokens, refresh, errors, skipAuth
  services/            # domain service layer by OpenAPI tag
  index.ts
```

## Sync OpenAPI

From repo root:

```bash
npm run fetch:openapi
npm run generate:api
```

Run those two commands separately until the root `sync:api` script stops delegating to `pnpm`.

## Service coverage checklist

| Area | Status | Entry |
|------|--------|-------|
| OTP | Done | `authService.requestOtp` / `verifyOtp` |
| Public reference catalog | Done | `catalogService.getBusinessTypes` / `getCategories` / `getProductsByCategory`, with generated query types and request cancellation |
| Products | Done | `catalogService.*Product*` + `vendorsService.getProducts` / SKUs |
| Prices | Done | `pricesService.getSkuPrice` / `updateSkuPrice` |
| Order History | Done | `ordersService.userHistory` / `userHistoryPaged` |
| Account History | Done | `usersService.accountHistory` / `accountHistoryPaged` |
| Vendor onboarding operations | Wrapped, integration gated | `vendorsService.updateBusinessType` / `getContext` / `saveStorefront` / `goLive` |
| Public storefront identifier | Done | `storefrontService.get(identifier)` |

Gaps / workarounds: `docs/API_GAPS.md`.

## Usage

```ts
import {
  configureApiClient,
  authService,
  vendorsService,
  storefrontService,
  ApiError,
} from '@mithra/api-client'

configureApiClient({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  onUnauthorized: () => { /* redirect to login */ },
})

await authService.requestOtp({ ... })
const store = await storefrontService.get(identifier)
```

Feature code must not create its own Axios client. React application code imports the app façade at
`@/shared/api`; package consumers use `@mithra/api-client`.

## Session (JWT)

- Token store: `tokens.ts` (`mithra_access_token` / `mithra_refresh_token`)
- Interceptors: Bearer attach; `401` → refresh once → retry; else `onUnauthorized`
- Public calls: `{ skipAuth: true }`
- App session sync + XSS notes: `docs/SESSION.md`

## Errors

**Source of truth:** `src/client/errors.ts` (this package). App `src/shared/api` only re-exports — no duplicate mapping.

All failures normalize to `ApiError` (`status`, `code`, `message`, `url`/`path`, `kind`).

- Reads Mithra body fields: `user_message`, `failure_reason`, `reason_code`
- HTTP 200 + `success: false` → failure (`assertApiSuccess` in http helpers)
- Timeout / offline / 4xx / 5xx → user-safe copy (never Axios “status code 401” text)
- 401 after failed refresh → session message; app `onUnauthorized` handles logout
- Logging: `setApiErrorLogger(fn)` — scrubbed payload (no tokens/PII)
- App UI already uses `getErrorMessage()`; optional hook: `useApiError()` from `@/shared/api`
