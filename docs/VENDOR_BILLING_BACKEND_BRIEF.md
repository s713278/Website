# Vendor billing: backend brief (Razorpay platform fee)

**As of 1 October 2026.** This brief is the single place where the frontend records, for the
backend team, how vendor platform billing must behave, what the frontend observed on the dev
backend, and exactly what each fix must return. It is self-contained so it can be copied into the
backend repository or an agent's knowledge base. The product rules it restates are owned by the
frontend repository's `docs/VENDOR_BILLING_DECISIONS.md`.

> **For coding agents: this brief is reference material, not a task.** Use it to explain the
> billing model, investigate the backend code, and propose changes. Change code only when a
> developer asks for a specific change in the conversation, and then only that change. The
> "Required change" lines below describe what the frontend is asking the backend team to decide and
> schedule; they are not instructions to carry out on reading. When a developer does ask for a fix,
> first compare this brief with the current backend code and say where they differ, then share a
> plan and wait for the developer's go-ahead before editing.

## 1. How to use this brief

- **Authority.** Backend code is what is implemented; the backend's OpenAPI document
  (`/api/v3/api-docs`) is the HTTP contract. This brief adds what the frontend observed and what it
  asks for. Where they disagree, the observation is evidence of a gap, not a new contract.
- **Certainty labels.** Every claim below carries one: *Observed on dev* (seen against the dev
  backend with fresh test vendors and real Razorpay Test Checkout), *Verified on Razorpay Test*
  (the exact Razorpay calls made directly on a separate Razorpay Test account, paid by Test card),
  *Inferred*, or *Not yet verified*.
- **Reporting a fix.** When a fix reaches dev, tell the frontend team which gap it closes. The
  frontend reruns that gap's check (section 12) with fresh test vendors. The app already reads both
  today's responses and the corrected ones, so a fix needs no frontend release.
- **Fix order.** K first (it changes the flow the others build on), then A and D (same
  subscription setup), I, MFPS-66 with H's rule, the configuration items, then C, B, E, J, F, G.
- Test vendor IDs and scrubbed request/response captures are available from the frontend team on
  request; none are reproduced here.

## 2. The model in one screen

MithraDirect charges each vendor a **platform fee** of **₹299 a month** (INR) for their store, via
Razorpay Subscriptions. This is unrelated to money customers pay vendors for orders, and to
customer delivery subscriptions (`/v1/api/subscription-plans` is that unrelated catalogue).

**Terms.** These two letters are used throughout:

- **T** = `trial_ends_at`: when the free days end.
- **P** = `current_period_end`: the **paid-through date**, the end of the month the vendor has
  paid for.

| Term | Meaning |
|---|---|
| Trial (free days) | 14 days without paying, in production. Shorter on dev and test environments on purpose; see *Trial length* below. |
| Early first fee | Paying during the free days. ₹299 is charged **now**; it pays for the month from T to P = T + one billing month. No free days are lost. The same Checkout approves AutoPay for later months. Decided by the backend team on 29 September 2026. |
| AutoPay | Razorpay charging ₹299 each month from the saved card or UPI mandate. Approving AutoPay is not a payment. |
| Captured | Razorpay has actually taken the money. Only a captured ₹299 is a paid platform fee. |
| Stop the plan | The vendor's own cancellation. Stops future charges; keeps the remaining free days and the paid month, with no automatic refund. |
| Keep shop open | A vendor who stopped pays again before P. ₹299 is charged now for the month after the old P. |
| Pay after the free days | A vendor whose trial ended unpaid pays ₹299 at once; the paid month starts at that payment. |
| Collection retry period | Razorpay retrying a scheduled renewal (day 1, 2 and 3 after the debit date). The shop stays open. |
| Halted / failed platform fee | Every retry used. The shop is hidden, new orders stop, existing orders can still be fulfilled; the backend cancels the halted subscription. |

**Timeline of the early first fee:**

```
 go-live      vendor pays early          T (free days end)          P = T + 1 month
    |------------------|-------------------------|-----------------------------|---------->
       free days            free days kept           paid month (the ₹299)        AutoPay ₹299
                        ₹299 charged NOW                                          charged here
                        AutoPay approved                                          (Razorpay start_at)
```

**Who owns what.**

- **Backend:** Razorpay keys and secrets, plan configuration, creating and cancelling Razorpay
  subscriptions, webhooks, the trial, P and every status, and shop enforcement on server time
  (hiding the shop, blocking new orders).
- **Frontend:** the wording, opening hosted Checkout with the values subscribe returns, sending
  Checkout's result to `confirm`, and reading the subscription. The browser never decides who has
  paid or whose shop is visible.

**Money and time.**

- Every amount on the MithraDirect API is in **rupees** (`sale_price: 299`). Paise exist only
  between the backend and Razorpay (`29900`). The frontend never converts.
- Every timestamp needs a timezone (`Z` or an offset). The frontend refuses a billing date it
  cannot place in time.

**When the trial starts.** The rule is: once onboarding is complete **and** the vendor is approved.
On dev today, `POST /v1/vendors/{vendor_id}/go-live` is the last onboarding step and no
verification step exists yet, so a successful go-live counts as complete and approved, and the
trial starts at go-live. A vendor verification and approval step is expected before production;
the trial must then start at approval, not at go-live. One trial per vendor identity; repeated
completion or approval never grants another.

**Trial length is configuration, not a bug to fix.** The product decision is a **14-day** trial,
and production must run 14 days. Dev and test environments deliberately run a **shorter** trial,
any length up to 14 days (1 day on dev as of 1 October 2026; 3 days or another value may be used
later), so that trial ends, payments after the trial and renewals can be tested without waiting two
weeks. When a non-production environment's trial is shorter than 14 days:

