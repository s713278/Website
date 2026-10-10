# Backend API gaps (frontend tracking)

Endpoints the frontend wants that the backend doesn't have yet, plus the interim workarounds.

Tracked against [Swagger](https://subscriptionapp-wgf8.onrender.com/api/swagger-ui/index.html).
Claims below were checked against `packages/api-client/openapi.json` (117 paths when first checked;
123 since the billing endpoints were added) and the `src/`
tree. See [API_ARCHITECTURE.md](./API_ARCHITECTURE.md) for how the API layer is put together.

> **Scope note.** Some workarounds here belong to the frozen `design-reference/` static prototype,
> not the React app. Those are marked **(static only)** — don't go looking for them in `src/`.

## Shipped (in the spec, use these)

| Endpoint | Use |
|----------|-----|
| `GET /v1/vendors/{identifier}/storefront` | Full public storefront payload by numeric vendor ID or `store_identifier` (theme, hero badges, fulfillment, categories, products, WhatsApp numbers, share link) |
| `POST /v1/vendors/{vendor_id}/delivery-eligibility` | Pincode / lat-lng deliverability check |
| `GET /v1/vendors/{vendor_id}/products/skus` | SKU list backing the storefront product grid |
| `GET /v1/users/{user_id}/dashboard` | Vendor-level insights: `total_customers`, `subscriptions_count` (active/pending/paused/expired/cancelled), `order_status_count`, `payment_dues`. Despite the `users` path it serves vendors — the contract carries both an `Admin Response` and a `Vendor Response` example, and a vendor token returns its own figures. **Empty groups come back as bare `{}`, not zeroed keys**, so read them through a mapper rather than reaching for `.delivered_count` directly. |
| `onboarding.next_step` on `POST /v1/auth/verify-otp` and `GET /v1/vendors/{id}/context` | **The** resume position for an unfinished vendor. 1-based over the ten wizard steps; `11` means setup is complete. Once `onboarding.status` is `COMPLETED` the context omits it (verified after go-live, 24 September 2026) and the frontend reads the status instead. Both endpoints return identical values — verify-otp carries it per vendor under `vendors[].onboarding`, alongside `status` and a human `description` ("Step 8: Payments"). |

Wrapped in `@mithra/api-client` as `storefrontService.get` / `checkDeliveryEligibility`, plus the
flat `getVendorStorefront`, `loadVendorStorefront`, `getVendorProductSkus` in `services/legacy.ts`.

> **The richer storefront payload is not called from `src/` yet.** The package wrappers are aligned,
> but the customer storefront still renders from the older catalog service (`/v1/vendors/…`). The
> onboarding preview renders its private same-browser draft; it does not pretend to be this
> public backend response.

## Still open

| Gap | Needed for | Interim workaround |
|-----|------------|--------------------|
| Public storefront shop-plan status | Hiding a lapsed vendor's customer shop by the [MFPS-66 rules](./VENDOR_BILLING_BACKEND_BRIEF.md#mfps-66-shop-enforcement-is-not-built--blocker): hidden after `trial_ends_at` unpaid, after a halted collection, and while an early ₹299 is unconfirmed after `trial_ends_at`; open while a renewal is collected and until `current_period_end`, even when `CANCELLED` | `GET /v1/vendors/{identifier}/storefront` does not document `subscription.status` / `subscription_status`, and on 30 September it still served a lapsed shop in full. The React shop reads either field when present and hides the shop on `HALTED`, `CANCELLED` or `EXPIRED`, which would hide a paid shop early ([gap H](#billing-gaps-ak)); otherwise it shows the normal store. Backend should enforce visibility and expose the result on this public payload. |
| `GET /v1/vendors/{id}/storefront/products` | Paginated public product grid (`page_number`, `page_size`, `result[]`, `last_page`) | Call the live path from `storefrontService.listProducts` + `mapStorefrontProductPage`. Chip labels may append price until names exist. Frontend maps name→numeric id from products when possible; otherwise filters client-side by category name. |
| `GET /v1/vendors/{identifier}/storefront/products/{product_id}` | Product detail with every variant in one object | Called from `storefrontService.getProduct` + `mapStorefrontProductDetail`. Public (`skipAuth`), so a 401 is not refreshed or retried. 404 is an unavailable product. The checked-in OpenAPI snapshot does not list this path yet. |
| `GET /v1/vendors/{identifier}/storefront/contact-us` | Contact page: business name, owner, phone, main address, extra addresses, social links. The shop calls `storefrontService.getContact` and maps the response with `mapStorefrontContact`. 
| `catalog_preview` on `GET /v1/vendors/{vendor_id}/context` | The setup phone preview on a step that has not read the catalog, such as a submitted store's Step 10: `catalog_preview: { categories: [{ id, name }], products: [{ id, name, category_id, image_url, price }], active_sku_count }`, `price` being the product's lowest active sale price | The frontend already maps the block (`mapVendorContext`) and shows it in the phone preview whenever present ([hydration](./API_ARCHITECTURE.md#vendor-setup-account-hydration)). Until the backend adds it, a submitted Step 10 reads context + profile only and its phone preview shows no categories or products and 0 / 0 / 0. Remove this row once the deployed context carries it. |
| Per-order WhatsApp message | Server-owned WhatsApp order text | Build the string client-side. (A bare `/v1/whatsapp` GET/POST exists but is not a per-order message endpoint.) |
| Rich product attributes on the storefront payload | Ingredients / nutrition / rating on the PDP | None. `ProductDTO` is `id`, `name`, `description`, `measurement_unit_id`, `image_path` — the spec itself calls it "lightweight". Pull detail from the SKU endpoints or fixtures. |
| Guest cart → merge on customer OTP | Browse anonymously, then sign in without losing the cart | Cart is local-only (`md-cart` via `useCartStore`) and never syncs, so there is nothing to merge yet |
| Coupon codes | Cart promo CTA | **(static only)** — `MITHRA50` / `HOME50` are hardcoded in `design-reference/assets/js/storefront.js`. The React app has no coupon UI. |
| Canonical payment-detail keys | A customer-facing consumer for bank details | **No bank/payout endpoint exists anywhere in the contract** — no path, schema or property matching bank/ifsc/payout. `details` is a free-form JsonNode that round-trips whatever it is given (verified). The wizard writes `{account_holder_name, account_number, ifsc_code, bank_name}` under `ONLINE`, matching the documented `upi_account` style. Backend must confirm these keys and that a consumer renders them. |
| Public store reachability | Sharing a store after go-live | `store_identifier` **is** generated at go-live (`slug-vendorId`) and `/stores/{identifier}` resolves it, but the public storefront returns `404` until an admin sets an approved `approval_status` (`APPROVED` in the documented contract). Share controls therefore unlock only on approval. `share_link` is still a relative API deep link, not a web URL. |
| Stable go-live validation contract | Link backend readiness failures to the responsible wizard step | Go-live succeeds with a plain string (`"Vendor is now active and pending admin approval"`); the failure shape is undocumented and untested. Errors fall back to `getErrorMessage`. |
| Approval reset during go-live | Keeping an approved vendor able to add sizes after completing setup | A September 2026 test report describes an already `APPROVED` account returning to `approval_status: PENDING` after Step 10 called `POST /v1/vendors/{vendor_id}/go-live`. This transition still needs backend review, including how existing approval should be preserved and the intended status after onboarding. The frontend requires an approved status for submitted size additions (`APPROVED`, plus the current `ACTIVE` compatibility value). The completed-and-approved UI flow passes with simulated responses; a live check of that combined state awaits an approved account. |
| Approval status vocabulary | Identifying approved vendors consistently | The documented contract and existing fixtures use `approval_status: APPROVED`, while a current supplied vendor context reports `approval_status: ACTIVE`. The frontend treats both as approved at its status boundary; the backend should publish one canonical enum and clarify whether `ACTIVE` belongs to `vendor_status` only. |
| ~~QR sharing~~ **closed 21 Sep 2026** | The ticket's offline-friendly QR requirement | The dashboard and approved setup Step 10 generate the QR in-browser from the canonical storefront URL. Vendors can save the PNG, and the native file-share action appears only when the device supports sharing that file. |
| Readable storefront before approval | Restoring Step 9 branding when a vendor resumes | `GET /{identifier}/storefront` is the only read carrying theme, tagline, badges and welcome message, and it `404`s until `approval_status: APPROVED` — exactly the vendor who needs it cannot use it. Resume repopulates name and contacts from the vendor record and leaves branding at defaults. |
| Per-SKU fulfillment flags | Restoring Step 6 exactly | Neither the SKU list nor `GET /skus/{sku_id}` exposes `home_delivery` / `store_pickup`, though both are writable. A resumed SKU defaults both to true. |
| Vendor-triggered approval | Testing the approval transition end to end | `PATCH /approval` returns `500` for a vendor token, so vendor credentials cannot exercise the administrator's approval transition. Login and a single active-size create/read-back have been verified with a manually approved live test account; this does not verify the approval transition itself. |
| Date-scoped vendor revenue | The dashboard's "Today's sales" tile, and any earnings figure a vendor is shown | **No aggregate revenue endpoint exists** — all 117 paths enumerated, zero matches for revenue, sales, earning, payout, settlement, income, transaction, invoice, billing or payment. `GET /v1/users/{user_id}/dashboard` carries `payment_dues.paid_amount`, but it is **cumulative, never date-scoped**, so it cannot answer "today". The only derivation available is paginating `GET /v1/vendors/{id}/orders/?start_date=&end_date=` and summing client-side: both bounds are honoured live and a malformed date returns `417`, so the filter is real, but this spends N requests to produce one number and the per-order amount field is **unconfirmed** — no test vendor has orders yet. Backend should expose a date-scoped vendor revenue aggregate. Until then a vendor-facing revenue figure is either omitted or explicitly labelled cumulative. |
| Vendor profile is not writable | Editing store name, owner, contact, email or address | **`PUT /v1/vendors/{id}` returns `417` "Could not commit JPA transaction" for every body shape tried** — echoing the record back unchanged, with the vendor's existing category ids, with `category_ids: []`, with `assign_categories` omitted, and with it null. Nothing changed on the record in any attempt. `VendorProfileRequest` also declares `assign_categories` **required**, which would collide with additive-only category assignment even if the write worked. No other endpoint covers these fields, and the wizard never calls this one, which is why the defect went unnoticed. Settings is therefore read-only. |
| 14-day trial in production | The agreed 14-day free trial and access enforcement | Go-live now starts a trial (on dev a successful go-live counts as complete and approved; once a vendor verification step exists, the trial must start at approval), and `GET /v1/vendors/{vendor_id}/subscription` carries `trial_started_at` and `trial_ends_at`. Dev deliberately runs a 1-day trial so subscriptions come due quickly; production must give 14 days, a [release blocker](./VENDOR_BILLING_BACKEND_BRIEF.md#5-release-blockers). The app counts days from `trial_ends_at` and assumes no length. |
| Vendor platform billing | Vendor-to-MithraDirect recurring fees, trial eligibility, verification and store access | The backend published its own billing API, and the Live API reads it. Gaps A–K are summarised [below](#vendor-platform-billing); the [backend billing brief](./VENDOR_BILLING_BACKEND_BRIEF.md) owns their detail and the production release blockers. The explicitly labeled [development preview](./VENDOR_BILLING_PREVIEW.md) stays demo-only; it never grants real access. |
| `eligible_features` is unexplained | Deciding what a plan actually unlocks | Live returns `["DASHBOARD","VIEW","CATALOG"]` where the doc example returns five entries including `ORDERS` and `PRICES`. Nothing documents what the list governs. Mapped but **not** used for gating: gating on it would hide Orders from every FREE-tier vendor, which is currently all of them. |
| No rejection reason | Telling a rejected vendor what to change | `approval_status` includes `REJECTED` (`ApprovalStatusRequest`), but no field anywhere carries why. The dashboard can only say "Setup needs changes" and point at support. |
| ~~No courier partner list~~ **closed 10 Sep 2026** | Setting an order to SHIPPED with tracking | `GET /v1/courier-partners` **does** return real seeded partners (id 1 `DTDC`, 2 `PROFESSIONAL_COURIER`, 3 `INDIA_POST`, …) with a `tracking_url_template`, so `courier_partner_id` is obtainable. The earlier "no endpoint lists them" claim was wrong. The console still advances through `POST …/orders/bulk-status-update` rather than tracking — see the row below for why. |
| `POST /orders/{id}/tracking` bypasses transition validation | Nothing — this is a warning, not a gap to work around | The route sets `SHIPPED` **from any live state with no hop validation**: verified setting `SHIPPED` directly from `PENDING` (a two-hop skip) and from `SCHEDULED`, both HTTP 200, where `bulk-status-update` refuses the same skips. It is also the only order write that returns the full order DTO, and it is faster. **Do not build on it.** Inferred to be a validation gap rather than a feature; a console action that depends on the backend failing to enforce its own rules breaks when that is fixed. See `docs/adr/0004-new-means-scheduled.md`. |
| **Nothing can record a payment** | Any vendor-facing write of a customer order payment (vendor platform-fee billing is separate: see [Vendor platform billing](#vendor-platform-billing)) | Re-verified exhaustively 10 Sep 2026. `PATCH /v1/vendors/{v}/orders/{id}` and `PATCH /v1/orders/{id}` — the only two routes carrying `payment_status` — both return **417 for every body including `{}`**, a Jackson `Type definition error` on `OrderUpdateRequest` that fails before the body is read, so no body shape can pass. `PATCH /v1/users/{u}/orders/{o}` has no payment field and **returns a false `200` "Order updated successfully."** for `{"payment_status":"PAID"}` while changing nothing — never call it, and never treat its 200 as confirmation. All 117 paths were searched for `payment\|pay\|txn\|transaction\|settle\|razorpay\|upi\|invoice\|receipt\|collect`: **zero matches**, and there is no `/v1/payment-types`. `PaymentDTO` exists but hangs off a dead legacy route (`Cannot invoke "Cart.getId()" because "cart" is null`). `DELIVERED` does not auto-mark an order paid. **Interim:** the vendor console keeps the flag on the device — `docs/adr/0003-payment-status-is-a-device-local-vendor-record.md`. |
| `POST /v1/orders` is not implemented | Creating an order by any route but the cart | Returns `417 "createOrder from CreateOrderRequest not yet implemented"`. The React checkout now uses `POST /v1/orders/from-cart` (`CreateOrderFromCartRequest`). Every order that route creates arrives `order_status: SCHEDULED`, never `PENDING` — which is why the console's "New" bucket is `SCHEDULED`. Note the contract's own description of `POST /v1/orders` claims *"Order status set to PENDING by default"*; it cannot, because it does nothing. |
| Customer history/paged has no vendor filter | Store-scoped My orders (`/stores/{id}/orders`) | `GET /v1/users/{id}/orders/history/paged` takes only `page` and `size`. The page walks pages until this shop has rows (or `last_page`), then Load more does the same. Backend should accept a vendor id so one request can return that shop's page. |
| from-cart needs a backend `address_id` | Home-delivery checkout | Local pins are `addr-*` ids, not server rows. Checkout PATCHes `NameAndAddressRequest` with `setAsDefault=true` for the confirmed pin, then sends the returned id on from-cart. It reuses an older AddressDTO only when that save returns no id. Live validation requires `address1`, `city`, `country`, `latitude`, `longitude`, and `zipCode` — the OpenAPI “valid keys” list omits lat/lng and is wrong. Missing those keys returns `400` `Address validation failed.` There is still no dedicated create-address endpoint that guarantees an id. |
| STORE_PICKUP without `pickup_options.stores` | Store-pickup checkout (`pickup_slot` / `pickup_address_id`) | OpenAPI: STORE_PICKUP requires `pickup_address_id` (vendor store id) and `pickup_slot` (Morning/Evening), validated against that store’s configured slots from `GET …/checkout_options` → `pickup_options.stores[].pickup_slots`. Live vendor 371 (5 Oct 2026) returns `delivery_methods: ["HOME_DELIVERY","STORE_PICKUP"]` and a pickup message, but `pickup_options.stores: []` and `delivery_slots: []`. from-cart then `400` `pickup_slot is required for STORE_PICKUP`. Frontend maps stores/slots dynamically and blocks place when none are returned — it does not invent Morning/Evening. Backend should return at least one store with `store_id` and `pickup_slots` whenever STORE_PICKUP is offered, or stop advertising STORE_PICKUP until slots exist. |
| Customers cannot cancel their own orders | A customer-facing cancel control | `PATCH /v1/users/{u}/orders/{o}` refuses any status change past `PENDING` (`400 Cannot change status from SCHEDULED. Order is locked for further changes.`), and orders arrive `SCHEDULED`. So the customer route is unreachable in practice and **every cancellation comes from the vendor**, via `PATCH /v1/vendors/{v}/orders/{id}/cancel`. |
| `cancelReason` vs `cancel_reason` | Cancelling an order | `CancelOrderRequest` uses camelCase `cancelReason`, while `OrderUpdateRequest` and `BulkOrderStatusUpdateRequest` both use snake_case `cancel_reason`. The frontend sends camelCase to the cancel endpoint only. |
| ~~Unverified order row shape~~ **closed 10 Sep 2026** | Rendering the orders list | Measured against 13 real orders on the probe vendor across `SCHEDULED`, `IN_PROCESS`, `DELIVERED` and `CANCELLED`. `payment_status` was `DUE` and `payment_method` was `CASH_ON_DELIVERY` on **all** of them. The list row still carries **no creation timestamp**, so the delivery-date-only constraint is unchanged. |
| Ownership and lifecycle for vendor-authored catalog entries | Letting a vendor control what they add to the shared catalog | Vendor tokens can create categories and products, but the entries are shared immediately and have no vendor ownership, delete-own or moderation lifecycle. Detailed below. |
| Removing an assigned product | Deselecting a product at Step 5 | `PATCH /v1/vendors/{vendor_id}/delete/products` returns **403 for a vendor** (Admin/Customer_Care only), so assignment is additive. The wizard refuses the deselection and says removal needs support, rather than silently doing nothing. |
| Removing an assigned category | Deselecting a category at Step 4 | **No endpoint exists at all** — verified by exhaustive enumeration, not by guessing routes. `PATCH /categories` appends and `417`s on an already-assigned id. Same treatment as products: the wizard refuses the deselection. |
| Per-SKU fulfillment updates | Saving legacy drafts with changed delivery/pickup flags | The updated SKU PATCH still omits these flags. Only this legacy case retains delete-then-create; current Step 6 has no per-size fulfillment controls. See [updated SKU contract](#updated-sku-contract). |
| Structured SKU create response | Recording new size IDs without rereading every SKU page after a Step 6 create | `POST /v1/vendors/{vendor_id}/skus` is documented only as a generic `APIResponseObject`, with no response example. On 3 October 2026 dev answered a grouped create with `data: {"id": 3, "message": "[5120, 5121, 5122] SKU(s) created successfully."}`: `id` is the count of sizes created, the SKU IDs appear only inside the message text, and no `price_id` is returned. The frontend does not parse that message. Step 6 rereads `GET /v1/vendors/{vendor_id}/products/skus` after any create to recover SKU and price IDs. The backend should return the created SKUs as structured data (`sku_id`, `price_id`, `quantity_value`, `unit` per size) and document it in the contract. |
| Creating a SKU while under review | Adding a size to a product after a store is submitted | `POST /v1/vendors/{vendor_id}/skus` has returned **`417`** while approval is `PENDING`. Step 6 stays read-only for submitted pending vendors; real `approval_status: APPROVED` reopens size additions within plan limits. Categories/products remain additive in either case. The dashboard's temporary approval coercion is not used here. See [Step 6 behavior](./API_ARCHITECTURE.md#vendor-setup-sizes-step-6). |
| Activation inconsistent with onboarding | Resuming an account activated or approved before setup finishes | A September 2026 supplied context reports `ACTIVE`/`APPROVED` with `IN_PROGRESS` and `next_step: 7` after manual database changes. The frontend honors explicit onboarding progress; activation and approval cannot skip remaining steps. Backend writes should preserve that invariant and document the precedence for conflicting fields. See [entry routing](./SESSION.md#where-a-session-lands). |
| Legacy SKU unit vocabulary | Keeping existing real-account sizes aligned with the backend measurement catalog | New writes use the backend's units, but this work does not migrate SKUs already written with the frontend's old unit vocabulary. Detailed below. |
| Unimplemented shipping strategies | Flat / tiered / weight-based delivery pricing | `FLAT`, `ZIPCODE_TIERED` and `WEIGHT_BASED` are in the enum (and `FLAT` even has a documented example) but return `No validator registered for shipping strategy type`. Only `ORDER_AMOUNT_THRESHOLD` and `ZIPCODE_THRESHOLD` work. A flat charge is expressed as `ORDER_AMOUNT_THRESHOLD` with a zero threshold. |
| Unvalidated `scheduling_config` | Trusting the delivery schedule a vendor configures | The backend stores `scheduling_config` **verbatim without validation** — even `{}` is accepted. `FIXED_WINDOW` and `CUSTOMER_SELECT_DATE` keys come from documented examples; `PREDEFINED_DAYS` and `INSTANT` keys are our own snake_case and no consumer contract confirms them. |
| Unique `cart_item_id` per cart line | Quantity + / − / remove by `PUT`/`DELETE /cart/items/{cart_item_id}` | 

### Vendor platform billing

**Updated 30 September 2026 for the early first fee.** The backend published its own billing API
instead of the 24 September request to extend the vendor context with billing and add three write
contracts. That request is withdrawn, including its access flags, allowed actions, payment,
cancellation and refund state, attempt IDs and idempotency keys. This section summarises where the
published API still falls short. [The billing decision record](./VENDOR_BILLING_DECISIONS.md) owns
the product rules, the [backend billing brief](./VENDOR_BILLING_BACKEND_BRIEF.md) owns the backend
contract, gap evidence and release blockers, and the [architecture owner](./API_ARCHITECTURE.md)
owns how the Live API reads and writes billing. The [development preview](./VENDOR_BILLING_PREVIEW.md) and the local test
server stay demo-only.

The published operations are the subscription read, subscribe, `confirm`, cancel and history under
`/v1/vendors/{vendor_id}/subscription`, the plans list `GET /v1/subscription-plans`, and a Razorpay
webhook that moves the status. Another vendor gets `403`; before go-live the read returns `404`.
Since 29 September the vendor context is flat: top-level `features` and `limits`, and no
`subscription` block, so it carries no plan, trial, `days_remaining` or lifecycle status. The live
OpenAPI context description and examples match that shape. Billing reads none of the context.

#### Billing gaps A–K

Verified on dev with fresh test vendors, a real Razorpay Test Checkout and a dashboard "Charge this
now", 28–30 September 2026, and rechecked on the night of 30 September (J's recheck is pending and E
was not rechecked). The app reads today's responses and the corrected ones alike, so a fix needs no
app change; code comments tag each gap the app copes with.

The [backend billing brief](./VENDOR_BILLING_BACKEND_BRIEF.md) owns each gap's evidence, required
read, Razorpay recipe and acceptance check, the
[production release blockers](./VENDOR_BILLING_BACKEND_BRIEF.md#5-release-blockers) (these gaps
plus MFPS-66 shop enforcement, a 14-day trial in production and eMandate switched off), and the
standing backend requirements for verification, cancellation, trial ownership and acceptance
evidence. This table is the summary.

| Gap | Problem | Cost if unfixed | Recommended fix | Blocker |
|---|---|---|---|---|
| A | Stopping after an early first fee returns `500` | A vendor who paid early cannot stop the plan until the paid month ends, so the next ₹299 is charged | Cancel at Razorpay immediately; report `ACTIVE` with `cancel_at_period_end: true` until `current_period_end`; a 4xx with the reason when refused | Yes |
| B | `ACTIVE` before the ₹299 is captured | A charge that fails, or whose webhook is lost, leaves an unpaid vendor `ACTIVE` | Move to `ACTIVE` on `subscription.charged` only | No |
| C | Subscribing alone moves the trial to `PAYMENT_PENDING` with the paid plan | A vendor who closes Checkout unpaid stays `PAYMENT_PENDING` for good, and is named on the paid plan | Keep `TRIAL_ACTIVE` until the ₹299 is captured; cancel a still-`created` subscription at trial end | No |
| D | The next ₹299's date is unconfirmed | A charge after `current_period_end` gives a free day and shifts every renewal; the shop reads Collecting meanwhile | `start_at` = the new `current_period_end`; confirm with a Razorpay read | Yes |
| E | Keep shop open returns `409` while the plan is stopped | A stopped vendor cannot restart before the paid days end, so the shop closes first | Charge ₹299 now; the new month starts at the old `current_period_end` | No |
| F | `next_billing_at` is kept after a stop | The read names a charge that will not happen | Null while `cancel_at_period_end` is true | No |
| G | Minor: duplicate history rows, no amounts, timestamp without offset, brief `502`s, OpenAPI doc bugs, `confirm` history only | History shows no amounts; a lost `confirm` drops its history row | Webhook-written history with `amount` in rupees, idempotent `confirm`, an offset on `timestamp` | No |
| H | A Razorpay-side cancel reads `CANCELLED` while the paid month remains | Enforcement keyed on status would hide a paid shop up to a month early | MFPS-66 keeps a `CANCELLED` shop with a future `current_period_end` open | Via MFPS-66 |
| I | Paying after the trial fails: a `500`, or since 30 September a `200` that reuses the free-days subscription and opens a blank Checkout | A vendor whose free days ended has no way to pay | After the trial, a new immediate-start subscription that collects ₹299 at once; never reuse a free-days one | Yes |
| J | The status stays `TRIAL_ACTIVE` after `trial_ends_at` | The status contradicts the dates; anything reading the status alone sees a trial | `TRIAL_EXPIRED` at `trial_ends_at`, on server time | No |
| K | The early first fee is not built | Paying in the free days sets up AutoPay only (₹5 now, ₹299 at trial end); the shop is hidden after the trial end until Razorpay charges | One ₹299 now, a paid month from `trial_ends_at`, `start_at` = `current_period_end` | Yes |

#### Billing read gaps

Recorded 4 October 2026. Every billing endpoint answers `Cache-Control: no-store` and nothing
announces a billing change, so the app limits its billing reads in memory: the
`TEMP(vendor-billing-reads)` workaround, whose target design and request counts
[VENDOR_BILLING_READS_TARGET.md](./VENDOR_BILLING_READS_TARGET.md) owns. None of these is a release
blocker. Each fix is a contract change the backend would have to publish; no such endpoint, field or
header exists today.

| Gap | Problem | Required contract change | Frontend code it would retire |
|---|---|---|---|
| Subscribe guard | No documented guarantee that a second subscribe, from another tab or device or after a stale read, cannot start a second payment. On dev, a repeat while pending returns the same subscription, but after the trial end that reuse is [gap I](#billing-gaps-ak), and an active subscription is not covered | Subscribe made idempotent per store (a repeat returns the existing subscription and Checkout), or rejected with a 4xx and the reason while a subscription is active or confirming | Plan's forced read on open and Checkout disabled while reading; the target's `refetchOnMount: 'always'` |
| Billing change push | Nothing tells an open tab that billing changed (a webhook-applied payment, a cancel or a charge elsewhere), so the app rereads on focus once 15 minutes old, on Plan and at T or P | A vendor-scoped push channel, such as server-sent events, announcing billing changes | The 15-minute focus gate, the cross-tab `BroadcastChannel` and most of Plan's 5 s poll; the target's 15 min `staleTime` could rise |
| Plan summary in the vendor context | The rail chip, Settings' Plan row and the chrome need the plan name, trial end and billing status, but since 29 September the vendor context has none, so every vendor page starts a billing read | The vendor context carries a plan summary: plan name, `trial_ends_at` and the billing status | The chrome's, rail's and Settings' use of the shared billing read (`useStartedLiveBilling`); only Plan would read billing |
| Cacheable plans catalog | `GET /v1/subscription-plans` is public and static but answers `no-store`, so the browser cannot cache it | An `ETag` with conditional requests, or a `max-age`, instead of `no-store` | The in-memory, once-per-page-load plans request; the target's `staleTime: Infinity` plans query |

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

The refusal takes effect the moment the assigning write succeeds, not only after a reload. The
account catalog is read on entry and then grown by each successful write; the write itself is the
evidence, so a vendor who returns to the step during the same visit is refused there too. Earlier,
the entry read was the only source, so same-visit deselection was allowed and quietly discarded.
Both steps also show a note beside Continue, the button that saves, saying a saved choice cannot be
removed.
Neither the notice nor the refusal appears in demo mode or on the sample catalog, where nothing
reaches an account.

### Backend request: give vendor-authored catalog entries an owner and lifecycle

A vendor can now introduce a missing category or product during setup. The wizard creates
the entry in the shared platform catalog, records the returned platform identifier, and
then assigns it to the vendor's store. The deployed API accepts both creates with a vendor
token:

| Operation | Verified result | Consequence |
|-----------|-----------------|-------------|
| `POST /v1/categories/` | **201** | Creates a platform category, not a vendor-private category. |
| `POST /v1/categories/{id}/products/` | **201** | Creates a platform product under that platform category. |
| `GET /v1/categories/` after the category create | The new category is visible immediately | Every other vendor browsing that business type sees it too. |
| `PATCH /v1/vendors/{id}/delete/products` | **403** for a vendor | The author cannot remove the assigned product from their own store. |
| `DELETE /v1/categories/{id}` | **403** for a vendor | The author cannot delete the platform category they introduced. |

Creation therefore exists, but ownership, deletion and moderation do not. The contract
exposes no creator or owner for an authored entry and no moderation state. Once Continue
creates it, the author has no more control over it than any other vendor. The wizard warns
about that shared, permanent effect before authoring; only a still-pending draft entry can
be removed for free.

**Needed:** vendor-owned entries with an explicit ownership and moderation lifecycle, so a
vendor can manage what they introduced without gaining control over somebody else's
platform entries. At minimum, provide delete-own for vendor-authored categories and
products, plus vendor-callable un-assign for the author's own store. The frontend cannot
reconstruct ownership or safely emulate those permissions from the current shared records.

### Existing SKU units are not migrated

Step 6 now takes its unit vocabulary from `GET /v1/measurements/`, then hydrates each row from
authenticated `GET /v1/measurements/{id}` because the deployed list omits `unit_options` even
though its OpenAPI description says the list includes them. New writes therefore consistently use
the backend spellings (`gr`, `pcs`, `L`) rather than the frontend's removed hardcoded spellings
(`g`, `piece`, `l`). This applies to every product, not only a vendor-authored one.

SKUs already written to real accounts under the old vocabulary are not rewritten or
migrated by this work. Reconciling those stored units requires a separate backend migration
or an explicit update contract; the frontend must not claim that replacing its picker also
changed existing account data.

### Onboarding continuity a vendor still loses

Symptom-first, because these are what a vendor actually reports. Each is caused by a gap
above and is **not** a frontend defect — the frontend cannot fix any of them alone.

| What the vendor sees | Cause | What the backend must provide |
|----------------------|-------|-------------------------------|
| "I re-enter my business location every time I come back." | `business_location` lives only on the storefront payload, which `404`s until approval. The vendor record carries a structured `business_address` (measured on vendor 96 — see the corrections section below), but not the storefront's free-text `business_location`, so the wizard's location field still has nothing to resume from. | Either a vendor-readable storefront before approval, or `business_location` on `GET /v1/vendors/{id}`. |
| "My theme, tagline, welcome message and badges reset to defaults on every resume." | Same 404. `GET /{identifier}/storefront` is the only read carrying them, by `store_identifier` **and** by `vendor_id` — both verified `404` on a live `PENDING` vendor. | A read a vendor may call on their own unapproved store. |
| "A SKU I set to pickup-only comes back as delivery + pickup." | The SKU read omits `home_delivery` and `store_pickup` entirely (verified: the row returns `vendor_product_id, sku_id, sku_name, image_path, sku_size, sku_type, is_active, valid_days, price_id, list_price, sale_price, effective_date, eligible_subscription_details, discount, on_sale, description`). Both are writable but unreadable, so resume defaults them to `true`. | Return the two flags on the SKU read. |
| "I can't remove a category or product I picked by mistake." | 403 / no endpoint, above. | A vendor-callable un-assign for both. |
| "A product I don't want to sell blocks go-live." | Follows from the above: the product cannot be un-assigned, and Step 6 requires every assigned product to carry at least one *active* valid SKU. So a mistakenly assigned product must be priced and sold. | Same un-assign. Until then the only escape is support. |

Normal size and price edits now preserve `sku_id`. The remaining legacy fulfillment-only
replacement may still lose subscription plans; see [updated SKU contract](#updated-sku-contract).

### Updated SKU contract

The supplied September 2026 OpenAPI revision supersedes the older SKU creation and update
observations below. The frontend now follows that contract for creation, structured measurement
reads, and in-place edits; [API architecture](./API_ARCHITECTURE.md#vendor-setup-sizes-step-6) owns
the request mapping and reconciliation details. The old forced one-time subscription plan has
been removed because the contract explicitly permits no subscription plans.

Creation accepts multiple `price_list` entries, but its generic response does not document a
created-ID mapping or batch atomicity. The frontend confirms all new sizes through the account
read and reconciles before retrying. The backend should document per-size results or guarantee
atomic batch behavior. A single active-size create and read-back passed on an approved live test
account in September 2026; a multi-size create and a failed batch still need live verification.

A September 2026 live probe on an approved account accepted an inactive size creation, increasing
`subscription.usage.skus`, but neither `GET /vendors/{id}/products/skus` (including a product filter)
nor the unfiltered vendor SKU search returned it. The product-detail read exposes no SKU IDs.
Creation's response is not mapped to IDs by the app service, so this leaves an inactive create
unconfirmable through the current reconciliation path. Backend should provide an owner-only read
including inactive sizes and document created IDs in the response. Do not report such a save as
confirmed or infer a SKU ID. Plan-limit checks include the usage omitted from the list only when
the context sends `subscription.usage`; the flat context of 29 September 2026 does not.

The revised PATCH promises to preserve omitted fields, including features. A September 2026 live
probe against both an approved and a pending completed vendor still found two deployed failures:
including the quantity and unit from the current read returned `400 Unsupported measurement unit`,
while sending only `is_active` returned `417` with a JDBC error because the omitted `features`
parameter could not be typed. Neither request changed the size. The frontend therefore keeps
existing size status and removal controls read-only until the backend accepts a safe partial update;
it does not invent a `features` payload or silently replace a SKU when the update fails. Isolated
tests validate the new contract and error paths, not the backend's deployment.

Per-size delivery/pickup flags remain absent from PATCH and from the documented reads. Legacy
drafts with an explicit flag change retain their existing delete/create behavior, with its
non-atomic failure window and possible subscription loss. Remove that exception when the backend
supports reading and updating those flags. The wizard configures fulfillment in Step 7 and
does not offer these per-size controls. The under-review gate is unchanged.

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
- **Historical SKU subscription validation failure, superseded by the updated contract.** Older
  deployments rejected omitted or empty `eligible_sub_plans`. The September contract explicitly
  accepts both; the frontend no longer fabricates a plan to bypass the old validator. See
  [updated SKU contract](#updated-sku-contract) for the verification boundary.
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
- **`GET /v1/vendors/{id}` is the only read for `business_type`** — while typed as a bare
  `APIResponseObject` with no example. It also returns `owner_name`, `contact_person`,
  `contact_number`, `description`, `communication_email`, `business_address`, `banner_image`,
  `user_id`, `vendor_status` and `approval_status`; an earlier entry here claimed the record
  held the first few "and nothing else", which direct measurement disproved (see corrections).
  A never-configured vendor reports `business_type: "Others"`, which is indistinguishable from a
  vendor who genuinely chose Others; the frontend treats it as unset and re-asks.
- **A vendor can only remove SKUs. Categories and products are additive for this role,
  permanently.** Verified live against the dev API with a `VENDOR` token:

  | Operation | Endpoint | Result |
  |-----------|----------|--------|
  | Delete a SKU | `DELETE /v1/vendors/{id}/skus/{sku_id}` | **200** — works |
  | Update a SKU | `PATCH /v1/vendors/{id}/skus/{sku_id}` | Earlier probes returned **417**. This historical result is superseded by the [updated SKU contract](#updated-sku-contract); Step 6 now uses in-place updates. |
  | Un-assign a product | `PATCH /v1/vendors/{id}/delete/products` | **403 Authorization failed.** Body is a bare `int64[]`, not an object; the description says Admin/Customer_Care only, and that is enforced |
  | Un-assign a category | — | **No endpoint exists.** Confirmed by enumerating all 117 paths: every `DELETE` in the contract, plus every path/summary/description mentioning remove, delete, unassign, deactivate or disable |
  | Reset the whole catalog | `DELETE /v1/admin/vendors/{vendorId}/catalog` | **403.** Would do exactly what is needed — "Removes SKUs, prices, subscription plans, product assignments, and category assignments; the vendor profile itself is NOT deleted" — but is admin-only |
  | Deactivate a vendor product | `PATCH /v1/vendors/{id}/products/{product_id}` | Not possible. `UpdateVendorProductRequest` is `{product_id, description, features}` — no `is_active` or status field |
  | Replace the category set | `PATCH /v1/vendors/{id}/categories` | Not possible. `AssignCategoriesRequest` is `{category_ids: int64[]}` with no mode or replace flag, and the handler appends |
  | Re-assign a category subset | `PATCH /v1/vendors/{id}/categories` | **417** "The following categories are already assigned" — additive only, so it cannot express a removal |

  Consequences the frontend has to live with, until the backend grants a vendor
  un-assign or an admin flow exists:
  - Step 6 reconciles SKUs against the account — create, update, and delete what the vendor
    removed. Only the legacy fulfillment exception still replaces a row.
  - Steps 4 and 5 refuse to deselect anything already saved to the account and say why,
    from the moment the write succeeds rather than only after a reload, and warn that a
    choice is permanent before it is made. Silently allowing it produced the worst
    outcome: Continue was a no-op, the draft was marked clean, and the next resume handed
    the selection straight back.
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

- **"The vendor record returns `business_name`, `business_type`, `owner_name`, `contact_person`,
  `contact_number` and nothing else"** — it returns considerably more. Measured on vendor 96:
  `description`, `communication_email`, a full `business_address` object (country, state, district,
  city, address1, address2, zipCode), `banner_image`, `user_id`, `created_date`, `vendor_status`,
  `approval_status` and `langauage` [sic]. This weakens the recorded "I re-enter my business
  location every time I come back" symptom: `business_location` is missing from the *storefront*
  read, but a business address is on the vendor record and is readable before approval.
- **"`GET /v1/vendors/{id}/products` returns `{id, ref_id}`"** — it also returns `name`,
  `category_id` and `measurement_id`. It carries no price and no size, which is the real reason the
  old products page rendered every row at ₹0; the dashboard reads `/products/skus` instead.
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
