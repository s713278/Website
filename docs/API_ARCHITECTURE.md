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
| `live-billing.service.ts` | `liveBillingService` | In development, the [local Razorpay Test backend](#local-razorpay-test-backend-development-demo); a production demo build routes Plan to the billing panel instead | The package's `vendorBillingService`; see [Live API billing](#vendor-platform-billing-live-api) |
| `vendor-onboarding.service.ts` | Public catalog reads plus vendor setup account reads and writes | Wire-shaped vendor-context fixture mounts the console; setup references still come only from the explicitly selected sample catalog | Package `catalogService`, `vendorsService`, and `platformService`; strict mappers normalize references, account resources, checkout options, and measurements |

In Live API mode, the onboarding service reads the platform catalog and uses vendor-scoped account
reads and writes. In Demo mode, `getVendorContext` returns a wire-shaped completed-account fixture
through `mapVendorContext`, which lets the vendor console mount without a backend request. The setup
wizard still never mounts the other account-catalog readers: it waits for the vendor to explicitly
select the reserved-negative-ID sample catalog, then answers from module-local sample data. It never
silently converts a live failure into sample data. A persisted sample draft carried into Live API
mode is blocked at Continue because its synthetic IDs cannot reach an account.

#### Vendor setup account hydration

The setup wizard reads the vendor's account per step. On every entry (Live API, ready session) it
reads the vendor context and the vendor profile; every other account resource is read only when the
vendor first opens a step that needs it (`stepResources` in `onboarding-resume.ts`;
`loadStepResources` in `onboarding-server-state.ts` starts or joins those reads). A context the
session already holds or is reading costs no second request. While the context is read the wizard
shows "Restoring your setup…".

| Step | Account reads | Units |
|---|---|---|
| Business type (3), store details (9) | Profile, business types | No |
| Categories (4) | Step 3's plus vendor categories | No |
| Products (5) | Step 4's plus vendor products | Yes |
| Sizes (6) | Step 5's plus vendor sizes | Yes |
| Delivery, payments (7, 8) | Checkout options (one read for both) | No |
| Review (10), store submitted | Profile | No |
| Review (10), not submitted | All six | Yes |

The business-type catalog (one 100-item page) is read only once the profile shows a saved business
type, because it exists to map that saved name back to the reference Step 3 stores; a vendor who has
not chosen one, like every new vendor on Step 3, skips it, and Step 3 lists its own page. A
successful read also files Step 3's unsearched first page in the catalog reference cache (never over
an existing entry), so the step's first visit makes no request; later pages still load on scroll. A
first-time vendor's checkout 404 arrives as `null`, meaning no settings yet, not a failure.

Each result is applied to the draft as it lands, through one pure applier per resource, whatever
step is on screen. A step with unsaved edits keeps them unless the store is submitted, and nothing is
applied without a context. Which resources loaded is wizard memory, reset on every entry and vendor
change; a save does not reset it. A step shows a form-shaped skeleton until its reads have loaded,
and "Something went wrong" with **Try again** when one failed; Try again re-reads only that step's
failed resources. Continue is disabled in both states, while Back and the stepper stay usable, so a
failed earlier step never traps the vendor. A failed read is never turned into empty data, because
Step 6's save deletes account sizes missing from the draft and Steps 7-8 save checkout as a whole.
A submitted store's Step 10 is the exception: it shows its status once the profile settles and never
blocks; a failed profile leaves the store name to its fallback. Requests time out at 15 s and then
fail.