- treat it as intended and leave it as configured; it is not a deviation from the product rule;
- keep the trial length a per-environment setting and compute T from the stored trial start plus
  that setting, rather than writing 14 (or 1) into the billing logic;
- derive every other date from the stored T and P, never from an assumed trial length: the early
  first fee's P is T + one billing month whatever the trial length is;
- set it to 14 days for production; that switch is a release blocker (section 5).

The frontend assumes no trial length: it counts the free days from `trial_ends_at`.

## 3. Published contract today

All responses use the envelope `{ timestamp, success, status, data }`. The frontend treats
`success: false` as a failure even with HTTP 200.

| Operation | Use |
|---|---|
| `GET /v1/vendors/{vendor_id}/subscription` | The billing read: the vendor's single subscription row. `404` before go-live; `403` for another vendor. |
| `POST /v1/vendors/{vendor_id}/subscription` | Subscribe. Body `{ "plan_code": "MITHRA_SOCIAL_STARTER_MONTHLY" }`. Returns the row plus `razorpay_key_id`, `razorpay_subscription_id` and `checkout_url`. A repeat while pending returns the same subscription. Documented `409` when already active on the plan, `400` when not purchasable, `404` before go-live. |
| `POST /v1/vendors/{vendor_id}/subscription/confirm` | Body `{ razorpay_payment_id, razorpay_subscription_id, razorpay_signature }` from Checkout. Verifies HMAC-SHA256 over `payment_id\|subscription_id` and writes a `PAYMENT_AUTHORIZED` history row. Does not change the status. Documented `401` on signature mismatch, `400` on subscription mismatch. |
| `POST /v1/vendors/{vendor_id}/subscription/cancel` | No body. Returns the row. Documented: `ACTIVE`/`PAST_DUE` → `cancel_at_period_end: true`; `PAYMENT_PENDING` → cancelled at once. See gap A for what actually happens. |
| `GET /v1/vendors/{vendor_id}/subscription/history` | Lifecycle events, newest first, capped at 100. |
| `GET /v1/subscription-plans` | Paid plans. Dev lists one monthly plan. |
| Razorpay webhook | Moves the status. Its path is not in the OpenAPI document (gap G). |

**Subscription row fields the app reads:** `status`, `razorpay_status`, `plan_code`, `plan_name`,
`trial_started_at`, `trial_ends_at`, `current_period_start`, `current_period_end`,
`next_billing_at`, `cancel_at_period_end`. It ignores `checkout_url`, `days_remaining` and display
labels. Null fields may be omitted, except `cancel_at_period_end`, which must be a boolean on every
read.

**`status` values:** `TRIAL_ACTIVE`, `TRIAL_EXPIRED`, `PAYMENT_PENDING`, `ACTIVE`, `PAST_DUE`,
`HALTED`, `CANCELLED`, `EXPIRED`. **`razorpay_status`** mirrors Razorpay: `created`,
`authenticated`, `active`, `pending`, `halted`, `cancelled`, `completed`. The app treats AutoPay
as approved only when `razorpay_status` is `authenticated` or `active`.

**Plans list fields the app reads:** the `billing_cycle: "MONTHLY"` entry's `plan_code`,
`plan_name` and `sale_price` (rupees).

**History event types the app reads:** `SUBSCRIPTION_CHARGED` ("Payment received"),
`SUBSCRIPTION_AUTHENTICATED` ("AutoPay set up"), `CANCELLATION_REQUESTED`,
`SUBSCRIPTION_CANCELLED`, each with `event_at`, `previous_status`/`new_status`,
`external_subscription_id`, `external_payment_id` and, once added, `amount` in rupees. Other
events (`CHECKOUT_CREATED`, `PAYMENT_AUTHORIZED`, `SUBSCRIPTION_ACTIVATED`) are ignored.

**Vendor context.** Since 29 September 2026, `GET /v1/vendors/{vendor_id}/context` is flat
(top-level `features` and `limits`, no `subscription` block). Billing reads nothing from it.

## 4. Required behavior by flow

Each flow states what the backend does at Razorpay and what the subscription read must say.
Recipes are in section 7; how the app turns each read into a screen is in section 8.

1. **Pay during the free days (early first fee, gap K).** Subscribe creates a Razorpay
   subscription with the first ₹299 as an upfront `addons` item and `start_at` = P = T + one
   billing month (recipe 1). Subscribing alone changes nothing in the read (gap C). Once the ₹299 is
   captured: `ACTIVE`, `current_period_start` = T, `current_period_end` = `next_billing_at` = P.
2. **Stop the plan (gap A).** Cancel at Razorpay immediately (`cancel_at_cycle_end: 0`, recipe 2):
   that stops future charges and leaves the paid ₹299 paid. Keep P. Report `ACTIVE`,
   `cancel_at_period_end: true`, the same P and `next_billing_at: null` (gap F) until P. When
   Razorpay refuses, return a 4xx with its reason.
3. **Keep shop open (gap E).** When `cancel_at_period_end` is true, subscribe cancels the old
   Razorpay subscription immediately (its paid invoice stays) and creates a new one as in recipe 1
   with `start_at` = old P + one month. Keep the stopped read until the ₹299 is captured, then
   `ACTIVE`, `cancel_at_period_end: false`, P = old P + one month.
4. **Pay after the free days (gap I).** After T, subscribe creates an immediate-start
   subscription: no `start_at`, no `addons` (recipe 3). Checkout charges ₹299 at once; P = one
   month from that charge. Never reuse a subscription created during the free days; cancel it and
   create a new one. The read is `PAYMENT_PENDING` until captured, then `ACTIVE` with P.
5. **Renewal at P.** Razorpay charges at `start_at` = P exactly (gap D). While it retries, report
   `PAST_DUE` (or keep `ACTIVE`) and keep the shop open. Move P on only when the renewal is captured
   (`subscription.charged`). A retry that succeeds keeps the original cycle dates. When collection
   halts: `HALTED`, hide the shop, cancel the halted subscription.
