# @mithra/api-client

Typed Axios client for MithraDirect OpenAPI (`/api/v3/api-docs`).

## Structure

```
src/
  schema.d.ts          # generated from openapi.json
  client/              # axios, tokens, refresh, errors
  services/            # domain service layer by OpenAPI tag
  index.ts
```

## Sync OpenAPI

```bash
pnpm --filter @mithra/api-client sync
```

## Usage

```ts
import {
  configureApiClient,
  authService,
  vendorsService,
  storefrontService,
  ApiError,
} from '@mithra/api-client';

configureApiClient({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  onUnauthorized: () => { /* redirect to login */ },
});

await authService.requestOtp({ ... });
const store = await storefrontService.get(vendorId);
```

React Query hooks live in `apps/web/src/shared/api` (app layer).
