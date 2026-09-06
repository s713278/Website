# Vendor console — backend asks

What the target vendor console needs from the backend, ranked by product consequence.

**Cross-checked 6 September 2026.** This revision corrects the original 5 September probe report
using current development-API checks, the deployed OpenAPI document and current frontend source.
The [claim audit](./VENDOR_CONSOLE_CLAIM_AUDIT.md) records every dashboard-relevant verdict and its
limits. The [discussion brief](./VENDOR_CONSOLE_BACKEND_BRIEF.md) explains what to present.
[API_GAPS.md](./API_GAPS.md) remains the broader contract tracker; some older entries there predate
this audit and must not be used as independent confirmation of these claims.

This document owns the **asks and target console**, not a claim that all proposed behavior is
implemented. Original item numbers remain stable, including withdrawn blockers. The current
development contract contains 118 paths; the checked-in snapshot contains 117.

## How to read the tiers

| Tier | Means |
|---|---|
| **1 — Core workflow dependency** | A required capability needs a working contract. An alternative or corrected test can narrow or remove the original blocker. |
| **2 — Visible compromise or contract clarification** | A usable fallback exists, or semantics need agreement before the UI can make a reliable promise. |
| **3 — Domain follow-up** | A model or validation question; not automatically a confirmed defect. |

## The console being built

**Target design.** Six surfaces, with Subscriptions inside Orders. Desktop navigation carries all
six; mobile carries five, with Settings reached through the account menu. Current navigation has
five entries; Customers and customer-subscription views are not integrated yet.

| Surface | Target job | Current dependency or qualification |
|---|---|---|
| **Overview** | Setup path while setting up; work queue, status counts and plan usage while open; explanatory state screen for under-review, rejected or suspended stores | Reliable period money definitions are missing. Current Overview still has KPI tiles and displays dues/customer counts; the proposed queue and delivery-window sum are not implemented |
| **Orders** | Advance one step; cancel; identify customers by mobile contact action; label operational dates “Delivery date” | Current advance and mark-paid actions call failing PATCH. Full `/items` detail is already integrated. List mobile/contact support and date controls still need frontend work |
| **Products** | Edit prices; assign products; add/remove sizes; offer safe availability management | Current dashboard edits prices. SKU updates fail when features is omitted; broader claims of impossible updates must be narrowed to the audit evidence |
| **Customers** | List and invite by WhatsApp; omit bulk spreadsheet import from daily work | Empty owner-self-order test data does not establish a broken customer list. Agree active-relationship semantics and implement the screen |
| **Subscriptions** | Read-only list and detail inside Orders | Treat the subscription model as a black box. Its creation, lifecycle and plan rules are outside this review |
| **Storefront / Settings** | Maintain store information and checkout options | Profile name changes now work on the tested account. Revisit the earlier read-only restriction. Current Settings has no profile or checkout editor; checkout writes exist in setup |

Two target decisions still stand:

- **Money labels must match their basis.** A delivery-window total can be labelled “Orders
  delivering this week”; it cannot stand in for orders placed this week. The target period gross
  order value, collected and outstanding figures need separate definitions. This proposed Overview
  metric is not yet implemented, and unreliable dues are still visible today.
- **Demo should match supported live behavior.** Current fixtures contain fields missing from the
  sampled live list, and demo writes are no-ops. A successful demo is insufficient integration evidence.

## Tier 1 — Core workflow dependencies and corrected blockers

### 1.1 Vendor-list placed-at data and date-basis selection are missing

**Need.** Reliably populated order-placed time and an explicit choice of date basis for filtering.

**Blocked.** Booking-period reporting and a placed-date filter. Delivery-date filtering and
delivery-window totals remain possible.

**Evidence.** Current vendor-list probes contain no creation/placement timestamp. Filtered results
align with delivery dates. `OrderDTO.order_date` exists in the schema but was absent from sampled
full detail; declaration alone does not supply usable data. No date-basis selector is documented.

**Ask.** Populate and document placed-at, timezone and date boundaries, then agree period aggregate
and payment definitions. This is a high-value reporting dependency, not a blocker for every money
display or every date filter.

### 1.2 Per-order PATCH fails on tested update shapes

**Need.** A supported, reliable delivery-status and payment-status update.

**Blocked.** Current advance and mark-paid controls depend on this route. Status advancement has
a reported bulk-route alternative; payment recording still needs a verified supported write.

**Evidence.** Empty, delivery-status and payment-status requests to
`PATCH /v1/vendors/{v}/orders/{id}` return HTTP 417, envelope status 500, identifying
`OrderUpdateRequest`. An existing-order same-value payment write and nonexistent-ID requests fail
alike. This supports a deserialization defect; it does not prove every backend payment process fails.