6. **AutoPay cancelled outside MithraDirect (gap H).** For example in the Razorpay dashboard or by
   the bank. Keep P; the shop stays open until P. `CANCELLED` with a future P is readable, but
   enforcement must not hide the shop on that status alone.
7. **Trial ends unpaid (gap J).** At T, on server time, the status becomes `TRIAL_EXPIRED` and the
   shop is hidden. Cancel any subscription still `created` (gap C).
8. **Early ₹299 still unconfirmed at T.** The shop is hidden until the payment is captured: a fee
   paid now has no retry period. The read keeps its trial status with AutoPay approved and no P.

**Moment → required read** (`GET …/subscription`):

| Moment | `status` | `razorpay_status` | Dates | `cancel_at_period_end` |
|---|---|---|---|---|
| Free days, not subscribed | `TRIAL_ACTIVE` | null | T ahead, no P | `false` |
| Subscribed in free days, Checkout closed unpaid | `TRIAL_ACTIVE`, trial plan | `created` | T ahead, no P | `false` |
| Early ₹299 paid, not yet recorded | `TRIAL_ACTIVE` | `authenticated` | T ahead, no P | `false` |
| Early ₹299 captured | `ACTIVE` | `authenticated` (until P) | `current_period_start` = T; `current_period_end` = `next_billing_at` = T + 1 month; `trial_ends_at` unchanged | `false` |
| Early ₹299 still unrecorded when T passes | `TRIAL_ACTIVE` or `TRIAL_EXPIRED` | `authenticated` | T passed, no P | `false` |
| Stopped (the plan or AutoPay) | `ACTIVE` | `cancelled` (immediate cancel), or `active` (cycle-end cancel in a paid cycle) | same P; `next_billing_at` null | `true` |
| Keep shop open paid, not yet captured | unchanged stopped read | — | old P | `true` |
| Keep shop open captured | `ACTIVE` | `authenticated` | P = old P + 1 month; `next_billing_at` = new P | `false` |
| Trial ended unpaid | `TRIAL_EXPIRED` | null, or `cancelled` | T passed, no P | `false` |
| Paying after T, not yet captured | `PAYMENT_PENDING`, paid plan | `created`, then `authenticated`/`active` | T passed, no P | `false` |
| Paying after T, captured | `ACTIVE` | `active` | P = charge + 1 month | `false` |
| Renewal being retried | `PAST_DUE` (or `ACTIVE`) | `pending` | P passed | `false` |
| Collection halted | `HALTED` | `halted` | — | — |

Example: the early ₹299 captured (T = 14 October).

```json
{
  "status": "ACTIVE",
  "plan_code": "MITHRA_SOCIAL_STARTER_MONTHLY",
  "plan_name": "Mithra Social Starter",
  "razorpay_status": "authenticated",
  "trial_ends_at": "2026-10-14T10:00:00Z",
  "current_period_start": "2026-10-14T10:00:00Z",
  "current_period_end": "2026-11-14T10:00:00Z",
  "next_billing_at": "2026-11-14T10:00:00Z",
  "cancel_at_period_end": false
}
```

Razorpay keeps an early-fee subscription `authenticated` until its first cycle starts at P, so
`razorpay_status` is `authenticated` here, not `active`. **History:** a `SUBSCRIPTION_CHARGED`
event with the payment ID and `amount: 299` (rupees).

## 5. Release blockers

A gap blocks a production release if, left unfixed, a real vendor is charged wrongly, cannot pay,
cannot stop paying, or loses a shop they paid for. No production release of billing until all of
these are cleared:

- **K**: one ₹299 at setup during the free days, a paid month from T to P, and `start_at` = P;
  card and UPI tested with the upfront ₹299.
- **A**: stopping after an early first fee works.
- **D**: the next ₹299 falls exactly at P, confirmed by a Razorpay read of `start_at`.
- **I**: a vendor whose free days ended can pay.
- **MFPS-66**: shop enforcement on server time. Keep the shop open while a renewal is collected and
  until P when AutoPay ends, even when the status is `CANCELLED` (H). Hide it after T when unpaid,
  and while an early ₹299 is still unconfirmed after T.
- **Configuration**: a 14-day trial in production (shorter trials elsewhere stay as they are);
  eMandate switched off on the Checkout account.

B, C, E, F, G and J are not blockers: the app reads around them.

## 6. Gaps A–K, MFPS-66 and configuration

Observed on the dev backend, 28–30 September 2026, with fresh test vendors, real Razorpay Test
Checkout and a dashboard "Charge this now". Rechecked the night of 30 September (about 23:50 IST):
everything below still reproduced, except J (recheck pending) and E (not rechecked: it needs a
paid vendor who stopped the plan).

### K. The early first fee is not built — *blocker*

- **Observed on dev (30 September, twice).** A fresh vendor in its free days subscribed: `200`,
  `PAYMENT_PENDING`, the monthly plan, `razorpay_status: created`, `trial_ends_at` unchanged, no
  `current_period_end`. Hosted Checkout said: "To begin your subscription, a refundable amount of
  ₹5 will be charged now. MithraDirect will then charge ₹299 every month until 5 Sep 2036." It
  offered UPI, cards and eMandate. Closing Checkout unpaid left the read unchanged.
- **Cause (inferred).** The Razorpay subscription is still created with a future `start_at` (T)
  and no upfront amount, the withdrawn AutoPay-only setup: a refundable ₹5 now, the first ₹299 at T.
- **Required change.** Recipe 1: the first ₹299 as an upfront `addons` item and `start_at` = P
  (T + one month). `start_at` = T would charge a second ₹299 at T for the same month; an immediate
  start would make the vendor lose the remaining free days. Store P yourself: Razorpay records no
  period for the upfront payment. `ACTIVE` only once the ₹299 is captured (B's rule, with the
  upfront caveat in section 7). Test with card and UPI.