The phone preview (storefront mockup and its Categories / Products / Sizes counts) is shown on every
step. Its categories, products and sizes each come from the context's `catalog_preview` while their
step (4, 5, 6) has been neither read this visit nor edited, and from the draft otherwise; the summary
is never applied to the draft. The deployed context does not carry `catalog_preview` yet
([gap](./API_GAPS.md#still-open)), so a step that has not read the catalog, such as a submitted
Step 10, shows an empty catalog and 0 / 0 / 0.

A failed context read blocks every step from 3 on: the step shows the context error above "Something
went wrong" and Try again, which re-reads the context and then the step's resources. If the context
has no usable `onboarding.next_step` for a store that is not submitted, the wizard opens on Step 10,
which reads everything, and moves to the resource-derived step once every read has succeeded. If one
fails, Step 10 shows the error until Try again succeeds. Demo mode reads nothing and never blocks a
step; a sample-catalog draft makes no account reads.

Measurements mean one authenticated `GET /v1/measurements/` followed by one authenticated
`GET /v1/measurements/{id}` per list row. Detail calls fan out together and enrich the list because
the deployed list omits `unit_options`; an individual failed detail retains its usable list row.
The measurement catalog is platform reference data, so `measurement-catalog-cache` keeps one
successful read per session: a later visit reuses it without a request, and only sign-out drops it.
Steps 5, 6 and an unsubmitted Step 10 read it when they open, and their skeleton waits for it.
Continue starts only the next step's missing account reads alongside its save, never the units. A
failed read does not block: sizes fall back to the sample units and products carry no measurement
metadata, and it is not retried within the visit.

The per-resource cache (`onboarding-resource-cache`, one entry per vendor for profile, business
types, categories, products, sizes and checkout options) is what the wizard and sign-in share. Each
entry is single-flight, a failed read is evicted so the next load retries it, and a late response
for an invalidated entry reaches its caller but is not stored; the wizard additionally applies a
result only while the same visit and vendor are current.

A successful step save drops only the resource it wrote (Step 3 or 9 the profile, Step 4
categories, Step 5 products, Step 6 sizes, Step 7 or 8 the checkout settings), submission drops
every account resource except business types, and sign-out drops every resource for every vendor
plus the units; business types and units otherwise stay cached until sign-out. Each of these also
drops the dashboard's context cache, so a later visit re-reads only what changed and returning from
setup cannot reuse pre-write store state, storefront details, or plan usage. The open wizard keeps
what it already applied: after a save its draft is the account copy. Both caches ignore a late
response belonging to an entry that has already been invalidated. Submission's read-back of the
context after go-live goes through the dashboard's context cache, so opening the dashboard next
reuses it rather than reading the context again.

The marketing header decides its vendor actions from the context alone. On every route, `/onboarding`
included, it calls `loadVendorAccountContext`: one `GET /v1/vendors/{id}/context`, filed in the
context cache so the dashboard opens on it, or no request when that cache already holds a resolved
context. On `/onboarding` the wizard reads its context through the same cache, so the two share one
context request.

Post-sign-in routing (`resolveLandingPath`) first decides from the chosen vendor's `verify-otp`
`vendors[]` status and onboarding when they suffice (see
[SESSION.md](./SESSION.md#where-a-session-lands)); it then awaits no request, and starts
`loadVendorAccountContext` plus the shell's `readLiveBilling` for `/vendor`, or
`prefetchOnboardingLanding` for `/onboarding`, none awaited. Otherwise it decides from the context
the same way, through `loadVendorAccountContext` or a resolved context in the context cache. A
submitted store therefore lands on `/vendor` after at most one request, instead of waiting on reads
the dashboard never uses. For `/onboarding`, `prefetchOnboardingLanding` starts the context (or reuses
the one just read), the profile, and the landing step's account reads from the table above, without
the units and not awaited, so they overlap navigation and the wizard's route chunk and the wizard
joins them. The landing step is the `verify-otp` `next_step`, or else the context's, clamped to 3–10
exactly as the wizard clamps it; with no usable pointer only the context and profile start. Local
edits that keep the wizard on another step can leave that set unused. A failed prefetch is evicted as
usual and the wizard retries it.

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
makes a later step save again. A resume vouches only for the steps before the one it opens on, and
only for a step that took the account copy along with every catalog step before it. A failed save,
local edits on that step or an earlier catalog step that outrank the account on entry, or a change
of vendor leave the step unvouched, so it saves as before.

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
| Wording | `src/modules/vendor/lib/live-billing-wording.ts` | Pure: each view's card, note, Confirming line, Stop the plan confirmation, Checkout purpose (waiting, failed and refused lines), banner, header label and rail badge. Every ₹ amount comes from the plan price. `isSettledView` defines a settled read |
| Shared read store | `src/modules/vendor/store/live-billing.ts` | `useLiveBilling`, `useStartedLiveBilling`, `readLiveBilling`, `cancelLiveBilling`, `holdLiveBilling` and `resetLiveBilling`: the read, its refresh and retries, the cancel response and the confirmation hold |
| Retry timing | `src/modules/vendor/lib/live-billing-retry.ts` | `retryDelays` (5, 15 and 30 s), `isBriefOutage` (502, 503 or network) and `pause`, shared by the read and `confirm` |
| Live Plan | `src/modules/vendor/components/LiveVendorPlan.tsx`, `LivePaymentsYouMade.tsx` | The card, its actions, the Checkout sequence, the poll and "Payments you made" |
| Live chrome | `src/modules/vendor/components/LiveBillingChrome.tsx`; `VendorShell.tsx`'s `LivePlanChip`; `VendorSettingsPage.tsx`'s `LivePlanName` | Banner and header button from the wording, both linking to Plan; the rail chip shows the wording's badge and Settings the plan name from the shared read |
| Checkout | `src/shared/payments/razorpay-checkout.ts` (`openSubscriptionCheckout`) | Reused unchanged: the key ID and subscription ID come from subscribe's response |

`VendorPlanPage` routes by mode: the Live API, and demo mode in development, get `LiveVendorPlan`
(development demo reads the [local Razorpay Test backend](#local-razorpay-test-backend-development-demo));
a production demo build gets the billing panel. Pages and components import billing only from `@/shared/api`. Tests spy on
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
- **The vendor context** supplies features and limits only. In the Live API, Settings' Plan row
  takes the plan name from the shared read (`mapLivePlanName` through `useStartedLiveBilling`) and
  the rail chip shows the wording's badge for the shared view: days left (red from 3), "Social
  Starter" while paid, "Open until" the last paid day once stopped or AutoPay is off, or "Shop
  closed", and none before go-live. Demo mode names its context's plan in both.
  Billing reads nothing from the context.
- **Mapping.** The backend's statuses and dates decide the view; the browser clock only compares
  them with now. The first matching rule wins. Absent fields read as null, except that an `ACTIVE` paid
  period without a boolean `cancel_at_period_end` takes the read error path. Unknown fields are ignored, and timestamps need a timezone but not seconds. Days left are counted from
  `trial_ends_at` or the paid-through date, rounded up; the backend's `days_remaining` and display
  labels are ignored. Before go-live (404) Plan shows only a note.

**Views.** `LiveBillingView` has Free days, 3 days left, Free days Confirming, Collecting, Paid,
Stopped, AutoPay off, Payment failed, Shop closed, Confirming and not live. Shop closed and
Confirming say whether free days or paid days ended. Free days and 3 days left carry `trialDays`,
the free days' length in whole days from `trial_started_at` to `trial_ends_at` (`null` without a
readable start, when the Free days card shows the exact end instead). Paid carries `trialEndsAt`
while its free days last after an early first fee (otherwise `null`); with it, or with
`next_billing_at`, the wording adds that next month is another ₹299. The Confirming views are Free days Confirming,
Confirming, and Stopped or AutoPay off marked `confirming`; they offer no payment action, and Plan
shows their status line with **Check again**.

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
  only when none is loaded, so client navigation sends nothing. A sign-in routed to `/vendor` from
  the `verify-otp` snapshot starts that same read early, and the chrome joins it.
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
  read store: "Confirming your payment…", with Checkout's `razorpay_payment_id`.
- **Confirming variants.** While a payment is confirming (the hold lasts, or a read reports the
  latest payment `authorized`), the shared read publishes the view's Confirming variant
  (`confirmingLiveBilling`), so Plan, the banner and the header offer no payment and no "If you do
  not pay". Free days and 3 days left show as Free days Confirming (row 7); Shop closed as Confirming
  with the same ended days (rows 8 and 8b), and Payment failed as Confirming after paid days;
  Stopped and AutoPay off keep their eyebrow and days without the Pay sentence, with "your ₹299
  payment is being confirmed." in the banner and "Shop plan" in the header. Settled views never
  change. Ending the hold, below, is decided on the view as read. `authorized` needs no hold, so it
  survives a reload; without the fields only the hold shows the variant.
- The hold lives in memory, per vendor and session, and is never persisted. It ends on a settled
  read, a read reporting the hold's payment failed, a reload, sign-out or a vendor change. It
  survives leaving Plan; back on Plan, the waiting line shows with **Check again**.
- A **settled read** is one that is neither a Confirming view nor offering a Checkout action
  (`isSettledView`). A changed view that still offers a payment, such as Free days turning into
  3 days left, does not end the hold.
- Plan polls every 5 s for up to 90 s while the hold lasts, including through Confirming views.
  Leaving Plan stops the poll, and it does not restart on return. After 90 s the Confirming status
  line stays with **Check again**.
- The chrome shows the same Confirming variant as Plan.
- **A failed payment** is known only from the requested `latest_payment_id` and
  `latest_payment_status` ([payment outcome gap](./API_GAPS.md#billing-read-gaps)), which
  `mapLiveLatestPayment` reads when present. When any read during the hold (poll, Check again, focus
  or another reread) names the hold's payment `failed`, the store ends the hold without telling other
  tabs, and Plan offers the action again with "Payment failed. Try again." under it. The store keeps
  that in memory until the next Checkout starts or the session or vendor changes; without the
  fields the hold behaves as above.

**Payments you made.** `LivePaymentsYouMade` reads the history when the shared read lands from a
subscription response whose content changed since the last good history read (a cancel response
included), after each successful `confirm`, and on its own Try again; otherwise it shows the kept
rows at once, so reopening Plan on an unchanged subscription sends no history request
(`TEMP(vendor-billing-reads)`). A newer reason drops the history read in flight. Its failure, or an unreadable shown
event, stays in its section with Try again, beside any last rows. `mapLiveBillingHistory` lists
events newest first and shows each once per type and payment ID, or per type and subscription ID
without a payment, because the development backend records some twice
([gap G](./API_GAPS.md#billing-gaps-ak)). The titles are "Payment received",
"Plan stopped" (a cancellation requested while `ACTIVE`) or "AutoPay turned off" (one requested while
not `ACTIVE`, such as a legacy AutoPay-only subscription on dev), "AutoPay ended" (skipped after a Plan stop on that subscription), and
"Free days started" from the shared read's `trialStartedAt`. Other events, such as `SUBSCRIPTION_AUTHENTICATED`, are ignored. An amount
shows, in rupees, only when an event carries one; the app never infers it.

**Chrome.** `LiveShellBanner` shows the view's billing banner on every vendor page, Plan included.
Below it, `LivePlanBanner` shows "Share your shop link to get your first WhatsApp orders." to an open store only
while the vendor is on unpaid free days: before T, from the shared read's `trialEndsAt` (the
subscription's `trial_ends_at`, kept after subscribe), and while the view is Free days or 3 days
left. It is hidden while a payment confirms and once paid early, and goes at T's reread. Demo's `PlanBanner` (an open store on
the `FREE` plan) is not used, since the Live API has no free plan. `LiveHeaderButton` replaces the
plan pill with the view's header label. Both billing elements only link to Plan.

**Session-bound.** The read belongs to one vendor and one session. A change of the auth store's
user (sign-in, sign-out or a vendor switch) resets it, drops any response still on its way, and
ends the hold, so the next vendor on that browser never sees another vendor's billing.

**Demo in development uses the Live Plan.** Since 7 October 2026, demo mode in development shows
`LiveVendorPlan` and the Live billing chrome, read from the
[local Razorpay Test backend](#local-razorpay-test-backend-development-demo) instead of the Spring
API. The Live API never calls it. A production demo build keeps the simulated billing panel, and the
development preview is unchanged.

#### Vendor platform billing preview

This section describes the production demo build's billing panel and the development preview only;
the [Live API](#vendor-platform-billing-live-api) does not use them.

| Concern | Owner | Boundary |
|---|---|---|
| Official script, subscription Checkout inputs, browser callback/failure/dismissal, teardown | `src/shared/payments/razorpay-checkout.ts` | No trial, pricing, eligibility, signature secret or access rules |
| App-facing status/configuration/verification submission contract | `src/shared/api/services/vendor-billing.service.ts` | Proposed four-operation interface and separate trial, authorisation, fee, cancellation and refund facts; not a generated HTTP contract |
| Proposed wire mapper and fixture service | `src/shared/api/mappers/vendor-billing.ts`, `src/shared/api/services/vendor-billing-fixture.service.ts` | Existing context mapper feeds every supplied scenario; mock acknowledgements and explicit reconciliation stay in memory. Demo and preview only |
| Shared context selection and refresh | `src/shared/api/services/vendor-billing-context.service.ts`, `src/modules/vendor/components/VendorAccountProvider.tsx`, `src/modules/vendor/lib/vendor-context-cache.ts` | Demo mode only: the production demo build's billing panel. Billing reads and simulated writes refresh one vendor-scoped context |
| Explicit development implementation | `src/shared/api/services/vendor-billing-preview.service.ts` | Test keys and inspected subscription schedule; real callbacks only become pending |
| Billing and trial presentation | `src/modules/vendor/components/VendorBillingPanel.tsx` | Renders service-provided access, trial, authorisation and payment independently |
| Development route and scenario controls | `src/modules/vendor/pages/VendorBillingPreviewPage.tsx` | DEV-only lazy route `/dev/vendor-billing`, outside auth and vendor-context gates |
| Plan page | `src/modules/vendor/pages/VendorPlanPage.tsx` | In a production demo build, the billing panel from the selected auth vendor, without usage against limits. In development demo mode, and with the Live API, the [Live Plan](#vendor-platform-billing-live-api) |
| Live billing banner | `src/modules/vendor/components/BillingStateBanner.tsx` | The billing banner the Live chrome renders |

The preview service is explicitly constructed rather than selected through `isLiveApi()`: an
environment-enabled Spring API cannot accidentally make these examples touch real vendor accounts.
Neither scenario controls nor browser callbacks change auth, cart, onboarding or production routes.
The parent remounts the billing panel when its service changes and passes the fixture `vendorId`.
The plan page keys its panel on the selected auth `vendorId`, never the public store slug.
Plan's former development controls, the sample-status override and the local Test Mode switch,
were replaced by the six-state prototype on 24 September 2026, which was itself removed on
7 October 2026 for the [local Razorpay Test backend](#local-razorpay-test-backend-development-demo).

##### Local Razorpay Test backend (development demo)

Added 7 October 2026, replacing the six-state prototype and its helper protocol. In development
demo mode (`import.meta.env.DEV` set, `isLiveApi()` false), `usesLiveBilling()` is true, so Plan, the
rail chip, Settings and the console banner and header use the Live billing path unchanged.
`liveBillingService` then sends its six operations to `localBillingBackend`
(`local-billing-backend.service.ts`), which fetches `/__local_vendor_billing_test/api/v1/…`; Vite
proxies that to the helper on `127.0.0.1:4179`. Failures become `ApiError`s, so a `404` still reads
as "not live yet".

`scripts/vendor-billing-test-helper.mjs` serves the backend's billing routes in its envelope and
wire shape, backed by real Razorpay Test calls with the key, secret and plan in the git-ignored
`.env.billing-helper.local`. It follows the corrected reads of the
[backend brief](./VENDOR_BILLING_BACKEND_BRIEF.md#4-required-behavior-by-flow), not dev's gaps:

- **Free days:** subscribe creates a subscription with the plan price as an upfront `addons` item
  and `start_at` = T + one month. The read stays `TRIAL_ACTIVE` until the addon payment is
  captured, then `ACTIVE` with the period T → P. A free-days subscription still `created` at T is
  cancelled.
- **Stop the plan:** an immediate Razorpay cancel; `ACTIVE`, `cancel_at_period_end: true`, P kept,
  `next_billing_at: null`.
- **Keep shop open:** the old subscription is read closed, then a new addon subscription starts at
  old P + one month; the stopped read stays until its payment is captured.
- **After T, paid days or a halt:** an immediate-start subscription (`PAYMENT_PENDING` until
  captured), never reusing a free-days one.
- **Renewals:** only an invoice starting exactly at P extends P. Razorpay `pending` past P reads
  `PAST_DUE`; `halted` reads `HALTED`, and the helper cancels the subscription. A cancel from
  outside reads `CANCELLED` with P kept.
- **Confirm** checks the HMAC over `payment_id|subscription_id` (`401` on mismatch) and writes one
  `PAYMENT_AUTHORIZED` per payment. History carries `SUBSCRIPTION_CHARGED` with `amount` in rupees.

`BillingTestScenarios`, under Plan in development demo only, seeds the vendor through
`POST /dev/vendors/{id}/scenario`: Free days, 3 days left, free days ending in 5 minutes, free days
over, Paid, Stopped, AutoPay off, paid days over, renewal retrying and payment failed. A seed first
reads every Razorpay subscription the helper made for that vendor closed. Seeded paid days have no
Razorpay payment behind them; paying, stopping and keeping the shop open from a seeded state run
real Test Checkout unless a simulated outcome is chosen. The store defaults to the ignored
`vendor-billing-backend-store.local`.

Under Plan, "Payment outcome" chips (Real Test Checkout, Stay pending, Succeed in N s, Fail in N s)
cover what Test Checkout cannot produce; N is `BILLING_HELPER_SIMULATED_DELAY_MS` (default 5000).
`GET/POST /dev/vendors/{id}/simulation` reads and sets the choice, which is kept on the vendor record
across seeds. While one is chosen, subscribe creates a `sub_Sim…` subscription that never reaches
Razorpay, and a development-only stand-in for `window.Razorpay` pays it through
`POST …/simulation/pay`. That returns a callback signed like Checkout's, so the real success handler,
confirm, reconcile, mapper and poll path run. `POST …/simulation/deliver` settles a pending payment
now ("Deliver now"). The helper scripts Razorpay's objects from the stored payments and the current
time, with no timers: an upfront addon (free days, Keep shop open) pending is `authenticated`, invoice
`issued`, payment `authorized`; success makes the invoice `paid` and the payment `captured`, the
subscription staying `authenticated`; an immediate start stays `created` until capture, then turns
`active` with the period from the payment time. A failed payment leaves the subscription unchanged,
to be retried on it; after a failed free-days fee the read reports `razorpay_status: created`, so it
is plain free days. Every read also carries the requested `latest_payment_id` and
`latest_payment_status` for the latest simulated payment on the vendor's current subscription
(`authorized` while pending, then `captured` or `failed`); seeded states and real Test Checkout
subscriptions report both `null`. This exists only in development demo mode; in Live API mode the backend's billing
APIs serve every read and write and neither the helper nor the stand-in is involved.

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
