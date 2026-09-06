# Vendor console — frontend delivery plan while backend fixes are pending

**Prepared: 6 September 2026. Status: proposed implementation plan; not a completion report.**

We can build a useful vendor console before the remaining backend dependencies are resolved.
The first team demonstration should show vendors finding delivery work, inspecting complete
orders, maintaining prices and store settings, and understanding their store's setup state.
That gives the backend discussion a concrete product and specific unfinished workflows to review.

This document owns the frontend work sequence, demonstration scope and acceptance evidence.
The [backend asks](./VENDOR_CONSOLE_BACKEND_ASKS.md) own the target console and contract requests;
the [claim audit](./VENDOR_CONSOLE_CLAIM_AUDIT.md) owns the verification evidence and its limits;
the [discussion brief](./VENDOR_CONSOLE_BACKEND_BRIEF.md) owns the backend meeting agenda.
Backend observations below refer to that dated audit, not new live tests performed for this plan.

## 1. The first milestone to show the team

**Milestone A: a usable console for viewing delivery work and maintaining the store.**

| Demonstration | What the team should see | Completion evidence |
|---|---|---|
| Understand the store | Setup or approval guidance; an operational Overview for an open store; existing catalog plan usage | Appropriate state presentation, useful navigation, no unreliable dues/customer KPI |
| Find delivery work | Status filters including scheduled orders; a delivery-date range; paginated results with amounts and mobile contact identity | Filters affect the request and displayed results; changing filters resets pagination |
| Inspect an order | Complete purchased items, available customer/delivery information, separate payment and delivery statuses, and the returned total | A multi-item order is readable; documented charges explain differences between item subtotal and final total |
| Maintain prices | Edit an existing size's list/sale price and see the saved result | Fresh read after save shows the change; a failed save does not appear successful |
| Maintain store settings | Edit store name and existing checkout options | Values survive a fresh read/page reload; unrelated settings and category assignments are preserved |
| Use the console on a phone | Readable cards, accessible forms and navigation, clear loading/error/empty states | Complete the same walkthrough at a mobile viewport without obstructed controls |

Milestone A does not require Customers, Subscriptions, a weekly money tile, or working order-status
changes. Those should not hold up the first demonstration. Price and full-order-detail capabilities
already exist; the milestone improves and verifies them rather than counting them as new endpoints.
Settings writes have a credible existing integration path, but checkout round trips and supported
profile fields still need live verification while building.

A demonstration can use synthetic demo data for breadth and controlled live data for integration
evidence. Identify which mode each scenario uses. An interactive demo is useful progress, but does
not establish that an unverified backend operation works.

## 2. What can proceed, and what needs a condition

| Work | Build position | Condition before calling it complete |
|---|---|---|
| Navigation, responsive layouts, state screens, loading/error handling | Proceed now | Manual walkthrough and relevant frontend checks |
| Order reads, delivery filters, amount/mobile mapping, work queue | Proceed now | Verify observed response shapes and filtered results; protected-read release dependency remains |
| Existing price editor | Proceed now | Correct price identifier, supported request fields, save followed by fresh read |
| Profile name and checkout editors | Proceed now using existing contracts | Verify field/state support and preservation of unrelated values |
| Storefront configuration editor | Proceed using existing setup capability | Establish safe initial values and a reliable read/verification path for each editable field |
| Customer directory and invitation interface | Proceed now | Verify active-relationship population; separately test invitation delivery with a designated recipient |
| Read-only subscription views | Proceed now | Verify list/detail shapes; protected-read release dependency remains |
| Product assignment and adding/removing sizes | Build controls now; enable per supported store state | Verify approval restrictions, returned IDs, plan limits and mutation results |
| SKU rename/availability | Build controls; conditional live integration | Accepted features-preserving workaround or backend fix, state checks and purchasing enforcement |
| Order advancement | Prepare UI/service/error handling; conditional live integration | Supported write alternative and confirmed transition rules, then successful real transition |
| Cancellation | Retain and verify its separate integration | Confirm allowed states, errors and persisted result; it was not rerun in the audit |
| Delivery-window order-value total | Optional after the first milestone | Complete result set, explicit date/status scope and valid amounts |
| Mark paid and financial/booking-period reporting | Defer live completion | Working payment write and the relevant date/financial contracts |