- **Acceptance check.** A fresh vendor in free days subscribes; Checkout says "a payment of ₹299
  will be charged now"; after paying, the reads follow the table in section 4 (rows 3–5), Razorpay
  shows one paid ₹299 invoice and `start_at` = P, and history has `SUBSCRIPTION_CHARGED` with
  `amount: 299`.
- **Frontend today.** Plan offers "Pay ₹299 with Razorpay" and says the free days are kept. On dev
  that creates an AutoPay-only subscription: the app shows "Confirming payment…" in the free days,
  then hides the shop with "Confirming payment…" from T until Razorpay charges, then Collecting,
  then Paid.

### A. Stopping before Razorpay's first cycle returns `500` — *blocker*

- **Observed on dev (rechecked 30 September).** Cancel returned `500` "Unable to cancel the
  subscription at this time." for a subscription Razorpay held as `created` (never paid) and for
  one `authenticated` (card approved). Razorpay stayed unchanged. After a real charge (`active`),
  cancel returns `200` with `cancel_at_period_end: true`.
- **Cause (verified on Razorpay Test, 30 September).** A cycle-end cancel before Razorpay's first
  cycle gets Razorpay's `400` "Subscription cannot be cancelled since no billing cycle is going on".
  The backend turns that into a `500`.
- **Impact (inferred).** After an early first fee, Razorpay's first cycle starts only at P. A
  vendor who paid early could not stop the plan for the whole paid month, and the next ₹299 would
  be charged against their wishes, which the product's refund rule would then make MithraDirect
  refund in full.
- **Required change.** Recipe 2: cancel at Razorpay with `cancel_at_cycle_end: 0` (stops future
  charges only; the paid invoice stays paid). Keep P in MithraDirect and report `ACTIVE`,
  `cancel_at_period_end: true`, the same P, until P, not `CANCELLED`. When Razorpay refuses, return
  a 4xx with its reason, not a `500`.
- **Acceptance check.** After an early first fee, cancel returns `200` with `ACTIVE`,
  `cancel_at_period_end: true`, unchanged P and `next_billing_at: null`; Razorpay shows the
  subscription `cancelled` with its ₹299 invoice still `paid`; no charge arrives at P.
- **Frontend today.** Stop the plan still calls cancel; a `500` shows "Couldn't stop the plan right
  now. Try again later or contact support." A backend that reports `CANCELLED` instead reads
  "AutoPay off", open until P.

### D. The next ₹299 must fall exactly at P — *blocker*

- **Observed on dev (28 September).** Subscribe created the Razorpay subscription with `start_at`
  exactly 24 hours after T; a paid vendor's `current_period_start` still shows T + 24 h. On
  29 September a subscription created after T had a start already in the past (see I), so the
  offset looks removed (inferred). The current `start_at` cannot be read without dev's Razorpay
  keys. Untested with the early first fee.
- **Impact.** Each late day is a free day, every later renewal shifts by the same amount, and the
  app shows Collecting from P until the charge lands.
- **Required change.** `start_at` = P exactly, with no offset: T + one month after an early first
  fee, old P + one month after Keep shop open. Existing subscriptions keep their `start_at`.
- **Verified on Razorpay Test (30 September).** Razorpay schedules the next charge at `start_at`
  (`charge_at` = `start_at`). The charge at P itself is not yet observed.
- **Acceptance check.** A Razorpay read of a new subscription shows `start_at` = the read's P, to
  the second.

### I. Paying after the free days fails — *blocker*

- **Observed on dev, form 1 (29 September, once, end to end).** Two minutes after a trial ended,
  subscribe returned `500` "Unable to initiate subscription payment at this time." A retry returned
  `200`, but Checkout offered a refundable ₹5 now and ₹299 monthly, as for a trial. Paying by Test
  card failed with Razorpay's "Subscription's start time is past the current time. Cannot do an
  auth transaction now."
- **Observed on dev, form 2 (30 September).** A vendor who had opened Checkout during the free
  days subscribed again after T: `200`, but with the same Razorpay subscription. Razorpay refuses
  to open it (its Checkout preferences call returns `400`), so Checkout stays blank.
- **Cause (inferred).** After T the backend still builds, or reuses, a trial-style subscription
  whose start time is already past. Likely tied to J.
- **Impact.** Every vendor whose trial ends unpaid has no way to pay, so their shop cannot reopen.
  This is the most common path.
- **Required change.** After T, subscribe creates an immediate-start subscription (recipe 3), so
  Checkout collects ₹299 at once. Never reuse a subscription created during the free days: cancel it
  (`cancel_at_cycle_end: 0`) and create a new one. Decide on server time at subscribe.
- **Acceptance check.** A vendor past T (with and without an earlier unpaid free-days Checkout)
  subscribes; Checkout opens showing ₹299 now; after paying, the read is `ACTIVE` with P one month
  from the charge.
- **Frontend today.** A `500` shows the backend's message. The `200` with a reused subscription
  opens a blank Checkout, which the app cannot detect.

### MFPS-66. Shop enforcement is not built — *blocker*

- **Observed on dev (30 September).** The public `GET /v1/vendors/{identifier}/storefront` served
  a shop whose free days ended on 29 September, in full; the payload has no subscription or
  visibility field.
- **Required change.** Hide the shop from the marketplace and block new orders on server time,
  from MithraDirect's own dates, not Razorpay's status:
  - keep it **open** while a renewal is being collected (the collection retry period);
  - keep it **open** until P after AutoPay ends or the plan is stopped, even when the status is
    `CANCELLED` (H);
  - **hide** it after T when unpaid, after a halted collection, and while an early ₹299 is still
    unconfirmed after T.
  Existing orders stay fulfillable; billing and account stay reachable. Exposing the result on the
  public storefront payload (a visibility flag or the shop-plan status) lets the customer app follow
  the server instead of guessing.
