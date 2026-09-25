# API architecture

How this frontend talks to the backend. Written for whoever is adding the next endpoint,
wiring up the next page, or debugging why a call behaves oddly.

The API-package baseline was verified against `integration` at commit `ff995c1`, after the
`@mithra/api-client` merge (PR #16, `ac4aecb`).

Updated on 2026-09-01 for landing-page location-based store discovery, as well as the
vendor-onboarding account service, resume-step-sized entry hydration, authenticated measurement
details, explicit demo/sample isolation, and privacy-filtered local draft recovery.

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

Layer 2 services currently mix calls to Layer 1's raw primitives (`apiGet`/`apiPost`) with calls to
its domain wrappers. Catalog uses package storefront/vendor wrappers; vendor onboarding uses package
catalog/vendor/platform wrappers and strict mappers; auth also uses package auth functions. Generated
operation types do not consistently flow through these services. Names still exist in both layers
with different signatures, and changing one does not automatically change the other: trace the caller
and import before editing.

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
  fixtures/
    vendor-dashboard.ts     # demo payloads in backend WIRE shape, not view models
  mappers/
    vendor.ts               # vendor wire payload → app view-model
    vendor-dashboard.ts     # vendor dashboard wire payloads → dashboard view-models
    vendor-onboarding.ts    # strict setup reference/account mapping + request mappers
  services/                 # the demo/live service layer
    auth.service.ts  catalog.service.ts  cart.service.ts  orders.service.ts
    vendor.service.ts  vendor-orders.service.ts  vendor-products.service.ts
    vendor-onboarding.service.ts # public references + live setup account reads/writes
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
| `vendors.ts` | `vendorsService` | Vendor CRUD, status/approval, checkout options, products/SKUs, categories, service area, customers, search, business-type update, context, storefront save, and go-live. Its protected setup methods back the live vendor-onboarding workflow. |
| `catalog.ts` | `catalogService` | Platform-wide categories and business types; category-scoped product CRUD. Public onboarding reads accept generated query types plus `AbortSignal`. |
| `cart.ts` | `cartService` | `get`, `clear`, `addItem`, `upsertItem`, `updateItemQty`, `removeItem` — all under `/v1/vendors/{vendorId}/cart`. |
| `orders.ts` | `ordersService` | `create`, `createFromCart`, vendor-scoped list/update/cancel/tracking, user order history. |
| `users.ts` | `usersService` | Profile, mobile/address updates, dashboard, history, preferences, subscriptions. |
| `storefront.ts` | `storefrontService` | Public storefront payload by numeric ID or string identifier, paginated storefront products, and delivery-eligibility check (all `skipAuth`). Exports the `Storefront*` types. |
| `subscriptions.ts` | `subscriptionsService` | Vendor subscriptions, SKU-level plans, platform plans. |
| `platform.ts` | `platformService`, `imagesService`, `pricesService`, `courierService` | FAQs, authenticated measurement list/detail reads, SKU pricing, vendor image upload, courier admin. |
| `social.ts` | `socialService` | Social OAuth connect/callback, profile/media sync. |
| `admin.ts` | `adminService` | Bulk catalog/vendor import, catalog summary/delete. |
| `legacy.ts` | flat functions | Back-compat wrappers (`getVendor`, `getCart`, `createOrderFromCart`, `loadVendorStorefront`, …). Also re-declares `VendorStorefront`/`StorefrontProduct`/`DeliveryEligibility` types that overlap `schema.d.ts` — treat those as convenience, not source of truth. |

### 3.3 App services (`src/shared/api/services/*.service.ts`)

The established services have two jobs: **demo-mode fallback** and **payload → view-model mapping**.
An illustrative demo/live skeleton for a service that uses raw transport is:

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
| `catalog.service.ts` | `listStores`, `listLandingStores`, `getStore` | `modules/storefront/data/catalog.ts` (`STORES`, `getStoreById`) | Public `GET /v1/home` plus `/v1/vendors/{id}` and `/v1/vendors/{id}/products`; landing rows use `mapLandingStore`, established storefront views use `mapVendorToStore` |
| `orders.service.ts` | `placeOrder`, `listMyOrders`, `listMyOrdersPage`, `getMyOrder` | localStorage `md-customer-orders` | `POST /v1/orders/from-cart` (live checkout; `POST /v1/orders` is unimplemented), `GET /v1/users/{userId}/orders/history/paged` (`page` + `size`, default 20), `GET /v1/users/{userId}/orders/{orderId}` |
| `vendor.service.ts` | `getVendorInsights`, `getVendorStoreProfile` | wire-shaped fixtures in `shared/api/fixtures/vendor-dashboard.ts` | `GET /v1/users/{userId}/dashboard` (vendor figures, keyed on the **user** id) and `GET /v1/vendors/{id}` (Settings, read-only — `PUT` fails with a JPA transaction error) |
| `vendor-orders.service.ts` | `listVendorOrders`, `getVendorOrder`, `updateVendorOrderStatus` | same fixtures | `GET /v1/vendors/{vendorId}/orders/` (paginated `result` container), `GET`/`PATCH` on one order. The write sends `{delivery_status, payment_status}` — the contract has no single `status` field |
| `vendor-subscriptions.service.ts` | `listVendorSubscriptions` | same fixtures, with wire-shaped rows covering each supported filter | `GET /v1/vendors/{vendorId}/subs` (read-only, server-filtered, paginated `result` container) |
| `vendor-products.service.ts` | `listVendorSizes`, `updateSizePrice` | same fixtures | `GET /v1/vendors/{vendorId}/products/skus` (**not** `/products`, which carries no price), `PUT /v1/sku/price/{price_id}` |
| `cart.service.ts` | `get`, `clear`, `addItem`, `setItemQty`, `removeItem` | Service returns empty snapshots/no-ops; cart orchestration mutates Zustand locally | `/v1/vendors/{vendorId}/cart/*`, mapped by `mapCartPayload`; called by storefront `cart-actions.ts` |
| `vendor-onboarding.service.ts` | Public catalog reads plus vendor setup account reads and writes | Wire-shaped vendor-context fixture mounts the console; setup references still come only from the explicitly selected sample catalog | Package `catalogService`, `vendorsService`, and `platformService`; strict mappers normalize references, account resources, checkout options, and measurements |

In Live API mode, the onboarding service reads the platform catalog and uses vendor-scoped account
reads and writes. In Demo mode, `getVendorContext` returns a wire-shaped completed-account fixture
through `mapVendorContext`, which lets the vendor console mount without a backend request. The setup
wizard still never mounts the other account-catalog readers: it waits for the vendor to explicitly
select the reserved-negative-ID sample catalog, then answers from module-local sample data. It never
silently converts a live failure into sample data. A persisted sample draft carried into Live API
mode is blocked at Continue because its synthetic IDs cannot reach an account.

#### Vendor setup account hydration

`loadServerOnboardingState` remains the one hydration point that produces a shape-stable account
snapshot for both post-sign-in routing and the setup wizard. It starts the three reads every vendor
needs together: vendor context, vendor profile, and the business-type catalog. As soon as context
reveals the backend resume step, it starts only the cumulative account reads needed to reconstruct
that step and every earlier one:

| Resume step | Additional account reads |
|---|---|
| Business type (3) | None |
| Categories (4) | Vendor categories |
| Products (5) | Vendor categories, vendor products, and measurements |
| Sizes (6) | The preceding reads plus vendor sizes |
| Delivery through review (7–10) | The preceding reads plus checkout options |

Measurements mean one authenticated `GET /v1/measurements/` followed by one authenticated
`GET /v1/measurements/{id}` per list row. Detail calls fan out together and enrich the list because
the deployed list omits `unit_options`; an individual failed detail retains its usable list row.
The entire measurement read starts with the Products-step fan-out and is never one of the three
universal reads.

Submitted vendors load the complete read set so earlier setup remains reviewable. If context omits
`onboarding.next_step`, the loader also chooses the complete set so the resource-derived resume
fallback is computed from real data rather than an intentionally partial snapshot. Context failure
rejects hydration; the other reads retain the existing optional behavior and become empty/default
snapshot fields when unavailable.

`loadVendorOnboardingState` caches one in-flight promise and then one resolved snapshot per vendor.
Sign-in and the wizard therefore share the same fan-out rather than issuing it twice. Failed loads
are evicted, and successful setup writes, submission, and sign-out invalidate the relevant entry.
The same invalidation also drops the dashboard's narrower context cache, so returning from setup
cannot reuse pre-write store state, storefront details, or plan usage. Both caches ignore a late
response belonging to an entry that has already been invalidated.

#### Vendor setup sizes (Step 6)

After setup is submitted, categories and products remain open for additions. Step 6 allows new
sizes only when the account's real approval status is approved (`APPROVED`; current `ACTIVE`
wire values are accepted for compatibility); pending vendors keep a
read-only step. Previously saved sizes remain locked after submission. The controls and Continue
handler use the same approval-aware rule, and saving validates new size details, duplicates and
the projected account total against `subscription.limits.max_skus`. The total includes any
`subscription.usage.skus` missing from the SKU list, so unlisted inactive sizes still consume
capacity. That count survives subsequent additions in the same visit. It does not demand pricing
for unrelated products already on a submitted account. Completed approved stores also offer a
Sizes shortcut from Step 10. Unfinished accounts retain the normal editable setup flow; their
entry decision is documented in [SESSION.md](./SESSION.md#where-a-session-lands).

The September 2026 OpenAPI contract separates a size's numeric `quantity_value` and `unit`.
Creation sends them in each `price_list` entry, along with measurement type and prices; it never
sends the retired string `value`. `product_id` remains the vendor product ID. Names, descriptions,
and images are inherited from the product, so setup omits those deprecated request fields. Setup
does not configure subscriptions: new sizes send `subscription_eligible: false` and an empty
`eligible_sub_plans`, as the updated contract permits.

New sizes of the same vendor product share one POST with multiple `price_list` entries when
their availability, home-delivery, and pickup flags match. Different products or flag values
use separate requests because those fields apply to the entire request. Grouping happens after
reconciliation, so existing sizes are excluded from creation, including sizes recovered on retry.

Account reads load every SKU page before reconciliation, reject incomplete pagination, and retain
`price_id` for repricing. The shared measurement mapper prefers the separate fields and accepts
legacy `sku_size` labels for older responses and demo fixtures. Vendor and storefront size labels
use the same mapping so fractional quantities remain visible.

Quantity, unit, and availability edits use `PATCH /v1/vendors/{vendor_id}/skus/{sku_id}`; quantity
and unit are sent together, while product details and features are omitted and preserved. Prices
use `PUT /v1/sku/price/{price_id}` with `sku_id`, `list_price`, and `sale_price`. These edits retain
the SKU ID and its subscriptions. A missing price record blocks repricing before any writes. A
partial failure stays visible; retry reads current account values and writes only remaining changes.

After creation, the account is reread and saved IDs replace the local draft IDs without replacing
the draft's other fields. Repeated saves also recognise an identical size whose successful create
did not return an ID. Matching uses product, quantity, and unit, never a stale product-derived name.
Conflicting new drafts must reload instead of taking over an existing size. The wizard records
returned identities only while the initiating session and step remain current.

The final read must confirm every new size before Step 6 succeeds. If a successful response leaves
a size missing, the wizard retains the confirmed IDs and shows a save error. A failed batch may
have saved some sizes; retry reads the account again and groups only the remaining creates.

Only explicit removals and the existing legacy fulfillment-only workaround delete sizes. Step 6
has no fulfillment controls; old drafts can still carry those flags, which the PATCH contract
cannot update. That remaining exception and the limits of live verification are recorded in
[API_GAPS.md](./API_GAPS.md#updated-sku-contract).

**Mapping** — `src/shared/api/mappers/vendor.ts` (`mapVendorToStore`, `mapVendorTheme`)
absorbs the backend's inconsistent field naming (`business_name` *or* `name`, `distance_km`
*or* `distanceKm`, `price` *or* `selling_price`, `veg` *or* `is_veg`) and supplies defaults.
That normalisation belongs here and nowhere else — don't re-do it inline in a page.

**Landing discovery** — `listLandingStores(location, signal)` calls the public `GET /v1/home`
operation with its generated required query type (`service_area`, `latitude`, and `longitude`) and
passes request cancellation through the package wrapper. `mappers/landing-store.ts` accepts both
documented vendor identifier spellings, drops unusable rows, and preserves absent card metadata as
absent. It intentionally ignores the ambiguous `image_path`: landing artwork uses explicit
`banner_image`, then `thumbnail_image`, then the store name. Demo mode returns the same presentation
shape from `STORES` without calling Photon or the backend.

The landing-only adapter at `modules/marketing/lib/landing-location.ts` uses Photon's public `/api/`
and `/reverse` operations. It keeps the coordinates returned by the selected prediction. When that
prediction lacks a postal code, it requests up to ten house, street, and locality results within one
kilometre of those coordinates, accepts a six-digit Indian PIN only when the valid nearby candidates
agree, and never replaces the selected coordinates with a nearby feature's point. Browser-location
reverse results follow the same bounded rule and retain the browser coordinates. Conflicting or
missing candidates remain unresolved rather than mixing a guessed service area with exact
coordinates. The shared Photon behavior used by other routes is intentionally unchanged.

A safe public request using the OpenAPI sample coordinates was checked on 2026-09-01. The deployed
response was a successful envelope with `data.new_vendors`; sampled vendor rows used `business_name`,
included both `id` and `vendor_id`, and optionally included explicit `banner_image` and
`thumbnail_image`. Rows with neither image were present. The response's generic `image_path` occurred
on `top_products`, not on the sampled vendor rows, so it is not treated as landing-store artwork.

#### Storefront cart

`src/modules/storefront/lib/cart-actions.ts` connects storefront actions to the app-facing
`cartService`. Live adds and quantity updates apply the returned cart snapshot after API success;
deletion removes the local line after the request succeeds, or locally if it has no backend item ID.
In-flight add/qty writes are tracked per SKU so switching pack size shows a loader instead of a
stale Add.
Mutations for one vendor run in a queue so an older snapshot cannot wipe a later add. A missing
cart *line* ("specified item was not found") refreshes that vendor's cart; it does not clear it.
Logout increments a write epoch and drops `md-cart`, so a late response cannot refill the
previous identity's cart. After the next customer OTP, `StorefrontLayout` only applies a
pending add-to-cart. Live cart GET belongs to the shop home and cart pages (checkout hydrates
only when that vendor has no local lines). Demo actions update Zustand directly. The package's
parallel cart wrapper is not used by this path.

`useCartStore` persists lines and summaries per vendor under `md-cart`; replacing one vendor's cart
retains other vendors' lines. Lines are keyed by SKU, so two sizes of the same product stay
independent. After login, `syncVendorCart` always replaces that vendor from the server — leftover
`md-cart` names from the previous session are not kept. Line labels come from the catalog SKU
(or the size just tapped), not from an older local name. Trace this orchestration when changing
cart behavior.

#### Storefront customer orders

Checkout shows `eligible_delivery_dates` as one estimated window (first to last
date, e.g. `26–28 Sept`), not a picked day. From-cart still sends the first eligible `delivery_date`
when the timing type requires one, and writes that window into `notes`.

Each storefront page owns its HTTP calls:

| Page | Live GETs |
|------|-----------|
| Store list | nearby stores / keyword search |
| Store home | storefront + products (+ cart once if signed in) |
| Product detail | SKU detail; storefront only on cache miss |
| Cart | cart; storefront only on cache miss |
| Checkout | checkout_options; storefront on cache miss; cart only if no local lines |
| Location / success / orders | none for chrome (memory cache) |
| My orders | `GET /v1/users/{userId}/orders/history/paged` — page 0 first (`size` 20); next page when the list bottom is visible |
| Order details | `GET /v1/users/{userId}/orders/{orderId}` |

Live customer history uses `mapCustomerOrderHistoryPage` on the paged
container (`result`, `page_number`, `page_size`, `total_elements`,
`total_pages`, `last_page`). Detail goes through `mapCustomerOrderDetail`.
The storefront order-details page renders documented
fields only: `order_id`, `store_name`, `order_status`, `payment_status`,
`delivery_date`, `delivery_method`, `notes`, `customer_name`, `customer_mobile`,
`delivery_address.address.address1`, `order_amount` (`items_count`, `gross_amount`,
`discount`, `delivery_charges`, `service_charge`, `tax_amount`, `amount`), and
`order_items` (`sku_name`, `size`, `quantity`, `unit_price`, `list_price`,
`line_total`, `discount`, `image_path`). Item size stays on its own field; it is
not folded into the name.

#### Vendor dashboard reads

The vendor dashboard surfaces share one mapping module. `src/shared/api/mappers/vendor-dashboard.ts`
owns every wire-to-view-model conversion behind them, because the backend is inconsistent in ways
a page must never learn:

- **Collections arrive in three shapes.** `/orders/` answers a paginated container
  (`data: { result, page_number, page_size, total_elements, total_pages, last_page }`),
  `/subs` uses that same measured paging envelope, `/products` answers a bare array, and other reads
  use Spring's `content`. All three go
  through `vendorCollectionRows` in `mappers/vendor.ts`, which never throws — a tile that
  cannot read its collection should be empty, not take the page down. The strict onboarding
  sibling still throws, deliberately; setup cannot proceed on a shape it does not recognise.
- **Subscription paging does not inherit the orders fallback.** `mapVendorSubscriptionPage` treats
  only an explicit `last_page: true` as the last page, so an omitted key cannot stop the walk early.
  It preserves nullable row values, including a zero quantity, and the page renders every field from
  the read-only subscription row rather than inventing a detail surface.
- **Products loads every SKU page.** `mapVendorSizePage` preserves the paging evidence from
  `/products/skus`; `listVendorSizes` follows `page_number` with `page_size=50` until `last_page`.
  The service deduplicates by SKU id and rejects incomplete or non-advancing responses instead of
  presenting a partial catalog as complete. Leaving Products aborts the read and stops further pages.
- **Overview reads one page of its delivery window.** When more pages remain, its pagination notice
  and Orders link remain visible even if every loaded order was filtered out as finished. Only a
  complete result with no open orders is labelled "Nothing waiting."
- **Insight groups are omitted rather than zeroed.** A vendor with no orders gets
  `order_status_count: {}`, so `mapVendorInsights` reads every field through the mapper
  instead of reaching for a nested count.
- **Status is two independent axes.** `delivery_status` uses the contract enum
  (`PENDING`/`SCHEDULED`/`IN_PROCESS`/`SHIPPED`/`DELIVERED`/`CANCELLED`) and `payment_status`
  (`DUE`/`PAID`) is separate, so a delivered-but-unpaid order can be expressed. Anything
  outside the enum becomes `PENDING` — never an invented state.
- **Store state derives from submission and approval alone** in
  `src/modules/vendor/lib/store-state.ts`. The console's temporary approval reading is scoped
  there; [ADR 0002](./adr/0002-console-assumes-verification-approved-the-vendor.md) owns its
  removal condition and separation from the wizard's approval gate.

`src/shared/api/fixtures/vendor-dashboard.ts` holds the demo payloads **in backend wire shape**,
not as view models, so demo mode hands them to the same mappers live mode uses and `isLiveApi()`
chooses only between fetching and returning a fixture. `fixtures/vendor-dashboard.test.ts` runs
every fixture through the real mapper, so a fixture that stops matching the wire shape fails a
test instead of drifting into a parallel reality.

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

1. **Page** calls the app service (`src/shared/api/services/catalog.service.ts`).
2. **Mode gate** — `isLiveApi()` is true, so the demo branch is skipped.
3. **Package wrapper** — `storefrontService.get('42')` calls
   `apiGet('/v1/vendors/42/storefront', { skipAuth: true })`.
4. **Instance** — `getHttp()` lazily builds the Axios singleton on first use, reading `baseURL`
   and `timeoutMs` from the config module.
5. **Request interceptor**:
   - if the body is `FormData`, the `Content-Type` header is **deleted** so the browser can set
     `multipart/form-data` with the correct boundary — this is what makes image upload work;
   - unless `skipAuth`, attaches `Authorization: Bearer <mithra_access_token>` — refreshing
     first when `isAccessTokenExpired()` says the stored token has already expired, so an
     idle return does not spend a doomed request to discover it (see the
     [session lifecycle](./SESSION.md#lifecycle)).
6. **Response interceptor** — this public request skips authenticated refresh/retry. Protected
   calls use the shared refresh, retry, and credential-failure rules in the session lifecycle.
   Errors leave the transport normalized through `toApiError`.
7. **Envelope check** — `assertApiSuccess` throws if the payload says `success: false` (§3.1).
8. **Unwrap + map** — `unwrapData(res)` peels `{ data: … }`; `mapVendorToStore` turns the
   storefront details into the app's `Store` type with an initially empty product list.
9. **Page** sets state and renders.

Products load separately through `catalogService.listStoreProducts`, which calls the package's
paginated `/v1/vendors/{vendorId}/storefront/products` wrapper and maps the result.

---

## 5. HOW auth and tokens work

The package owns transport and token handling. App `auth.service.ts` maps the verified backend
identity into a session, and `auth-store.ts` coordinates application state through `applySession`
and `clearSession`. `AppProviders` configures callbacks, restores the session, and wires feature
cleanup. Persisted credentials belong to the API token store; `md-auth` persists identity only.

Read [SESSION.md](./SESSION.md) before changing OTP, roles, refresh, logout, route gates, or
session-owned storage. It owns the implemented lifecycle, failure behavior, authorization limits,
and the separately marked target session model. Human login instructions and demo credentials
live in [README.md](../README.md#authentication-status).

---

## 6. HOW to call the API from a component

There is **no** React Query, SWR, or data context in this app — confirmed, not an oversight.
Pages or their hooks own `loading` / `error` / `data` state. An illustrative component read is:

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
persists only a versioned, validated safe draft through `onboardingDraftAdapter`. Writes use one
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
6. **Verify:** `npm run typecheck && npm run lint && npm run test`. Vitest runs the pure setup
   logic in the node environment; there is no DOM or end-to-end runner, so also exercise UI behavior
   in both modes by flipping `VITE_USE_API`.
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
| `md-auth` | `useAuthStore` | persisted `{ user }` for UI restore; legacy tokens are ignored |
| `md-cart` | `useCartStore` | vendor-scoped lines and summaries; live API snapshots or local demo state |
| `md-delivery-location` | `shared/lib/customer-location.ts` | the latest delivery label, service area, latitude, and longitude shared across customer routes |
| `md-delivery-location-photon-confirmation` | landing location module | matching validation provenance; Live landing discovery ignores legacy/shared coordinates without it |
| `md-customer-orders` | demo services | mutable demo-mode state. The vendor dashboard keeps none: its demo data is read-only wire-shaped fixtures, so `md-vendor-orders` and `md-vendor-products` no longer exist |
| `md-vendor-onboarding-draft-v3` | `onboardingDraftAdapter` | schema-version-4 safe wizard draft, owner ID, and optional same-browser preview snapshot; no phone/OTP, payment credentials, tokens, files, or object URLs |

Onboarding phone/OTP/order and support WhatsApp values, UPI and bank-account details, files, and
object URLs remain in memory. The browser draft is crash/reload recovery only, not authenticated
server persistence or a public storefront. The `mapStorefrontConfigRequest` mapper aligns the typed
draft with `SaveStorefrontConfigRequest`: it adds the `+91` country code to the national ten-digit
order and support WhatsApp numbers and rejects local image URLs. Live account setup calls it through
`vendorOnboardingService.saveStorefront`; demo and sample flows only save the private preview.

---

## 9. Traps and rough edges

- **Two `catalogService`s, two `cartService`s.** Same names, different layers, different
  signatures. Confirm your import path.
- **Demo mode is the default.** `VITE_USE_API=false` ships in `.env.example`. A live-only service
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
- **After login the live cart is always replaced from the server** — see [Storefront cart](#storefront-cart).
- **`useAuthStore.login`/`register` are demo-only service actions.** The login screens use OTP;
  see [authentication status](../README.md#authentication-status).
- **Tokens are readable by JavaScript.** localStorage is an interim choice; any XSS is a
  session compromise. `SESSION.md` covers the intended migration to httpOnly cookies.
- **Storefront details and products load separately.** App `catalogService.getStore` uses the
  package storefront wrapper and returns an initially empty product list. Use `listStoreProducts`
  for the paginated catalog; the initial `Store.products` value does not establish an empty catalog.
- **`pnpm-workspace.yaml` is unused** — §2.
