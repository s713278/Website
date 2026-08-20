# API architecture

How this frontend talks to the backend. Written for whoever is adding the next endpoint,
wiring up the next page, or debugging why a call behaves oddly.

Verified against branch `integration` at commit `ff995c1`, i.e. after the `@mithra/api-client`
merge (PR #16, `ac4aecb`).

Updated on 2026-08-19 for the 117-path generated contract, vendor-onboarding public-reference
service, and privacy-filtered local draft recovery.

Companion docs: [`API_GAPS.md`](./API_GAPS.md) (endpoints the backend doesn't have yet),
[`SESSION.md`](./SESSION.md) (JWT lifecycle + the XSS posture of localStorage tokens).

**How to read this:** §1 is *why* the layering exists, §2 is *where* every file lives, §3 is
*what* each piece does, §4–§6 are *how* things actually run, §7 is the playbook for adding
your own endpoint. §9 is the list of traps that will otherwise cost you an afternoon.

---

## 1. WHY there are two layers

A single service layer would have to do four unrelated jobs at once: speak HTTP, stay in sync
with the backend's OpenAPI spec, fall back to fixtures when there's no backend, and reshape
backend payloads into what the UI renders. Those change for different reasons and at
different rates, so they're split:

| Layer | Lives in | Changes when… | Knows about |
|---|---|---|---|
| **1. Transport + typed API** | `packages/api-client/` (`@mithra/api-client`) | the **backend** changes | HTTP, auth headers, refresh, the OpenAPI schema |
| **2. App services** | `src/shared/api/services/` | the **UI** changes | demo fixtures, view-model shapes, `Store`/`CustomerOrder` types |

Layer 1 is a standalone package precisely so it carries **no** React and no app types — it
could be dropped into a second app (a vendor admin, a native shell) unchanged. Layer 2 is
where this specific app's opinions live: demo mode, and the mapping from the backend's
inconsistent wire format to the types our components expect.

**The consequence you must internalise:** they are stacked, not merged. Most established Layer 2
services call Layer 1's raw primitives (`apiGet`/`apiPost`) with hand-written paths rather than its
typed services. The vendor-onboarding reference service is the first bounded exception: it calls
Layer 1's `catalogService`, then validates and maps the generic response before exposing it to the
wizard. So `catalogService` still exists in both layers, means different things in each, and changing
one does not automatically change the other. Check which one you're importing.

### The one import rule

App code imports from **`@/shared/api`** — never from `@mithra/api-client` directly.

`src/shared/api/index.ts` is the façade: it re-exports the package's primitives *and* the
app's own services from one place. Today nothing under `src/` outside `src/shared/api/`
imports the package directly, and keeping it that way means the package can be swapped or
restructured without touching a single page.

```ts
import { catalogService, getErrorMessage, isLiveApi } from '@/shared/api'
```

---

## 2. WHERE everything lives

### Layer 1 — `packages/api-client/`

```
packages/api-client/
  openapi.json              # fetched from backend Swagger — generated, do not hand-edit
  scripts/fetch-openapi.mjs # the fetcher
  src/
    schema.d.ts             # generated from openapi.json — do not hand-edit
    client/                 # transport: axios, tokens, refresh, errors, config
      config.ts             #   baseURL / timeout / onUnauthorized
      http.ts               #   axios instance + interceptors + apiGet/apiPost/...
      refresh.ts            #   single-flight token refresh
      tokens.ts             #   localStorage token store
      errors.ts             #   ApiError + normalisation
      types.ts              #   ApiEnvelope, RequestConfig, ...
      index.ts
    services/               # one file per backend domain, built on client/
      auth.ts  vendors.ts  catalog.ts  cart.ts  orders.ts  users.ts
      storefront.ts  subscriptions.ts  platform.ts  social.ts  admin.ts
      legacy.ts             #   flat back-compat wrappers
      index.ts
    index.ts                # package entry — re-exports schema + client + services
```

### Layer 2 — `src/shared/api/`

```
src/shared/api/
  index.ts                  # THE façade — import from here
  config.ts                 # adds the demo/live `useApi` flag on top of the package config
  mode.ts                   # isLiveApi()
  useApiError.ts            # small error-state hook for pages
  mappers/
    vendor.ts               # vendor wire payload → app view-model
    vendor-onboarding.ts    # strict public-reference mapping + future storefront request mapper
  services/                 # the demo/live service layer
    auth.service.ts  catalog.service.ts  cart.service.ts  orders.service.ts
    vendor.service.ts  vendor-orders.service.ts  vendor-products.service.ts
    vendor-onboarding.service.ts # live public reference reads for the onboarding wizard
    index.ts
  client.ts   errors.ts   tokens.ts   types.ts    # ← thin re-export shims only
```

> **`client.ts`, `errors.ts`, `tokens.ts`, `types.ts` contain no logic.** Each is a ~10-line
> re-export from `@mithra/api-client`, kept so the older `import … from '../client'` paths
> inside `services/*.service.ts` still resolve. If you open `src/shared/api/client.ts` looking
> for the HTTP implementation, you want `packages/api-client/src/client/http.ts` instead.

### "Which file do I open?"

| I want to… | Open |
|---|---|
| Change how requests are sent / headers attached | `packages/api-client/src/client/http.ts` |
| Change the base URL or timeout | `packages/api-client/src/client/config.ts` |
| Change token storage or refresh behaviour | `client/tokens.ts`, `client/refresh.ts` |
| Change how errors become user-facing text | `client/errors.ts` (`getErrorMessage`) |
| Add a typed call to a new backend endpoint | `packages/api-client/src/services/<domain>.ts` |
| Add demo-mode fallback or view-model mapping | `src/shared/api/services/<x>.service.ts` |
| Fix a wire-format quirk (`business_name` vs `name`) | the matching file in `src/shared/api/mappers/` |
| Change what a page renders while loading | the page itself — it owns its own state |
| Change login / logout / session behaviour | `src/shared/auth/store/auth-store.ts` |

### How the package is linked

Two mechanisms, both present:

- **npm dependency:** `"@mithra/api-client": "file:packages/api-client"` in `package.json`.
- **Path alias:** `@mithra/api-client` → `packages/api-client/src/index.ts` in both
  `vite.config.ts` and `tsconfig.app.json`.

The alias means imports resolve to **raw TypeScript source** — there is no build step for the
package, and edits to it are picked up by `vite dev` immediately.

> **`pnpm-workspace.yaml` is vestigial.** It's committed at the repo root, but this project is
> built with **npm** (there is a `package-lock.json` and no `pnpm-lock.yaml`, and the root
> scripts shell out via `npm --prefix`). Ignore the file; use npm.

---

## 3. WHAT each piece does

### 3.1 Transport core (`packages/api-client/src/client/`)

| File | Job |
|---|---|
| `config.ts` | Module-level config singleton: `baseURL`, `timeoutMs` (15 s), `onUnauthorized`. `getApiBaseUrl()` reads `VITE_API_BASE_URL`, falling back to the hardcoded Render staging URL. |
| `http.ts` | Creates the Axios instance and both interceptors; exports the `apiGet`/`apiPost`/`apiPut`/`apiPatch`/`apiDelete` primitives plus `apiRequest`, `unwrapData`, `getHttp`, `resetHttpClient`. |
| `refresh.ts` | `refreshAccessToken()` — single-flight refresh against `POST /v1/auth/refresh`. |
| `tokens.ts` | localStorage token store, keys `mithra_access_token` / `mithra_refresh_token`. All access is try/catch-wrapped so SSR/private-mode never throws. |
| `errors.ts` | `ApiError` + `toApiError` / `getErrorMessage` / `apiErrorFromResponse` / `assertApiSuccess`, plus a pluggable logger (`setApiErrorLogger`). |
| `types.ts` | `ApiEnvelope<T>`, `RequestConfig`, `TokenPair`, `AuthTokensResponse`, `HttpMethod`. |

**`RequestConfig` flags** (`client/types.ts:24-32`) — the two that carry real behaviour:

- `skipAuth` — don't attach the `Authorization` header. Use for genuinely public endpoints
  (storefront/catalog reads). Also suppresses the 401-refresh path.
- `skipRefresh` — don't attempt refresh-and-retry on a 401. Used by sign-out, so a dead
  session can't trigger `401 → refresh → fail → logout` recursion.

**`unwrapData(res)`** — the backend wraps most responses as `{ data: … }`. `unwrapData`
returns `res.data` when a `data` key is present and the value unchanged otherwise, so it's
safe on both shapes. List endpoints additionally come back as either a bare array *or* a
paged `{ content: [] }` — services handle that themselves (see `catalog.service.ts:24-28`).

**`assertApiSuccess(data, path)`** (`client/errors.ts:294`) runs on **every** successful
response. If the envelope contains `success: false`, it throws an `ApiError` even though HTTP
said 200 — inferring a status from the payload's `status`/`reason_code` string (`unauthorized`
→ 401, `forbidden` → 403, `not_found` → 404, `valid…` → 422, else 400). If you're ever
puzzled by a 200 response landing in your `.catch()`, this is why.

### 3.2 Typed services (`packages/api-client/src/services/`)

One object per backend domain, all thin wrappers over the primitives above.

| File | Service | Covers |
|---|---|---|
| `auth.ts` | `authService` | `requestOtp`, `verifyOtp`, `refreshToken`, `getProfile`, `signOut`. OTP-first — no email/password. |
| `vendors.ts` | `vendorsService` | Vendor CRUD, status/approval, checkout options, products/SKUs, categories, service area, customers, search, business-type update, context, storefront save, and go-live. The protected onboarding methods are wrapped but not called by the local prototype. |
| `catalog.ts` | `catalogService` | Platform-wide categories and business types; category-scoped product CRUD. Public onboarding reads accept generated query types plus `AbortSignal`. |
| `cart.ts` | `cartService` | `get`, `clear`, `addItem`, `upsertItem`, `updateItemQty`, `removeItem` — all under `/v1/vendors/{vendorId}/cart`. |
| `orders.ts` | `ordersService` | `create`, `createFromCart`, vendor-scoped list/update/cancel/tracking, user order history. |
| `users.ts` | `usersService` | Profile, mobile/address updates, dashboard, history, preferences, subscriptions. |
| `storefront.ts` | `storefrontService` | Public storefront payload by numeric ID or string identifier + delivery-eligibility check (both `skipAuth`). Exports the `Storefront*` types. |
| `subscriptions.ts` | `subscriptionsService` | Vendor subscriptions, SKU-level plans, platform plans. |
| `platform.ts` | `platformService`, `imagesService`, `pricesService`, `courierService` | FAQs, measurements, SKU pricing, vendor image upload, courier admin. |
| `social.ts` | `socialService` | Social OAuth connect/callback, profile/media sync. |
| `admin.ts` | `adminService` | Bulk catalog/vendor import, catalog summary/delete. |
| `legacy.ts` | flat functions | Back-compat wrappers (`getVendor`, `getCart`, `createOrderFromCart`, `loadVendorStorefront`, …). Also re-declares `VendorStorefront`/`StorefrontProduct`/`DeliveryEligibility` types that overlap `schema.d.ts` — treat those as convenience, not source of truth. |

### 3.3 App services (`src/shared/api/services/*.service.ts`)

The established services have two jobs: **demo-mode fallback** and **payload → view-model mapping**.
Most functions have the same skeleton:

```ts
export async function listStores(query?: string): Promise<Store[]> {
  if (!isLiveApi()) {
    await delay()
    return STORES            // ← demo path: fixtures or localStorage
  }
  const res = await apiGet<ApiEnvelope<unknown>>('/v1/vendors/', { skipAuth: true })
  return unwrapData(res).map(mapVendorToStore)   // ← live path
}
```

**Write both paths, always.** A live-only function silently returns `undefined` in demo mode,
which is the default — so the bug shows up as an empty screen, not an error.

| File | Exposes | Demo source | Live endpoint(s) |
|---|---|---|---|
| `auth.service.ts` | `requestOtp`, `verifyOtp`, `login`, `register`, `getProfile`, `signOut` | `shared/auth/api/demo-auth.ts` (in-memory `DEMO_USERS`); demo OTP is **`1234`** | `/v1/auth/*`. `login`/`register` are email+password and **throw in live mode** — see §5. |
| `catalog.service.ts` | `listStores`, `getStore` | `modules/storefront/data/catalog.ts` (`STORES`, `getStoreById`) | `GET /v1/vendors/`, `/v1/vendors/{id}`, `/v1/vendors/{id}/products` → `mapVendorToStore` |
| `orders.service.ts` | `placeOrder`, `listMyOrders` | localStorage `md-customer-orders` | `POST /v1/orders`, `GET /v1/users/{userId}/orders/history` |
| `vendor.service.ts` | `getVendorDashboard` | stats derived from `VENDOR_ORDERS`/`VENDOR_PRODUCTS`, plus a hardcoded store name and theme | `Promise.all` over `/v1/vendors/{id}` + `/orders/` + `/products`, aggregated client-side |
| `vendor-orders.service.ts` | `listVendorOrders`, `updateVendorOrderStatus` | localStorage `md-vendor-orders`, seeded from `modules/vendor/data/demo.ts` | `GET`/`PATCH /v1/vendors/{vendorId}/orders/*` |
| `vendor-products.service.ts` | `listVendorProducts`, `setProductAvailability` | localStorage `md-vendor-products`, seeded from same `demo.ts` | `GET`/`PATCH /v1/vendors/{vendorId}/products/*` |
| `cart.service.ts` | `get`, `clear`, `addItem`, `upsertItem`, `updateItemQty`, `removeItem` | — | `/v1/vendors/{vendorId}/cart/*` — **imported by nothing.** See below. |
| `vendor-onboarding.service.ts` | `getBusinessTypes`, `getCategories`, `getProductsByCategory` | Explicit user-selected sample catalog lives in the vendor module, not as a silent service fallback | Public catalog operations through the package `catalogService`; strict `ReferencePage<T>` mappers reject malformed records and deduplicate numeric IDs |

The onboarding reference service intentionally ignores the global demo/live switch. It tries the
public live catalog in either app mode; if that fails, the wizard offers a visibly labelled switch
to reserved-negative-ID sample records. It never silently converts a live failure into sample data.

**Mapping** — `src/shared/api/mappers/vendor.ts` (`mapVendorToStore`, `mapVendorTheme`)
absorbs the backend's inconsistent field naming (`business_name` *or* `name`, `distance_km`
*or* `distanceKm`, `price` *or* `selling_price`, `veg` *or* `is_veg`) and supplies defaults.
That normalisation belongs here and nowhere else — don't re-do it inline in a page.