- **Acceptance check.** A lapsed shop is absent from the marketplace and refuses new orders; a
  `CANCELLED` shop with a future P, and a shop whose renewal is being retried, stay visible.
- **Frontend today.** Plan tells a lapsed vendor that customers cannot see their shop; that is true
  only once this is built. The customer storefront currently hides a shop itself when the status is
  `HALTED`, `CANCELLED` or `EXPIRED` (it reads a status field when present); that rule should follow
  MFPS-66.

### H. A Razorpay-side cancel reads `CANCELLED` while the paid month remains — *via MFPS-66*

- **Observed on dev (29 September; history rechecked 30 September).** A paid subscription cancelled
  immediately in the Razorpay dashboard moved `ACTIVE` → `CANCELLED` at once
  (`SUBSCRIPTION_CANCELLED`), with P still a month ahead. P itself was kept correctly.
- **Impact.** Enforcement keyed on `status == CANCELLED` would hide a paid shop up to a month early.
- **Required change.** MFPS-66 keeps a `CANCELLED` shop with a future P open. Reporting `ACTIVE`
  until P would also do.
- **Frontend today.** Reads it as "AutoPay off", open until P.

### Configuration — *blocker*

- **Observed on dev (30 September).** Dev uses a 1-day trial on purpose (see *Trial length* in
  section 2). Checkout offered UPI, cards and eMandate.
- **Required change.** A 14-day trial in production; dev and test keep their shorter trial. Switch
  eMandate off in the Razorpay dashboard (Subscriptions → Settings), then check the methods hosted
  Checkout offers. eMandate is excluded by product decision: it cannot register and charge on the
  same day, bank holidays can move a debit earlier, and confirmation can take 1–2 days, which breaks
  "₹299 now" and "charge exactly at P".

### B. `ACTIVE` before the ₹299 is captured — not a blocker

- **Observed on dev (twice, 28 September; history rechecked 30 September).** The status became
  `ACTIVE` on Razorpay's `subscription.activated` webhook, about six minutes before the ₹299 was
  captured and `subscription.charged` arrived.
- **Impact.** If that charge fails and its `pending`/`halted` webhook is late or lost, an unpaid
  vendor stays `ACTIVE`. With UPI the window can be hours.
- **Required change.** `ACTIVE` only once money is captured: `subscription.charged` for AutoPay and
  immediate-start charges. For an upfront ₹299 (K, E) Razorpay stays `authenticated` until P, so
  use that payment's capture instead (section 7). Until then keep the current status: the trial, or
  `PAST_DUE` while Razorpay retries.
- **Frontend today.** `ACTIVE` without P reads Collecting ("Shop is open · AutoPay on"), never Paid.

### C. Subscribing alone moves the trial to `PAYMENT_PENDING` — not a blocker

- **Observed on dev (28–30 September).** Subscribing during the trial moves the status to
  `PAYMENT_PENDING` with the paid plan's name, before any payment. A vendor who closed Checkout
  unpaid still read that way 20 minutes later, with `razorpay_status: created`. On 30 September,
  five such vendors were still `PAYMENT_PENDING`/`created` 14–56 hours after T, never
  `TRIAL_EXPIRED`.
- **Cause (inferred).** The status is written on subscribe, not on payment. A `created` Razorpay
  subscription has no payment method, so Razorpay never charges it and no webhook ever moves it on.
- **Required change.** Subscribing alone changes nothing: keep `TRIAL_ACTIVE` and the trial plan
  until the ₹299 is captured, whatever `razorpay_status` is. At T, cancel any subscription still
  `created` (`cancel_at_cycle_end: 0`, recipe 4). Use `PAYMENT_PENDING` only for paying after the
  trial.
- **Frontend today.** AutoPay counts as approved only when `razorpay_status` is `authenticated` or
  `active`; `PAYMENT_PENDING` reads like a trial. The vendor sees the right state, but reporting
  and anything reading the status alone do not.

### E. Keep shop open returns `409` while the plan is stopped — not a blocker

- **Observed on dev (twice, before 30 September; not rechecked).** After a paid-period stop,
  subscribe returned `409` "An active subscription already exists."
- **Impact.** A vendor who changes their mind cannot restart before P, so the shop closes first.
- **Required change.** Flow 3 in section 4: cancel the old subscription immediately, create a new
  one with the upfront ₹299 and `start_at` = old P + one month, and keep the stopped read until the
  ₹299 is captured. A `PAYMENT_PENDING` read with a future P is a shape the app deliberately refuses
  to guess about; it shows a read error.
- **Frontend today.** A `409` shows "Couldn't start the payment right now. Your shop stays open
  until ‹P›."

### F. `next_billing_at` is kept after a stop — not a blocker

- **Observed on dev (rechecked 30 September).** With `cancel_at_period_end: true`, the read still
  showed the old next charge date, likely copied from Razorpay's `charge_at`. It also stayed after an
  immediate Razorpay-side cancel (H).
- **Required change.** `next_billing_at: null` while `cancel_at_period_end` is true, set from
  MithraDirect's own flag. After Keep shop open, the next ₹299's date.
- **Frontend today.** Ignores `next_billing_at` whenever `cancel_at_period_end` is true.

### J. The status does not flip at T — not a blocker

- **Observed on dev (29 September).** Two to three minutes after T the read still showed
  `TRIAL_ACTIVE` with the trial plan. Recheck pending (due 1 October).
- **Required change.** `TRIAL_EXPIRED` at T on server time (a scheduled job, or computed on read).
- **Frontend today.** Past T with no P reads "Shop closed · Free days are over" from the dates.

### G. Minor items — not blockers

