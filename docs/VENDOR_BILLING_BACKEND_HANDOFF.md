# Vendor billing: what the vendor context still needs

> **Superseded (29 September 2026) by the published backend billing API.** The backend chose its
> own subscription endpoints instead of this context extension, and the context no longer carries a
> `subscription` block. Kept for history only. The current gaps and production release blockers are
> in [API gaps](./API_GAPS.md#vendor-platform-billing).

**Backend alignment request · 24 September 2026.** The frontend now adopts the lifecycle shape that
`GET /v1/vendors/{vendor_id}/context` returns today (`subscription.lifecycle_status`, `trial`, `plan`,
`available_paid_plans` and top-level `features`). We map it to our screens ourselves. This section
lists only what that response still lacks for Razorpay billing. Field names are suggestions in the
response's existing style; the backend may choose others and the frontend mapper will follow.

## Already usable as returned

| Returned field | Frontend use |
|---|---|
| `subscription.lifecycle_status` | Membership state: `NOT_STARTED` → setup incomplete, `TRIAL_ACTIVE` → trial, `TRIAL_EXPIRED` → trial ended, `ACTIVE` → paid |
| `subscription.display_status` | Status label |
| `subscription.trial.started_at`, `ends_at`, `days_total`, `days_remaining`, `expired` | Trial countdown and exact end date |
| `subscription.plan` | Current plan name, features and limits |
| `subscription.available_paid_plans` | Plan choice (monthly, and yearly where offered) and prices |
| Top-level `features` | Effective permissions, replacing `eligible_features` |

We no longer need `tier`, `monthly_price`, `trial_days`, `trial_ends_at`, `eligible_features`,
`subscription.usage`, a separate `revision` or a `notice` text; the frontend writes its own messages.

## Requirements for the current response

These requirements and the additions below were raised on the backend Jira stories on 24 September
2026: context requirements on MFPS-64, and billing writes on MFPS-67. Observations below were
verified that day against a fresh dev vendor taken through go-live.

1. **Show `onboarding.next_step` in the OpenAPI example.** The live context returns it during setup
   and omits it once `onboarding.status` is `COMPLETED`; the frontend then reads the status, so no
   response change is needed. Only the example leaves it out.
2. **Prices in rupees.** A live Social Starter plan returned `sale_price: 2.99`, `list_price: 5.99`,
   `discount: 3.00`; the agreed price is ₹299 (list ₹599). Return `299.00` in rupees, as the OpenAPI
   example does. The frontend will not multiply by 100: if 2.99 comes from a Razorpay plan created
   with `amount: 299` (paise), Razorpay would also charge ₹2.99. Razorpay plan amounts must be in paise
   (`29900`).
3. **IST with `+05:30` on every timestamp.** The envelope `timestamp` is returned without an offset
   (it is IST, for example `2026-09-24T12:54:05.110441213`), and the OpenAPI example omits it on
   `trial` and `updated_at` too. Live `trial.*` and a stored `updated_at` use `Z`; `updated_at` before
   go-live uses `+05:30`. MithraDirect operates only in India, so return every timestamp, including
   the envelope, in IST with its offset (`2026-10-08T08:46:30+05:30`). Billing refuses dates it
   cannot place in time; the frontend also accepts `Z`, but never a time without an offset.
4. **`updated_at` is the last real change.** It should be a stored value that moves forward only when
   a subscription or billing field changes, including trial start, so a stale read can never replace a
   newer one once billing writes exist. Today, before go-live it is generated on every read (three
   reads 8 s apart returned three values), and one existing trial vendor's value is exactly 24 h before
   `trial.started_at`; a fresh go-live was consistent. Before a subscription exists, return `null` or
   omit it rather than the current time.
5. **Define `days_remaining`.** A vendor who had just gone live, with exactly 14 days left, got `13`.
   Count whole days
   **rounded up** to `trial.ends_at` from server time: 14 on the first day, `1` in the final 24 hours,
   `0` once expired. The screen also shows the exact end time from `ends_at` in IST.
6. **Return what the endpoint description promises.** It lists "storefront/dashboard access flags"
   and "UI-driven allowed actions", but neither appears in the response or its example; see
   additions 2 and 3.

## Additions for Razorpay billing

1. **One more `lifecycle_status`: `PAYMENT_REQUIRED`**, for a paid period that ended or a renewal
   that failed. Cancelling during a trial or paid period keeps the current status until its end.
2. **Access flags:** `subscription.access: { storefront_visible, dashboard_enabled }`, enforced on the
   server too. An expired or unpaid store must be hidden, and the frontend must not decide that.
3. **Allowed actions:** `allowed_actions` on each `available_paid_plans` entry (`START_AUTOPAY` during
   the trial, charged at `trial.ends_at`; `PAY_NOW` after expiry) and `subscription.allowed_actions`
   (`CANCEL`). Buttons appear only when listed.
4. **Payment state:** `subscription.payment`:

   | Field | Values |
   |---|---|
   | `autopay_status` | `NOT_SETUP`, `PENDING`, `ACTIVE`, `FAILED`, `REVOKED` |
   | `last_payment_status` | `NONE`, `PENDING`, `CAPTURED`, `FAILED` |
   | `paid_through` | End of confirmed paid coverage, or null |
   | `next_charge_at` | Next scheduled charge, or null |

5. **Cancellation:** `subscription.cancellation`, null or `{ status, requested_at, effective_at }`
   with status `REQUESTED`, `SCHEDULED`, `CONFIRMED` or `FAILED`.
6. **Refund (can follow later):** `subscription.refund`, null or `{ status, amount }` for a renewal
   collected after a timely cancellation. Until it exists the refund display stays hidden.

Example `subscription` during a trial with AutoPay set up (existing fields abbreviated):

```json
{
  "lifecycle_status": "TRIAL_ACTIVE",
  "display_status": "Free trial",
  "trial": { "started_at": "2026-09-24T03:16:30Z", "ends_at": "2026-10-08T03:16:30Z", "days_total": 14, "days_remaining": 14, "expired": false },
  "plan": { "plan_code": "SOCIAL_STARTER_TRIAL", "...": "..." },
  "available_paid_plans": [
    { "plan_code": "MITHRA_SOCIAL_STARTER_MONTHLY", "billing_cycle": "MONTHLY", "currency": "INR", "sale_price": 299.00, "list_price": 599.00, "discount": 300.00, "allowed_actions": [] }
  ],
  "access": { "storefront_visible": true, "dashboard_enabled": true },
  "allowed_actions": ["CANCEL"],
  "payment": { "autopay_status": "ACTIVE", "last_payment_status": "NONE", "paid_through": null, "next_charge_at": "2026-10-08T03:16:30Z" },
  "cancellation": null,
  "refund": null,
  "updated_at": "2026-09-25T09:00:00Z"
}
```

## Writes

No billing write exists in the published contract. Each uses the existing envelope, and after each
the frontend reads the context again; an acknowledgement alone never grants access.

| Operation | Request | Response |
|---|---|---|
| `POST /v1/vendors/{vendor_id}/subscription/checkout` | `plan_code`, `idempotency_key` | `attempt_id`, public `key_id`, `razorpay_subscription_id`, `amount` (rupees), `currency`, `charge_at` (null = pay now), `expires_at` |
| `POST /v1/vendors/{vendor_id}/subscription/verify` | `attempt_id`, `razorpay_payment_id`, `razorpay_subscription_id`, `razorpay_signature` | `data: null` |
| `POST /v1/vendors/{vendor_id}/subscription/cancel` | `idempotency_key` | `data: null` |

The backend decides from `lifecycle_status` whether checkout charges at trial end or now, and also
needs a Razorpay webhook to record renewals, failures and cancellations. Errors use the envelope
with a safe `message` and an `error_code`. Route names are suggestions; publish the chosen ones in
OpenAPI.

## Frontend transition

Nothing on screen changes while this is pending. The context mapper already reads the lifecycle
shape's plan name, currency, trial end and `features`; live billing stays marked unavailable until
the additions above arrive. The mock dataset and preview keep the 19 September shape below until
the backend confirms its field names, then move to the agreed shape and are checked against a real
response.

---

# Mock dataset shape (19 September proposal)

**Superseded as a backend request by the section above.** It still documents the fabricated
[mock dataset](./examples/vendor-billing/mock-responses.json) that the preview and tests use.


Use the existing **`GET /v1/vendors/{vendor_id}/context`** for all billing status reads. Add one
`data.subscription.billing` block, populate the existing plan/trial fields and refresh this same
context after billing actions. **No separate billing-status endpoint is required.** Checkout
preparation, callback submission and cancellation still need writes; reading context never initiates
payment, cancellation or a replacement subscription.

The [mock dataset](./examples/vendor-billing/mock-responses.json) now follows the response supplied
by the user: `timestamp`, `success`, numeric `status`, snake_case `data`, numeric `vendor_id`,
`onboarding`, `subscription`, limits/usage and `eligible_features`. `contexts.current_context`
preserves that current shape with anonymised identity and no billing block. The other 31 contexts
are fabricated extensions for frontend tests; they do not establish backend/provider behaviour.

## Reuse the fields we already have

| Existing field | Billing use / required completion |
|---|---|
| `data.vendor_id`, `business_name`, `role` | Selected vendor, display name and membership role; no duplicate billing identity object |
| `onboarding`, `approval_status`, `vendor_status` | Explain unfinished setup, awaiting/rejected approval or suspension; no second setup/approval status. Backend still decides trial grant. |
| `subscription.plan_name`, `monthly_price`, `currency` | Display the agreed plan and full monthly fee, including during trial. Proposed Test values are ₹299 and INR; the supplied response currently says Free/0. |
| `subscription.trial_days` | Configured trial length, proposed 14; **not days remaining**. The supplied response currently has 0. |
| `subscription.trial_ends_at` | Original granted trial expiry or null. Already mapped by the app and present in the OpenAPI example; absent from the supplied response. |
| `subscription.limits`, `subscription.usage` | Quota data; the Plan page no longer shows usage against limits |
| `data.eligible_features` | Reuse the existing list for effective permissions; do not add another capabilities list |
| Envelope `timestamp` | Server as-of time; add an explicit timezone (`Z` or offset), rather than another `server_time` field |

Keep `tier`, legacy subscription `status` and `yearly_price` in the context without changing their
meaning or inventing a new tier. `FREE`/`ACTIVE` are not paid-membership evidence. The backend must
populate `plan_name`/`monthly_price` with the agreed offer; a free trial does not make its future
monthly fee zero. These are requested updates, not claims about the response supplied today.

**Units:** keep the current major currency units: `monthly_price: 299.00` means ₹299, not 299 paise.
Proposed preparation/refund amounts use the same units. Convert accurately to integer paise at a
payment boundary, not by changing existing field units. Annual billing remains outside this scope.

**Time:** the supplied timestamp has no timezone. The frontend must not silently interpret it as
UTC or device-local time for billing. Backend must include the offset on that timestamp and all
billing dates. Mocks with the extension use explicit UTC; the unchanged current example retains
the missing offset as a compatibility case.

## Add only this billing information

These **13 fields** live under `data.subscription.billing`. Nested cancellation/refund objects are
null when absent. They describe backend decisions; the browser does not calculate entitlement.

| Field | Values / purpose |
|---|---|
| `revision` | Monotonic per-vendor version for a consistent context snapshot; older responses cannot overwrite newer billing/features. Backend still serializes concurrent writes. |
| `trial_status` | `not_started`, `active`, `ended`, `ineligible`. Expresses trial state and new-trial ineligibility without a separate eligibility/reason object. |
| `trial_days_remaining` | Server-counted integer, 0 after expiry, null before grant or when ineligible. Original expiry stays in `subscription.trial_ends_at`. |
| `autopay_status` | `not_configured`, `pending`, `confirmed`, `failed`, `revoked`. Authorisation is separate from a platform-fee payment. |
| `payment_status` | `none`, `pending`, `confirmed`, `failed` for the latest due platform fee. Token authorisation is excluded. A failed renewal must replace the old payment label, while `paid_through` preserves historic coverage. |
| `paid_through` | End of confirmed paid coverage, or null. Remains unchanged by cancellation or an unintended debit awaiting refund. |
| `next_charge_at` | Next scheduled first fee/renewal, or null when no collection is scheduled. Includes rejoining at retained coverage end. |
| `access_status` | `SETUP_INCOMPLETE`, `TRIAL`, `TRIAL_ENDED`, `PAID`, `PAYMENT_REQUIRED`. Backend-owned membership status; cannot override approval/suspension. |
| `store_visible` | Effective marketplace visibility, also enforced by the server. Kept separate because approval/activation and billing access alone do not establish visibility. |
| `available_actions` | Array of `setup_autopay`, `pay_first_fee`, `cancel`. Controls come from this list; refresh remains available independently. |
| `cancellation` | Null or `{status, requested_at, effective_at}`. Status is `requested`, `scheduled`, `confirmed` or `failed`; backend receipt time and effective stop date are separate. |
| `refund` | Null or `{status, amount}`. Status is `owed`, `pending`, `completed` or `failed`; amount is in `subscription.currency`. Only the approved cancellation-race refund is in scope. |
| `notice` | Nullable safe display text for pending/failed outcomes, reminders or support recovery. No duplicate recovery DTO or dedicated reminder schedule. Never parse this text to decide actions. |

Example addition during a trial; all other context fields remain in the existing envelope:

```json
{
  "trial_ends_at": "2026-10-15T10:00:00Z",
  "billing": {
    "revision": 1,
    "trial_status": "active",
    "trial_days_remaining": 10,
    "autopay_status": "not_configured",
    "payment_status": "none",
    "paid_through": null,
    "next_charge_at": null,
    "access_status": "TRIAL",
    "store_visible": true,
    "available_actions": ["setup_autopay"],
    "cancellation": null,
    "refund": null,
    "notice": null
  }
}
```

The retained boundary comes from the existing trial expiry or `paid_through`; no duplicate retained
date/current-period object is needed. Backend keeps the original boundary and complete history in
its ledger. `cancellation` describes the current agreement only: clear it when a replacement is
prepared, so an old confirmed cancellation never labels the new agreement cancelled. Refund
obligations remain visible across replacements. If several cancellation-race refunds are unresolved,
return their combined amount and progress; report failure if any needs recovery and completion only
after all are confirmed. Individual charge/refund IDs and history stay server-side.

For permissions, retain existing feature meanings. The proposal keeps `ORDERS` for access to the
orders surface and adds `FULFILL_EXISTING_ORDERS` and `NEW_ORDERS` to distinguish allowed work after
expiry. Expired examples retain `VIEW`, `ORDERS`, `FULFILL_EXISTING_ORDERS`, removing `CATALOG` and
`NEW_ORDERS`. Billing/account access remains available under the existing authenticated routes.
The supplied response has only `DASHBOARD`, `VIEW`, `CATALOG`; these feature additions require backend
agreement and enforcement. No frontend-only route gates are introduced by this proposal.

## Three writes, then refresh context

The existing context endpoint handles all reads. Backend defines/publishes only the missing write
contracts; no invented URL is called. Requests below use operation names in the mock dataset.

| Operation | Submitted information | Minimal response / next step |
|---|---|---|
| `prepareCheckout` | selected `vendor_id`, setup/first-fee `action`, `idempotency_key` | `attempt_id`, public `key_id`, `subscription_id`, `amount`, `currency`, `charge_at`, nullable `authorisation_amount`, `expires_at` |
| `submitCheckout` | selected vendor, `attempt_id`, `razorpay_payment_id`, `razorpay_subscription_id`, `razorpay_signature` | Accepted/rejected result; refresh vendor context for authorisation/payment progress |
| `requestCancellation` | selected vendor and `idempotency_key` | Receipt accepted/rejected; refresh context for requested/scheduled/confirmed/failed state and any refund |

Use the existing response envelope. Write acknowledgement can have `data: null`; an accepted
response alone never grants access or confirms cancellation. Preparation is transient action data,
not a second status source: `charge_at: null` means pay now; a timestamp means future collection.
Compare its fee/date with the context display and obtain explicit agreement to any change.
An optional authorisation charge is disclosed separately. The mock's ₹5 charge and ten-minute
attempt expiry are illustrative, not promises about actual provider behaviour.

All reads of ongoing payment/cancellation/refund state return through vendor context. After a write,
lost response, refresh click, focus return or access boundary, invalidate/bypass the cached context
and read again; the current cache retains successful reads indefinitely. Update the shared vendor
context so the billing panel, plan summary and effective features do not disagree. An old read must
not replace a newer revision, even if its request completed later. A failed refresh leaves a clearly
stale snapshot and recovery action; it cannot preserve access beyond the backend's boundary.

No provider IDs, cycle counts, payment ledger, signature fields, secrets, merchant configuration or
reconciliation history are needed in every context read. The server owns them. Keep one idempotency
key per logical write, reconcile before retry/replacement, and reject keys reused with different
input. Backend verifies ownership/signatures and uses stored attempts, never browser fee/date claims.

Failures use the existing `timestamp/success/status` envelope with safe `message` and proposed
`error_code`; optional `retry_after_seconds` is needed only for throttling/temporary unavailability.
The dataset keeps representative authentication, ownership, stale/action/attempt, signature,
idempotency and provider-failure cases. Error field spelling/status mapping still needs OpenAPI
agreement. Honour `success: false` even in HTTP 200 and refresh context before offering new work.

## What stays covered

The [product decisions](./VENDOR_BILLING_DECISIONS.md) are unchanged: approval-triggered independent
trial, optional AutoPay at its original end, immediate signup after expiry, no grace, retained
existing-order fulfilment, cancellation with retained coverage, full refund of an unintended fee
after timely cancellation, and rejoining/retry without resetting the billing boundary. On
24 September 2026 they were amended: UPI is decided alongside cards (on standby until an account can enable it), and a scheduled fee still
pending or retrying keeps service until its collection halts
([UPI and collection retries](./VENDOR_BILLING_DECISIONS.md#upi-and-collection-retries--24-september-2026)).

The backend must persist and enforce those rules, reconcile callbacks/webhooks/jobs, prevent
duplicate chargeable subscriptions/refunds, and expose the resulting context. A retrying scheduled
fee is `payment_status: pending` with service kept. Only a halted collection is
`payment_status: failed`, shown while the original `paid_through` is retained; the backend then
cancels that subscription. A successful retry keeps the original cycle end. Pending authorisation and pending refunds cannot
grant access. [API gaps](./API_GAPS.md#backend-acceptance-evidence-before-production-wiring) owns the
server acceptance checklist.

The 33 context fixtures include the unextended current response, ineligibility and all previous
trial/payment/renewal/cancellation/refund/rejoining scenarios. `authorisation_revoked_paid` is the
paid-coverage variant of `authorisation_revoked` and uses only existing fields. Four preparation examples, 12 errors
and eight journeys remain; on 25 September `renewal_retry` was split so a retried renewal keeps the store open and
`renewal_halted` ends in the halted failure. Feed `contexts.<scenario>` through the proposed context/billing mapper;
stamp mock/demo/preview/backend provenance in the service, not the wire payload. Preserve the complete
envelope and unrelated context fields. Missing `billing` means billing unavailable, never a granted
trial or payment; the current context must still load the existing vendor dashboard normally.

Fully simulated tests stub Checkout and use fixed server timestamps. Fake IDs never reach Razorpay.
Real Test Checkout uses supplied real configuration and retains unverified callbacks; fixture
confirmation does not verify them. Keep the existing injected service seam and explicit mock/demo
selection. The app's current mapper discards these additions, so implementation must extend it and
the shared context type/cache before wiring the panel. No application behaviour changes in this
documentation revision.

For the meeting: agree the minimal context extension, effective feature meanings, timezone/price
population and three write contracts. Assign ownership of trial grant, verification, cancellation,
refund recovery and access enforcement. Production tax/invoicing, other refunds, reminder delivery
and finite production schedule policies remain later decisions. Current work stays in Test Mode
with cards; eMandate remains excluded. Publish OpenAPI and safe response examples when implemented,
then replace fabricated extensions while retaining the lifecycle tests.
