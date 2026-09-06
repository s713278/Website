# Vendor console claim audit — 6 September 2026

Cross-check of [the backend asks](./VENDOR_CONSOLE_BACKEND_ASKS.md) and
[the presentation brief](./VENDOR_CONSOLE_BACKEND_BRIEF.md). Claim numbers below retain the
original report's numbering, including claims that are withdrawn.

The original report overstates the number of backend blockers. Order-update failures and
untrustworthy dues are reproducible. Booking-date reporting remains a contract gap. Several
other claims confuse a frontend omission, an incorrect request, an intended API boundary, or a
limited test case with an unavailable backend capability.

## Re-probe corrections — 6 September 2026

Before building against this audit, its four load-bearing capabilities were re-run on **both**
approval states, rather than only on the never-submitted store. Rows marked **[re-probed]** below
carry the corrected result. Five corrections matter enough to state up front:

1. **`features: {}` destroys data.** Claim 1.3's recommended workaround overwrites any existing
   feature map. The safe recipe is read-modify-write: `GET` the SKU, then send
   `features: sku.features ?? null`. `getSkuInfo` does return `features` once it is non-null.
2. **The customer-paging withdrawal in Tier 3 was a misread.** `page_size=5` changes the *echoed*
   parameter, not a row count. Both probe vendors return zero rows for every parameter combination,
   and the 200 response is typed as the generic `APIResponseObject`, so no row schema is declared
   anywhere. Paging is neither proven nor disproven.
3. **Profile `PUT` is a partial merge that silently ignores `null`,** so an editor built on it
   cannot clear a field. `assign_categories`, although declared `required`, is not enforced.
4. **`PENDING → IN_PROCESS` is rejected by the backend.** `PENDING → SCHEDULED` is the required
   first hop. The "PENDING skips SCHEDULED" row below is no longer an open question — it is a
   confirmed live defect in shipped frontend code.
5. **`CANCELLED` is in the bulk `new_status` enum but unusable through it** (417, transaction
   rolled back). Cancellation must use the separate `PATCH …/{id}/cancel` route.

Two findings strengthened rather than corrected: `due_amount` rose 840 → 900 after one order was
created **and cancelled**, and never fell back — cancelled orders inflate dues in real time. And
`order_status_count` gained `shipped_count` then lost it again within one session, proving sparse
keys in both directions.

## Evidence and limits

- **Live checks:** direct requests to the development API on 6 September 2026 using the two
  existing designated probe accounts. Identity responses and token roles were checked: `VENDOR`
  and `USER`, without `ADMIN`. No credentials or customer records are reproduced here.