- **History duplicates (MFPS-87).** Repeating `confirm` adds a second `PAYMENT_AUTHORIZED` row;
  repeating cancel a second `CANCELLATION_REQUESTED`. Make `confirm` idempotent on
  `razorpay_payment_id`: a repeat returns `200` and writes nothing new.
- **History has no amounts.** Add `amount` on charge events, in rupees. The app shows rows without
  amounts and never infers one.
- **History is written only by `confirm`.** If the browser closes before `confirm`, that payment
  gets no history row (status and payment are unaffected). Write history from the webhooks
  (`subscription.authenticated`, `payment.authorized`, `subscription.charged`), and reconcile
  subscriptions stuck in `PAYMENT_PENDING` against Razorpay on a schedule.
- **The envelope `timestamp` has no timezone** (it is IST). Add the offset.
- **OpenAPI documents prices in paise (`29900`)** on the subscription read and the plans list, but
  the API returns rupees (`299`). Fix the document and keep rupees: a paise price would show as
  ₹29,900. The billing webhook path is not listed.
- **Brief `502`s** for one to three minutes several times a day on dev (Render). The app retries
  reads at 5, 15 and 30 s.
- Keep sending `cancel_at_period_end` as `true`/`false` on every read.

## 7. Razorpay recipes and verified facts

Verified on Razorpay Test (24 and 30 September 2026): the calls below were made directly against
a separate Razorpay Test account with a monthly ₹299 plan and paid by Test card through hosted
Checkout. The dev backend was not involved. Amounts to Razorpay are in paise.

### Recipe 1: early first fee (K) and Keep shop open (E)

```http
POST /v1/subscriptions
{
  "plan_id": "<monthly ₹299 plan>",
  "total_count": <as today>,
  "start_at": <P as Unix seconds>,
  "addons": [{ "item": { "name": "First month", "amount": 29900, "currency": "INR" } }]
}
```

P is T + one month for K, and old P + one month for E. Observed:

- Hosted Checkout said "To begin your subscription, a payment of ₹299 will be charged now.
  MithraDirect will then charge ₹299 every month until …": one ₹299 now, no ₹5.
- After a Test card payment: one invoice `paid`, ₹299, with a single line item of type `addon`; its
  payment `captured` within 5 s; the card saved for AutoPay.
- The subscription was `authenticated`, with `charge_at` = `start_at`. It stays `authenticated`
  until P. Razorpay records **no period** for the upfront ₹299: `paid_count` 0, no `current_start`
  or `current_end`, and no billing dates on the invoice. The backend stores the period itself:
  `current_period_start` = T (or old P), P = `start_at`.
- **Paid signal.** `subscription.charged` does not fire for the upfront ₹299; Razorpay's docs send
  `subscription.authenticated` for an upfront payment (webhooks not observed: the Test account had
  no receiver). On that event, fetch the subscription's invoice and treat the ₹299 as paid once its
  payment is `captured`.
- Razorpay's FAQ says "the Add-Ons feature is deprecated". That refers to the old separate add-on
  endpoints; the `addons` field on create works.

### Recipe 2: stop the plan (A), and the old subscription in E

```http
POST /v1/subscriptions/{id}/cancel
{ "cancel_at_cycle_end": 0 }
```

- With `cancel_at_cycle_end: 1` on the recipe-1 subscription, Razorpay returned `400`
  "Subscription cannot be cancelled since no billing cycle is going on".
- With `0`: `200`, `cancelled`, `charge_at` cleared. The paid ₹299 invoice stayed `paid`, with no
  refund (30 September). On a subscription already `active` (a paid monthly cycle), an immediate
  cancel was also accepted and kept its paid invoice (24 September).
- So after an early first fee only an immediate cancel works. The paid days live in MithraDirect's
  P, not in Razorpay's cycle. Within a normal paid cycle (`active`), a cycle-end cancel also works.

### Recipe 3: pay after the free days (I)

Create the subscription with no `start_at` and no `addons`. Hosted Checkout charges the plan's
₹299 at once; in both 24 September runs the payment was captured by the first read after Checkout.
Razorpay keeps the subscription `created` until that charge, then `active`.

### Recipe 4: unpaid subscriptions at T (C)

A subscription whose Checkout was closed unpaid stays `created` and is never charged. At T, cancel
it with `cancel_at_cycle_end: 0`. Razorpay documents `expire_by` as "till when the customer can make
the authorisation payment"; setting it to T on create may make this automatic (*not yet verified*).

### Other Razorpay facts

- **Refunds** (verified on Razorpay Test, 30 September, on a captured upfront payment after an
  immediate cancel): a ₹1 refund was `processed`. A full ₹299 refund was refused with a generic
  `400` "invalid request sent" because the merchant balance (₹299 − ₹8.68 fee − ₹1 refunded) was
  short. Refunds come from the merchant's Razorpay balance; the fee on a refunded payment is not
  reversed; normal refunds take 5–7 working days and must be made within 6 months. Whether a vendor
  who stops before T after an early first fee gets a refund is **not decided**; the current rule is
  no automatic refund.
- **UPI** shows for a subscription only if the upfront plus plan amount is under ₹15,000 (₹299 is
  fine), per Razorpay's docs. Cards have no such limit.
- **Retries.** Razorpay retries a failed card or UPI renewal on the three days after the debit
  date, then halts.

### Not yet verified

- UPI with the upfront ₹299 (only cards were paid). Test before release.
- Which webhooks Razorpay sends for the upfront payment.
- The AutoPay charge actually landing at P (seen scheduled, not charged).
- Switching eMandate off in Subscriptions → Settings.

## 8. How the frontend reads the subscription

The app maps each read to one view. The backend's statuses and dates decide it; the browser clock
only compares them with now. Rows are checked in order and the first match wins. "AutoPay
approved" = `razorpay_status` is `authenticated` or `active`. Days left are counted from T or P,
rounded up.

