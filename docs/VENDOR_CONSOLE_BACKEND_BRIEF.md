# Vendor dashboard: backend discussion brief

Revised after claim verification on 6 September 2026. Use the
[corrected backend asks](./VENDOR_CONSOLE_BACKEND_ASKS.md) as the technical agenda and the
[claim audit](./VENDOR_CONSOLE_CLAIM_AUDIT.md) as the evidence appendix.

The verified case is narrower and more credible than the original report: **order updates fail,
dues include cancelled orders, and booking-period reporting lacks reliable date and payment
foundations.** SKU partial updates have a reproducible omission bug, but a tested payload can
update availability and names. Protected cross-account reads also require a separate security
review. Profile editing, correct customer pagination and complete order detail should not be
presented as unavailable capabilities.

## Open the meeting with this

> “We have checked the dashboard asks against the current API and frontend. Some original blocker
> claims were too broad, so we have corrected them. Store-name updates work, customer pagination
> works with the documented parameters, and full order detail is already integrated.
>
> The remaining issues affect the vendor's ability to operate reliably. Current order-update
> requests fail. The dues figure includes cancelled orders. The available date filtering answers
> when orders will be delivered, without providing a reliable basis for orders placed this week.
> SKU updates also fail when an optional features field is omitted, although supplying it allows
> the tested availability change.
>
> We need supported contracts and clear business definitions for those workflows. Frontend will
> implement its missing controls and fix its own mapping and demo-data defects in parallel. I’d
> like us to agree on the required release capabilities, owners and acceptance scenarios.”

## Explain why the remaining asks matter

These vendor examples are illustrations, not reported customer incidents.

| Vendor's question | Verified issue | Why it matters for the dashboard | Request |
|---|---|---|---|
| “Can I advance this order or mark it paid?” | Current per-order PATCH returns 417 with an OrderUpdateRequest error. The frontend uses that route for both actions | These are daily operational controls. A screen that displays orders but fails to persist its actions cannot complete that workflow | Repair PATCH or explicitly support alternatives. Agree the full transition graph and a working payment-state write. **1.2, 2.8** |
| “What amount should I collect?” | On the complete probe dataset, dues are 840, including 160 from cancelled/DUE orders | The amount labelled due could prompt the vendor to request money that is not owed under the intended cancellation rules | Agree cancellation and collection semantics; fix the aggregate and verify it against order/payment records. Frontend must hide the unreliable metric meanwhile. **2.3** |
| “How much did I sell this week?” | Sampled vendor rows lack placed-at data; the date filter selects delivery dates. No dedicated period vendor sales aggregate is documented | Delivery workload and order-booking activity are different. Mislabelled totals would give the vendor a misleading business picture | Supply reliably populated placed-at data, explicit date filtering and agreed period aggregates. **1.1, 2.2** |
| “Can I temporarily stop selling this size?” | Active-flag/name updates without features fail. A controlled test with features supplied successfully disabled, re-enabled and renamed a size | The intended simple availability action should not depend on an unrelated optional field. The dashboard also needs its own control | Fix omitted-field handling. If a workaround is accepted, preserve existing features and verify purchasing respects inactivity. **1.3** |
| “Which customers does this screen represent?” | The directory selects active vendor–customer relationships; the dashboard count and self-order history do not establish the same population | Implementing a directory against an assumed relationship definition could produce confusing counts and missing expected entries | Define the relationship, owner exclusion/inclusion and count scope. Verify with a known distinct active customer. This is a domain question, not a proven empty-list defect. **1.5, 2.5** |

## Explain the money distinction with one example

> “A ₹600 order placed on Sunday for delivery next Tuesday belongs to Sunday's booking activity
> and Tuesday's delivery workload. Payment collection is another fact. Those dates and amounts
> must stay distinct if we want the dashboard to answer the vendor's question correctly.”

Agree three definitions separately: **period order value**, **recorded collections** and
**legitimate outstanding amounts**. Specify the date basis, timezone, date boundaries and
cancellation treatment. A placed-at timestamp alone does not complete money reporting.

The proposed temporary Overview metric is a complete delivery-window order total, clearly labelled
“Orders delivering this week.” It is not implemented yet. It must cover all relevant pages, not
just the visible page, and must not be labelled sales booked that week or money collected.

## Correct these claims before presenting them