- **Contract:** freshly downloaded [development OpenAPI](https://subscriptionapp-wgf8.onrender.com/api/v3/api-docs),
  **118 paths / 155 operations**. The checked-in snapshot has 117 / 154. The added path is the
  public storefront-products read. Relevant customer pagination, order header/detail separation,
  and price DTO distinctions already exist in the checked-in snapshot.
- **Source:** working tree at `e65dede613bfd666810c496e89a15b1ad77783d6`. Application source was
  inspected, not changed. Source evidence establishes current integration, not successful UI
  execution. Existing local changes were preserved.
- **Scope:** no customer invitations, new orders, payment settlement, cancellation, or cross-vendor
  writes. Controlled profile changes were restored. Disposable SKU tests verified activation and renaming;
  these test sizes were removed. Customer purchasing while inactive was not exercised. Backend
  implementation source and a deployed
  build identifier were unavailable; runtime observations are bounded to the requests tested.
- **Snapshot digest:** SHA-256
  `5df4e8ef6f9d0dcdb6c160d44a263f0392717ad73482374b92090eb75c27e017`.

“Confirmed” below means the stated narrow observation was reproduced, not that every account,
payload or possible route behaves identically. Generic response schemas cannot prove runtime
field absence, and optional schema fields do not guarantee populated values.

## Tier 1 claims

| ID | Original blocker | Verdict and evidence | Correct implication |
|---|---|---|---|
| **1.1** | No creation timestamp; all money/reporting/date filtering blocked | **Partly confirmed; scope overstated.** The complete nine-order probe list has no placed/created timestamp. Sampled full detail also omits it. `getOrdersByVendor` has start/end dates but no date-basis selector. Live filtered results align with delivery dates. However, `OrderDTO.order_date` is a declared optional date-time field, so “nowhere in the contract” is false. | Request a reliably populated placed-at field and explicit filtering semantics. Booking-period reporting is blocked; delivery filtering and delivery-window totals are possible. Adding the date alone does not define sales or collections. |
| **1.2** | Per-order PATCH dead; payment can never become paid; dues only grow | **Failure confirmed; universal consequences unsupported.** Existing-order same-payment-state PATCH and nonexistent-order PATCH with empty/payment/delivery bodies return HTTP 417, envelope status 500, identifying `OrderUpdateRequest`. | Current advance/mark-paid controls depend on this failing route. Repair it or document supported alternatives. A nonexistent-ID `PAID` probe proves the parsing failure, not successful payment settlement. No conclusion about every backend payment process or permanent monotonicity follows. |
| **1.3** **[re-probed]** | Every SKU PATCH fails; availability and rename impossible | **Partial-update defect confirmed; availability-impossible claim disproved.** Same-state is_active without features returns HTTP 417 with a JDBC error (`could not determine data type of parameter $5`). With `features` supplied, disable, re-enable and rename all return 200 and persist. **Re-probe: identical on the gone-live store — the approval gate does not affect this endpoint** (it still blocks SKU *creation*). **`features: {}` and `features: null` both write and destroy any prior map;** only an echoed value preserves it. | Fix omitted-feature handling: an omitted optional field must leave the column unchanged. Until then the only safe client recipe is read-modify-write — `GET` the SKU, send `features: sku.features ?? null` — and it belongs in the service layer so no page can get it wrong. Neither the paginated list read nor `fetchSkuDetails` carries SKU `features`, so the extra `GET` is unavoidable. Purchasing enforcement against an inactive SKU is still unverified. No stock-on-hand model was found; that is separate from availability. |
| **1.4** **[re-probed]** | Profile PUT dead; vendor cannot correct store name | **Withdrawn.** Valid bodies return 200 on both accounts, and the re-probe extends this to the **gone-live store**, to `contact_person`, `communication_email` and the structured `business_address` map — each persisted and reread. **Two corrections:** `assign_categories` is declared `required` but is **not enforced** (omitting it returns 200 and leaves assignments intact), and the write is a **partial merge that silently ignores explicit `null`**. | Build the editor, but design it around two facts the original verdict missed. It **cannot clear a field** — `null` is ignored and `""`/`{}` set an empty value rather than removing one, so a "clear" affordance must be disabled or blocked in validation. The success message is double-nested at `data.data`; reading `data` renders an object. A separate storefront-config write also exists. |
| **1.5** **[re-probed]** | Empty customer list proves Customers screen blocked | **Not established as a defect, but the screen is blocked for a different reason.** The probe has nine orders all under the owner's user ID, dashboard count 1, and zero customer-list entries. `getVendorCustomers` explicitly selects active vendor–customer relationships, not every purchaser. **Re-probe: both approval states return `total_elements: 0` and zero rows for every parameter combination, and the 200 response is typed as the generic `APIResponseObject` — the contract declares no row schema at all.** | Clarify the relationship and count definitions, and publish a row schema. There is currently **no shape to build a mapper against**, which is a stronger obstacle than missing data: a screen written today would be guessing at field names. Verify with a distinct customer known to have an active relationship. Inviting one would send real messages, so that was not done. The React Customers screen is not implemented. |
| **1.6** | Order detail drops items, blocking detail screen | **Withdrawn as a screen blocker.** `getOrdersById` explicitly documents a header read and directs clients to `/items`. The live header contains legacy per-item-looking fields, but no complete item-array promise. `/items` returns two lines, and React already calls it. Line totals 190 plus delivery 30 equal order total 220. | Continue using the existing full-detail read. Ask backend to remove ambiguity from the header fields if needed. Line totals need not equal the final amount before delivery, discounts and other documented adjustments. |

Order integration evidence: [service](../src/shared/api/services/vendor-orders.service.ts),
[mapper](../src/shared/api/mappers/vendor-dashboard.ts),
[detail page](../src/modules/vendor/pages/VendorOrderDetailPage.tsx).
Relevant OpenAPI operation IDs: `getOrdersByVendor`, `getOrdersById`, `getOrderItems`,
`updateOrder`, `updateSkuInfo`, `updateVendor`, `getVendorCustomers`.

## Tier 2 claims

| ID | Claim | Verdict and corrected consequence |
|---|---|---|
| **2.1** | No customer name on the order list | **Confirmed on sampled live rows.** They carry `mobile`; `/items` supplies customer fields. This is a list-enrichment gap, not absence across every read. Current summary types/mappers do not expose mobile and cards say “Customer”; the contact-action fallback still needs frontend implementation. |
| **2.2** | No revenue/sales aggregate in 117 paths | **Confirmed as a documented-contract gap, with count corrected to 118.** No dedicated period vendor sales/revenue operation was found. `dashboard` has no period parameter and live data contains counts and dues. Request defined period aggregates; do not describe all possible money displays as blocked. |
| **2.3** **[re-probed]** | Dues include cancelled orders | **Confirmed twice — by summation, then by live demonstration.** Due amount 840 equalled the sum of all DUE order amounts; cancelled/DUE orders contributed 160. **Re-probe: creating one order and then cancelling it raised `due_amount` from 840 to 900 — exactly that order's amount — and it never fell back.** Cancelled orders inflate dues in real time, and no route can set `payment_status` away from `DUE`. Agree cancellation and collection rules before labelling this “money owed.” The current Overview still displays the figure; hiding it is outstanding frontend work. |
| **2.4** **[re-probed]** | Zero keys omitted; AUTO_ACCEPT produces a blank tile | **Sparse counts confirmed in both directions; present blank-tile claim false.** **Re-probe: `shipped_count` appeared while an order sat at SHIPPED, then disappeared again once it was cancelled — within one session.** A consumer keyed on a status key reads `undefined`, not 0, whenever that status is empty. Current Overview sums pending, scheduled and in-process using `?? 0` and renders empty-state text, so no tile goes blank today. **AUTO_ACCEPT → SCHEDULED was freshly rerun: a new `from-cart` order on the gone-live probe arrives `SCHEDULED`, not `PENDING`.** Request stable count semantics with explicit zeros; keep auto-accepted work discoverable. |
| **2.5** | Customer count includes owner and contradicts directory | **Observed owner-only count; universal bug not established.** One owner ordering from their own store accompanies count 1. The directory selects a different documented relationship. Ask which population each metric should count and whether owner self-orders belong in the business metric. Current Overview does show the count. |
| **2.6** | Two creation paths produce malformed order rows | **Partly confirmed, partly historical.** Current list rows have varying optional delivery fields; timing metadata is absent on some rows. The `grass_amount` typo and `display_name` suffix were not reproduced on the sampled order list or own-vendor subscription list. Creating each flow was not repeated. Preserve these as dated observations requiring exact response evidence, not a defect affecting every cell. Cart ordering supports multiple timing modes, not always CUSTOMER_SELECT_DATE. |
| **2.7** | Price read fields rejected by write | **Confirmed behavior; not inherently a backend defect.** GET is keyed by **SKU ID**; PUT by **price ID**. Adding shipping_price or effective_date returns 400. The documented sku_id/list_price/sale_price body returns 200 with the current values. The frontend already builds that body. Request clear field ownership; accepting and ignoring read-only fields is optional, not a dashboard prerequisite. |
| **2.8** **[re-probed]** | Only bulk works; graph undocumented; bad fields return 500 | **Mixed; the graph is now measured.** Vendor-scoped bulk accepts the documented body. Sending `order_status` instead of `new_status` returns **400**, disproving the 500 claim. **Re-probe walked real transitions end to end: `PENDING → SCHEDULED → IN_PROCESS → SHIPPED` are each accepted, every skip, repeat and backward move is rejected, and `SHIPPED → DELIVERED` was left untested only because it would have made the throwaway order uncancellable.** **`CANCELLED` is in the declared enum but returns 417 / "transaction silently rolled back" through this route.** A rejected transition is **HTTP 200 with `success_count: 0`** and one generic `reason` for every illegal edge; a nonexistent id is distinguishable by its reason string. Malformed requests do return 400. The unscoped bulk path is absent from the contract. |
| **2.9** | Go-live gate inverted | **Not established.** The submitted probe is ACTIVE/PENDING; the unsubmitted probe is INACTIVE/PENDING. Neither is approved. Submission and approval are different axes. Historical rejection after submission is consistent with an approval gate. Verify the intended state matrix before alleging inversion. The current dashboard has no add-size control; setup disables size editing after submission. |

Source: [Overview and its zero handling](../src/modules/vendor/pages/VendorOverviewPage.tsx),
[Orders controls](../src/modules/vendor/pages/VendorOrdersPage.tsx),
[price write](../src/shared/api/services/vendor-products.service.ts),
[setup access rules](../src/modules/vendor/lib/onboarding-access.ts).
Contract IDs: `dashboard`, `bulkUpdateOrderStatus`, `fetchSkuPrice`, `updateSkuPrice`,
`goLive`, `updateApprovalStatus`.

## Tier 3 claims

| Claim | Verdict and action |
|---|---|
| OTP sends role OWNER and frontend understands only one role | **Incorrect.** OTP registration requests `user_role: VENDOR` or `USER`. OWNER is store membership/context, not that global role. Current sessions preserve `roles[]` and `vendors[]`; route authorization uses verified roles. Staff permissions remain a valid domain/design question, not proof that multiple verified roles are unsupported. |
| Customers ignores size, so paging is broken | **[re-probed] The withdrawal was correct about the request, wrong about the evidence.** The declared parameters are `mobile`, `page_number` and `page_size`; `size` is undeclared and correctly ignored, so the original probe was malformed. But **`page_size=5` changes the *echoed* `page_size` field, not a row count** — both probe vendors return `total_elements: 0` and zero rows under every combination tried. Paging is neither demonstrated nor disproven, and the earlier phrasing "page_size=5 returns 5" should not be repeated. |
| Unknown sub_plan_id is silently ignored | **Outside this dashboard audit.** This is a historical subscription-related validation observation. The model remains a black box; no invalid-plan test was run and no current blocker is asserted. |

Source: [OTP request and session mapping](../src/shared/api/services/auth.service.ts),
[route guard](../src/app/router/ProtectedRoute.tsx),
[user type](../src/shared/types/index.ts).
Contract: `MobileSignUpRequest`, `getVendorCustomers`, `createVendorSku`.

## Authorization claims

These require a separate backend/security review. Only the two designated controlled accounts
were used; no cross-account write was attempted.

| Claim | Current evidence and interpretation |
|---|---|
| Another vendor's SKU list is accessible | Anonymous read also returns 200. This catalog operation declares no bearer requirement. Public catalog visibility is not, by itself, an authorization flaw. |
| Another vendor's price is readable | Confirmed with the other controlled vendor's token. Anonymous price read returns 401. Correct the path label: the GET identifier is a SKU ID, not a price ID. Backend must decide whether authenticated catalog price reads are globally permitted. |
| Other-vendor subscriptions return 200-empty | **Outdated for this check.** The other controlled vendor's subscriptions returned 200 with five rows. The caller has only VENDOR/USER roles, the expected user identity, and no membership of that vendor in its verification response. This warrants ownership-policy review. |
| Orders enforce 403 correctly | **False as a blanket statement.** The other vendor's order **list** returned 200 with nine rows using the same caller. This does not establish the behavior of every detail/write operation, but it disproves protection across all orders endpoints. Prioritize this with the subscription read finding. |
| Price PUT has no vendor ID, implying missing ownership checks | The path shape is real; the inference is unsupported. Backend can resolve ownership from price_id. Cross-vendor write authorization remains untested. |

The public SKU operation and protected order/subscription operations must be reviewed under their
intended policies, not treated as equivalent simply because each contains a vendor identifier.

## Scope boundary: subscriptions remain a black box

Only vendor-dashboard claims are in scope. Subscriptions are read-only list/detail data supplied
by the backend. Plan assignment, frequency, scheduling, creation, lifecycle edits, quantity changes
and order generation were not exercised and are not assessed as dashboard blockers here. Earlier
reports about those internals remain parked with separate subscription work. The authorization
finding above concerns read isolation only.

## Frontend and presentation claims

| Claim | Source-based verdict |
|---|---|
| Flat order totals become null | **Confirmed for sampled live row shape.** Mapper accepts order_amount.amount, total_amount or total, but not flat amount. Backend already supplies the total; this is frontend work. |
| Customer name and placed-at are null | **Confirmed for sampled list shape.** Do not use mobile as a customer-name field; add contact identity support. placedAt currently has no visible page consumer. |
| Advance still uses the failing PATCH | **Confirmed.** Both advance and mark-paid use it. Bulk wrapper exists in the package but is not integrated into the app-facing flow. Cancellation is a separate operation. |
| PENDING skips SCHEDULED | **[re-probed] Confirmed as a live defect, no longer an open question.** `order-actions.ts:13` maps PENDING to IN_PROCESS, and the backend **rejects** that edge; `PENDING → SCHEDULED` is the only accepted first hop. Because a rejected transition returns HTTP 200, a vendor pressing advance on a PENDING order today gets a silent no-op. |
| Demo/live share a mapper and richer fixtures conceal missing fields | **Shared mapper and richer fixture fields confirmed.** Demo writes are also no-ops and demo list dates are not filtered. Source alone cannot prove the historical reason a review missed the discrepancy. |
| Six surfaces, work queue, hidden metrics, delivery-window total, contact links, checkout editing are shipped | **Incorrect as current-state claims.** These are target decisions. Current navigation has five entries; Customers and customer-subscription views are absent; Overview still has KPI tiles and shows dues/customer counts; Settings has no checkout editor; order pages have no date controls. |
| A sparse pending count makes the current tile blank | **Incorrect.** The current consumer already includes scheduled orders and defaults missing counts to zero, then displays empty-state text. |
| Order detail still needs /items integration | **Incorrect.** It is already the service's live read. The sampled multi-line response fits the current mapper. |

Source: [mapper](../src/shared/api/mappers/vendor-dashboard.ts),
[fixtures](../src/shared/api/fixtures/vendor-dashboard.ts),
[order actions](../src/modules/vendor/lib/order-actions.ts),
[navigation](../src/modules/vendor/components/VendorShell.tsx),
[Settings](../src/modules/vendor/pages/VendorSettingsPage.tsx).

## What to take to the senior developers

Lead with reproducible order-update failures, cancelled-order dues — now demonstrated live, 840 → 900
after a single create-and-cancel — missing booking-date reporting, and the controlled cross-account
order/subscription reads. Keep the SKU omitted-feature defect precise: availability and rename work
on both approval states **when `features` is echoed back**, and the earlier `features: {}` suggestion
would have destroyed vendor data. Ask for domain decisions on customer relationships, approval gates
and sales/payment definitions, and for a **published row schema** for the customer list — today the
contract declares none, so that screen has no shape to build against. Treat the profile endpoint,
complete `/items` read and narrow price-write contract as available capabilities, with the profile
editor designed around a write that cannot clear a field. Do not present customer pagination as a
verified capability; nothing about it has been demonstrated on nonempty data.

Frontend must implement and verify its missing controls and mappings in parallel. Backend fixes
alone will not turn the report's target console into the currently routed application.