> **Cart is not backend-synced.** `useCartStore` (`src/modules/storefront/store/cart-store.ts`,
> localStorage `md-cart`) is entirely local and never calls `cartService`. Both layers *have* a
> cart service written; neither is wired to the store. Backend cart sync is unbuilt work, not a
> bug to route around. The cart is also single-store by design — adding an item from a
> different vendor prompts to clear it.

### 3.4 The demo/live switch

```ts
// src/shared/api/mode.ts
export function isLiveApi() {
  return getClientConfig().useApi || isApiEnabled()
}
```

`isApiEnabled()` (`src/shared/api/config.ts:21`) is true only when `VITE_USE_API` is exactly
`'true'` or `'1'`. `useApi` starts as that same value and can be changed at runtime via
`configureApiClient({ useApi })`.

> **The runtime override is one-way.** Because the two are `OR`-ed and `useApi` is *seeded*
> from the env var, `configureApiClient({ useApi: false })` cannot turn live mode **off** when
> `VITE_USE_API=true` — `isApiEnabled()` still returns true. You can force live mode on, never
> off. To run against fixtures, change the env var and restart the dev server.

---

## 4. HOW a request runs, end to end

Following `catalogService.getStore('42')` in live mode:

1. **Page** calls the app service (`src/shared/api/services/catalog.service.ts:43`).
2. **Mode gate** — `isLiveApi()` is true, so the demo branch is skipped.
3. **Primitive** — `apiGet('/v1/vendors/42', { skipAuth: true })` (`client/http.ts:96`).
4. **Instance** — `getHttp()` lazily builds the Axios singleton on first use, reading `baseURL`
   and `timeoutMs` from the config module (`client/http.ts:74`).
