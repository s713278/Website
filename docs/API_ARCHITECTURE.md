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
      billing.ts            #   vendor platform billing (Live API)
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
    live-billing-wire.ts    # Live API billing test responses in wire shape
  mappers/
    vendor.ts               # vendor wire payload → app view-model
    vendor-dashboard.ts     # vendor dashboard wire payloads → dashboard view-models
    vendor-onboarding.ts    # strict setup reference/account mapping + request mappers
    live-billing.ts         # Live API subscription read → billing view
  services/                 # the demo/live service layer
    auth.service.ts  catalog.service.ts  cart.service.ts  orders.service.ts
    vendor.service.ts  vendor-orders.service.ts  vendor-products.service.ts
    vendor-onboarding.service.ts # public references + live setup account reads/writes
    live-billing.service.ts # Live API billing reads and writes
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
| `billing.ts` | `vendorBillingService` | Vendor platform billing: the subscription read, subscribe, `confirm`, cancel and history under `/v1/vendors/{vendorId}/subscription`, and the paid plans list `GET /v1/subscription-plans`. See [Live API billing](#vendor-platform-billing-live-api). |
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
| `live-billing.service.ts` | `liveBillingService` | None: Live API only. `VendorPlanPage` routes demo mode to the prototype or the billing panel | The package's `vendorBillingService`; see [Live API billing](#vendor-platform-billing-live-api) |
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
snapshot for the setup wizard. It starts the two reads every vendor needs together: vendor context
and vendor profile. A caller that has just read the context passes it in, and the snapshot reuses it
instead of requesting it again. The business-type catalog (one 100-item page) is read only once the
profile shows a saved business type, because it exists to map that saved name back to the reference
Step 3 stores; a vendor who has not chosen one, like every new vendor on Step 3, skips it, and Step 3
lists its own page. A successful read also files Step 3's unsearched first page in the catalog
reference cache (never over an existing entry), so the step's first visit makes no request; later
pages still load on scroll. As soon as context reveals the backend resume step, it starts only the cumulative
account reads needed to reconstruct that step and every earlier one:

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
The measurement catalog is platform reference data, so `measurement-catalog-cache` keeps one
successful read per session: a later resume, or a return to setup after a saved step invalidates the
vendor's snapshot, reuses it without a request, and only sign-out drops it. The snapshot asks for it
from the Products step on (Step 5 shows product measurements and saved sizes are rebuilt against it)
and otherwise carries an already-read catalog. A vendor who enters on Steps 3-4 gets it when the
wizard reaches a step that uses it (5, 6 or 10). The read starts alongside the previous step's save,
and the step shows "Loading measurements…" with Continue disabled until it settles. A failed read
keeps the sample-unit fallback, as a failed snapshot read does.

Submitted vendors load the complete read set so earlier setup remains reviewable. If context omits
`onboarding.next_step`, the loader also chooses the complete set so the resource-derived resume
fallback is computed from real data rather than an intentionally partial snapshot. Context failure
rejects hydration; the other reads retain the existing optional behavior and become empty/default
snapshot fields when unavailable.

`loadVendorOnboardingState` caches one in-flight promise and then one resolved snapshot per vendor,
so the wizard, the header on `/onboarding`, and sign-in's prefetch share one fan-out. Failed loads
are evicted, and successful setup writes, submission, and sign-out invalidate the relevant entry.
The same invalidation also drops the dashboard's narrower context cache, so returning from setup
cannot reuse pre-write store state, storefront details, or plan usage. Both caches ignore a late
response belonging to an entry that has already been invalidated. Submission's read-back of the
context after go-live goes through the dashboard's context cache, so opening the dashboard next
reuses it rather than reading the context again.

The marketing header decides its vendor actions from the context alone. Off `/onboarding` it calls
`loadVendorAccountContext`: one `GET /v1/vendors/{id}/context`, filed in the narrower cache so the
dashboard opens on it, or no request when either cache already holds a resolved context (the
dashboard's is preferred). Waiting on the full read there held the actions back until the slowest of
its reads settled, however little the decision used them. On `/onboarding` the header shares the
wizard's full read instead of asking for the context a second time.

Post-sign-in routing (`resolveLandingPath`) decides from the context the same way, through
`loadVendorAccountContext` or a resolved context in either cache. A submitted store therefore lands
on `/vendor` after one request, instead of waiting on the complete read set the dashboard never
uses. Only when the destination is `/onboarding` does sign-in start `loadVendorOnboardingState`,
seeded with that context and not awaited, so the setup reads overlap navigation and the wizard's
route chunk. A failed prefetch is evicted as usual and the wizard retries it.

#### Vendor setup sizes (Step 6)

After setup is submitted, categories and products remain open for additions. Step 6 allows new
sizes only when the account's real approval status is approved (`APPROVED`; current `ACTIVE`
wire values are accepted for compatibility); pending vendors keep a
read-only step. Previously saved sizes remain locked after submission. The controls and Continue
handler use the same approval-aware rule, and saving validates new size details, duplicates and
the projected account total against the context's `limits.max_skus` (top level since the flat
context of 29 September 2026; the demo seed's nested `subscription.limits` is still read). When
the context sends `subscription.usage.skus`, any usage missing from the SKU list is added, so
unlisted inactive sizes still consume capacity; the flat context sends no usage, so in Live API
that count is zero. That count survives subsequent additions in the same visit. It does not demand pricing
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
the draft's other fields. The create response names the new SKU IDs only inside a human-readable
message, with no price IDs, so the reread stays ("Structured SKU create response" in
[API_GAPS.md](./API_GAPS.md#still-open)). Repeated saves also recognise an identical size whose
successful create did not return an ID. Matching uses product, quantity, and unit, never a stale product-derived name.
Conflicting new drafts must reload instead of taking over an existing size. The wizard records
returned identities only while the initiating session and step remain current.

The final read must confirm every new size before Step 6 succeeds. If a successful response leaves
a size missing, the wizard retains the confirmed IDs and shows a save error. A failed batch may
have saved some sizes; retry reads the account again and groups only the remaining creates.

Continue on Steps 4-6 skips the save, and with it the account reads that precede and follow each
write, while the step's catalog matches what this visit last saved or resumed. The comparison
covers that step and every earlier catalog step, plus the catalog source, so an upstream change
makes a later step save again. A resume vouches only for the steps before the one it opens on.
A failed save, local edits that outrank the account on entry, or a change of vendor leave the step
unvouched, so it saves as before.

Steps 7-9 apply the same rule to their request bodies, compared exactly as they would be sent:
the checkout options for Steps 7 and 8, which share one payload and so one comparison, and the
storefront plus business-details writes for Step 9. These steps are vouched for only by a save in
this visit, never by a resume, because the account's stored checkout options and storefront need
not match the payload a resumed draft would send.

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
independent. Header, cart bar, cart page, and checkout **item counts** use unique SKU lines
(`items_count`), not summed quantity (`total_quantity`) — same as order success/detail. After login, `syncVendorCart` always replaces that vendor from the server — leftover
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
| Product detail | `GET /v1/vendors/{identifier}/storefront/products/{product_id}`; storefront chrome on cache miss |
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

#### Vendor platform billing: Live API

Vendor-to-MithraDirect fees are separate from customer recurring deliveries. The existing
`vendorSubscriptionsService` and `/v1/api/subscription-plans` delivery-plan master are not a payment
gateway or platform-fee API. With `isLiveApi()`, Plan, the billing banner, the header button, the
rail's plan chip and Settings' Plan row read the published backend billing API. The
[decision record](./VENDOR_BILLING_DECISIONS.md#live-api-billing--29-september-2026) owns the
product rules and the billing states, as amended by the
[early first fee](./VENDOR_BILLING_DECISIONS.md#early-first-fee--29-september-2026).
[API gaps](./API_GAPS.md#vendor-platform-billing) owns where the backend falls short
([gaps A–K](./API_GAPS.md#billing-gaps-ak), including gap K, the early first fee) and the
[production release blockers](./VENDOR_BILLING_BACKEND_BRIEF.md#5-release-blockers), which the
[backend billing brief](./VENDOR_BILLING_BACKEND_BRIEF.md) owns with each gap's detail. Code comments tag each
gap the app copes with.

| Concern | Owner | Boundary |
|---|---|---|
| Backend wrappers | `packages/api-client/src/services/billing.ts` (`vendorBillingService`) | Six operations: the subscription read, subscribe, `confirm`, cancel, history and the paid plans list. Request bodies are typed from the schema; responses are the generic envelope, so shape safety comes from the mappers |
| Live billing service | `src/shared/api/services/live-billing.service.ts` (`liveBillingService`) | One exported object, the test seam. Unwraps each envelope through `assertApiSuccess` and returns payloads unmapped. The read's 404 becomes `not-live`; every other failure keeps its `ApiError` |
| Subscription and history mappers | `src/shared/api/mappers/live-billing.ts` | `mapLiveBilling` (the billing view), `mapLivePlanName`, `mapLiveTrialStart`, `mapLiveTrialEnd`, `mapLiveBillingHistory` and `mapLiveCheckout`. A read that matches no state throws `LiveBillingUnreadableError` |
| Wording | `src/modules/vendor/lib/live-billing-wording.ts` | Pure: each view's card, note, Confirming line, Stop the plan confirmation, Checkout purpose (waiting, failed and refused lines), banner and header label. Every ₹ amount comes from the plan price. `isSettledView` defines a settled read |
| Shared read store | `src/modules/vendor/store/live-billing.ts` | `useLiveBilling`, `useStartedLiveBilling`, `readLiveBilling`, `cancelLiveBilling`, `holdLiveBilling` and `resetLiveBilling`: the read, its refresh and retries, the cancel response and the confirmation hold |
| Retry timing | `src/modules/vendor/lib/live-billing-retry.ts` | `retryDelays` (5, 15 and 30 s), `isBriefOutage` (502, 503 or network) and `pause`, shared by the read and `confirm` |
| Live Plan | `src/modules/vendor/components/LiveVendorPlan.tsx`, `LivePaymentsYouMade.tsx` | The card, its actions, the Checkout sequence, the poll and "Payments you made" |
| Live chrome | `src/modules/vendor/components/LiveBillingChrome.tsx`; `VendorShell.tsx`'s `LivePlanChip`; `VendorSettingsPage.tsx`'s `LivePlanName` | Banner and header button from the wording, both linking to Plan; the rail chip and Settings show the plan name from the shared read |
| Checkout | `src/shared/payments/razorpay-checkout.ts` (`openSubscriptionCheckout`) | Reused unchanged: the key ID and subscription ID come from subscribe's response |

`VendorPlanPage` routes by mode: the Live API gets `LiveVendorPlan`; demo mode gets the
[six-state prototype](#six-state-plan-prototype) in development and the billing panel in a
production build. Pages and components import billing only from `@/shared/api`. Tests spy on
`liveBillingService` and use the wire-shaped responses in
`src/shared/api/fixtures/live-billing-wire.ts`.

**Sources.**

- **One shared read** covers `GET /v1/vendors/{vendor_id}/subscription` and
  `GET /v1/subscription-plans` (requested once per page load, see below); if either fails, the whole
  read fails. It feeds Plan, the banner, the header button, the rail chip and Settings, so they
  cannot disagree. It holds the billing view, the subscription's `plan_name`, its `trial_started_at` and its `trial_ends_at`.
- **The plan** is the list's `billing_cycle: MONTHLY` entry: its name, `plan_code` for subscribe and
  `sale_price`, which the app reads as rupees. There is no conversion; the OpenAPI examples'
  paise are a backend documentation bug ([gap G](./API_GAPS.md#billing-gaps-ak)). No monthly entry takes the
  read error path.
- **History** (`GET …/subscription/history`) is read only by Plan, apart from the shared read.
- **The vendor context** supplies features and limits only. In the Live API, the rail chip and
  Settings' Plan row take the plan name from the shared read (`mapLivePlanName` through
  `useStartedLiveBilling`); demo mode reads its context. Billing reads nothing from the context.
- **Mapping.** The backend's statuses and dates decide the view; the browser clock only compares
  them with now. The first matching rule wins. Absent fields read as null, except that an `ACTIVE` paid
  period without a boolean `cancel_at_period_end` takes the read error path. Unknown fields are ignored, and timestamps need a timezone but not seconds. Days left are counted from
  `trial_ends_at` or the paid-through date, rounded up; the backend's `days_remaining` and display
  labels are ignored. Before go-live (404) Plan shows only a note.

**Views.** `LiveBillingView` has Free days, 3 days left, Free days Confirming, Collecting, Paid,
Stopped, AutoPay off, Payment failed, Shop closed, Confirming and not live. Shop closed and
Confirming say whether free days or paid days ended. Paid carries `trialEndsAt` while its free days
last after an early first fee (otherwise `null`); the wording then says the free days are kept and
dates the next ₹299 on the paid-through date. The Confirming views are Free days Confirming and
Confirming; they offer no payment action, and Plan shows their status line with **Check again**.

**Actions.** Only Plan opens Checkout, and only one action runs at a time.

- **Pay ₹299 with Razorpay** in Free days and 3 days left is the early first fee: one Checkout for
  ₹299 now, with the free days kept. The backend decides what Checkout charges
  ([gap K](./API_GAPS.md#billing-gaps-ak)). Set up AutoPay and Turn off AutoPay are not Live API behavior.
- **Pay ₹299 with Razorpay** in Payment failed and Shop closed pays for a new period now.
- **Keep shop open** in Stopped and AutoPay off pays ₹299 now for the month after the paid-through
  date.
- **Stop the plan** in Paid, including while free days are kept, asks once and then calls cancel.
- The header and banner label these "Pay ₹299", "Keep open · ₹299" or "Shop plan".

A Checkout action runs subscribe, Checkout, then `confirm` with Checkout's values, then a poll.
Subscribe is never retried; a repeat while pending returns the same subscription (after the trial
end, that reuse is [gap I](./API_GAPS.md#billing-gaps-ak)). A dismissed
Checkout changes nothing; one closed after a failed attempt shows the purpose's failure line with
Razorpay's reason.

**Refresh and retries.**

- `TEMP(vendor-billing-reads)`: this behavior stands in for a query cache;
  [VENDOR_BILLING_READS_TARGET.md](./VENDOR_BILLING_READS_TARGET.md) owns the target, request counts
  and removal.
- A read already in flight for the vendor is joined. The chrome, rail and Settings start a read
  only when none is loaded, so client navigation sends nothing.
- Plan rereads on mount, and its Checkout action is off while any read runs, so Checkout is
  offered only from a read that has just landed.
- The plans list is requested once per page load and kept in memory, never persisted; rereads
  reuse it. A failed plans request is dropped, so the next read requests it again. Sign-out and a
  vendor switch keep it (it holds no vendor data).
- While anything shows the read, one window focus listener and one boundary timer keep it current.
  Focus rereads only when the last good read is 15 minutes old or more, the last read failed, a
  confirmation hold is active, the view is a Confirming view, or another tab signalled a change.
  The timer rereads at the view's earliest future T or P; Paid with free days kept carries both.
  A delay beyond the browser's longest timer (2³¹−1 ms, about 24.8 days) is re-armed in steps. Day
  counts move only on a reread.
- A 502, 503 or network failure is retried quietly 5, 15 and 30 s apart, then shows "MithraDirect
  isn’t responding. Try again in a minute." with Try again. Other failures use `getErrorMessage`.
  Once nothing shows the read, a read waiting to retry gives up, and the next mount reads afresh.
- Tabs share changes through the `md-vendor-billing` `BroadcastChannel`, carrying `{ vendorId }`
  only. The channel is open only while something shows the read (always the case on Plan). A tab
  posts on a confirmation hold, a successful cancel and a read that ends a hold; a receiving tab
  marks that vendor's read stale, even if a read is in flight, so its next focus rereads. Without
  `BroadcastChannel`, tabs fall back to the 15-minute gate.
- A failed read keeps the last view: Plan shows the error line above it, and the chrome keeps its
  banner and header. Until a view lands, including after a failed first read, the header says
  "Shop plan" and neither the billing banner nor the Free plan banner shows.

**Writes.**

- Writes are never retried automatically, except `confirm`: a 502, 503 or network failure is retried
  5, 15 and 30 s apart. A 400 or 401 shows "We couldn’t confirm this payment here…". The poll runs
  whatever `confirm` does, because the payment may have been taken. Leaving Plan stops the retries.
- Cancel's response is the subscription. It replaces the shared view directly, with no reread, and
  drops any read in flight. It is published even after Plan unmounts, so the chrome stays true; a
  late answer changes none of Plan's own state.
- Gap-specific messages appear only after the real failure. Cancel's 500
  ([gap A](./API_GAPS.md#billing-gaps-ak)) and subscribe's 409 from Stopped or AutoPay off
  ([gap E](./API_GAPS.md#billing-gaps-ak)) have their own lines. Subscribe's 500 after the trial
  ([gap I](./API_GAPS.md#billing-gaps-ak)) shows the backend's copy through `getErrorMessage`. Since
  30 September dev can instead return 200 with the free-days subscription, and Checkout then opens
  blank, which the app cannot detect.

**The confirmation hold** (early first fee).

- When Checkout reports success, `holdLiveBilling` stores the action's waiting line in the shared
  read store: "Confirming payment… Card payments take about a minute; UPI can take a few hours.",
  with "Your shop opens once Razorpay confirms the ₹299." added on a hidden shop. While the hold
  lasts, the card's Checkout action is off.
- The hold lives in memory, per vendor and session, and is never persisted. It ends on a settled
  read, a reload, sign-out or a vendor change. It survives leaving Plan; back on Plan, the waiting
  line shows with **Check again**.
- A **settled read** is one that is neither a Confirming view nor offering a Checkout action
  (`isSettledView`). A changed view that still offers a payment, such as Free days turning into
  3 days left, does not end the hold.
- Plan polls every 5 s for up to 90 s while the hold lasts, including through Confirming views.
  Leaving Plan stops the poll, and it does not restart on return. After 90 s the waiting line stays
  with **Check again**. While the view is a Confirming view, its own status line is the waiting
  line, so it never shows twice.
- The chrome follows the read, not the hold.

**Payments you made.** `LivePaymentsYouMade` reads the history when the shared read lands from a
subscription response whose content changed since the last good history read (a cancel response
included), after each successful `confirm`, and on its own Try again; otherwise it shows the kept
rows at once, so reopening Plan on an unchanged subscription sends no history request
(`TEMP(vendor-billing-reads)`). A newer reason drops the history read in flight. Its failure, or an unreadable shown
event, stays in its section with Try again, beside any last rows. `mapLiveBillingHistory` lists
events newest first and shows each once per type and payment ID, or per type and subscription ID
without a payment, because the development backend records some twice
([gap G](./API_GAPS.md#billing-gaps-ak)). The titles are "Payment received", "AutoPay set up",
"Plan stopped" (a cancellation requested while `ACTIVE`) or "AutoPay turned off" (one requested while
not `ACTIVE`, such as a legacy AutoPay-only subscription on dev), "AutoPay ended" (skipped after a Plan stop on that subscription), and
"Free days started" from the shared read's `trialStartedAt`. Other events are ignored. An amount
shows, in rupees, only when an event carries one; the app never infers it.

**Chrome.** `LiveShellBanner` shows the view's billing banner on every vendor page, Plan included.
Below it, `LivePlanBanner` shows "Free plan active — share your shop link…" to an open store until
T, from the shared read's `trialEndsAt` (the subscription's `trial_ends_at`, kept after subscribe),
so it stays after an early first fee and goes at T's reread. Demo's `PlanBanner` (an open store on
the `FREE` plan) is not used, since the Live API has no free plan. `LiveHeaderButton` replaces the
plan pill with the view's header label. Both billing elements only link to Plan.

**Session-bound.** The read belongs to one vendor and one session. A change of the auth store's
user (sign-in, sign-out or a vendor switch) resets it, drops any response still on its way, and
ends the hold, so the next vendor on that browser never sees another vendor's billing.

**Demo stays separate.** Demo mode keeps the earlier trial AutoPay flow (Set up AutoPay, AutoPay on,
Turn off AutoPay). Demo mode, the six-state prototype, the local test server and the development
preview are frozen: they get no Live API behavior, and the Live API never calls the local test
server. Their implementation is described below.

#### Vendor platform billing preview

This section and the [six-state prototype](#six-state-plan-prototype) describe demo mode and the
development preview only; the [Live API](#vendor-platform-billing-live-api) does not use them.

| Concern | Owner | Boundary |
|---|---|---|
| Official script, subscription Checkout inputs, browser callback/failure/dismissal, teardown | `src/shared/payments/razorpay-checkout.ts` | No trial, pricing, eligibility, signature secret or access rules |
| App-facing status/configuration/verification submission contract | `src/shared/api/services/vendor-billing.service.ts` | Proposed four-operation interface and separate trial, authorisation, fee, cancellation and refund facts; not a generated HTTP contract |
| Proposed wire mapper and fixture service | `src/shared/api/mappers/vendor-billing.ts`, `src/shared/api/services/vendor-billing-fixture.service.ts` | Existing context mapper feeds every supplied scenario; mock acknowledgements and explicit reconciliation stay in memory. Demo and preview only |
| Shared context selection and refresh | `src/shared/api/services/vendor-billing-context.service.ts`, `src/modules/vendor/components/VendorAccountProvider.tsx`, `src/modules/vendor/lib/vendor-context-cache.ts` | Demo mode only: the production demo build's billing panel. Billing reads and simulated writes refresh one vendor-scoped context |
| Explicit development implementation | `src/shared/api/services/vendor-billing-preview.service.ts` | Test keys and inspected subscription schedule; real callbacks only become pending |
| Billing and trial presentation | `src/modules/vendor/components/VendorBillingPanel.tsx` | Renders service-provided access, trial, authorisation and payment independently |
| Development route and scenario controls | `src/modules/vendor/pages/VendorBillingPreviewPage.tsx` | DEV-only lazy route `/dev/vendor-billing`, outside auth and vendor-context gates |
| Plan page | `src/modules/vendor/pages/VendorPlanPage.tsx` | In a production demo build, the billing panel from the selected auth vendor, without usage against limits; in development demo mode it lazy-loads the six-state prototype instead. The Live API gets the [Live Plan](#vendor-platform-billing-live-api) |
| Local Plan Test helper | `scripts/vendor-billing-test-helper.mjs`, `src/shared/api/services/vendor-billing-local-test.service.ts` | Loopback development HTTP, locally excluded scenario ledger, server-side Razorpay Test subscription creation/inspection, callback signature verification, provider readback and cancellation; no Spring call. The prototype's only transport |
| Six-state prototype seeds | `src/shared/api/fixtures/billing-prototype.ts` | One seed and event definition, imported by the app and loaded directly by the helper |
| Prototype state read and view model | `src/modules/vendor/hooks/use-billing-prototype.ts`, `src/modules/vendor/lib/billing-prototype-card.ts` | One shared helper read for Plan and the shell; card, banner, header and history derived once; no Checkout code |
| Prototype Plan and chrome | `src/modules/vendor/components/VendorBillingPrototype.tsx`, `BillingPrototypeChrome.tsx`, `BillingStateBanner.tsx` | Plan's card, sections, actions and chips; the banner and header button on every demo vendor page, linking to Plan |

The preview service is explicitly constructed rather than selected through `isLiveApi()`: an
environment-enabled Spring API cannot accidentally make these examples touch real vendor accounts.
Neither scenario controls nor browser callbacks change auth, cart, onboarding or production routes.
The parent remounts the billing panel when its service changes and passes the fixture `vendorId`.
The plan page keys its panel on the selected auth `vendorId`, never the public store slug.
Plan's former development controls, the sample-status override and the local Test Mode switch,
were replaced by the [six-state prototype](#six-state-plan-prototype) on 24 September 2026.

The ticket 12–17 paragraphs below describe the helper's machinery, which the prototype still
drives. Their Plan controls (the switch, the local Test panel's Pay Now, Cancel AutoPay and
**Reset Test scenario**) are no longer rendered. The helper still serves the three original
scenarios, so stored records such as vendor `r1` keep reading.

**Local Plan Test foundation (ticket 12):** an explicit development-only switch selects a
helper-backed service for the panel and selected auth vendor. The ordinary context service,
sample override, global API mode and account provider stay separate. Vite proxies the loopback
helper; production output has no helper transport or controls. The helper requires Test-only
configuration, saves a vendor-scoped scenario and append-only logical intent records in excluded
local storage, and returns them after restart. Scenario reads do not create provider objects.
Its fixed active/expired trial and paid sample boundaries are presentation data only; no Test
authorisation, fee or real marketplace entitlement has been verified. Choosing another scenario
never replaces the current one; only the guarded reset (ticket 17 below) retires it.

**Local Plan Test Checkout (ticket 13):** the helper owns preparation and exposes the scenario's
available action. During an active trial, Pay Now creates a future-start subscription on the
configured monthly Test plan with `start_at` at the original trial expiry and no add-on. An expired
trial gets a separate immediate-start subscription for the first fee. The paid sample prepares
AutoPay at its paid-through anchor; see ticket 15 below. A trial that has ended while it still
has a trial AutoPay object offers no preparation, since that object may charge at the boundary.
The helper persists the intent and a `provider_requested`
marker before calling Razorpay, tags the object with the attempt in its notes and persists the
association before replying. A lost or timed-out creation is reconciled by listing the plan's
subscriptions for that note. A miss within ten minutes stays uncertain; only a later complete miss
permits a new creation for the same attempt. A new key for the same action, as after a
reload, converges on the recorded attempt. Concurrent requests for one vendor receive a conflict.
Before Checkout, the helper inspects the provider plan (monthly, interval 1, INR), quantity,
ownership notes, `created` freshness and start time. A start or plan mismatch, or a consumed
object, blocks Checkout and marks the attempt unresolved; no replacement is created. The browser
receives no secret: the public Test key, subscription ID, expected fee/date and the local ledger. The panel's existing
consent step handles a fee that differs from the displayed ₹299.

**Local Plan Test verification (ticket 14):** the service forwards the callback's attempt,
subscription, payment ID and signature to the helper, then performs a fresh status read. The helper
resolves the attempt and subscription from its own record for the selected vendor. It verifies
`HMAC-SHA256(secret, payment_id | stored subscription_id)` with the server-held Test secret; a
missing field, wrong vendor/attempt/subscription or failed signature records nothing. A valid
signature records only that an authentic callback arrived. The payment ID and signature are not
stored. Each status read rereads associated subscriptions that are not yet settled: ownership
notes, plan (monthly, INR, ₹299), the original `start_at` for trial setup, the earliest ₹299
invoice and its captured, unrefunded payment. Only `authenticated`/`active` confirm authorisation;
`pending`, `paused` or an unknown status stays pending and is reread, and only
`cancelled`, `completed` or `expired` is closed. A `halted` read records `haltedAt` and is a failed fee:
the helper persists an immediate cancellation (`reason: 'halted'`) and asks Razorpay Test to cancel
the subscription, retrying an unanswered request on the next read. A refundable token charge, an
`authenticated`/`active` status or a signature alone never confirms the fee. The first fee must be
that earliest invoice, cover one month and start at the original trial expiry, or not before the
immediate-start preparation. Only its invoice/payment IDs and billing period are stored, once;
duplicate or late callbacks add no coverage. Later charges count only as renewals, described below.
An ownership, plan, schedule or
period mismatch is recorded as a final verification problem until the guarded reset retires the scenario. A failed
provider read keeps the recorded result and reports
`providerCheck: unavailable`; the service then removes billing actions and says so. A status
read works with no callback, including after reload or helper restart. After trial setup, verified
AutoPay leaves the trial and first-fee date at the original expiry. After an expired signup, a
verified first fee advances the local scenario to paid presentation through that invoice
period. An ended trial offers a separate first fee only once Razorpay shows its AutoPay object
closed. The service passes `providerVerified` flags. The panel marks those facts **Razorpay Test
verified**, and labels trial, access and restrictions as locally simulated. Spring context, auth
and orders are untouched. Mode is enforced by Test-only credentials: a live-account callback
fails the Test-secret signature, and the Test key cannot read live records.

**Local Plan Test renewal and recovery (ticket 15):** the paid sample gets its own provider object.
While its sample coverage runs, it offers `setup_autopay` with `start_at` at the sample's
paid-through date, which is its renewal anchor. The operator runs accelerated charges from the
Razorpay Test Dashboard and then refreshes Plan; Plan has no charge button and creates no second
subscription. Each status read rereads a confirmed fee's subscription and invoices; the first fee
itself is not rederived. A renewal counts only if it is a paid ₹299 invoice with a captured,
unrefunded payment and a one-month period starting exactly where the last confirmed period ended.
A retry settles that same invoice, so the recovered coverage and next renewal date stay on the
original anchor. Payment time and dashboard acceleration never start a new month or move a trial
expiry. Counted renewals are append-only, and paid charges outside the chain, such as duplicates or
periods starting at charge time, are reported as uncounted. The latest due fee is `pending` for an
open invoice, including while Razorpay retries it (`pending`), and `failed` only once Razorpay shows
`halted`; a later stale read cannot turn that failure back into pending. A `failed` recorded by the
earlier rule re-derives while Razorpay still shows `pending`. Unknown statuses and unavailable reads
stay pending or stale. Past the confirmed boundary, a scheduled fee still being collected (an
authorised or retrying AutoPay agreement, or a fee-confirmed one with no cancellation and no halt)
is the collection retry period: `collectionRetrying` is true, the store stays visible and access
keeps the status of the coverage that ended (`PAID`, or `TRIAL` for a first fee at trial end). A
fee paid now (`pay_first_fee` before its fee) has none. A halt, or any cancellation that has not
failed, ends it; then the local scenario becomes `PAYMENT_REQUIRED` or `TRIAL_ENDED`, with the store
hidden and no grace period. After a halt, `pay_first_fee` is offered again only once every object
reads closed. After a confirmed fee, authorisation follows the latest subscription status:
`authenticated`, `active`, retrying `pending` and a completed finite Test schedule stay confirmed.
`halted` is failed and paused or unknown statuses are pending. `cancelled` and `expired` are
revoked. A closed subscription is final: nothing further is scheduled and confirmed coverage is
kept. `providerVerified.coverage` marks a paid-through date that comes from a verified fee. A due
fee past that date with no provider invoice yet is local simulation, so its payment flag is off.
The Plan copy labels restriction as a
local demonstration that does not gate the real storefront or vendor operations. It also states that
an accelerated charge is a provider payment fact only, not evidence that trial days elapsed or that
backend enforcement works. Real no-grace enforcement remains Spring work.

**Local Plan Test cancellation and rejoining (ticket 16):** the helper offers `cancel` only for the
current agreement, the latest provider object: a helper-created subscription that is authorised,
still retrying its first charge, or fee-confirmed and still able to collect. An ordinary trial with no agreement, or an unverified
preparation, has nothing to cancel. The panel's existing two-step confirmation quotes the trial
expiry or paid-through date and leaves them unchanged. Confirming posts one idempotency key to the
helper's `cancellations` operation, and the service then performs a fresh status read. Before any
provider call, the helper rereads the object's ownership notes and persists the request with its
association. Before the first fee, or once paid coverage has lapsed, it requests an immediate stop.
While a confirmed-fee paid cycle runs, it requests a cycle-end stop, which Razorpay rejects before
the first cycle. Progress is shown separately from coverage:
- an unanswered request stays **Cancellation requested** and may be retried for the same agreement;
- Razorpay's acceptance of an immediate stop is still a request;
- an accepted cycle-end stop is **Renewal cancellation scheduled**, with no next fee, even while
  Razorpay shows the subscription `active`;
- a definite rejection is **Cancellation not confirmed**. A refusal of a retried request stays
  requested, since the earlier request may already have landed;
- only a status read showing the object cancelled is **Cancellation confirmed**, marked Razorpay Test
  verified. It takes effect no later than that read, with authorisation revoked.

A closed object is not reread, so a stale `active` read cannot undo a confirmed stop. Replayed or
reloaded keys converge on the recorded progress without another provider call, and a lost response
is reconciled by the next status read after restart. A key belongs to one agreement's cancellation,
so replaying it after a rejoin never touches the replacement. A closure without an accepted helper
request, including one after a rejected request, is reported as an external revocation instead.
Rejoining reuses `setup_autopay`. It is offered during retained trial, sample or verified paid
coverage only when every earlier object is closed at Razorpay. An unanswered, acknowledged or
scheduled stop withholds it. The replacement starts at the same boundary: the original trial expiry,
or the paid sample's anchor or verified paid-through date. The page's earlier preparation key
converges on that one new object. The panel's consent step still guards a changed schedule. The
replacement becomes the current agreement, so the cancellation label clears while the old attempt
keeps its history. Its first fee continues the original cycle, with no new trial or duplicate fee.

**Local Plan Test scenario reset (ticket 17):** Plan's **Reset Test scenario** is a two-step action.
Its confirmation names the selected vendor, scenario and generation and the number of recorded Test
subscriptions. It separates the discarded local simulation from actual provider cancellation and
states that subscriptions the helper did not create for that scenario are outside reset's reach.
Confirming posts the scenario, generation and one idempotency key to the helper's `resets`
operation. A stale confirmation for another scenario or generation is refused. Reload, helper
restart, the mode switch and choosing another scenario never reset anything. The helper persists
the reset, then settles each object recorded for that generation, including a creation whose
response was lost:
- a subscription already closed at Razorpay is recorded as closed without another call;
- a subscription that can still collect, whether it is `created`, authorised, paid or scheduled
  for a cycle-end stop, is checked for ownership. The helper persists a cancellation request and
  then asks for an immediate cancel;
- only a following read showing the subscription closed confirms the cancellation. Acceptance
  alone, an unanswered or rejected request, a failed read, an unowned subscription or a creation
  not yet visible leaves the reset **pending**.

While a reset is pending, the helper offers no billing action and refuses preparation, cancellation
and a new scenario. Plan lists each object's progress and offers **Retry reset**. A retry
converges on the same reset, rereads first and never repeats a cancellation that a read already
shows landed. A refusal after an unanswered request stays uncertain. Once every object is settled,
the generation moves to a per-vendor history with its dates, attempt states, provider associations,
fee periods, cancellation and reset progress. The history holds no idempotency keys, invoice or
payment IDs, signatures or callback fields. The vendor then has no scenario until the operator
explicitly chooses one, which starts the next generation. Late callbacks, replayed keys and
provider reads of a retired generation cannot change the new one. Spring context, auth, orders and
ordinary demo billing are untouched. The diagnostic preview's reset still recreates fixtures only
and cancels nothing at Razorpay.
A cancellation is never described as a refund. Cancellation-race and refund progress remain
labelled simulated samples; the helper performs no Test refund.

**Implemented in the development preview:** the [19 September hybrid decision](./VENDOR_BILLING_DECISIONS.md)
replaces the Option A/B policies. Proposed fixture context supplies an independently granted trial,
and optional **Pay Now** setup retains the original expiry. The service maps server-counted days,
uses genuine onboarding and approval for pending reasons, and rejects invalid billing fields or
timezone-free billing dates without breaking ordinary context hydration. The backend still owns
any real entitlement and after-expiry fee confirmation.

In the preview and demo (frozen with the trial AutoPay flow): trial entitlement, mandate
authorisation, confirmed paid coverage, provider lifecycle, cancellation and refund progress are
distinct. Cancellation retains the original trial or paid period; rejoining can set up billing again
at the same boundary (the Live API instead charges ₹299 at once, under the
[early first fee](./VENDOR_BILLING_DECISIONS.md#early-first-fee--29-september-2026)). A scheduled fee still being collected keeps
service past that boundary until collection halts; a failed (halted) fee grants no grace. Server capabilities must retain billing/account and existing-order
fulfillment while hiding the store and blocking new operations after access expires.
A successful retry keeps the original cycle. The decision record owns full
refunds for debits despite timely cancellation and no automatic proration for ordinary
cancellation; backend reconciliation must preserve those distinctions. The local test server's Test
account offers cards only; Live API Checkout uses MithraDirect's own account, which offers card and
UPI. eMandate is excluded under the
[method scope](./VENDOR_BILLING_DECISIONS.md#current-test-mode-method-scope), yet MithraDirect's
account still offered it on 30 September; switching it off and testing card and UPI with the early
first fee are [release blockers](./VENDOR_BILLING_BACKEND_BRIEF.md#5-release-blockers). Live API mode selects the backend, not Razorpay Live Mode.

The backend published its own billing API instead of the proposed contract, and the Live API
uses it through separate wrappers, service and mappers
([Live API billing](#vendor-platform-billing-live-api)). The app-facing four-operation service,
with its proposed cancellation/refund progress, schedule/paid-period data and action availability,
serves demo mode and the preview only. The Checkout adapter still owns only provider/browser
interaction.

**Authorised mock contract, 19 September:** the user permits fabricated missing backend data for
development and tests. The [mock dataset](./VENDOR_BILLING_MOCK_DATASET.md) and its JSON file
now follow the supplied vendor context envelope and snake_case fields, adding only the minimal
`subscription.billing` block and populating existing fee/trial data. Reuse the existing context
read; no new billing-status endpoint is needed. *(Withdrawn for the Live API on 29 September 2026:
the backend published its own billing API, and the context no longer carries a `subscription`
block. The mock contract still feeds demo mode.)* The billing mapper, mock/demo service, panel and
mock-backed `/vendor/plan` wiring use it; the extension itself will not ship. Keep proposed types in the app layer;
actual package HTTP wrappers/generated declarations still follow the published backend contract.
This is a scoped temporary exception to requiring measured wire-shaped demo fixtures.

The context mapper/type preserves the billing block and timestamp. Missing billing
data must not break ordinary dashboard hydration. Reuse rupee price/currency fields and the existing
`eligible_features` list; keep legacy tier/status distinct from paid access. After billing writes,
refresh vendor context and update shared plan/features/billing together. Ordinary dashboard reads
still use the retained cache. Billing status reads, manual refresh, focus/visibility return and
simulated write acknowledgements invoke the provider's `refreshContext`, which invalidates the cache
and accepts one context snapshot. Entry identity rejects late pre-refresh reads; per-vendor billing
revisions reject older whole snapshots, including their plan and features. A failed refresh marks
the last confirmed billing snapshot stale and blocks mutations. A server-time boundary timer asks
for another read without calculating access. Submission/cancellation write acknowledgements carry
no entitlement. The context service accepts injected acknowledgement functions for isolated
submit/cancellation refresh tests; the demo context service connects no backend cancellation write (the Live API's cancel is wired, above).

The preview injects a mock-backed service explicitly using the existing panel seam. In a
production demo build the plan page uses the demo context service; the Live API uses the
[Live Plan](#vendor-platform-billing-live-api) instead of the panel. Simulated transitions stay in
vendor-keyed demo memory and make no real auth/vendor/order writes.
The simulated Plan and fixture paths now keep a preparation key for one logical request, including
a lost response, and reject reuse for a different vendor or action. The panel compares the prepared
amount, currency and first collection instant with the displayed values; a null collection date
means payment now. A changed fee or schedule needs explicit review. Expired preparations stop before
Checkout. Script failure can retry the same unexpired prepared attempt, while dismissal, rejected
submission, a lost preparation response and an error envelope trigger status reconciliation unless
the envelope supplies a retry delay. A new preparation needs a fresh status listing the action and
another explicit Pay Now. A failed read leaves the last confirmed snapshot stale and blocks writes.
The fixture can explicitly simulate failed setup/first fee and later confirmation; a retry reuses
the same logical attempt and is labelled as a retry, and only confirmation restores simulated paid
access after expiry.
Plan cancellation is simulated in demo memory. **Cancel AutoPay** appears
only when the status lists `cancel` and opens a second-step confirmation quoting the status's trial
expiry or current paid-through date, sending nothing until **Confirm cancellation**. One logical key
covers repeated clicks and a lost response; an error marks the snapshot stale and reads status before
another request. The acknowledgement returns a fresh status and never confirms cancellation.
The panel shows requested, **Renewal cancellation scheduled**, confirmed and failed separately from
race-refund owed/pending/completed/failed. It renders the source's combined refund amount; neither
state changes the displayed trial or paid boundary, and a historic confirmed fee under
`PAYMENT_REQUIRED` is labelled a last fee rather than paid access. Confirmation, failure, a race
debit and each refund step advance only through explicit, labelled simulated controls
(`simulateCancellationProgress`); callbacks never advance them. The preview refuses cancellation
after a real Test callback. These in-memory guards do not serialize
other tabs or survive restart. The local helper serializes its Test preparation per vendor;
Spring must provide its own guarantee.
Rejoining is simulated the same way and reuses `setup_autopay`; there is no resume action. **Pay Now**
appears only once the status lists it, so a requested, failed or scheduled cancellation blocks a
replacement until an explicit simulated outcome confirms the old agreement stopped. During a trial the
replacement is scheduled for the unchanged trial expiry. During retained paid coverage the supporting
text quotes the paid-through date as the next fee date and says no fee is taken today. A prepared
replacement that differs from the displayed schedule still needs **Confirm updated schedule**.
Preparing a replacement clears the old agreement's cancellation in the refreshed status. A failed
paid replacement returns to the status it replaced. A refund already owed or in progress stays
visible across the replacement and grants no paid access. Tests derive that combination by carrying
one authorised context's refund into another. The dataset has no confirmed context for a new first fee
after earlier paid coverage, so the sample simulates only its failure. The simulated clock never runs
backwards between fixture contexts.
Renewal outcomes (`simulateRenewalProgress`) are offered only when the status lists them in
`simulatedRenewalSteps`. A pending renewal at the boundary keeps the store open while it is
collected; from there a successful retry two days later restores coverage only to the original
cycle's end, with the renewal date unchanged, and a halt (`renewal_failed`) shows limited access with
no grace, AutoPay revoked and Pay Now for a new paid period, even though the historic paid-through
date remains. Revoked authorisation is
shown separately from a failed or confirmed fee and keeps the trial or paid coverage the status
supplies. When the finite Test schedule has ended, the panel shows the notice and restricted access
and offers only the actions the status lists. Replacing a fixture never touches provider state.
Stamp provenance in the service: mock/demo (simulated Checkout and outcomes), preview (real Test
Checkout with unverified callback), local_test (helper-prepared Test Checkout, helper-verified
provider facts marked separately and simulated access). The type still lists `backend`, but no
service produces it: the Live API does not use this service. Fake provider IDs cannot reach
Checkout.

**Removal condition:** met for the Live API, which has its own wrappers, mappers and wire-shaped
test fixtures ([Live API billing](#vendor-platform-billing-live-api)). The proposed mapper and
fabricated fixtures stay for frozen demo mode, with their lifecycle tests.

The earlier preview asked vendors to forfeit trial days and demonstrated setup as a trial
prerequisite; that behavior has been removed. Its dated provider evidence remains
[historical](./VENDOR_BILLING_PREVIEW.md#validation-record). Backend confirmation remains separate
ticket work.

##### Six-state Plan prototype

The [decision record](./VENDOR_BILLING_DECISIONS.md#six-state-demo-plan-prototype--24-september-2026)
owns the six states and their rules. Everything below exists only when `import.meta.env.DEV` is set
and `isLiveApi()` is false. `VendorPlanPage` and `VendorShell` lazy-load it, so production output,
live mode and the production demo panel are unchanged.

- **Seeds.** `billing-prototype.ts` defines `PROTOTYPE_VENDOR_KEY` (`r1-prototype`), the six states
  and `prototypeSeed(state, now)`, including seeded history `events`. It is plain erasable
  TypeScript with no imports. The helper loads it directly (see the
  [Node requirement](../README.md#prerequisites)), so the displayed seed and the helper record
  cannot disagree.
- **Shared read.** `use-billing-prototype.ts` keeps one module-level store (`useSyncExternalStore`)
  of the helper status and the displayed state. `loadPrototypeState()` is single-flight. It reads
  the helper and selects Free days when nothing is stored. Every Plan mount rereads and marks the
  helper `reading`, keeping the last state on screen with actions and chips disabled. A click
  during a status read would otherwise get the helper's 409. With the helper unreachable
  (`LocalTestHelperUnavailableError`), the local seed is shown display-only. `prototypeView` derives
  Plan's card, the banner and the header label once, from `billing-prototype-card.ts`. Tests that
  render the prototype or its chrome call `resetBillingPrototypeState()`.
- **Chips.** Choosing a different chip (or retrying a pending switch) reads fresh state, runs the guarded reset for the current generation (one
  idempotency key per generation, reused on retry), then selects the new state. It shows
  "Switching…" until the reset is read closed, and **Retry switch** while it stays pending.
- **Checkout actions.** Set up AutoPay, Pay ₹299 and Keep shop open share one sequence: helper
  preparation, hosted Checkout through `openSubscriptionCheckout`, callback submission and a helper
  reread. The preparation key is per generation and action, so a dismissal or failure reuses the
  same Razorpay object. A synchronous in-flight guard prevents duplicate opens, and unmounting
  aborts Checkout. The state changes only from a helper reread after verification and a provider
  read. While a fee or authorisation is pending, Plan shows a waiting notice and **Check again**.
  If the callback submission cannot reach the helper (`LocalTestHelperUnavailableError`), the payment
  may already be taken. Plan then shows a "result did not reach the local helper" notice and
  rereads. The helper's provider read recovers the outcome, and the helper is shown down only if
  that reread also fails.
- **Helper transitions.** The helper stores each verified transition in the record, keeping the
  same generation, and appends a history event. `payNowScenarios` offers `pay_first_fee` in Payment
  failed and Shop closed. A captured first fee moves the record to `paid`, through the provider
  invoice's period end. Trial AutoPay adds `autopay_on`/`autopay_off` events only. The sample Paid
  offers `cancel` as a local stop (`sampleStop`) with no provider call. On a real subscription,
  `cancel` requests a cycle-end stop, and Razorpay's acceptance moves Paid to Stopped. In Stopped,
  `closeStoppedAgreement` persists the intent, cancels the stopped subscription now and rereads it,
  and creates the replacement only after a read shows it closed. An authorised replacement moves
  Stopped to Paid with the same paid-through date. When a read shows Paid's current agreement closed
  without a stop from Plan (the card issuer, the Test Dashboard or the Razorpay API), the helper
  moves Paid to Stopped with the same paid-through date and an `autopay_ended` event. Plan's Stopped
  card then says AutoPay was cancelled outside MithraDirect and offers Keep shop open. When the
  helper itself cancelled after a halt before paid-through (only a Test-accelerated renewal gets
  there), the event carries `reason: 'halted'` and the card says Razorpay could not collect ₹299.
  A halt read at or after the boundary instead moves Paid or free days to Payment failed with a
  `payment_failed` event, and Pay ₹299 returns once the halted subscription reads closed. While the
  helper reports `collectionRetrying`, Plan's card reads only "Shop is open · AutoPay on." with no
  date, countdown or banner.
  A fee confirmed outside Pay ₹299 (a trial AutoPay fee that Razorpay collected, or a renewal along
  the paid cycle) appends one `paid` event, dated at the read. When free days still run after the
  first ₹299 was collected, for example through a Test Dashboard charge, the trial is unchanged. The
  card and banner say that fee is paid and name the next ₹299.
- **Chrome.** `BillingPrototypeChrome` renders `PrototypeShellBanner` (using `BillingStateBanner`)
  under the top bar and `PrototypeHeaderButton` in place of the plan pill, keeping the Setup link.
  Both only link to `/vendor/plan`. After a helper read error other than "unavailable", the chrome
  keeps the last displayed state; before any state is shown there is no banner, and the header
  falls back to "Shop plan". Plan shows the error.
- **Removed.** The demo store-state switcher, its fixtures (`STORE_STATES` and related),
  `demoService` and the account provider's `demo` slot. So were Plan's former local Test panel
  (`VendorBillingLocalTest`) and sample override (`VendorBillingMockOverride`), and the billing
  panel's `local_test` presentation branches. The provider derives
  store state from the loaded context in both modes. `deriveStoreState`, `AccessNotice` and
  `StoreStatusScreen` still serve live vendors.

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
paginated `/v1/vendors/{vendorId}/storefront/products` wrapper and maps the result. The product
detail page calls `storefrontService.getProduct`, which is one product object and its variants,
not that page envelope.

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