**Ask.** Repair the update or explicitly support alternatives. The proposed single-order bulk
status action uses `POST /v1/vendors/{v}/orders/bulk-status-update`; it is not yet wired into the
app-facing service. Document transitions and per-order failures. Do not claim dues can only grow.

### 1.3 SKU partial updates fail when `features` is omitted

**Need.** Reliable updates to an existing size's name, description and active flag.

**Evidence.** A bare name update and same-value active-flag update reproduce HTTP 417 with a
JDBC/features error. Supplying `features: {}` on an isolated test SKU allowed disabling, re-enabling
and renaming it with HTTP 200. Each value persisted after reread. The test used an unsubmitted
store and the disposable size was removed. The claim that availability editing is impossible is
therefore withdrawn; customer purchasing enforcement and other approval states remain unverified.

**Ask.** Make the documented partial-update behavior work: omitted fields must remain unchanged.
Any client workaround must preserve existing feature data. A reversible active flag is a smaller
requirement than full inventory management; no stock-on-hand model or inventory-adjustment API was
found. Verify purchasing enforcement before describing an availability control as complete.

### 1.4 Profile-wide blocker withdrawn

**Evidence.** Valid `PUT /v1/vendors/{id}` bodies with existing category assignments return 200 on
both probe accounts. A changed business name persisted on the unsubmitted account and was restored
successfully. The earlier “dead for every body” claim is false today.

**Next step.** Integrate the intended editor and verify address/contact changes and relevant approval
states. Those were not exhaustively exercised. A separate storefront-configuration write also
exists. Read-only frontend Settings is not proof that profile writes are unavailable.

### 1.5 Customer-list blocker not established

**Evidence.** The current probe has nine orders, all placed by the owner, dashboard customer count
one and zero customer-list rows. `GET /v1/vendors/{id}/customers` explicitly selects active
vendor–customer relationships; it does not promise all distinct purchasers.

**Ask.** Define which actions establish a customer relationship, whether owner self-orders belong
in counts, and whether directory/count populations should agree. Verify with a distinct customer
known to have an active relationship. The current probe does not prove an eligible customer is missing.

### 1.6 Order-detail blocker withdrawn

**Evidence.** The contract explicitly describes `GET /v1/vendors/{v}/orders/{id}` as a header read
and directs clients to `/items`. The current frontend already uses `/items`; a tested multi-item
order returned both lines and reconciled after delivery charges.

**Next step.** Retain the complete read. Backend can clarify legacy item-looking fields on the
header response, but those fields do not block the currently integrated detail screen. Item sums
need not equal the final amount before delivery charges and other documented adjustments.

## Tier 2 — Visible compromises and contract clarification

| # | Finding | Dashboard consequence and ask |
|---|---|---|
| **2.1** | Sampled order-list rows have mobile, no customer name | Implement the proposed contact identity in the frontend. Customer fields exist on full detail; request list enrichment if names are required without per-order reads |
| **2.2** | No dedicated documented period vendor sales/revenue aggregate found among 118 paths | Agree period order-value, collected and outstanding definitions. A complete delivery-window sum is a limited fallback, not sales booked in that period |
| **2.3** | Dues include cancelled/DUE orders in the complete tested dataset | Backend due amount 840 includes 160 from cancelled orders; non-cancelled DUE orders total 680. Agree cancellation rules and correct the metric. Frontend should hide the unreliable figure, which is still visible today |
| **2.4** | Zero-valued status keys are omitted | Prefer all keys with explicit zeros. Current Overview already includes scheduled orders and defaults absent counts to zero; the report's blank pending tile was hypothetical |
| **2.5** | Owner-only purchases accompany customer count one | The counted population is undefined; do not infer a universal count bug from this case. The directory uses active relationships. Clarify the intended business metric |
| **2.6** | Optional delivery fields vary across current order rows | Document required and optional order-read fields. Earlier `grass_amount`/`-null` observations were not reproduced on the sampled current vendor list; retain them as historical evidence needing a specific response reproduction |
| **2.7** | Price read and write expose different fields | Current narrow client body works. Clear writable-field documentation is sufficient; accepting and ignoring read-only fields is optional, not a dashboard prerequisite |
| **2.8** | Complete vendor transition graph is missing | Document legal next states and useful errors. Current bad-field input returns 400, not the earlier reported 500; bulk HTTP 200 can still mean every order failed |
| **2.9** | Approval-dependent catalog actions need a state matrix | ACTIVE/PENDING means submitted but unapproved. The two historical states do not establish an inverted gate. Current setup blocks size editing after submission; the dashboard has no add-size control yet |

### Price identifiers and writable fields

