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
| Public storefront shop-plan status | Hide the customer shop when the vendor subscription is `HALTED`, `CANCELLED`, or `EXPIRED` | `GET /v1/vendors/{identifier}/storefront` does not document `subscription.status` / `subscription_status`. The React shop reads either field when present and otherwise shows the normal store. Backend should add the vendor shop-plan status on this public payload. |
| `GET /v1/vendors/{id}/storefront/products` | Paginated public product grid (`page_number`, `page_size`, `result[]`, `last_page`) | Call the live path from `storefrontService.listProducts` + `mapStorefrontProductPage`. Chip labels may append price until names exist. Frontend maps name→numeric id from products when possible; otherwise filters client-side by category name. |
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
| No authoritative trial entitlement in the deployed contract | The agreed 14-day free trial and access enforcement | The `Resp_Vendor_Context_Success` example shows `tier: SILVER, status: TRIAL, trial_ends_at, trial_days: 14`, but measured live context returns `tier: FREE, plan_name: Free, status: ACTIVE, monthly_price: 0, trial_days: 0` and **no `trial_ends_at`**. The 14-day hybrid policy is approved; backend entitlement and enforcement remain unimplemented. The production frontend still renders expiry only when provided. See [vendor platform billing](#vendor-platform-billing). |
| Vendor platform billing | Vendor-to-MithraDirect recurring fees, trial eligibility, verification and store access | Vendor context read exists; its billing extension and the three billing write contracts are missing. The explicitly labeled [development preview](./VENDOR_BILLING_PREVIEW.md) opens Test Mode Checkout using supplied configuration; it never grants real access. Required backend capabilities are [below](#vendor-platform-billing). |
| `eligible_features` is unexplained | Deciding what a plan actually unlocks | Live returns `["DASHBOARD","VIEW","CATALOG"]` where the doc example returns five entries including `ORDERS` and `PRICES`. Nothing documents what the list governs. Mapped but **not** used for gating: gating on it would hide Orders from every FREE-tier vendor, which is currently all of them. |
| No rejection reason | Telling a rejected vendor what to change | `approval_status` includes `REJECTED` (`ApprovalStatusRequest`), but no field anywhere carries why. The dashboard can only say "Setup needs changes" and point at support. |
| ~~No courier partner list~~ **closed 10 Sep 2026** | Setting an order to SHIPPED with tracking | `GET /v1/courier-partners` **does** return real seeded partners (id 1 `DTDC`, 2 `PROFESSIONAL_COURIER`, 3 `INDIA_POST`, …) with a `tracking_url_template`, so `courier_partner_id` is obtainable. The earlier "no endpoint lists them" claim was wrong. The console still advances through `POST …/orders/bulk-status-update` rather than tracking — see the row below for why. |
| `POST /orders/{id}/tracking` bypasses transition validation | Nothing — this is a warning, not a gap to work around | The route sets `SHIPPED` **from any live state with no hop validation**: verified setting `SHIPPED` directly from `PENDING` (a two-hop skip) and from `SCHEDULED`, both HTTP 200, where `bulk-status-update` refuses the same skips. It is also the only order write that returns the full order DTO, and it is faster. **Do not build on it.** Inferred to be a validation gap rather than a feature; a console action that depends on the backend failing to enforce its own rules breaks when that is fixed. See `docs/adr/0004-new-means-scheduled.md`. |
| **Nothing can record a payment** | Any vendor-facing payment write | Re-verified exhaustively 10 Sep 2026. `PATCH /v1/vendors/{v}/orders/{id}` and `PATCH /v1/orders/{id}` — the only two routes carrying `payment_status` — both return **417 for every body including `{}`**, a Jackson `Type definition error` on `OrderUpdateRequest` that fails before the body is read, so no body shape can pass. `PATCH /v1/users/{u}/orders/{o}` has no payment field and **returns a false `200` "Order updated successfully."** for `{"payment_status":"PAID"}` while changing nothing — never call it, and never treat its 200 as confirmation. All 117 paths were searched for `payment\|pay\|txn\|transaction\|settle\|razorpay\|upi\|invoice\|receipt\|collect`: **zero matches**, and there is no `/v1/payment-types`. `PaymentDTO` exists but hangs off a dead legacy route (`Cannot invoke "Cart.getId()" because "cart" is null`). `DELIVERED` does not auto-mark an order paid. **Interim:** the vendor console keeps the flag on the device — `docs/adr/0003-payment-status-is-a-device-local-vendor-record.md`. |
| `POST /v1/orders` is not implemented | Creating an order by any route but the cart | Returns `417 "createOrder from CreateOrderRequest not yet implemented"`. The React checkout now uses `POST /v1/orders/from-cart` (`CreateOrderFromCartRequest`). Every order that route creates arrives `order_status: SCHEDULED`, never `PENDING` — which is why the console's "New" bucket is `SCHEDULED`. Note the contract's own description of `POST /v1/orders` claims *"Order status set to PENDING by default"*; it cannot, because it does nothing. |
| from-cart needs a backend `address_id` | Home-delivery checkout | Local pins are `addr-*` ids, not server rows. A customer such as user `14752` can have `addresses: []`. The live path first `GET /v1/users/{user_id}` and reuses an AddressDTO id when present. Otherwise it PATCHes `NameAndAddressRequest`. Live validation requires `address1`, `city`, `country`, `latitude`, `longitude`, and `zipCode` — the OpenAPI “valid keys” list omits lat/lng and is wrong. Missing those keys returns `400` `Address validation failed.` There is still no dedicated create-address endpoint that guarantees an id. |
| Customers cannot cancel their own orders | A customer-facing cancel control | `PATCH /v1/users/{u}/orders/{o}` refuses any status change past `PENDING` (`400 Cannot change status from SCHEDULED. Order is locked for further changes.`), and orders arrive `SCHEDULED`. So the customer route is unreachable in practice and **every cancellation comes from the vendor**, via `PATCH /v1/vendors/{v}/orders/{id}/cancel`. |
| `cancelReason` vs `cancel_reason` | Cancelling an order | `CancelOrderRequest` uses camelCase `cancelReason`, while `OrderUpdateRequest` and `BulkOrderStatusUpdateRequest` both use snake_case `cancel_reason`. The frontend sends camelCase to the cancel endpoint only. |
| ~~Unverified order row shape~~ **closed 10 Sep 2026** | Rendering the orders list | Measured against 13 real orders on the probe vendor across `SCHEDULED`, `IN_PROCESS`, `DELIVERED` and `CANCELLED`. `payment_status` was `DUE` and `payment_method` was `CASH_ON_DELIVERY` on **all** of them. The list row still carries **no creation timestamp**, so the delivery-date-only constraint is unchanged. |
| Ownership and lifecycle for vendor-authored catalog entries | Letting a vendor control what they add to the shared catalog | Vendor tokens can create categories and products, but the entries are shared immediately and have no vendor ownership, delete-own or moderation lifecycle. Detailed below. |
| Removing an assigned product | Deselecting a product at Step 5 | `PATCH /v1/vendors/{vendor_id}/delete/products` returns **403 for a vendor** (Admin/Customer_Care only), so assignment is additive. The wizard refuses the deselection and says removal needs support, rather than silently doing nothing. |
| Removing an assigned category | Deselecting a category at Step 4 | **No endpoint exists at all** — verified by exhaustive enumeration, not by guessing routes. `PATCH /categories` appends and `417`s on an already-assigned id. Same treatment as products: the wizard refuses the deselection. |
| Per-SKU fulfillment updates | Saving legacy drafts with changed delivery/pickup flags | The updated SKU PATCH still omits these flags. Only this legacy case retains delete-then-create; current Step 6 has no per-size fulfillment controls. See [updated SKU contract](#updated-sku-contract). |
| Creating a SKU while under review | Adding a size to a product after a store is submitted | `POST /v1/vendors/{vendor_id}/skus` has returned **`417`** while approval is `PENDING`. Step 6 stays read-only for submitted pending vendors; real `approval_status: APPROVED` reopens size additions within plan limits. Categories/products remain additive in either case. The dashboard's temporary approval coercion is not used here. See [Step 6 behavior](./API_ARCHITECTURE.md#vendor-setup-sizes-step-6). |
| Activation inconsistent with onboarding | Resuming an account activated or approved before setup finishes | A September 2026 supplied context reports `ACTIVE`/`APPROVED` with `IN_PROGRESS` and `next_step: 7` after manual database changes. The frontend honors explicit onboarding progress; activation and approval cannot skip remaining steps. Backend writes should preserve that invariant and document the precedence for conflicting fields. See [entry routing](./SESSION.md#where-a-session-lands). |
| Legacy SKU unit vocabulary | Keeping existing real-account sizes aligned with the backend measurement catalog | New writes use the backend's units, but this work does not migrate SKUs already written with the frontend's old unit vocabulary. Detailed below. |
| Unimplemented shipping strategies | Flat / tiered / weight-based delivery pricing | `FLAT`, `ZIPCODE_TIERED` and `WEIGHT_BASED` are in the enum (and `FLAT` even has a documented example) but return `No validator registered for shipping strategy type`. Only `ORDER_AMOUNT_THRESHOLD` and `ZIPCODE_THRESHOLD` work. A flat charge is expressed as `ORDER_AMOUNT_THRESHOLD` with a zero threshold. |
| Unvalidated `scheduling_config` | Trusting the delivery schedule a vendor configures | The backend stores `scheduling_config` **verbatim without validation** — even `{}` is accepted. `FIXED_WINDOW` and `CUSTOMER_SELECT_DATE` keys come from documented examples; `PREDEFINED_DAYS` and `INSTANT` keys are our own snake_case and no consumer contract confirms them. |

### Vendor platform billing

**Requested 18 September 2026; revised 19 September for the approved hybrid trial. Backend contract
unimplemented.** Scope and agreed product rules are
owned by [the billing decision record](./VENDOR_BILLING_DECISIONS.md). The frontend
[development preview](./VENDOR_BILLING_PREVIEW.md) is a temporary integration seam, not an approved
production workaround. Remove that seam from any production path only after authenticated backend
operations and verified provider reconciliation exist. The hybrid is approved; remaining product
choices are explicitly tracked in the decision record, not inferred from this proposed contract.

**Contract recheck, 19 September 2026:** a fresh public `/api/v3/api-docs` read succeeded with
118 paths, matching the checked-in path set. No platform-billing operations are present. This
resolves the earlier retrieval failure, not the missing implementation; generated files were not
changed by the review. Re-fetch and regenerate when the backend publishes billing.

**Latest alignment, 24 September 2026:** the backend now returns and documents a lifecycle shape
(`subscription.lifecycle_status`, `trial`, `plan`, `available_paid_plans`, top-level `features`) and
says go-live starts a 14-day trial. The frontend adopts that shape rather than the 19 September
`subscription.billing` proposal; the context mapper already reads its plan name, currency, trial
end and features. The [aligned request](./VENDOR_BILLING_BACKEND_HANDOFF.md) lists what it still
lacks: `onboarding.next_step` in the OpenAPI example, rupee prices (a live plan returned
`sale_price: 2.99` for ₹299), a timezone on the envelope `timestamp`, a monotonic `updated_at`,
`days_remaining` rounded up (a fresh 14-day trial returns `13`), access flags, allowed actions,
payment/cancellation/refund state and the billing writes. It was raised on the backend Jira stories
MFPS-64 and MFPS-67 on 24 September. Usage is no longer requested. Store slugs remain opaque.

#### Existing context discrepancies

- The lifecycle shape now persists a trial (`trial.started_at`/`ends_at`) instead of the earlier
  `trial_days: 0` and legacy `FREE`/zero-price fields. Still do not infer a trial from first login
  or a browser timestamp; persist the one-time trial against the verified vendor identity.
- The current product allows one store per vendor. Keep ownership validation on billing operations;
  it protects against cross-vendor access and does not imply a multi-store product or trial transfer.
- The checked-in contract, onboarding gate and ADR 0002 use `approval_status: APPROVED`;
  `ACTIVE` belongs to `vendor_status`. The fresh public contract confirms both enums. Earlier
  `approval_status: ACTIVE` wording is corrected to genuine `APPROVED`; no enum rename is requested.
  A manually adjusted test account does not establish general approval/trial-grant behavior.
- Trial creation must atomically establish that both onboarding completion and genuine approval
  have occurred, then claim the identity's one-time grant. Either event alone is insufficient;
  approval arriving after Step 10 must not consume the trial while the store waits. The console's
  temporary `PENDING` approval coercion is not evidence of approval for billing.
  Store approval, billing access, visibility and accepting new orders are different decisions;
  a paid membership must not bypass rejection/suspension or incomplete onboarding.
- Existing `/v1/api/subscription-plans` defines delivery frequency/mode (`SubscriptionPlanDTO`),
  not a Razorpay platform-fee plan. Do not repurpose that master or customer `/subs` reads.

#### Operations the backend must define in OpenAPI

These are **capabilities and proposed additions**, not invented routes. Reuse the existing
`GET /v1/vendors/{vendor_id}/context` read. Backend owns the three missing write contracts and
server jobs; the frontend currently has no real billing writes.

| Operation | Required behavior and result |
|---|---|
| Extend vendor context for billing/access | Authenticate ownership; return the minimal `subscription.billing` state alongside existing plan/expiry/features. Reuse envelope timestamp with explicit timezone and include a billing revision. Fresh reads must expose reconciled progress after lost callbacks/cancellation responses; no separate billing-status endpoint. |
| Prepare Checkout for an explicit intent | Accept the selected store, requested setup/payment action and an application idempotency key; validate ownership and allowed action. During trial, schedule the first monthly fee for its persisted expiry; after expiry, prepare immediate first-fee collection. Choose plan/amount/currency/mode/count/schedule server-side, limit methods to those validated for that phase, and reconcile any existing subscription first. Return the minimal preparation payload in the handoff; merchant display text is static app configuration. Never trust a browser price, plan, trial duration, clock or subscription ID. |
| Submit Checkout result for verification | Accept attempt ID and the three Razorpay callback fields. Resolve expected store/subscription from the authenticated attempt; verify/reconcile and acknowledge receipt. Frontend refreshes vendor context for pending/confirmed state; acknowledgement alone must not imply paid access. |
| Request cancellation and read its outcome | Authenticate ownership, record/deduplicate receipt and stop future collection while retaining existing coverage. Acknowledge the write; requested/scheduled/confirmed/failed progress and refund state return through refreshed vendor context. Reconcile timeouts/concurrent charges; request receipt alone does not prove cancellation. A Razorpay subscription read does not show an accepted cycle-end stop (`charge_at` unchanged, `has_scheduled_changes` false; [Test Mode observation, 23 September 2026](./VENDOR_BILLING_PREVIEW.md#plan-test-mode-evidence--23-september-2026)), so the backend must persist the accepted cancellation itself or reconcile it from webhooks. |
| Reconcile and refund a debit despite timely cancellation | Persist the authenticated cancellation's backend receipt time and original access boundary. If the request preceded that boundary but the next monthly fee was collected, record a full-refund obligation against that charge and reconcile refund progress idempotently. Return pending/completed/failed outcomes separately from cancellation and access; no instant-refund guarantee. Backend must define the refund contract and operational recovery. |
| Provider webhook ingress | Validate raw-body signature with a separate webhook secret; durably receive, deduplicate and reconcile events to the same billing records used by callback verification. This is not a browser redirect endpoint. |
| Trial grant, expiry and reminder jobs | Atomically claim the identity's trial once onboarding and approval both qualify; persist the original start/expiry. Enforce the access boundary without grace, using server time even with no browser session. Deduplicate reminders; distinguish setup needed, confirmed future billing and cancellation. Channels/times await product decisions. |
| Recover an interrupted billing attempt or rejoin after cancellation | Reconcile created, authenticated, charge-pending, expired and cancelled provider objects before retry/replacement. Rejoining during retained trial/paid coverage is allowed at that same expiry, without a new trial or duplicate fee. Setup crossing expiry must not silently change the schedule or leave two debit-capable subscriptions. |

Backend should return meaningful ownership/eligibility errors, already-subscribed/conflicting-attempt
results, expired/consumed-subscription reasons, pending verification and retry guidance. Retrying
preparation must retrieve/reconcile the same logical attempt rather than create another chargeable
subscription. Concurrent tabs, duplicate requests and timeouts require a per-store constraint/lock;
do not assume the provider creation API implements MithraDirect's idempotency policy.

#### Proposed status data

The [backend meeting handoff](./VENDOR_BILLING_BACKEND_HANDOFF.md#add-only-this-billing-information)
owns the field-level proposal, operation inputs/outputs, error contract and
[fabricated responses](./examples/vendor-billing/mock-responses.json). These replace the earlier
illustrative status object here so the two proposals cannot drift. The user authorised fabricated
missing data for frontend implementation and tests on 19 September. The current vendor context
shape is supplied; only its billing extension and the three write contracts remain missing.

The mapper, mock/demo service, panel and mock-backed route wiring can proceed against these
responses. Keep the fabricated shape explicitly proposed, separate from generated declarations.
Do not call invented URLs or treat mock verification/refunds/access as real. The
[architecture owner](./API_ARCHITECTURE.md#vendor-platform-billing-preview) defines selection,
isolation and the condition for replacing fabricated wire data with real response fixtures.

Reuse context identity, onboarding, plan prices in rupees, trial expiry, features and timestamp.
The billing block adds only independent trial/AutoPay/latest-payment status, paid-through/next-charge
dates, access/visibility/actions, cancellation receipt/stop, refund summary, notice and revision.
Provider IDs, period/charge/refund history and reconciliation details remain server-side. Provider
`active` alone is insufficient. Backend enforces discovery, direct storefront access, new orders
and stale carts while preserving existing-order fulfilment. The feature list's effective meanings
must be documented; today's unexplained list is not permission to add frontend route gates.

#### Provider verification and reconciliation requirements

Use the [current official-source research](./research/razorpay-vendor-subscriptions.md) for exact
provider fields and restrictions. At minimum:

1. Keep API and webhook secrets exclusively server-side; isolate Test/Live keys, records and events.
2. Bind attempts to verified vendor identity and selected store. Derive the subscription ID from
   the persisted attempt, then verify Checkout HMAC-SHA256 over `payment_id|subscription_id` using
   a constant-time comparison. Do not copy the one-time Orders signature formula.
3. Fetch/reconcile the payment, subscription and invoice. Verify relationships, mode, known plan,
   INR amount, actual capture/settlement as appropriate to the method, and that this is the first
   **platform-fee charge**, not a refundable authorisation transaction. Confirmed authorisation
   records permission for the scheduled charge; it neither grants the platform trial nor
   establishes paid access. Verify future billing matches the original trial expiry and has no
   unintended upfront platform-fee add-on.
4. Verify webhook HMAC over the exact raw bytes; deduplicate event IDs and application transitions.
   Handle duplicates, out-of-order events and callback/webhook races without extending a paid period
   twice or resurrecting an obsolete subscription. Persist events before acknowledging them and
   reconcile delayed/missing callbacks with provider reads/jobs.
5. Preserve the trial through its original expiry, including after successful optional setup or
   pre-start cancellation. Establish paid membership from confirmed platform-fee coverage. A fee
   charged earlier than the promised date is a discrepancy to reconcile, not permission to
   forfeit trial days. After unpaid expiry, immediate signup requires confirmed payment before
   restored access. There is no grace for an authorised but delayed/failed first or renewal charge:
   full service stops at the end of trial/confirmed paid coverage, with existing-order fulfillment
   and payment recovery retained. Browser pending state cannot grant an extension.
6. Track recurring charged/pending/halted/cancelled/completed/paused/resumed/updated states separately
   from entitlement. Failed renewal or cancellation must not erase a period already paid for.
   Cancellation confirmation must not be undone by an old authenticated/active webhook. A real
   charge arriving after cancellation still requires reconciliation, rather than being discarded
   as stale. A next-period fee collected despite a timely cancellation must be refunded in full
   without extending access. Ordinary cancellation retains paid coverage without automatic
   proration. Other refund cases remain open.
7. A successful retry of a scheduled first/renewal fee restores only the remainder of its original
   billing cycle. Reconcile the charge's invoice/period rather than calculating a new month from
   callback or retry time. Do not append interrupted days or extend coverage twice; a stale
   successful charge for a period already ended cannot grant current access.

#### Cancellation and concurrent operations

Before the first billing cycle, Razorpay requires immediate cancellation; cycle-end cancellation
is invalid without a cycle. Within a paid cycle, cycle-end cancellation is the documented primitive
for stopping renewal while completing that cycle. A scheduled cancellation can leave the provider
status `active` until the boundary; expose the confirmed schedule to the UI separately from the
eventual terminal state. See [provider cancellation evidence](./research/razorpay-vendor-subscriptions.md#cancellation-and-retained-access).

Serialize setup, cancellation, replacement and charge reconciliation per store. Repeated clicks,
multiple tabs, delayed callbacks and worker retries must converge on the same operation. On a
provider timeout, read/reconcile the outcome before retrying or creating a replacement. Preserve
the trial/paid-through date while cancellation is pending; show the pending/error state and a
recovery action rather than asserting that billing stopped.

Rejoining before retained access ends is approved. The existing trial or paid-period end remains
the intended new charge date; a cancelled provider subscription cannot simply be restarted.
Do not make a replacement chargeable while the old subscription's
collection status is uncertain. The provider API does not establish a rollback guarantee for an
already-submitted debit. Reconcile final-cycle completion instead of assuming cycle-end
cancellation is always accepted. Provider cancellation is not a refund operation.

The approved cutoff is the **MithraDirect backend's receipt time**, recorded durably with the
original trial/paid-period boundary before acknowledging the cancellation. If receipt precedes
that boundary, later provider confirmation must not disqualify the vendor from a full refund of
an unintended next monthly fee. Use neither the browser's clock nor webhook arrival order as the
cutoff. Link the refund obligation to the actual collected charge and deduplicate processing;
lost responses and duplicate events must not trigger duplicate refunds.

Preserve only the original trial/paid coverage while the refund is pending, completed or failed;
continue recovery for a failed refund without silently abandoning the obligation. Report request
receipt, provider cancellation progress and refund progress separately. Method-specific refund
execution, reconciliation and recovery still require a backend contract and safe test evidence.

#### Trial ownership and reminder orchestration

The backend grants the eligible identity's trial after completed onboarding and approval, without
Checkout or a mandate. Optional setup during that entitlement prepares future billing at its
original expiry. With ten days left, preserve those ten days; do not create another fourteen-day
provider trial or collect the monthly fee immediately. After expiry, explicit signup prepares an
immediate first fee. Never automatically open Checkout at registration or move dates in React.

Compute this choice from server time at preparation and reconcile it again when the provider
outcome arrives. A browser opened before expiry can return after it. Reconcile an existing
authenticated/pending subscription before offering a new immediate-start one. Show a changed
payment schedule and obtain the vendor's explicit agreement before a replacement Checkout.
Payment methods must be validated for the required dates: a future `start_at` alone does not
guarantee the exact debit/confirmation time for every method.

Current development is scoped to **Test cards**, with eMandate excluded and UPI deferred; the
[decision record](./VENDOR_BILLING_DECISIONS.md#current-test-mode-method-scope) owns the rationale.
Use the existing account's Subscriptions settings and verify the hosted method set, immediate
signup and future-start authorisation. No custom method selector or all-method matrix is needed
for this iteration. Existing Test observations do not establish production bank behavior. Before
production launch, validate the intended methods' timing and enforce that set in Checkout.

Backend should schedule the proposed three-days-left and last-day reminders from the persisted
expiry, with idempotent delivery. Suppress setup-needed wording after confirmed AutoPay setup;
scheduled-debit and cancelled/no-renewal messages require their own approved rules. Exact delivery
times, timezone, offsets and channels (in-app/WhatsApp/email/SMS) need approval. Provider lifecycle
and pre-debit notices do not establish these MithraDirect trial reminders. The preview only
displays example reminder states and sends no notifications.

#### Backend acceptance evidence before production wiring

- Completion without approval, approval with incomplete setup and the console's approval coercion
  never grant a trial. The eligible grant happens once when both backend facts are true, including
  delayed approval; duplicate events, attempted duplicate store records or a second browser cannot
  create another identity trial. Trial time cannot transfer to a different store.
- Unauthorized cross-store reads/preparations/verifications fail without exposing billing records.
- Signature tampering, a valid callback for another store/attempt, wrong plan/mode/currency and a
  token-authorisation amount cannot grant paid access.
- Successful, failed, dismissed or unconfirmed setup with ten trial days left preserves that expiry.
  The monthly fee is scheduled for that expiry, with no upfront platform-fee add-on. A webhook
  arriving before, after or without the browser callback produces the same final entitlement once.
- At unpaid expiry without AutoPay, server reads/writes enforce hiding and blocked new orders while
  existing fulfillment remains possible. Existing pending carts cannot bypass billing policy.
  Signup then collects a full first monthly fee and restores access only after confirmation.
- Cancelling a future subscription before trial expiry prevents its first monthly fee and retains
  the exact original trial. Cancelling a paid membership retains its paid-through date and stops
  subsequent renewal. Pending/failed cancellation is distinguishable from confirmed cancellation.
- Setup straddling expiry, duplicate tabs, cancellation/charge races, lost responses and delayed
  webhooks never reset the trial, extend paid coverage twice or leave duplicate debit-capable
  subscriptions. Reconciliation must still account for money collected in a race.
- A cancellation received before the original trial/paid boundary qualifies for a full refund of
  an unintended next fee even when provider cancellation confirms later. A charge arriving before
  or after that confirmation produces the same refund obligation once; duplicate events and lost
  refund responses cannot cause duplicate refunds. Pending/failed refunds do not extend coverage.
- Test confirmed scheduled cancellation while provider status remains active, terminal cancellation,
  final-cycle completion and rejoining before trial/paid expiry with the original boundary preserved.
- Reconcile mandate revocation outside MithraDirect without losing retained trial/paid coverage.
  A trial with no provider subscription has no renewal to cancel; retrying an already-completed
  cancellation must not create new billing or change entitlement dates.
- First-charge/renewal failures, delayed confirmations, near-expiry setup, method-specific token
  transactions and debit dates are measured separately from access. Confirm no-grace expiry and
  retained existing-order fulfillment and the timely-cancellation refund rule.
- A retry succeeding two days into the original cycle restores only its remaining time and keeps
  its original renewal date. Duplicate charge events cannot add another period. Ordinary paid
  cancellation retains that cycle without an automatic prorated refund.
- Only methods proven to meet timing requirements are offered for the corresponding phase;
  unsupported methods cannot bypass that restriction through another Checkout entry point.
  Validate remaining refund/reminder policies once decided, then run controlled production acceptance.

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
Both steps also carry a notice before anything is saved, saying a saved choice cannot be removed.
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
confirmed or infer a SKU ID. Plan-limit checks include the usage omitted from the list.

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
