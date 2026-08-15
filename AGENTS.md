# AGENTS.md — MithraDirect

Guidance for coding agents (Cursor, Claude, Codex, etc.) working in this repo.
Prefer this file over any older doc that mentions `apps/web`, `src/features/*`, or root `assets/`
HTML — those describe a layout that does not exist here.

Human setup detail lives in [README.md](./README.md). Keep both in sync when architecture changes.
Deep API detail lives in [docs/API_ARCHITECTURE.md](./docs/API_ARCHITECTURE.md).

---

## What this repo is

A **Vite + React 19 + TypeScript** app (`mithradirect`) plus one local package.

| Surface | Module | Routes (examples) |
|---------|--------|-------------------|
| Marketing | `src/modules/marketing` | `/` |
| Storefront (customer) | `src/modules/storefront` | `/stores`, `/cart`, `/checkout`, `/orders` |
| Vendor | `src/modules/vendor` | `/vendor`, `/vendor/orders`, `/vendor/products` |

Auth UI lives in `src/shared/auth`. The app's demo/live service layer lives in `src/shared/api`.
**Transport (axios) and the OpenAPI-typed API live in `packages/api-client` (`@mithra/api-client`).**

**Not product source:** `design-reference/` is frozen static HTML for visual reference only (not served by Vite).

There is **no** `apps/web` package.

---

## Commands

```bash
npm install
cp .env.example .env   # never commit .env
npm run dev            # http://localhost:5173
npm run typecheck      # tsc -b
npm run lint           # eslint src (react-hooks deps enforced)
npm run build          # tsc -b && vite build → dist/
npm run preview        # serve dist/ after a build
```

No test runner exists (no vitest/jest, no `npm test`). `npm run typecheck && npm run lint` is the
full verification loop — run both before calling a change done. `build` type-checks first, and
`noUnusedLocals`/`noUnusedParameters` are on, so an unused import breaks the build.

**Package manager is npm.** `pnpm-workspace.yaml` is committed but unused — there is a
`package-lock.json` and no `pnpm-lock.yaml`. Ignore the pnpm file.

OpenAPI codegen (only when the backend changes):

```bash
npm run fetch:openapi   # backend Swagger → packages/api-client/openapi.json
npm run generate:api    # openapi-typescript → packages/api-client/src/schema.d.ts
npm run sync:api        # both — but shells out to pnpm internally; prefer the two above
```

`openapi.json` and `schema.d.ts` are generated — never hand-edit; commit the regenerated diff.

| Env | Purpose |
|-----|---------|
| `VITE_USE_API=false` | Demo mocks (**default** in `.env.example`) |
| `VITE_USE_API=true` | Live Spring Boot at `VITE_API_BASE_URL` |

---

## Where to put code

| Adding… | Put it here |
|---------|-------------|
| Screen / page | `src/modules/<module>/pages/` |
| Module-only UI | `src/modules/<module>/components/` |
| Module Zustand store | `src/modules/<module>/store/` |
| Shared UI (2+ modules) | `src/shared/components/` |
| A typed call to a backend endpoint | `packages/api-client/src/services/<domain>.ts` |
| Demo/live service + view-model shaping | `src/shared/api/services/` → export from `@/shared/api` |
| API → domain mapping | `src/shared/api/mappers/` |
| Transport change (headers, retry, timeout) | `packages/api-client/src/client/` |
| Auth UI / store | `src/shared/auth/` |
| Routes / layouts | `src/app/router/`, `src/app/layouts/` |
| shadcn primitive | `npx shadcn@latest add …` → `src/components/ui/` |
| Design tokens | `src/styles/global.css` |

```ts
import { Button, EmptyState } from '@/shared/components'
import { catalogService, getErrorMessage } from '@/shared/api'
import { cn, formatCurrency } from '@/shared/lib/utils'
```

Prefer `@/` imports over deep relatives. `cn` is available from both `@/lib/utils` (shadcn's alias
target) and `@/shared/lib/utils` (same function, plus `formatCurrency`) — pick one per file.

---

## The API layer in one screen

Two stacked layers. Read [docs/API_ARCHITECTURE.md](./docs/API_ARCHITECTURE.md) before changing either.

1. **`packages/api-client` (`@mithra/api-client`)** — axios instance + interceptors, token
   storage/refresh, `ApiError`, and OpenAPI-typed services (`vendorsService`, `ordersService`, …).
   No React, no app types, no demo mode. Resolved straight from TypeScript source via a path alias
   in `vite.config.ts` / `tsconfig.app.json` (plus a `file:` dep in `package.json`) — no build step.
2. **`src/shared/api/services/*.service.ts`** — the app's own services. They add demo-mode fallback
   and map wire payloads to app view-models. **This is what pages import.**

Layer 2 calls Layer 1's raw primitives (`apiGet`/`apiPost`), *not* Layer 1's typed services — so
`catalogService`/`cartService` exist in both layers and mean different things. Check your import.