“Proceed now” means no identified backend fix must precede frontend development. It does not mean
every account, field or approval state has already passed live acceptance.

## 3. Frontend work packages

### A. Correctness and realistic demo behavior

Do these first because every later screen depends on trustworthy presentation.

- Map the observed flat order `amount` as well as supported existing shapes. Preserve valid zero
  amounts; missing amounts remain unknown rather than becoming zero.
- Add mobile contact identity to order summaries separately from customer name. Offer call and
  WhatsApp links only when usable contact data exists; sending remains a deliberate user action.
- Remove the unreliable dues figure and ambiguous customer-count KPI from Overview. Do not replace
  dues with a home-grown “corrected” balance while cancellation/payment semantics are unresolved.
- Remove outdated product copy that says all profile updates are unavailable. Correct stale
  implementation comments encountered in the affected code using the audit as evidence.
- Make demo writes update shared demo state so list, detail and editor views agree. Define the
  persistence/reset behavior explicitly and make the team walkthrough repeatable.
- Apply demo date filters and pagination. Include synthetic flat-list rows, absent names/dates,
  zero/missing amounts, sparse counts and multi-item detail. Simulate failures as well as success.

**Acceptance:** the same mapper handles representative live-shaped and demo data; editing a demo
price changes subsequent demo reads; missing data is visibly different from zero; no success toast
or updated badge conceals a failed live write.

### B. Overview and console navigation

- Extend the existing setup/approval presentation into a focused state screen for setting up,
  under review, rejected and suspended stores. Give only actions supported for that state.
- For an open store, prioritize pending, scheduled, preparation and dispatch work with links into
  the corresponding Orders view. Preserve existing zero-count handling.
- Show existing plan usage and limits when supplied. Do not invent trial deadlines or billing data.
- Keep counts labelled according to their source. A cumulative dashboard count must not acquire a
  “today” label because a nearby order list has a delivery-date filter.
- Add Customers navigation with its screen in Milestone B. Keep Subscriptions within Orders;
  the final desktop navigation has six entries and mobile has five, with Settings in the account menu.

**Acceptance:** scheduled work is reachable; links retain their intended filters; unavailable
counts do not claim that no work exists; each store state gives a clear explanation without
implying that submission equals approval.

### C. Orders list and detail

- Add delivery-date range controls to the existing list service capability, with clear/reset
  behavior and pagination reset when filters change. Explicitly label the date basis.
- Add a scheduled-order filter and preserve separate payment and delivery badges.
- Display mapped amounts and available contact identity. Show an appropriate fallback when the
  customer name or delivery timing is absent.
- Retain the existing full-detail read. Improve item, quantity, amount and returned charge
  presentation without manufacturing a charge to make totals reconcile.
- Keep filters when returning from detail. Make retry, not-found and failed-load states distinct
  from a successfully loaded empty list. Ignore stale responses when filters or vendor change.
- While writes remain unsupported, hide or clearly disable affected live actions with concise
  availability copy. Do not make working order inspection depend on those actions succeeding.

**Acceptance:** inspect a multi-item order, filter a date range, traverse multiple pages, change
filters and return from detail. Missing contact/date fields do not break the page. Failed requests
do not display “No orders” as if the request succeeded.

### D. Products and sizes

- Improve the existing price editor with validation, busy state, failure recovery and a fresh
  read after save. Keep SKU identity separate from the price record identity.
- Organize the catalog so a vendor can locate a product and its sizes, see existing prices and
  understand available plan capacity.
- Reuse supported setup operations for product assignment and size creation/removal, adapted to
  dashboard editing rather than forcing vendors through the setup wizard again.
- Preserve the distinction between platform products, assigned vendor products and vendor SKUs.
  Do not add general product/category deletion or stock-quantity controls without a contract.
- Prepare rename and availability controls. Any temporary SKU update must preserve current
  features; do not blindly send `features: {}` against a real SKU containing feature data.