| Row | Read | View | Shop |
|---|---|---|---|
| 1 | `HALTED` | Payment failed | hidden |
| 2 | `PAST_DUE` | Collecting | open |
| 3 | `ACTIVE`, P ahead, `cancel_at_period_end: false`, `razorpay_status` ≠ `cancelled` | Paid ("free days kept" while now < T) | open |
| 4 | `ACTIVE`, P ahead, `cancel_at_period_end: true` | Stopped | open |
| 5 | `CANCELLED` or `EXPIRED` with P ahead; or `ACTIVE` + `razorpay_status: cancelled` + flag `false`, P ahead | AutoPay off | open |
| 6 | Row 3's facts with P passed | Collecting (renewal) | open |
| 6′ | Row 4's or 5's facts with P passed | Shop closed (paid days ended) | hidden |
| 3a | `ACTIVE`, no P | Collecting | open |
| 7 | `TRIAL_ACTIVE`/`PAYMENT_PENDING`, AutoPay approved, T ahead, no P | Free days, confirming payment | open |
| 8 | `TRIAL_ACTIVE`/`TRIAL_EXPIRED`/`PAYMENT_PENDING`, AutoPay approved, T passed, no P | Confirming payment | hidden |
| 8b | `PAYMENT_PENDING`, AutoPay approved, T passed, P passed | Confirming payment (paid days ended) | hidden |
| 9 | `TRIAL_ACTIVE`/`PAYMENT_PENDING`, or `CANCELLED` without P; AutoPay not approved; T ahead | Free days (3 days left when ≤ 3) | open |
| 10 | `TRIAL_EXPIRED` without AutoPay; or row 9's facts with T passed and no P | Shop closed (free days over) | hidden |
| 11 | `PAYMENT_PENDING`, `razorpay_status: created`, P passed | Shop closed (paid days ended) | hidden |

**Read errors.** Anything else shows "Couldn't read your shop plan" with Try again, rather than
guessing about a vendor's money or shop. Known examples: `ACTIVE` with P but no boolean
`cancel_at_period_end`; a trial status with AutoPay approved **and** P set; `PAYMENT_PENDING` with
AutoPay approved and a future P (gap E's wrong shape); a timestamp without a timezone; a plans list
without a `MONTHLY` entry or a non-positive `sale_price`. A `404` reads as "not live yet".

**Writes.**

- **Pay ₹299 / Keep shop open:** subscribe → hosted Checkout with `razorpay_key_id` and
  `razorpay_subscription_id` → `confirm` with Checkout's three values → poll the read every 5 s for
  up to 90 s. Subscribe is never retried automatically. `confirm` is retried on 502, 503 or a
  network failure at 5, 15 and 30 s. While a payment is confirming, the app offers no second payment.
- **Stop the plan:** cancel. Its response (the row) replaces the view directly.
- **Rereads:** on page load, window focus, at T and at P, and after brief outages (5, 15, 30 s).

## 9. Standing backend requirements

These apply whatever the endpoints are called.

### Provider verification and reconciliation

1. Keep API and webhook secrets server-side only; isolate Test and Live keys, records and events.
2. Bind each Checkout to the verified vendor and store. Take the subscription ID from the persisted
   record, then verify Checkout's HMAC-SHA256 over `payment_id|subscription_id` with a
   constant-time comparison. This is not the one-time Orders signature formula.
3. Fetch and reconcile the payment, subscription and invoice: relationships, mode, known plan, INR
   amount, and actual capture. Paid evidence is the captured upfront add-on payment for the early
   first fee and Keep shop open, and a captured charge (`subscription.charged`) for immediate-start
   payments and renewals. An approved mandate or a refundable authorisation is never a paid fee.
   Check that exactly one upfront ₹299 is charged and that `start_at` = P.
4. Verify webhook HMAC over the exact raw bytes; deduplicate event IDs and status transitions.
   Duplicates, out-of-order events and callback/webhook races must never extend a paid period twice
   or revive an obsolete subscription. Persist events before acknowledging them, and reconcile late
   or missing callbacks with Razorpay reads or jobs.
5. Keep the trial through T, including after an early first fee or a stop after it. Paid
   membership comes only from confirmed platform-fee coverage. After an unpaid T, payment must be
   confirmed before access returns. A renewal pending or being retried keeps service through its
   collection retry period; only a `halted` collection is a failed platform fee. Then full service
   stops with no grace, existing-order fulfilment and payment recovery stay available, and the
   backend cancels the halted subscription. A cancellation during the retry period stops service at
   once. A fee paid now (an early first fee, or a payment after T) has no retry period. Browser
   pending state never grants access.
6. Track Razorpay's recurring states (charged, pending, halted, cancelled, completed, paused,
   resumed, updated) separately from entitlement. A failed renewal or a cancellation never erases a
   period already paid for. An old `authenticated`/`active` webhook must not undo a confirmed
   cancellation. A real charge arriving after cancellation still needs reconciling, not discarding.
   A next-period fee collected despite a timely cancellation is refunded in full, without extending
   access. Ordinary cancellation keeps paid coverage with no prorated refund.
7. A retry that succeeds keeps its original cycle and renewal date. Recovery after a halt is a new
   immediate-start signup whose period begins at confirmation; the unpaid retry days are not
   billed. Take the period from the charge's invoice, not from callback or retry time.

### Cancellation and concurrent operations

- Before Razorpay's first cycle (`created`, or `authenticated`, which covers the whole paid month
  after an early first fee or Keep shop open), only an immediate cancel works. Within an `active`
  cycle, a cycle-end cancel is the usual primitive. Either way MithraDirect keeps P and reports
  `ACTIVE` with `cancel_at_period_end: true` until P.
- Serialize subscribe, cancel, replacement and charge reconciliation per store. Repeated clicks,
  several tabs, delayed callbacks and worker retries converge on the same operation. On a Razorpay
  timeout, read the outcome before retrying or creating a replacement.