| Original claim | What to say now |
|---|---|
| “The profile endpoint is dead.” | A changed store name saved and persisted in the current test, then was restored. Verify remaining fields and states while building the editor. **1.4** |
| “Order detail is missing purchased items.” | The header endpoint is not the full-detail API. `/items` returned both tested lines and is already integrated. Clarify ambiguous legacy header fields separately. **1.6** |
| “Customers pagination is broken.” | The documented `page_size` parameter works. The original probe used undeclared `size`. **Tier 3** |
| “The vendor cannot change availability at all.” | Omitting features fails; a features-aware request successfully changed the tested active flag. Purchasing enforcement and the frontend control remain to be verified. **1.3** |
| “The customer directory must be broken because there are orders.” | All orders in the current probe were owner self-orders. That does not prove a distinct active customer relationship exists. **1.5** |
| “The approval gate is inverted.” | The tested submitted vendor is still awaiting approval. Confirm a matrix of setup/approval states before alleging inversion. **2.9** |
| “Bad bulk-status fields return 500.” | The current wrong-field request returns 400. Valid bulk requests can return 200 with zero successes, so inspect failed_orders. **2.8** |
| “The current pending tile goes blank.” | Current Overview already includes scheduled work and defaults absent counts to zero. Stable backend zero-count semantics are still useful. **2.4** |

Price read/write asymmetry is also not inherently a defect. Reading uses a SKU ID; updating uses a
price ID and the documented sku_id/list_price/sale_price body. That narrow body works and is already
used by the frontend. Accepting and ignoring extra read fields is optional.

## Make ownership and completion concrete

Ask the seniors to choose sequencing; the table defines outcomes, not an imposed implementation plan.

| Work | Backend outcome | Frontend work / acceptance evidence |
|---|---|---|
| Order actions | Supported delivery/payment writes, complete transition rules, actionable failures | Integrate supported operations; an allowed transition and payment update persist after reload; rejected transitions and bulk partial failures are handled |
| Dues and period reporting | Agreed financial/date definitions with correct reads and aggregates | Hide unreliable dues; fix flat amount mapping; verify cancelled, paid, unpaid and cross-period delivery examples across the complete result set |
| SKU editing | Optional fields can be omitted without JDBC failure | Build availability/name controls; preserve unrelated fields; verify disable/re-enable by the same SKU ID and confirm customer purchasing enforcement |
| Customer semantics | Defined active relationship and count populations | Build the proposed directory and verify a distinct known active customer; use page_number/page_size |
| Existing capabilities | Confirm field/state limits of profile and detail contracts | Build the profile editor; retain `/items`; maintain the already working narrow price write |

The current frontend still has work independent of these asks: advance calls PATCH rather than the
bulk alternative; flat order amount is ignored; mobile contact identity is absent from list cards;
Overview still displays dues/customer KPI tiles; Settings has no checkout editor; and demo fixtures
do not faithfully exercise live shapes or state changes. These are not backend blockers.

## Give protected reads a separate security owner

Controlled checks returned another test vendor's order list and subscription list using a caller
with VENDOR/USER roles and no membership of that store in the verification response. This contradicts
the original blanket claim that order endpoints enforce 403 and requires ownership-policy review.

Public catalog listing is different: it is accessible anonymously. A price writer without a vendor
ID can still enforce ownership through price ID. No cross-vendor write was attempted, so do not
claim a demonstrated write vulnerability. Use the audit's authorization section for the bounded
evidence and ask the backend security owner for policy confirmation and enforcement tests.

## Keep subscriptions a black box

For this dashboard, subscriptions are **read-only list and detail supplied by the backend**.
Plan rules, creation, scheduling, pause/resume, cancellation, quantity changes and order generation
are outside the discussion. The read-isolation finding above concerns access control only; it does
not reopen the subscription model.

## Close with this request

> “Can we agree which vendor workflows the release must support, assign owners and target
> integration dates to the verified dependencies, and document the supported temporary alternatives?
> For each item, let’s agree the live scenario that proves it works. Where capability is deferred,
> we should explicitly reduce release scope rather than imply the screen is complete.”

Record the required workflow, backend owner, frontend counterpart, target integration date,
accepted fallback and completion evidence. The original report and the brief are proposed product
direction; the audit distinguishes that direction from today's verified implementation.
