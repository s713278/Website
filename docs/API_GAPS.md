# Backend API gaps (frontend tracking)

Endpoints the frontend wants that the backend doesn't have yet, plus the interim workarounds.

Tracked against [Swagger](https://subscriptionapp-wgf8.onrender.com/api/swagger-ui/index.html).
Claims below were checked against `packages/api-client/openapi.json` (117 paths) and the `src/`
tree. See [API_ARCHITECTURE.md](./API_ARCHITECTURE.md) for how the API layer is put together.

> **Scope note.** Some workarounds here belong to the frozen `design-reference/` static prototype,
> not the React app. Those are marked **(static only)** — don't go looking for them in `src/`.

## Shipped (in the spec, use these)

| Endpoint | Use |
|----------|-----|
| `GET /v1/vendors/{identifier}/storefront` | Full public storefront payload by numeric vendor ID or `store_identifier` (theme, hero badges, fulfillment, categories, products, WhatsApp numbers, share link) |
| `POST /v1/vendors/{vendor_id}/delivery-eligibility` | Pincode / lat-lng deliverability check |
| `GET /v1/vendors/{vendor_id}/products/skus` | SKU list backing the storefront product grid |
| `onboarding.next_step` on `POST /v1/auth/verify-otp` and `GET /v1/vendors/{id}/context` | **The** resume position for an unfinished vendor. 1-based over the ten wizard steps; `11` means setup is complete. Both endpoints return identical values — verify-otp carries it per vendor under `vendors[].onboarding`, alongside `status` and a human `description` ("Step 8: Payments"). |

Wrapped in `@mithra/api-client` as `storefrontService.get` / `checkDeliveryEligibility`, plus the
flat `getVendorStorefront`, `loadVendorStorefront`, `getVendorProductSkus` in `services/legacy.ts`.

> **The richer storefront payload is not called from `src/` yet.** The package wrappers are aligned,
> but the customer storefront still renders from the older catalog service (`/v1/vendors/…`). The
> onboarding prototype's own preview renders its private same-browser draft; it does not pretend to be this
> public backend response.

## Still open

| Gap | Needed for | Interim workaround |
|-----|------------|--------------------|
| `GET /v1/vendors/{id}/storefront/products` | Paginated public product grid (`page_number`, `page_size`, `result[]`, `last_page`).Call the live path from `storefrontService.listProducts` + `mapStorefrontProductPage`. Chip labels may append price until names exist.
Frontend maps name→numeric id from products when possible; otherwise filters client-side by category name.
| Per-order WhatsApp message | Server-owned WhatsApp order text | Build the string client-side. (A bare `/v1/whatsapp` GET/POST exists but is not a per-order message endpoint.) |
| Rich product attributes on the storefront payload | Ingredients / nutrition / rating on the PDP | None. `ProductDTO` is `id`, `name`, `description`, `measurement_unit_id`, `image_path` — the spec itself calls it "lightweight". Pull detail from the SKU endpoints or fixtures. |
| Guest cart → merge on customer OTP | Browse anonymously, then sign in without losing the cart | Cart is local-only (`md-cart` via `useCartStore`) and never syncs, so there is nothing to merge yet |
| Coupon codes | Cart promo CTA | **(static only)** — `MITHRA50` / `HOME50` are hardcoded in `design-reference/assets/js/storefront.js`. The React app has no coupon UI. |
| Canonical payment-detail keys | A customer-facing consumer for bank details | **No bank/payout endpoint exists anywhere in the contract** — no path, schema or property matching bank/ifsc/payout. `details` is a free-form JsonNode that round-trips whatever it is given (verified). The wizard writes `{account_holder_name, account_number, ifsc_code, bank_name}` under `ONLINE`, matching the documented `upi_account` style. Backend must confirm these keys and that a consumer renders them. |
| Public store reachability | Sharing a store after go-live | `store_identifier` **is** generated at go-live (`slug-vendorId`) and `/stores/{identifier}` resolves it, but the public storefront returns `404` until an admin sets `approval_status: APPROVED`. Share controls therefore unlock only on approval. `share_link` is still a relative API deep link, not a web URL. |
| Stable go-live validation contract | Link backend readiness failures to the responsible wizard step | Go-live succeeds with a plain string (`"Vendor is now active and pending admin approval"`); the failure shape is undocumented and untested. Errors fall back to `getErrorMessage`. |
| QR sharing | The ticket's offline-friendly QR requirement | No QR dependency in the project. The control is rendered disabled pending a decision on adding one. |
| Readable storefront before approval | Restoring Step 9 branding when a vendor resumes | `GET /{identifier}/storefront` is the only read carrying theme, tagline, badges and welcome message, and it `404`s until `approval_status: APPROVED` — exactly the vendor who needs it cannot use it. Resume repopulates name and contacts from the vendor record and leaves branding at defaults. |
| Per-SKU fulfillment flags | Restoring Step 6 exactly | Neither the SKU list nor `GET /skus/{sku_id}` exposes `home_delivery` / `store_pickup`, though both are writable. A resumed SKU defaults both to true. |
| Vendor-triggered approval | Testing the approved-vendor path end to end | `PATCH /approval` returns `500` for a vendor token, so an approved store cannot be produced without an admin account. The frontend's approved branch is verified against a forced status only. |
| Onboarding-aware dashboard | Landing an approved vendor somewhere real | `/vendor` renders `VendorDashboardPage`, still backed by the mock `vendorService` with a hardcoded `'r1'` fallback id, showing invented order counts and revenue. An approved vendor is redirected there today; replacing it with real data is a separate task. |
| Removing an assigned product | Deselecting a product at Step 5 | `PATCH /v1/vendors/{vendor_id}/delete/products` returns **403 for a vendor** (Admin/Customer_Care only), so assignment is additive. The wizard refuses the deselection and says removal needs support, rather than silently doing nothing. |
| Removing an assigned category | Deselecting a category at Step 4 | **No endpoint exists at all** — verified by exhaustive enumeration, not by guessing routes. `PATCH /categories` appends and `417`s on an already-assigned id. Same treatment as products: the wizard refuses the deselection. |
| Updating a SKU in place | Changing a price, size or name at Step 6 | `PATCH /vendors/{id}/skus/{sku_id}` returns **`417`** with a JDBC error on `update tb_sku` for every body tried, and `SkuInfoUpdateRequest` carries only `name`, `description`, `features`, `is_active` — never price or size. Step 6 expresses an edit as delete-then-create, which mints a new `sku_id`. |
| Unimplemented shipping strategies | Flat / tiered / weight-based delivery pricing | `FLAT`, `ZIPCODE_TIERED` and `WEIGHT_BASED` are in the enum (and `FLAT` even has a documented example) but return `No validator registered for shipping strategy type`. Only `ORDER_AMOUNT_THRESHOLD` and `ZIPCODE_THRESHOLD` work. A flat charge is expressed as `ORDER_AMOUNT_THRESHOLD` with a zero threshold. |
| Unvalidated `scheduling_config` | Trusting the delivery schedule a vendor configures | The backend stores `scheduling_config` **verbatim without validation** — even `{}` is accepted. `FIXED_WINDOW` and `CUSTOMER_SELECT_DATE` keys come from documented examples; `PREDEFINED_DAYS` and `INSTANT` keys are our own snake_case and no consumer contract confirms them. |

### Backend request: let a vendor edit their own catalog during setup

The single largest unresolved gap in onboarding. A vendor who picks the wrong category or
product at Step 4/5 and notices at Step 7 cannot undo it — there is no call the frontend
can make. Searched exhaustively (all 117 paths, every `DELETE`, every summary and
description mentioning removal), and every candidate is either admin-gated or absent:

| Candidate | Result |
|-----------|--------|
| `PATCH /v1/vendors/{id}/delete/products` (bare `int64[]`) | 403 — Admin/Customer_Care |
| `DELETE /v1/admin/vendors/{vendorId}/catalog` | 403 — admin prefix |
| `PATCH /v1/vendors/{id}/products/{product_id}` | No `is_active`/status field to deactivate with |
| `PATCH /v1/vendors/{id}/categories` with a subset | Appends; cannot express removal |
| Any category-removal route | Does not exist |

**Minimum needed:** grant `VENDOR` the existing `PATCH /v1/vendors/{id}/delete/products`
for their *own* `vendor_id`, and add the category equivalent
(`PATCH /v1/vendors/{id}/delete/categories`, body `{category_ids: int64[]}` to match the
assign call). Both are naturally scoped by the path's `vendor_id`, so the authorization
change is "own record" rather than a new role.

**Nice to have:** an `is_active` flag on `UpdateVendorProductRequest`, which would let a
vendor retire a product without deleting history.

Until then, Steps 4 and 5 refuse the deselection and say so. That is deliberate: silently
allowing it was worse — Continue made no request, the draft was marked as matching the
account, and the next resume handed the discarded selection straight back.

### Onboarding continuity a vendor still loses

Symptom-first, because these are what a vendor actually reports. Each is caused by a gap
above and is **not** a frontend defect — the frontend cannot fix any of them alone.

| What the vendor sees | Cause | What the backend must provide |
|----------------------|-------|-------------------------------|
| "I re-enter my business location every time I come back." | `business_location` lives only on the storefront payload, which `404`s until approval. It is not on the vendor record (verified: the profile returns `business_name`, `business_type`, `owner_name`, `contact_person`, `contact_number` and nothing else). | Either a vendor-readable storefront before approval, or `business_location` on `GET /v1/vendors/{id}`. |
| "My theme, tagline, welcome message and badges reset to defaults on every resume." | Same 404. `GET /{identifier}/storefront` is the only read carrying them, by `store_identifier` **and** by `vendor_id` — both verified `404` on a live `PENDING` vendor. | A read a vendor may call on their own unapproved store. |
| "A SKU I set to pickup-only comes back as delivery + pickup." | The SKU read omits `home_delivery` and `store_pickup` entirely (verified: the row returns `vendor_product_id, sku_id, sku_name, image_path, sku_size, sku_type, is_active, valid_days, price_id, list_price, sale_price, effective_date, eligible_subscription_details, discount, on_sale, description`). Both are writable but unreadable, so resume defaults them to `true`. | Return the two flags on the SKU read. |
| "I can't remove a category or product I picked by mistake." | 403 / no endpoint, above. | A vendor-callable un-assign for both. |
| "A product I don't want to sell blocks go-live." | Follows from the above: the product cannot be un-assigned, and Step 6 requires every assigned product to carry at least one *active* valid SKU. So a mistakenly assigned product must be priced and sold. | Same un-assign. Until then the only escape is support. |

Not yet exercised: Step 6 expresses a SKU edit as delete-then-create, so the `sku_id`
changes. Nothing in onboarding references a SKU by id afterwards, but a SKU carrying
subscription plans (`/skus/{sku_id}/subscription-plans`) may lose them. Worth confirming
before SKU editing is offered outside onboarding.

### Deployed catalog sorting behavior

The deployed business-types operation fails when `sortBy=display_order` (the response envelope
reports status 500; the current HTTP status is 417). The onboarding reference hook therefore
requests `sortBy=id&sortOrder=ASC`, which returns HTTP 200. Do not restore `display_order` sorting
unless the backend behavior is fixed and verified.

### Resolved contract alignment: public storefront identifiers

The regenerated contract provides `GET /v1/vendors/{identifier}/storefront`; its identifier accepts
either a numeric ID or a store slug. `storefrontService.get(identifier)` and the legacy
`getPublicStoreBySlug(slug)` now both use that operation. The removed
`GET /v1/public/stores/{slug}` workaround must not be reintroduced.

## Backend defects (verified against the deployed dev API)

Found by running the full onboarding chain against a live test vendor. Each is a backend fix, and
the frontend works around it with an inline comment at the call site.

- **`assign/products` is documented against the wrong ID.** Its description says `category_id` is the
  vendor category ID from `/{vendor_id}/categories`. Passing that returns
  `400 Invalid vendor category id`. It requires the **platform** category ID. Either the docs or the
  implementation is wrong; they disagree.
- **`POST /skus` crashes instead of validating.** Omitting `eligible_sub_plans` returns
  `HV000028: Unexpected exception during isValid call` (envelope `500`, HTTP 417). An empty array
  correctly returns `400 SKU must have at least one eligible subscription plan`, so the validator
  simply cannot handle the field being absent. The schema marks only `product_id` as required.
- **Three shipping strategies are unimplemented** — see the table above.
- **`POST /v1/auth/refresh` returns the token as a bare string.** The body is
  `{ success, status, data: "<jwt>" }` — `data` is the access token itself, not an object with an
  `access_token` field, and no new refresh token is issued. The operation is typed as a generic
  `APIResponseObject` with no example, so nothing in the contract reveals this; a client written from
  the document alone parses `null` and signs the user out on every refresh. Verified against the
  deployed API, including that the returned token authenticates (`GET /v1/auth/profile` → 200).
- **Access tokens live 600 seconds.** Any form that takes longer than ten minutes — onboarding
  certainly does — depends on refresh working correctly, so treat the refresh path as a main path.
- **`GET /checkout_options` returns far more than it documents.** All five OpenAPI examples show
  only delivery and pickup, but the deployed response also carries `payment_options` (with the full
  UPI/bank `details`), `order_acceptance_policy`, `delivery_slots`, `customer_consent_title` and
  `customer_consent_text`. Anyone reading the document would conclude payments cannot be read back
  and rebuild them from scratch; they round-trip fine. Verified on a configured vendor.
- **`GET /v1/vendors/{id}` is the only read for `business_type`**, plus `owner_name`,
  `contact_person` and `contact_number` — while typed as a bare `APIResponseObject` with no example.
  A never-configured vendor reports `business_type: "Others"`, which is indistinguishable from a
  vendor who genuinely chose Others; the frontend treats it as unset and re-asks.
- **A vendor can only remove SKUs. Categories and products are additive for this role,
  permanently.** Verified live against the dev API with a `VENDOR` token:

  | Operation | Endpoint | Result |
  |-----------|----------|--------|
  | Delete a SKU | `DELETE /v1/vendors/{id}/skus/{sku_id}` | **200** — works |
  | Update a SKU | `PATCH /v1/vendors/{id}/skus/{sku_id}` | **417**, JDBC error on `update tb_sku`. Broken regardless of body; and `SkuInfoUpdateRequest` covers only `name`, `description`, `features`, `is_active` — never price or size |
  | Un-assign a product | `PATCH /v1/vendors/{id}/delete/products` | **403 Authorization failed.** Body is a bare `int64[]`, not an object; the description says Admin/Customer_Care only, and that is enforced |
  | Un-assign a category | — | **No endpoint exists.** Confirmed by enumerating all 117 paths: every `DELETE` in the contract, plus every path/summary/description mentioning remove, delete, unassign, deactivate or disable |
  | Reset the whole catalog | `DELETE /v1/admin/vendors/{vendorId}/catalog` | **403.** Would do exactly what is needed — "Removes SKUs, prices, subscription plans, product assignments, and category assignments; the vendor profile itself is NOT deleted" — but is admin-only |
  | Deactivate a vendor product | `PATCH /v1/vendors/{id}/products/{product_id}` | Not possible. `UpdateVendorProductRequest` is `{product_id, description, features}` — no `is_active` or status field |
  | Replace the category set | `PATCH /v1/vendors/{id}/categories` | Not possible. `AssignCategoriesRequest` is `{category_ids: int64[]}` with no mode or replace flag, and the handler appends |
  | Re-assign a category subset | `PATCH /v1/vendors/{id}/categories` | **417** "The following categories are already assigned" — additive only, so it cannot express a removal |

  Consequences the frontend has to live with, until the backend grants a vendor
  un-assign or an admin flow exists:
  - Step 6 reconciles SKUs against the account — create, and delete what the vendor
    removed. A price or size change is delete-then-create, because update is unavailable.
  - Steps 4 and 5 refuse to deselect anything already saved to the account and say why.
    Silently allowing it produced the worst outcome: Continue was a no-op, the draft was
    marked clean, and the next resume handed the selection straight back.
  - Resume position comes from `onboarding.next_step`, not from the resources. A leftover
    unpriced product is permanent, and deriving the step from gaps reopened Step 6 for it
    forever, discarding the delivery, payment and storefront work already saved.
- **`GET /v1/home` returns `500`** for a plain `zip_code` query.
- **`GET /v1/vendors/{id}` (list) requires auth** while `/products` and `/products/skus` are public,
  which is an inconsistent boundary for the same vendor's data.

## Corrections to earlier versions of this file

Previous revisions referenced things that do not exist in this repo. Recorded here so the same
workarounds don't get re-proposed:

- **`@mithra/domain` package** — does not exist. `packages/` contains only `api-client`.
- **`buildWhatsAppOrderMessage()`** — does not exist anywhere in the tree.
- **`mapVendorStorefrontToDraft()`** — does not exist anywhere in the tree.
- **`mithra_store_cart` localStorage key** — belongs to `design-reference/assets/js/store-api.js`.
  The React app's cart key is `md-cart`.
- **"vendor-app pages"** — there is no vendor-app. Vendor screens live in `src/modules/vendor`.

### Retracted in this revision

- **"`onboarding.next_step` is derived and moves backwards, and `onboarding.status` never reaches
  `COMPLETED`."** Both halves are false, and acting on them caused a real bug. Measured across five
  live vendors covering the full range — nothing configured, mid-catalog, finished-but-not-live, a
  vendor with a permanently unpriced leftover product, and a live store:

  | Account state | `next_step` | Resource-derived guess |
  |---------------|-------------|------------------------|
  | Nothing configured | 3 | 3 |
  | Categories, products, SKUs, checkout saved | 9 | 9 |
  | **Same, plus one unpriced leftover product** | **9** | **6 — wrong** |
  | One product priced, no checkout | 7 | 7 |
  | Live store | 11, `status: COMPLETED` | 10 |

  `next_step` was correct in every case, including the one that broke the derivation. `COMPLETED`
  does appear. The value tracks what the vendor completed, not what the account happens to hold —
  which is exactly the distinction that matters, because a product cannot be un-assigned, so a
  leftover unpriced one is permanent and would otherwise reopen Step 6 forever.

  The frontend now reads `next_step` and nothing else for resume position. `derivedResumeStep`
  survives only as a fallback if the field stops being returned; it is not a second opinion.

These were recorded as blocking contract gaps. All were **wrong**, and all were disproved by calling
the API instead of reading `openapi.json`. The lesson is in the first two: an operation typed as a
bare `APIResponseObject` says nothing about what it actually returns, and operation-level
`requestBody.examples` can be far richer than the schema.

- **"Assigned-product ID mapping is blocking"** — it is not. `GET /v1/vendors/{id}/products` is
  public and returns `{id, ref_id}`, where `ref_id` is the platform product ID and `id` the vendor
  product ID. One field, one unauthenticated call.
- **"Canonical checkout JSON keys are unknown"** — they are documented. `PUT /checkout_options`
  carries four complete request examples with exact snake_case keys per shipping strategy.
- **"There is no `next_step`"** — there is. Both `verify-otp`'s `vendors[]` entry and
  `GET /context` return `onboarding.next_step`. Only the checked-in OpenAPI *example* omits it.
- **"`THUMBNAIL` is not confirmed as the storefront logo"** — it is. A live storefront returns
  `thumbnail_image` at `/vendors/{id}/thumbnails/logo_*` and `banner_image` at `/homebanners/*`.
- **"A verified vendor may have no vendor record"** — verification auto-creates one ("My Store")
  and returns it in `vendors[]`.
- **"`VENDOR` may not be granted at verification"** — it is. A first-time vendor's `verify-otp`
  returns `roles: ["VENDOR", "USER"]`.