**Acceptance:** verified mutations survive rereads; retries do not create duplicate sizes; price
changes target the correct record; unsupported approval states receive useful feedback. Availability
is complete only after disable/re-enable preserves the SKU and customer purchasing respects inactivity.

### E. Settings and Storefront

- Build the profile editor starting with store name, whose changed-value write was verified in
  the audit. Expand to contact/address/description only as each field and state is verified.
- Load editable data from an appropriate source; a flattened display address is not a safe
  replacement for a structured address on write. Preserve required category assignments and other
  unchanged fields in full update requests.
- Bring the existing checkout read/write behavior into Settings. Load and save delivery/payment
  options together as required, preserving the portion the vendor did not edit.
- Reuse existing storefront configuration behavior for supported branding/content fields. Where
  reliable current values cannot be loaded, do not overwrite them with browser defaults.
- Improve the published-store link, copy/share interaction and preview presentation. Keep a local
  draft preview visibly distinct from published data, and explain unavailable preview states.
- Retain existing plan/account information. New billing, subscription purchases and staff
  administration are outside this delivery plan.

**Acceptance:** store-name and checkout edits survive reload; cancelling an edit leaves saved values
unchanged; a failed save retains entered values for retry; a fresh device does not present a local
draft as the published store. Additional fields earn acceptance individually.

### F. Customers

- Implement the active customer-relationship directory with the documented `page_number` and
  `page_size`, clear pagination and loading/error/empty states.
- Display only supported identity/contact fields. Do not equate this list with all historical
  purchasers, or use its current page length as the total customer count.
- Build the WhatsApp invitation form, validation, explicit send action and backend response
  feedback. Use the documented request; do not invent invitation lifecycle states.
- Keep spreadsheet import out of the daily-work screen.

**Acceptance:** verify a known distinct active customer and nonempty pagination. An empty result
does not assert that the store has never had orders. Test invitation delivery separately with a
designated recipient; a demo success proves the interaction only. Record unresolved population
semantics against the existing backend ask instead of silently redefining “customer.”

### G. Read-only Subscriptions inside Orders

- Add a Subscriptions view and detail navigation using backend-supplied records.
- Map only verified fields; handle missing values, empty results and failed reads explicitly.
- Keep customer subscriptions distinct from the vendor's platform plan/usage display.
- Do not implement creation, plan assignment, pause/resume, cancellation, quantity changes,
  scheduling or order generation. Those remain outside this console scope.

**Acceptance:** a selected subscription opens the matching detail and returns to the list;
unsupported fields do not become fabricated schedule promises. Use synthetic or controlled data
for demonstrations while the documented protected-read isolation finding remains unresolved.

### H. Optional delivery-window total

This can follow the operational milestone; it is not necessary to prove useful progress.

Use a clearly labelled value such as **“Order value scheduled for delivery this week”**, with the
exact range and included statuses visible. Fetch all relevant pages; never sum only the displayed
page. Fix amount mapping first. If any page fails or a required amount is missing, withhold the
complete total rather than displaying a partial result as complete.

Validate date boundaries and timezone behavior before enabling a weekly preset. Cancelled-order
treatment must be explicit. If scope or boundaries remain uncertain, keep the filtered list and
defer the aggregate. This display does not answer sales booked, money collected or money owed.

## 4. Conditional actions and the work we can prepare

| Action | Frontend preparation now | Evidence needed to enable live behavior |
|---|---|---|
| Advance order | Isolate action rules, pending/error states and supported response mapping; prepare the documented bulk alternative for a single order | Backend confirms supported route and legal next states; an allowed transition persists; rejected transitions and per-order failures are surfaced |
| Mark paid | Keep payment status readable; prepare disabled/unavailable presentation and future save feedback | A supported payment-state write succeeds and persists; demo simulation is not payment evidence |
| Cancel order | Improve the existing reason/confirmation/error interaction | Dedicated cancellation succeeds in an agreed allowed state and is rejected appropriately elsewhere; use designated test orders |
| Rename/disable size | Prepare controls and preservation of existing feature data | Backend fix or accepted workaround, relevant approval states, reread persistence and purchase enforcement |

