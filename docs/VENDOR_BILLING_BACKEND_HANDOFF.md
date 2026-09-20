# Vendor billing: minimal vendor context additions

**Team meeting handoff · 19 September 2026 · proposed additions, not a shipped contract.**

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
| `subscription.limits`, `subscription.usage` | Preserve the existing usage panel and quota data |
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
after timely cancellation, and rejoining/retry without resetting the billing boundary.

The backend must persist and enforce those rules, reconcile callbacks/webhooks/jobs, prevent
duplicate chargeable subscriptions/refunds, and expose the resulting context. Failed renewal is
shown with `payment_status: failed` while the original `paid_through` is retained; a successful retry
restores coverage only to the original cycle end. Pending authorisation and pending refunds cannot
grant access. [API gaps](./API_GAPS.md#backend-acceptance-evidence-before-production-wiring) owns the
server acceptance checklist.

The 32 context fixtures include the unextended current response, ineligibility and all previous
trial/payment/renewal/cancellation/refund/rejoining scenarios. Four preparation examples, 12 errors
and seven journeys remain. Feed `contexts.<scenario>` through the proposed context/billing mapper;
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