`GET /v1/sku/price/{sku_id}` reads by **SKU ID**; `PUT /v1/sku/price/{price_id}` writes by **price ID**.
The read carries `price_id`, `sku_id`, `list_price`, `sale_price`, `shipping_price`, `effective_date`.
The declared write uses `{sku_id, list_price, sale_price}`. Current extra-field requests return 400;
the narrow same-price write returns 200. Separate read and write DTOs are valid API design.

### Status-write contract

Use the declared vendor-scoped bulk route with `{order_ids, new_status}`. No unscoped bulk route is
declared. Sending `order_status` instead of `new_status` now returns 400. A nonexistent order with
the correct body returns HTTP 200, `success_count: 0` and `failed_orders`; the client must inspect
the result. Successful real transitions were not repeated in this audit.

Earlier probes recorded `PENDING → SCHEDULED → IN_PROCESS → SHIPPED → DELIVERED`. Confirm the full
vendor graph before implementing it. Some individual customer/tracking transitions are documented;
the claim that all transition behavior is undocumented was too broad. Dedicated cancellation is separate.

## Tier 3 — Domain follow-up

- **Staff capabilities.** OTP registration uses `user_role: VENDOR` or USER; OWNER is a store
  membership/context role. Current frontend sessions retain verified `roles[]` and `vendors[]`,
  and route guards use verified roles. Multiple roles are supported. Granular staff permissions
  remain a valid question for the intended owner-operated console.
- **Customer paging claim withdrawn.** Use `page_number` and `page_size`. Live `page_size=5`
  returns 5; `size=5` is not a declared parameter and leaves the default 10.
- **Subscription-related SKU reference validation** is parked with the black-box model. Earlier
  unknown-plan observations are not a freshly confirmed vendor-dashboard blocker.

## Authorization boundary — for separate escalation

**Give this to a backend security owner.** Controlled checks used two distinct vendor identities,
VENDOR/USER roles without ADMIN, and no listed membership of the other store. No cross-vendor
write was attempted.

- The other controlled vendor's **order list returned 200 with nonempty order data**. The earlier
  blanket statement that orders enforce 403 is withdrawn.
- The other controlled vendor's **subscription list returned 200 with nonempty data**, superseding
  the earlier empty result. This is a read-isolation finding; subscription internals remain a black box.
- Cross-vendor price reads returned 200, while anonymous price reads returned 401. Confirm whether
  authenticated cross-store price reads are intended.
- SKU catalog listing also returns 200 anonymously and declares no bearer requirement. Public
  merchandising data is not by itself an authorization flaw.
- Price PUT has no vendor ID in its path, but ownership can be resolved from price ID. That path
  shape does not prove a write vulnerability.

Prioritize ownership-policy review and tests for protected order/subscription reads. The audit
records the scope; no claim about all detail/write routes is made.

## Out of scope: subscriptions remain a black box

The console may list and read the detail of subscriptions provided by the backend. Plan assignment,
frequency, fixed-day validation, creation, pause/resume, cancellation, quantity changes and
order-generation semantics belong to separate work. Earlier observations about these internals
are not dashboard blockers and were not revalidated here.

## Frontend defects — ours, not asks

These are source-confirmed integration issues, not independent proof of a backend defect.

| Where | Finding |
|---|---|
| `src/shared/api/mappers/vendor-dashboard.ts:110` | Reads customer_name; sampled list rows carry mobile. Add separate contact-identity support rather than treating a phone number as a name |
| `src/shared/api/mappers/vendor-dashboard.ts:111` | Ignores flat amount. Existing fallbacks are order_amount.amount, total_amount and total; sampled live list totals therefore map to null |
| `src/shared/api/mappers/vendor-dashboard.ts:114` | Placed-at is null on sampled rows. The schema declares order_date, but sampled reads omit it; pages do not currently display placedAt |
| `src/shared/api/services/vendor-orders.service.ts:89` | Advance and mark-paid still call the failing PATCH; bulk is not integrated |
| `src/modules/vendor/lib/order-actions.ts:13` | PENDING maps directly to IN_PROCESS, skipping the historically observed SCHEDULED step; align with the confirmed graph |
| `src/modules/vendor/pages/VendorOverviewPage.tsx` | Still shows dues/customer tiles; the proposed hidden metrics and work queue are not implemented |
| `src/modules/vendor/pages/VendorSettingsPage.tsx` | Has no profile or checkout editor; do not claim checkout editing already ships here |

Demo and live lists share a mapper, but demo fixtures supply customer_name, created_date and
nested order_amount. They do not exercise the measured flat list shape. Demo writes also do not
persist changes and demo list dates are not filtered. These establish a coverage gap; they do not
prove the historical reason an earlier review missed it.