5. **Request interceptor** (`client/http.ts:32`):
   - if the body is `FormData`, the `Content-Type` header is **deleted** so the browser can set
     `multipart/form-data` with the correct boundary — this is what makes image upload work;
   - unless `skipAuth`, attaches `Authorization: Bearer <mithra_access_token>`.
6. **Response interceptor** (`client/http.ts:49`) — passes 2xx straight through. On a 401, and
   only if `skipAuth`/`skipRefresh` are unset and this isn't already a retry:
   `refreshAccessToken()` → on success, re-attach the new token and replay the request once
   → on failure, call `onUnauthorized()`. Everything else is normalised by `toApiError` and
   rejected.
7. **Envelope check** — `assertApiSuccess` throws if the payload says `success: false` (§3.1).
8. **Unwrap + map** — `unwrapData(res)` peels `{ data: … }`; `mapVendorToStore` turns the raw
   vendor into the app's `Store` type.
9. **Page** sets state and renders.

Note step 8's partial-failure handling in `getStore`: the products call is wrapped in
`.catch(() => null)`, so a vendor still renders if its product list 404s. Deliberate.

---

## 5. HOW auth and tokens work

See [`SESSION.md`](./SESSION.md) for the full lifecycle and the security posture. Summary:

1. **Request OTP** — `authService.requestOtp({ phone, role, countryCode })` →
   `POST /v1/auth/request-otp`. In demo mode this is a 300 ms no-op and the OTP is `1234`.