`src/shared/api/client.ts`, `errors.ts`, `tokens.ts`, `types.ts` are **thin re-export shims** over
the package — no logic. The real HTTP code is `packages/api-client/src/client/http.ts`.

---

## Architecture rules

1. **Pages call services only** (`@/shared/api`). Do not `fetch`/`axios` from pages or components.
2. **Import from `@/shared/api`, never `@mithra/api-client` directly** in app code. The façade
   (`src/shared/api/index.ts`) re-exports everything the app needs.
3. **HTTP lives in** `packages/api-client/src/client/http.ts` (axios: auth header, FormData
   handling, non-2xx → `ApiError`, 401 → single-flight refresh → retry once).
4. **Demo vs live:** services branch on `isLiveApi()` from `@/shared/api` (not a React hook). Every
   service function needs **both** paths — demo (fixtures in `src/modules/*/data/`, or `md-*`
   localStorage keys) and live — or demo mode breaks silently. Demo is the default.
5. **Wire-format quirks** (`business_name` vs `name`, `distance_km` vs `distanceKm`) get normalized in
   `src/shared/api/mappers/`, never inline in a page.
6. **Data fetching:** no React Query/SWR/context. Page-local `useState` + `useEffect` with a
   `cancelled` flag + `getErrorMessage(err, fallback)` in the catch. `StoreDetailPage` is the template.
   `useApiError()` from `@/shared/api` optionally wraps the error half.
7. **State:** Zustand for auth/cart; keep ephemeral UI state in the component.
8. **UI:** App wrappers in `src/shared/components`; raw shadcn in `src/components/ui` (also re-exported
   as `Shadcn*`). Don’t invent a parallel design system.
9. **Brand:** emerald + Poppins (display) + Inter (body) via `src/styles/global.css`. Prefer `--md-*` / shadcn CSS vars. No purple-glow / cream-serif AI defaults.
10. **Per-vendor theming:** `applyStoreTheme()` from `@/shared/lib/theme` must target a **scoped element**
    (a ref), never `documentElement` — it sets `--font-display`/`--font-body`, which are app-wide — and
    must be paired with `clearStoreTheme()` in the effect cleanup. Backgrounds/fonts are curated
    allowlists; `getBgPreset`/`getFontPreset` are the only validation gate, so don’t add hex checks elsewhere.
11. **Small-vendor UX:** one job per screen, clear primary CTA, collapse secondary detail.
12. **design-reference/** may be read for look-and-feel; do not treat it as runtime source. Mirror into React/`src/styles`.
13. **Secrets:** never commit `.env` or credentials.
14. **Scope:** only change files needed for the task; don’t drive-by refactor.

## Known state (don’t "fix" these by accident)

- **Two service layers exist**, by design — see above. Adding an endpoint usually means touching both.
- **Auth has two entry points.** Live login is OTP (`requestOtp`/`verifyOtp`, called from the pages);
  `useAuthStore.login`/`register` are email+password and **throw in live mode**. Check which one a page
  uses before changing either.
- **Tokens live in two places** — `mithra_access_token`/`mithra_refresh_token` (what requests read)
  and the persisted `md-auth` key (UI state). Route session changes through `applySession()` /
  `clearSession()` in `auth-store.ts`, never bare `setTokens`, or the two drift. `onRehydrateStorage`
  deliberately calls `setTokens(access)` with no second argument — passing `null` there used to wipe
  the refresh token on every reload.
- **`onUnauthorized` → `clearSession()`, not `logout()`** (wired once in `AppProviders.tsx`). A failed
  refresh means the server session is already gone; calling sign-out would risk a loop.
- **A 200 response can throw.** `assertApiSuccess` rejects any envelope with `success: false`.
- **`isLiveApi()` overrides are one-way.** It's `useApi || isApiEnabled()`, so
  `configureApiClient({ useApi: false })` cannot disable live mode when `VITE_USE_API=true`.
- **Cart is local-only.** `useCartStore` (`md-cart`) never calls `cart.service.ts`, which is written but
  unwired. Single-store cart by design.
- **`packages/api-client` is not linted** — `npm run lint` is `eslint src`. It *is* type-checked,
  transitively via the app build and by its own `npm --prefix packages/api-client run typecheck`.
- **`openapi-fetch` is a declared dependency of the package but imported nowhere.**

---

## React / hooks

- Function components only.
- Data-fetch `useEffect`s must list real deps (`storeId`, `vendorId`, `query`, …) and cancel in-flight work.
- Run `npm run lint` — `react-hooks/exhaustive-deps` and `rules-of-hooks` are errors.
- Don’t rename non-hooks to `use*` (e.g. use `isLiveApi`, not `useLiveApi`).

---

## design-reference (static)

Serve locally if needed:

```bash
npx --yes serve design-reference -p 4173
```

Static conventions (only when editing that folder):

- Tokens historically in `design-reference/assets/css/global.css`
- Page JS depends on `MithraDraft` / `StoreAPI` load order
- Do not move product work back into static HTML

Cursor rules under `.cursor/rules/` cover scoped editing for `src/**` and `design-reference/**`.
