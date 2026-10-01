# Vendor billing mock dataset (demo only)

**What this is.** A description of the fabricated
[mock dataset](./examples/vendor-billing/mock-responses.json) that demo mode, the
[development preview](./VENDOR_BILLING_PREVIEW.md) and their tests use
(`src/shared/api/services/vendor-billing-fixture.service.ts`, mapped by
`src/shared/api/mappers/vendor-billing.ts`). It is **not** a backend contract and not a request to
the backend.

**Frozen on the earlier model, on purpose.** The dataset encodes the shape proposed on
19 September 2026: a `subscription.billing` block on the vendor context, plus three proposed writes.
It models the trial AutoPay flow as it stood before 29 September: during the trial, Checkout sets up
AutoPay with a small refundable authorisation now and the first ₹299 at the trial end, and AutoPay
can be turned off before then. Demo mode is frozen with that flow by decision
([Live API billing](./VENDOR_BILLING_DECISIONS.md#live-api-billing--29-september-2026),
[Early first fee](./VENDOR_BILLING_DECISIONS.md#early-first-fee--29-september-2026)).

**Current model.** The Live API reads the backend's own subscription API, and paying during the
trial is the early first fee: ₹299 at once for the month that starts at the trial end. The
[decision record](./VENDOR_BILLING_DECISIONS.md) owns the product rules, and the
[backend billing brief](./VENDOR_BILLING_BACKEND_BRIEF.md) owns the backend contract and its gaps.
The backend never adopted the context extension below; the vendor context has been flat since
29 September 2026.

## Shape

The dataset follows a vendor context response supplied on 19 September: `timestamp`, `success`,
numeric `status`, snake_case `data`, numeric `vendor_id`, `onboarding`, `subscription`,
limits/usage and `eligible_features`. `contexts.current_context` preserves that shape with
anonymised identity and no billing block. The other 32 contexts are fabricated extensions for
frontend tests; they do not establish backend or provider behaviour.

Billing status is read from the context (`GET /v1/vendors/{vendor_id}/context`), with one
`data.subscription.billing` block, the existing plan and trial fields populated, and the same
context refreshed after each billing action. Checkout preparation, callback submission and
cancellation are writes; reading the context never starts a payment, cancellation or replacement.

### Existing context fields the dataset reuses

| Existing field | Billing use in the dataset |
|---|---|
| `data.vendor_id`, `business_name`, `role` | Selected vendor, display name and membership role; no duplicate billing identity object |
| `onboarding`, `approval_status`, `vendor_status` | Unfinished setup, awaiting/rejected approval or suspension; no second setup/approval status |
| `subscription.plan_name`, `monthly_price`, `currency` | The plan and full monthly fee, including during the trial: ₹299, INR |
| `subscription.trial_days` | Configured trial length (14); **not days remaining** |
| `subscription.trial_ends_at` | Original granted trial expiry, or null |
| `subscription.limits`, `subscription.usage` | Quota data; the Plan page no longer shows usage against limits |
| `data.eligible_features` | Effective permissions |
| Envelope `timestamp` | Server as-of time, with an explicit timezone |

`tier`, the legacy subscription `status` and `yearly_price` keep their meaning. `FREE`/`ACTIVE`
are not paid-membership evidence, and a free trial does not make the future monthly fee zero.

**Units.** Rupees: `monthly_price: 299.00` means ₹299, not 299 paise. Preparation and refund
amounts use the same units; paise exist only at a payment boundary.

**Time.** Contexts with the extension use explicit UTC on the envelope `timestamp` and every
billing date. `current_context` keeps its missing offset as a compatibility case.

### The billing block

These **13 fields** live under `data.subscription.billing`. Nested cancellation and refund objects
are null when absent. They stand for backend decisions; the browser does not calculate entitlement.

| Field | Values / purpose |
|---|---|
| `revision` | Monotonic per-vendor version, so an older response cannot overwrite a newer one |
| `trial_status` | `not_started`, `active`, `ended`, `ineligible` |
| `trial_days_remaining` | Server-counted integer, 0 after expiry, null before grant or when ineligible |
| `autopay_status` | `not_configured`, `pending`, `confirmed`, `failed`, `revoked`. Authorisation is separate from a platform-fee payment |
| `payment_status` | `none`, `pending`, `confirmed`, `failed` for the latest due platform fee. A retrying scheduled fee is `pending`; only a halted collection is `failed` |
| `paid_through` | End of confirmed paid coverage, or null; unchanged by cancellation or an unintended debit awaiting refund |
| `next_charge_at` | Next scheduled first fee or renewal, or null |
| `access_status` | `SETUP_INCOMPLETE`, `TRIAL`, `TRIAL_ENDED`, `PAID`, `PAYMENT_REQUIRED` |
| `store_visible` | Effective marketplace visibility |
| `available_actions` | Array of `setup_autopay`, `pay_first_fee`, `cancel`; controls come from this list |
| `cancellation` | Null or `{status, requested_at, effective_at}`; status `requested`, `scheduled`, `confirmed` or `failed` |
| `refund` | Null or `{status, amount}`; status `owed`, `pending`, `completed` or `failed`; amount in `subscription.currency` |
| `notice` | Nullable display text for pending/failed outcomes or reminders; never parsed to decide actions |

Example during a trial:

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

The retained boundary comes from the trial expiry or `paid_through`; there is no separate
current-period object. `cancellation` describes the current agreement only and clears when a
replacement is prepared. Refund obligations stay visible across replacements; several unresolved
refunds report their combined amount, failure if any needs recovery, and completion only after all
are confirmed.

**Features.** The dataset keeps `ORDERS` for the orders surface and adds `FULFILL_EXISTING_ORDERS`
and `NEW_ORDERS` to separate allowed work after expiry. Expired examples keep `VIEW`, `ORDERS` and
`FULFILL_EXISTING_ORDERS`, and drop `CATALOG` and `NEW_ORDERS`. These are fabricated; the live
context returns `DASHBOARD`, `VIEW`, `CATALOG`.

### Three writes, then refresh the context

| Operation | Submitted information | Response / next step |
|---|---|---|
| `prepareCheckout` | Selected `vendor_id`, setup/first-fee `action`, `idempotency_key` | `attempt_id`, public `key_id`, `subscription_id`, `amount`, `currency`, `charge_at`, nullable `authorisation_amount`, `expires_at` |
| `submitCheckout` | Selected vendor, `attempt_id`, `razorpay_payment_id`, `razorpay_subscription_id`, `razorpay_signature` | Accepted/rejected; refresh the context for progress |
| `requestCancellation` | Selected vendor and `idempotency_key` | Receipt accepted/rejected; refresh the context for cancellation and refund progress |

Write acknowledgements can have `data: null`; an accepted response never grants access or confirms
cancellation by itself. `charge_at: null` means pay now; a timestamp means future collection. The
₹5 authorisation and ten-minute attempt expiry are illustrative, not provider promises.

After a write, a lost response, a refresh click, focus return or an access boundary, the demo
reads the context again and updates the shared vendor context, so the billing panel, plan summary
and effective features agree. An older read never replaces a newer `revision`. A failed refresh
leaves a clearly stale snapshot and a recovery action.

Failures use the envelope with a safe `message` and an `error_code`; `retry_after_seconds` appears
only for throttling or temporary unavailability. `success: false` is honoured even in HTTP 200.

## What the dataset covers

The scenarios follow the [product decisions](./VENDOR_BILLING_DECISIONS.md) as they stood on
25 September 2026, before the early first fee: an approval-triggered trial, optional AutoPay with
the first fee at the original trial end, immediate signup after expiry, a collection retry period
that keeps service until a halt, retained existing-order fulfilment, cancellation with retained
coverage, a full refund of an unintended fee after a timely cancellation, and rejoining or retry
without resetting the billing boundary.

The 33 contexts include the unextended current response, ineligibility and the
trial/payment/renewal/cancellation/refund/rejoining scenarios. `authorisation_revoked_paid` is the
paid-coverage variant of `authorisation_revoked`. There are four preparation examples, 12 errors
and eight journeys; `renewal_retry` keeps the store open while a renewal is retried and
`renewal_halted` ends in the halted failure. Each `contexts.<scenario>` is fed through the billing
mapper; the service stamps mock, demo or preview provenance, not the wire payload. A context without
`billing` means billing unavailable, never a granted trial or payment, and still loads the
dashboard normally.

Fully simulated tests stub Checkout and use fixed server timestamps. Fake IDs never reach Razorpay.