2. **Verify** — `authService.verifyOtp(...)` → `POST /v1/auth/verify-otp`. Tokens are pulled
   out by `parseTokenResponse()`, which accepts `access_token` / `accessToken` / `token` at
   either the root or under `data` — the backend isn't consistent.
3. **Store** — `setTokens(access, refresh)` writes localStorage `mithra_access_token` /
   `mithra_refresh_token`. These are what the request interceptor reads.
4. **UI state** — `useAuthStore` (zustand + `persist`, key `md-auth`) separately holds
   `{ user, token }` for rendering. Entry points: `applySession(session)` (the one place that
   writes both stores), `completeOtpLogin`, `clearSession` (local wipe, no server call),
   `logout` (server sign-out then `clearSession`), `hasRole`.
5. **Reload** — `onRehydrateStorage` re-syncs the persisted access token into the token store
   with `setTokens(access)` — deliberately **without** a second argument, because passing
   `null` there used to wipe the refresh token on every page load. A microtask then clears the
   session if a persisted user has no access token left.
6. **Expiry** — handled entirely by the response interceptor (§4 step 6).
7. **Give up** — `onUnauthorized` is wired exactly once, in
   `src/app/providers/AppProviders.tsx:12`, to `useAuthStore.getState().clearSession()` —
   *not* `logout()`, because a failed refresh means the server session is already gone and
   calling sign-out would risk a loop. The same effect installs the API error logger via
   `setApiErrorLogger`.