- Keep shop open: cancel the old subscription immediately and create a new one (recipe 1). Do not
  make a replacement chargeable while the old one's collection is uncertain. Razorpay cancellation
  is not a refund.
- The cancellation cutoff is the **backend's receipt time**, stored durably with the trial or paid
  boundary before acknowledging. If receipt precedes the boundary, a later Razorpay confirmation
  must not disqualify the vendor from a full refund of an unintended next fee. Tie the refund
  obligation to the actual charge and deduplicate it: lost responses and duplicate events must not
  cause duplicate refunds. A pending or failed refund grants no extra coverage; keep recovering a
  failed refund.

### Trial ownership and reminders

- Grant the trial once per vendor identity when onboarding is complete and the vendor is approved
  (on dev, at go-live; section 2), without Checkout or a mandate. Trial time cannot move to another
  store. Never open Checkout automatically.
- Decide early first fee versus immediate start from server time at subscribe, and reconcile again
  when the payment outcome arrives: a Checkout opened before T can complete after T. Never reuse a
  free-days subscription after T (gap I). Show a changed schedule and get the vendor's explicit
  agreement before a replacement Checkout.
- Payment methods: cards and UPI; eMandate excluded. Configure them in Subscriptions → Settings and
  check the hosted method set for both the early first fee (future start with an upfront ₹299) and
  immediate start. Validate each method's timing before production.
- Reminders (proposed: three days left and last day) are scheduled from the stored T, delivered
  idempotently. Suppress payment-needed wording once an early ₹299 is paid, including while it is
  confirming. Times, timezone and channels still need product approval.

### Acceptance evidence before production

- The trial is granted once, only when both onboarding completion and approval are true (including
  late approval); duplicate events, a second browser or a duplicate store cannot create another.
- Cross-store reads and writes fail without exposing billing records. Tampered signatures, a
  callback for another store, the wrong plan, mode or currency, and an authorisation-only amount
  never grant paid access.
- Early first fee: exactly one ₹299 now, `start_at` = P, the trial kept through T, and the same
  final read whether the webhook arrives before, after or without the browser's `confirm`.
- Stop after an early first fee: immediate Razorpay cancel, `ACTIVE` with
  `cancel_at_period_end: true` and P unchanged, no charge at P.
- Keep shop open: the old subscription cancelled, one ₹299 now, P = old P + one month.
- After an unpaid T: the shop hidden and new orders blocked while existing orders stay fulfillable;
  pending carts cannot bypass this; paying collects a full ₹299 and restores access only after
  confirmation. An early ₹299 still unconfirmed at T also hides the shop.
- A `CANCELLED` shop with a future P, and a shop whose renewal is being retried, stay visible.
- A renewal pending or retrying past P keeps service; a halt stops service and cancels the
  subscription; a cancellation during retries stops service at once; a retry succeeding two days
  late keeps the original renewal date; duplicate charge events add no period.
- A cancellation received before the boundary qualifies for a full refund of an unintended next fee
  even when Razorpay confirms later, exactly once.
- Mandate revocation outside MithraDirect keeps the trial or paid coverage. Retrying a completed
  cancellation creates no billing and changes no dates.
- Only methods proven to meet the timing rules are offered (no eMandate), at every Checkout entry.

## 10. Withdrawn asks

The frontend's 24 September request to extend the vendor context with a `subscription.billing`
block (access flags, `allowed_actions`, payment, cancellation and refund state, `attempt_id`,
`idempotency_key` and three new writes; raised on MFPS-64 and MFPS-67) is **withdrawn**: the backend
published its own subscription API instead. Of that request, rupee prices are now true on
`GET /v1/subscription-plans`, the timestamp offset lives on as gap G, and everything else is
replaced by this brief.

## 11. Open questions

- A test vendor who approved AutoPay on 28 September (₹5 authorisation) was still `PAYMENT_PENDING`
  and uncharged 35 hours after T, about 11 hours after its T + 24 h start. Was the ₹299 attempted in
  Razorpay, and did a webhook arrive? The frontend can share the vendor ID.
- Which webhooks Razorpay sends for the upfront ₹299 (section 7).
- UPI with the upfront ₹299, before release.
- Gap J's recheck after a fresh vendor's trial ends (due 1 October).
- **Product, not backend:** a full refund for a vendor who stops before T after an early first fee
  is undecided. Today's rule is no automatic refund.

## 12. Checking a fix on dev

Use fresh test vendors taken through go-live, and never a captured Razorpay ID.

| Gap | Check |
|---|---|
| K | In free days, subscribe and open Checkout: it must say ₹299 now, not ₹5. Pay by Test card and UPI; read. |
| C | Subscribe, close Checkout unpaid, read: still `TRIAL_ACTIVE`, trial plan. After T: not `PAYMENT_PENDING`. |
| A | After an early first fee (or on a `created`/`authenticated` subscription), cancel: `200`, `ACTIVE`, flag `true`, same P. |
| D | Read the new subscription's `start_at` in Razorpay (backend keys or dashboard): equals P. |
| I | Let a trial pass (dev's configured length, 1 day as of 1 October), with and without an earlier unpaid Checkout; subscribe: Checkout charges ₹299 now. |
| J | Read just after T: `TRIAL_EXPIRED`. |
| E, F | On a paid vendor: stop, read (`next_billing_at` null), then Keep shop open: ₹299 now, P + one month. |
| B | Trigger a charge ("Charge this now" in the dashboard): `ACTIVE` appears only with `subscription.charged`. |
| H | Cancel a paid subscription in the Razorpay dashboard: shop stays visible until P. |
| MFPS-66 | After T unpaid, the public storefront hides the shop and new orders are refused. |
| G | Repeat `confirm` and cancel: no duplicate rows; charge events carry `amount`; `timestamp` has an offset. |
