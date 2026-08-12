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
pnpm fetch:openapi
pnpm generate:api
```

Or: `pnpm --filter @mithra/api-client sync` / `npm run sync:api`

## Service coverage checklist

| Area | Status | Entry |
|------|--------|-------|
| OTP | Done | `authService.requestOtp` / `verifyOtp` |
| Categories | Done | `catalogService.getCategories` / `getCategoriesGrouped` |
| Products | Done | `catalogService.*Product*` + `vendorsService.getProducts` / SKUs |
| Prices | Done | `pricesService.getSkuPrice` / `updateSkuPrice` |
| Order History | Done | `ordersService.userHistory` / `userHistoryPaged` |
| Account History | Done | `usersService.accountHistory` / `accountHistoryPaged` |

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
const store = await storefrontService.get(vendorId)
```

Feature code must not create its own Axios client — import from `@mithra/api-client` (or the app shared wrapper over it).