`AppProviders` wraps no context — it is purely this one configuration effect and returns
`children` unchanged.

> **Auth has two entry points, and only one works live.** Live login is OTP, called directly
> from the login/register pages. `useAuthStore.login`/`register` are the email+password
> **demo-only** path — `auth.service.ts` throws in live mode telling you to use OTP. Check
> which one a page actually uses before changing either.

> **Tokens live in two places** — `mithra_*` (what requests read) and `md-auth` (what the UI
> reads), kept in sync by hand in `applySession` / `clearSession` / `onRehydrateStorage`. Any
> new code path that changes the session must go through `applySession` or `clearSession`, not
> `setTokens` alone, or the two will drift.

---

## 6. HOW to call the API from a component

There is **no** React Query, SWR, or data context in this app — confirmed, not an oversight.
Each page owns its own `loading` / `error` / `data` state. The template is
`src/modules/storefront/pages/StoreDetailPage.tsx`:

```tsx
const [store, setStore] = useState<Store | null>(null)
const [loading, setLoading] = useState(true)
const [error, setError] = useState('')

useEffect(() => {
  let cancelled = false
  setLoading(true)
  setError('')
  void catalogService
    .getStore(storeId)
    .then((data) => { if (!cancelled) setStore(data) })
    .catch((err) => { if (!cancelled) setError(getErrorMessage(err, 'Could not load store')) })
    .finally(() => { if (!cancelled) setLoading(false) })
  return () => { cancelled = true }
}, [storeId])
```

