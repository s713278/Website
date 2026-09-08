# Vendor dashboard: backend discussion brief

> **Closed as refused, 8 September 2026.** This brief was presented and the backend team declined
> the work. It is kept as the record of what was raised, not as a live agenda. The console's v1
> scope, built only on data that already exists, is
> [VENDOR_CONSOLE_V1_SCOPE.md](./VENDOR_CONSOLE_V1_SCOPE.md).

Revised after claim verification on 6 September 2026. Use the
[corrected backend asks](./VENDOR_CONSOLE_BACKEND_ASKS.md) as the technical agenda and the
[claim audit](./VENDOR_CONSOLE_CLAIM_AUDIT.md) as the evidence appendix.

The verified case is narrower and more credible than the original report: **order updates fail,
dues include cancelled orders, and booking-period reporting lacks reliable date and payment
foundations.** SKU partial updates have a reproducible omission bug, but a tested payload can
update availability and names. Protected cross-account reads also require a separate security
review. Profile editing and complete order detail should not be presented as unavailable
capabilities.

**Re-probed the same day, before implementation.** Four things changed and you should present the
corrected versions, not the ones above them: the SKU workaround `features: {}` **destroys** existing
data and must be read-modify-write; profile `PUT` works more widely than claimed but **cannot clear
a field**; customer pagination is **not** demonstrated working — both accounts return zero rows and
the contract declares no row schema; and `PENDING → IN_PROCESS`, which our own code sends today, is
**rejected** by the backend. Two asks also got stronger evidence: dues rose 840 → 900 after one
create-and-cancel, and sparse status counts were watched appearing and disappearing in one session.

## Open the meeting with this

> “We checked the dashboard asks against the current API and our own frontend, then re-checked the
> four that mattered most on both approval states. Some original blocker claims were too broad and
> we have corrected them: profile edits work, including on a store that has gone live, and full
> order detail is already integrated. Two of our own corrections were also wrong, and we have
> corrected those too.
>
> The remaining issues affect whether a vendor can operate reliably. Per-order updates fail
> outright. Status changes work only through the bulk route, one step at a time, and when it
> refuses it returns a success code — so today a vendor can press advance and believe an order
> moved when nothing happened. The dues figure counts cancelled orders: we created an order,
> cancelled it, and watched the amount owed go up by exactly that order and stay there. Date
> filtering answers when orders will be delivered; there is no creation timestamp anywhere, so
> nothing answers what was ordered this week. And the customer list returns no rows on either test
> account and declares no row schema at all, so there is nothing for us to build against.
>
> We need supported contracts and clear business definitions for those workflows. Frontend is
> implementing its missing controls and fixing its own mapping and demo-data defects in parallel.
> I'd like us to agree the required release capabilities, owners and acceptance scenarios.”

## Explain why the remaining asks matter

These vendor examples are illustrations, not reported customer incidents.

| Vendor's question | Verified issue | Why it matters for the dashboard | Request |
|---|---|---|---|
| “Can I advance this order or mark it paid?” | Per-order PATCH returns 417 with an OrderUpdateRequest error, and the frontend uses it for both actions. Bulk status update works, but only one hop at a time — and it returns **HTTP 200 with `success_count: 0`** when it refuses | Advancing is a daily operational control. Worse than failing loudly, a refused transition currently looks like success, so a vendor can press the button and believe the order moved | Repair PATCH or confirm bulk as the supported route. Return distinct, actionable rejection reasons instead of one generic sentence. Supply a working payment-state write. **1.2, 2.8** |
| “What amount should I collect?” | Dues were 840 including 160 from cancelled orders — and creating one order then **cancelling** it moved the figure to 900, where it stayed | The amount labelled due would prompt the vendor to ask a customer for money that was never owed, for an order the customer already cancelled | Agree cancellation and collection semantics; fix the aggregate and verify it against order and payment records. Frontend hides the metric meanwhile. **2.3** |
| “How much did I sell this week?” | Sampled vendor rows lack placed-at data; the date filter selects delivery dates. No dedicated period vendor sales aggregate is documented | Delivery workload and order-booking activity are different. Mislabelled totals would give the vendor a misleading business picture | Supply reliably populated placed-at data, explicit date filtering and agreed period aggregates. **1.1, 2.2** |
| “Can I temporarily stop selling this size?” | Updates omitting `features` fail on both approval states; with `features` echoed back, disable, re-enable and rename all succeed. Sending `features: {}` succeeds too — and **wipes the vendor's feature data** | A simple availability toggle should not depend on an unrelated optional field, and the obvious workaround is silently destructive. Every client has to know a rule the contract does not state | Fix omitted-field handling so an absent field leaves the column unchanged. Confirm that customer purchasing actually respects an inactive SKU — that is still unverified. **1.3** |
| “Which customers does this screen represent?” | The directory selects active vendor–customer relationships. Both probe accounts return zero rows, and the 200 response is typed generically, so **no row schema is declared anywhere** | We cannot write a mapper against field names we are guessing at. This blocks the screen more firmly than missing data would — data arrives eventually, a shape has to be decided | Publish the row schema. Define the relationship, owner inclusion and count scope, then point us at one vendor with a real active relationship so the mapping can be verified. **1.5, 2.5** |

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
| “Customers pagination is broken.” | The original probe used undeclared `size`, so it proved nothing. **But do not replace it with "pagination works"** — `page_size` only changes an echoed field, and both accounts return zero rows. Say pagination is untested. **Tier 3** |
| “The vendor cannot change availability at all.” | It works on both approval states when `features` is echoed back. Do **not** repeat the `features: {}` suggestion from the first draft — it destroys existing data. Purchasing enforcement is still unverified. **1.3** |
| “Store profile can be edited, so Settings is unblocked.” | Editing works, including on the gone-live store — but the write ignores `null`, so no field can be **cleared**. Present it as a working editor with one missing capability, not a solved problem. **1.4** |
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