The audit did not reconfirm successful real bulk transitions. Do not encode a guessed full
transition graph, and do not interpret HTTP 200 as success when the operation reports failed orders.
Detailed contract evidence stays in the [backend asks](./VENDOR_CONSOLE_BACKEND_ASKS.md).

## 5. Sequence and review gates

| Stage | Scope | Review gate |
|---|---|---|
| 1. Correct the foundation | Work package A; representative fixtures; hide unreliable metrics and unsupported live actions | Existing frontend defects no longer obscure what the backend supplies |
| 2. Deliver Milestone A | Overview, order reads/filters/detail, price editing, store-name/checkout editing, mobile polish | Run the first demonstration and capture implemented behavior plus live evidence |
| 3. Deliver Milestone B | Customers, read-only Subscriptions, final navigation, broader verified profile/storefront editing | New surfaces work with supported reads; invitations and additional writes have explicit verification status |
| 4. Add conditional capabilities | Catalog mutations, SKU availability, supported order actions; optional delivery-window sum | Each capability passes its own contract/state checks; unrelated work continues if one fails |
| 5. Complete release dependencies | Verified payment/order writes, agreed reporting, protected-read isolation | Backend-dependent acceptance scenarios pass before claiming the affected workflows are production-ready |

These are deliverable boundaries, not duration estimates. Record owners and dates when scheduling
implementation. Completing Stage 2 is enough to hold a substantive product/backend review; there is
no need to wait for every conditional capability or financial report.

The protected order/subscription read finding should be escalated independently while frontend
work proceeds. A frontend demonstration is not a prerequisite for reporting that finding, and
frontend route guards do not repair backend ownership enforcement.

## 6. Evidence to bring to the team

Use this walkthrough after implementation:

1. Open the console on mobile and show the appropriate store state and actionable Overview.
2. Open scheduled work, change the delivery range and traverse results. Point out real amounts
   and available customer contact information.
3. Open a multi-item order and explain the distinction between its delivery state, payment state
   and total. Show how unavailable actions are presented.
4. Edit a price, reread it, then edit store name and checkout settings and reload them.
5. Show one failed request and one empty result so the team can assess recovery behavior.
6. If Milestone B is complete, demonstrate Customers and read-only Subscriptions, identifying any
   scenarios still backed only by synthetic data.
7. Finish with the specific remaining dependency beside the affected screen and its acceptance
   scenario, using the existing backend brief for technical discussion.

For each demonstrated feature, record: implementation/commit reference when available, demo or
live mode, scenario, expected result, observed result, verification date and remaining limitation.
Keep screenshots/recordings free of credentials and personal customer data. Evidence should show
saved values after a fresh read, not just optimistic UI or a success message.

Use this status vocabulary in the review:

| Status | Meaning |
|---|---|
| Planned | This document describes the intended work; implementation is outstanding |
| Implemented in demo | Interaction works with synthetic data; live behavior remains unproven |
| Integrated, awaiting verification | The existing contract is wired; the required scenario has not passed yet |
| Verified in controlled live scenario | The named scenario passed on the recorded date and state; broader behavior is not implied |
| Awaiting backend contract/fix | Frontend completion depends on the linked backend ask |

## 7. Implementation and validation boundaries

Extend the existing React vendor module and shared API facade. Keep wire mapping in shared
mappers and reuse existing setup capabilities where appropriate; do not undertake an unrelated
API architecture migration. Follow [API architecture](./API_ARCHITECTURE.md) for placement and
[Testing](./TESTING.md) for test tiers and the repository verification baseline.

Prioritize regression coverage for amount/contact mapping, date filtering and pagination,
features/settings preservation, demo mutation consistency and bulk per-order failures where
implemented. Use component tests for stale-response/effect behavior. Automated tests must not hit
the live backend. Manually exercise full journeys because the repository has no end-to-end runner.

The deliverable is a console with demonstrated reads and supported edits, accompanied by precise
evidence of the remaining dependencies. Neither a polished mock nor backend fixes alone establish
that the vendor's complete operational workflow is ready.