Three non-negotiables:

- **The `cancelled` flag.** Without it, a fast route change sets state on an unmounted page.
- **`getErrorMessage(err, fallback)` in every `catch`.** It's the single place that turns an
  `ApiError`, a network failure, or an arbitrary thrown value into user-facing text.
- **Real dependency arrays.** `react-hooks/exhaustive-deps` is an **error**, not a warning.

Optionally, `useApiError()` (`src/shared/api/useApiError.ts`) wraps the error half of that
boilerplate — it returns `{ error, setError, capture, clear }` where `capture(err, fallback)`
runs `getErrorMessage` for you. It's a convenience, not the house style; most pages still use
plain `useState`.

State management now includes three Zustand stores: `useAuthStore`, `useCartStore`, and the
feature-local `useOnboardingStore`. The onboarding store keeps private fields in volatile memory and
persists only a versioned, validated safe draft through the `local-prototype` adapter. Writes use one
1200 ms trailing timer followed by `requestIdleCallback` (with a timeout fallback), plus immediate
flushes on step transitions, completion, and page hiding. It deliberately does not use Zustand's
per-mutation persistence middleware. The safe snapshot excludes phones, OTP digits, payment
credentials, files, object URLs, tokens, vendor IDs, and backend error bodies. Newer cross-tab
revisions pause writes until the user chooses which draft wins.

The onboarding catalog hooks separately use a bounded module-memory result cache keyed by reference
kind, Live/Sample provenance, query, and parent ID. Business-type keys additionally include the
committed query, page size, sort field, and sort order so a six-record `id:ASC` result cannot collide
with a different request contract. Successful accumulated pages are reused on remount, while failed
pages are never cached and retries still go to the service. This cache also clears on reload and
stores no vendor input. There is no React Query, SWR, or shared server-state store.

---

## 7. HOW to add a new endpoint

1. **Confirm it exists.** Check `packages/api-client/openapi.json`, re-sync if stale (§8), and
   check [`API_GAPS.md`](./API_GAPS.md) for endpoints known to be missing.
2. **Add the typed call** to the matching file in `packages/api-client/src/services/`, copying
   the shape of its neighbours — a thin wrapper over `apiGet`/`apiPost` typed against
   `ApiEnvelope`. New domain? New file, exported from `services/index.ts`. Mark genuinely
   public endpoints `{ skipAuth: true }`.
3. **Add the app service** in `src/shared/api/services/` *if* the UI needs demo-mode fallback
   or view-model mapping — which it usually does. For ordinary app surfaces, write **both**
   branches: demo (fixtures under `src/modules/*/data/`, or an `md-*` localStorage key for mutable
   state) and live. A live-first feature such as onboarding must make any sample mode an explicit,
   labelled user choice. Export the service from `services/index.ts` so it reaches the
   `@/shared/api` façade.
4. **Normalise wire quirks** in `src/shared/api/mappers/`, not in the page.
5. **Call it from the component** with the §6 pattern.
6. **Verify:** `npm run typecheck && npm run lint`. There is no test runner — that pair *is*
   the verification loop. Exercise both modes by flipping `VITE_USE_API`.
7. **If the backend isn't ready,** add a row to `API_GAPS.md` describing the gap and your
   interim workaround, so it's findable when the endpoint lands.

**Don't** call `apiGet('/v1/…')` straight from a page or component. It bypasses the typed
layer, skips demo mode (so the page breaks under the default config), and scatters endpoint
paths across the UI.

---

## 8. Reference

### Commands

```bash
npm install
cp .env.example .env
npm run dev          # http://localhost:5173
npm run typecheck    # tsc -b
npm run lint         # eslint src
npm run build        # tsc -b && vite build
```

```bash
npm run fetch:openapi   # GET the backend Swagger → packages/api-client/openapi.json
npm run generate:api    # openapi-typescript → packages/api-client/src/schema.d.ts
npm run sync:api        # both (see caveat)
```

`openapi.json` and `schema.d.ts` are **generated** — never hand-edit them. Re-run after any
backend change and commit the diff.

> **Caveat on `sync:api`:** the root script delegates to the package's own `sync`, which is
> `node ./scripts/fetch-openapi.mjs && pnpm generate` — it shells out to **pnpm** even though
> this repo is npm-managed. It works only on machines that happen to have pnpm installed. The
> portable equivalent is `npm run fetch:openapi && npm run generate:api`. (A stray
> `pnpm --filter` reference also survives in the header comment of
> `packages/api-client/src/index.ts`.)

### Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `VITE_API_BASE_URL` | Backend base URL | `https://subscriptionapp-wgf8.onrender.com/api` — also hardcoded as the fallback in `getApiBaseUrl()`, so an unset var silently points at staging |
| `VITE_USE_API` | `'true'`/`'1'` → live API; anything else → demo mode | **`false`** in both `.env` and `.env.example` — the app runs on fixtures unless you change this |
| `VITE_APP_ENV` | General environment label | `development` |
| `OPENAPI_URL` | Overrides the Swagger URL `fetch-openapi.mjs` pulls | `https://subscriptionapp-wgf8.onrender.com/api/v3/api-docs` |

`VITE_SAMPLE_VENDOR_ID` is referenced in `API_GAPS.md` as a workaround but is **not read by
any code in this repo** — treat it as a proposal, not a supported knob.

### localStorage keys

| Key | Owner | Holds |
|---|---|---|
| `mithra_access_token` / `mithra_refresh_token` | `client/tokens.ts` | the tokens requests actually use |
| `md-auth` | `useAuthStore` | persisted `{ user, token }` for UI restore |
| `md-cart` | `useCartStore` | the local-only cart |
| `md-customer-orders`, `md-vendor-orders`, `md-vendor-products` | demo services | mutable demo-mode state |
| `md-vendor-onboarding-draft-v1` | `local-prototype` onboarding adapter | versioned safe wizard draft and optional same-browser preview snapshot; no private contact/payment values or files |

Onboarding phone/OTP/order and support WhatsApp values, UPI and bank-account details, files, and
object URLs remain in memory. The browser draft is crash/reload recovery only, not authenticated
server persistence or a public storefront. The future `mapFutureStorefrontConfig` mapper aligns the
typed draft with `SaveStorefrontConfigRequest`, rejects local image URLs, and is not connected to a
protected request in prototype mode.

---

## 9. Traps and rough edges

- **Two `catalogService`s, two `cartService`s.** Same names, different layers, different
  signatures. Confirm your import path.
- **Demo mode is the default.** `VITE_USE_API=false` ships in `.env`. A live-only service
  function fails as an empty screen, not an error.
- **The `useApi` runtime override can't disable live mode** — see §3.4.
- **A 200 can throw.** `assertApiSuccess` rejects any envelope with `success: false` — §3.1.
- **`configureApiClient` rebuilds Axios asynchronously.** `packages/api-client/src/client/config.ts:28`
  fires `void import('./http').then(({ resetHttpClient }) => resetHttpClient())` without
  awaiting it. Since every other file imports `./http` statically, this also produces a Vite
  mixed-static/dynamic-import warning at build time and no actual code splitting. The real
  risk is narrow but genuine: a request issued before that import resolves runs against an
  Axios instance built without the just-configured `onUnauthorized`, so a cold-load 401 can
  fail to trigger logout.
- **`sync:api` needs pnpm** despite this being an npm repo — see §8.
- **Cart isn't backend-synced** and **`useAuthStore.login`/`register` are demo-only** — §3.3, §5.
- **Token storage is duplicated** across `mithra_*` and `md-auth` — §5.
- **Tokens are readable by JavaScript.** localStorage is an interim choice; any XSS is a
  session compromise. `SESSION.md` covers the intended migration to httpOnly cookies.
- **The richer `/storefront` payload isn't wired into the customer storefront.**
  `storefrontService.get(identifier)` and the flat storefront functions exist in the package, but
  the customer surface still renders from `catalogService` (`/v1/vendors/…`). The legacy
  `getPublicStoreBySlug` now delegates to the identifier endpoint; this fixes the old nonexistent
  `/v1/public/stores/{slug}` path but does not complete customer storefront adoption.
- **`pnpm-workspace.yaml` is unused** — §2.
