# Razorpay research: vendor platform subscriptions

Research date: **18 September 2026; hybrid/cancellation review 19 September 2026**.
**Amended 29 September 2026** for the [early first fee](../VENDOR_BILLING_DECISIONS.md#early-first-fee--29-september-2026): paying during the trial now charges the first ₹299 at
once as an upfront add-on, with the subscription's `start_at` one billing month after the trial end.
Passages describing optional AutoPay with the first fee at the trial end are marked as withdrawn.
The Razorpay calls behind the early first fee were **verified on a Razorpay Test account on
30 September 2026**; the [backend billing brief](../VENDOR_BILLING_BACKEND_BRIEF.md#7-razorpay-recipes-and-verified-facts) records them.
Sources: current official Razorpay documentation, including
its Markdown pages where the HTML/browser reader could not load the content. Scope: registered
vendors paying MithraDirect for their store's platform membership. Customer purchases, vendor
settlements, and customer-to-vendor payments are outside this work.

This is research and an input to the backend brief. The [billing decision record](../VENDOR_BILLING_DECISIONS.md)
owns the approved hybrid and cancellation rules; their inclusion here does not mean production
billing exists. The [backend billing brief](../VENDOR_BILLING_BACKEND_BRIEF.md) owns missing backend capabilities;
[API architecture](../API_ARCHITECTURE.md) owns implementation boundaries.

## Evidence and product inputs

- **Product requirements:** one INR plan at ₹299/month; one eligible 14-day platform
  trial after completed onboarding and successful approval; paying during the trial collects the
  first monthly fee at once for a paid period starting at the original expiry (the early first fee;
  until 29 September 2026, optional AutoPay setup scheduled the first fee for that date). After expiry, explicit signup
  collects the first fee upfront. Trial/paid coverage survives ordinary cancellation until its
  existing end. The user supplied Test plan `plan_TcleJ0esLkwUPM`, named
  `MITHRADIRECT_MONTHLY_PLATFORM_FEE`. The discussed `total_count: 12` is a test setting only.
- **Documented facts:** provider behavior below has a nearby official source link. Account
  enablement, bank availability and real response fields still need confirmation with safe test data.
- **Recommendations:** MithraDirect orchestration and backend requirements are explicitly labeled;
  they are proposed application behavior, not existing endpoints or Razorpay guarantees.
- **Actually tested in this research:** official documentation retrieval only. No Checkout payment,
  signature, webhook, recurring debit, cancellation or schedule update was executed by the research
  task. Implementation tests and later manual observations must be recorded separately. The
  30 September 2026 Test-account verification of the early first fee is in the [backend billing brief](../VENDOR_BILLING_BACKEND_BRIEF.md#7-razorpay-recipes-and-verified-facts).

## Checkout contract

The subscription integration uses the official script
`https://checkout.razorpay.com/v1/checkout.js`, constructs `new Razorpay(options)` and calls `open()`
after an explicit vendor action. The subscription guide returns these fields through the handler:

```ts
{
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}
```

These are authentication transaction results, not MithraDirect access claims.
[Subscription integration](https://razorpay.com/docs/payments/subscriptions/integration-guide/).

| Concern | Documented subscription behavior |
|---|---|
| Required Checkout inputs | Public `key` and `subscription_id`; the subscription determines the amount. |
| Presentation inputs | `name`, `description`, `image`, `prefill` and `theme` appear in the subscription example. |
| Plan selection | The server creates the subscription against a plan before Checkout opens. A plan ID or a hosted subscription URL does not replace `subscription_id`. |
| Success signature | Verification uses the payment ID and the subscription ID held by the server. |

Sources: [Test subscription Checkout](https://razorpay.com/docs/payments/subscriptions/test/),
[subscription integration](https://razorpay.com/docs/payments/subscriptions/integration-guide/).

A regular one-time payment integration creates an Order and passes `order_id`; its callback has
`razorpay_order_id`. Do not copy that order flow or its signing input into this subscription
integration. Both products use the same Checkout script, but their server orchestration differs.
[Standard payment integration](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/).

**Recommendation:** the reusable Checkout module accepts configuration, loads the script once,
opens one modal, and emits browser outcomes. It must not own prices, trial clocks, vendor
eligibility, subscription creation, signature secrets or access grants. The subscription service
owns configuration, verification submission and refreshed billing status. During development,
provider-supplied configuration and unverified callback results must be clearly labeled.

### Browser success, failure, dismissal and retry

The Standard Checkout handler runs for successful completion. `payment.failed` provides an error
object with fields such as `code`, `description`, `source`, `step`, `reason` and `metadata`.
`modal.ondismiss` reports modal closure. With retries disabled it can also fire after a failure.
Retries default to enabled; web Checkout does **not** support `retry.max_count`. A redirect
`callback_url` is distinct from a webhook.
[Checkout events and options](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/).

**Recommendations for the application:**

| Browser observation | Presentation and reconciliation |
|---|---|
| Script fails or configuration is unavailable | Show a useful error and an explicit retry action. No access change. |
| Checkout opens | Show that setup/payment is in progress. Do not activate a trial or paid plan. |
| `payment.failed` while retry remains possible | Show the failed attempt without discarding the Checkout instance; a later retry may succeed. |
| Vendor closes Checkout | Show dismissed/unconfirmed. Closing a modal does not prove that an asynchronous payment failed. |
| Handler returns callback fields | Submit verification, show confirmation pending, and refresh authoritative billing status. |
| Verification request fails or times out | Preserve existing entitlement and provide status refresh; do not start a second subscription automatically. |
| Backend confirms the early first fee during trial | Show paid coverage from the trial end to one billing month later, with the remaining trial days kept, and the next ₹299 at that period's end. (Until 29 September 2026: show the scheduled first fee and do not mark the monthly fee paid.) |
| Backend confirms first ₹299 membership payment after expiry | Record paid coverage for the confirmed period. |

Guard against repeated clicks, stale callbacks after navigation/account changes, and a dismiss
event overwriting a success callback. Browser failure/dismissal must never revoke an otherwise
valid trial. If an attempt remains unconfirmed past the original trial expiry, the shop is hidden
until the backend confirms it (decided 29 September 2026); the browser cannot extend the trial.

## Verification and access authority

Razorpay requires server-side signature verification. The subscription signing input is:

```text
HMAC-SHA256(key_secret, razorpay_payment_id + "|" + server_subscription_id)
```

Use the subscription ID retrieved from the server's own record, not the browser's claimed ID.
Keep the secret off the frontend.
[Subscription signature verification](https://razorpay.com/docs/payments/subscriptions/integration-guide/).

`subscription.authenticated` can represent a token authorisation, upfront amount, plan amount or
combination. `subscription.activated` indicates a lifecycle transition; `subscription.charged`
indicates a successful charge. The charged payload includes payment amount, currency, capture
status and invoice linkage. Therefore an authenticated mandate or lifecycle label alone cannot
establish that the vendor paid the monthly platform fee. For an upfront add-on with a future start
(the early first fee), the subscription stays `authenticated` with `paid_count` 0 until its start, so
the paid evidence is the captured payment on the add-on invoice, not `subscription.charged`
(verified on Razorpay Test, 30 September 2026).
[Subscription event definitions](https://razorpay.com/docs/payments/subscriptions/subscribe-to-webhooks/),
[subscription webhook payloads](https://razorpay.com/docs/webhooks/subscriptions/).

**Backend recommendation:** bind each billing attempt to the authenticated vendor and store;
validate the returned ID against that attempt; verify the signature; retrieve/reconcile the
provider subscription, payment and invoice; check mode, plan, currency, amount and relationship.
Grant paid access only for the confirmed first membership charge of 29900 paise INR for the chosen
store (the API itself reports rupees, `sale_price: 299`), not a refundable token authorisation. Apply entitlement changes atomically and idempotently.
Keep the original trial record unchanged across authorisation, cancellation and recovery. A valid
signature authenticates the callback; it does not implement eligibility or entitlement policy.

Webhooks require their own HMAC-SHA256 validation over the **raw request body** using the webhook
secret and `X-Razorpay-Signature`. Deduplicate with `x-razorpay-event-id`; delivery can repeat and
arrive out of order. This verification is separate from Checkout verification.
[Validate and test webhooks](https://razorpay.com/docs/webhooks/validate-test/).

**Backend recommendation:** persist verified event receipt before acknowledging processing,
reconcile stale/out-of-order events against provider state, and make callback and webhook paths
converge on the same billing record. Handle authenticated, charged, pending, halted, cancelled,
completed, paused, resumed and updated events as applicable. Provide authenticated status reads
so a browser refresh or lost callback can recover. Do not equate a webhook delivery delay with a
payment failure.

## Immediate start and a future billing date

Subscription creation requires `plan_id` and `total_count`. `quantity` defaults to 1. Omit
`start_at` for an immediate start after authorisation; supply a Unix timestamp in **seconds** for
a future start. `expire_by` is the authorisation deadline, not trial expiry. `customer_notify`
selects Razorpay-managed communication. `addons` introduces an upfront charge.
[Create subscription API](https://razorpay.com/docs/api/payments/subscriptions/create-subscription/).

Razorpay documents its trial as the interval between authentication and a future subscription
start. An upfront add-on charges at authentication, before that start. The early first fee uses
exactly one: a ₹299 add-on with `start_at` one billing month after the trial end, so Razorpay's
first automatic charge is the second month (verified on Razorpay Test, 30 September 2026).
Cancellation before the start is possible, but only immediately.
[Creating a subscription trial](https://razorpay.com/docs/payments/subscriptions/create/).

For a future-start subscription without an add-on, successful authentication produces
`authenticated`; billing is not yet active. For an immediate-start subscription, the first charge
advances it to `active`. At a scheduled start, activation attempts a charge. An unauthenticated
subscription expires if its configured start passes; an expired subscription cannot be reused.
[Subscription states](https://razorpay.com/docs/payments/subscriptions/states/).

### Approved hybrid: independent trial with optional future billing

**Amended 29 September 2026** by the [early first fee](../VENDOR_BILLING_DECISIONS.md#early-first-fee--29-september-2026). The trial row of the table below now prepares an
upfront ₹299 add-on with `start_at` one billing month after the trial end, and Checkout completion
pays the first month; the original wording is kept for history.

MithraDirect grants the eligible identity's trial when onboarding is completed **and** genuine
approval is recorded. No provider object, Checkout or mandate is required then. When the vendor
voluntarily chooses **Pay Now**, the backend selects the schedule using its original trial record:

| Backend entitlement at setup | Intended provider preparation | Meaning of Checkout completion |
|---|---|---|
| Trial still active | *Withdrawn 29 September 2026:* future `start_at` equal to the persisted trial expiry; no upfront platform-fee add-on. *Now:* an upfront ₹299 add-on; `start_at` = trial expiry + one billing month | *Withdrawn:* authorisation for future fees. *Now:* the first month (trial expiry to one month later) is paid; trial expiry stays unchanged |
| Trial expired | Immediate-start subscription, after reconciling any existing attempt | First monthly fee must be confirmed before paid access |

For example, setup with ten days left covers only those remaining ten days before the paid start.
It neither discards them nor creates another fourteen-day trial. The provider's interval from
authorisation to billing and MithraDirect's full entitlement have different start events. Failure,
dismissal and cancellation do not change the platform's original trial dates.

The CTA remained **Pay Now** by explicit product decision; the Live API and the development
prototype now use state-specific labels ("Pay ₹299 with Razorpay", "Keep shop open"). Explain
when the paid month starts during the trial and immediate collection after expiry.
The checked-in approval enum discrepancy is documented in [API gaps](../API_GAPS.md#vendor-platform-billing).

**Backend recommendation:** prepare and reconcile schedules with server time. A Checkout opened
before expiry may finish afterwards. Fetch the original subscription before offering replacement
payment, and require explicit agreement to a changed charge schedule. Do not backdate a new
subscription, extend the trial or treat a pending mandate as paid access. Method limits below may
prevent near-expiry setup or exact-date collection; these need evidence, not a browser workaround.

This supersedes the earlier Option A/Option B choice, trial-forfeiting early conversion, and the
proposal that mandate authorisation must precede platform trial access.

### Cancellation and retained access

Razorpay supports immediate and cycle-end cancellation. Its API rejects `cancel_at_cycle_end: true`
before the first billing cycle and directs callers to immediate cancellation (`false`). For a
paid cycle, cycle-end cancellation takes effect at the end; provider status can remain `active`
until then. In the final cycle, that request can be rejected because no further cycle remains.
Concurrent operations can also be rejected; fetch state before deciding how to retry.
[Cancellation API](https://razorpay.com/docs/api/payments/subscriptions/cancel-subscription/).

**Application of the approved policy:** cancel a pre-start subscription immediately and preserve
the independently granted trial; schedule the end of paid renewal while retaining confirmed
paid-through coverage. After an early first fee the subscription is pre-start at Razorpay
(`authenticated`) yet already paid for its first month: only an immediate cancel works, and
MithraDirect keeps the trial and the paid month itself (verified on Razorpay Test, 30 September
2026: the paid ₹299 invoice stays paid). Store cancellation progress separately from access and provider lifecycle
status. An accepted request, a scheduled stop and a terminal cancellation are distinct observations.
Ordinary cancellation retains paid coverage without an automatic prorated refund in v1. Provider
cancellation does not itself request or confirm a refund.

**Approved MithraDirect policy:** if the backend received a cancellation before the original
trial/paid boundary but an in-flight debit still collected the next fee, refund that fee in full.
The backend receipt time governs eligibility even when provider confirmation comes later. Retain
only the original coverage; a pending refund grants no extra period. This is a product obligation,
not a provider rollback or instant-refund guarantee. Refunds are paid from the merchant's Razorpay balance, and
Razorpay's fee on the refunded payment is not reversed (Razorpay docs; a full refund refused for a
balance shortfall was observed on Razorpay Test, 30 September 2026). Refund recovery remains a backend requirement in the
[backend billing brief](../VENDOR_BILLING_BACKEND_BRIEF.md#cancellation-and-concurrent-operations).
Whether stopping after an early first fee, before the trial end, earns a refund is undecided.

Cancelled subscriptions cannot restart; expired unauthenticated subscriptions cannot be reused.
[Subscription states](https://razorpay.com/docs/payments/subscriptions/states/).
The documented cancellation of scheduled changes concerns a pending subscription **update**;
it does not establish a way to undo a scheduled cancellation.
[Cancel scheduled update](https://razorpay.com/docs/api/payments/subscriptions/cancel-update/).

**Evidence gaps:** the reviewed cancellation contract does not guarantee recall of a debit already
submitted to a bank or give a complete cancellation matrix for pending/halted states. Test those
states, lost responses, boundary races and final-cycle completion. Preserve a real charge in the
ledger even if its event arrives after cancellation; resolve its coverage/refund under the agreed
policy. Do not announce that all future debits are stopped while provider confirmation is pending.

### Recovery and schedule changes

Rejoining before retained trial/paid coverage ends is approved. Since 29 September 2026 it charges
₹299 at once for the period starting at that boundary (an upfront add-on with `start_at` one month
later), after cancelling the old subscription immediately. Replacement must preserve that
boundary and cannot leave two subscriptions able to charge for the same store. A cancelled mandate
must not be represented as restored. Cancellation uncertainty
blocks making a replacement chargeable; pending status must remain visible and recoverable.

The update API documents `start_at` and `schedule_change_at`, but rejects UPI/eMandate updates;
domestic-card updates have further restrictions. These are relevant to exceptional recovery,
not a required early-conversion step in the approved hybrid. Neither a Checkout amount nor
reopening its modal is a supported way to reschedule an existing subscription.
[Update API](https://razorpay.com/docs/api/payments/subscriptions/update-subscription/),
[update limitations](https://razorpay.com/docs/payments/subscriptions/update/).

## Payment methods and authorisation charges

Subscriptions documents support cards, UPI AutoPay and eMandate. Availability depends on enabled
methods, supported banks/apps and the merchant account; the platform should not promise that
every payment method offered for one-time payments is available for recurring payments.
[Supported subscription methods](https://razorpay.com/docs/payments/subscriptions/supported-payment-methods/),
[subscription settings](https://razorpay.com/docs/payments/subscriptions/settings/).

| Method | Evidence for initial authorisation | Practical implication |
|---|---|---|
| Cards, future start without upfront fee | Test guide documents a ₹5 authorisation that is refunded. | The monthly ₹299 fee has not been paid. Verify account behavior before promising refund timing. Withdrawn for the trial on 29 September 2026. |
| Cards, future start with an upfront ₹299 add-on | Hosted Checkout said "a payment of ₹299 will be charged now"; no ₹5 (verified on Razorpay Test, 30 September 2026). | The early first fee. UPI with an upfront amount is unverified and shows only when the total is under ₹15,000. |
| UPI AutoPay | Subscription FAQ describes a refundable ₹5 token validation payment for a card or UPI ID. Razorpay's separate AutoPay product page advertises ₹1 registration. | There is a product/account-specific discrepancy; do not hardcode a universal ₹5 or ₹1 promise. Confirm the selected Checkout flow. |
| eMandate | Recurring Payments eMandate FAQ describes possible ₹1/₹2 bank validation deductions refunded in 3–5 bank working days. | This is method-level guidance from the lower-level product, not proof of the exact Subscriptions Checkout amount; confirm the account/bank behavior. |
| Immediate start | The Test guide charges the plan amount in its immediate-start example. | Await confirmation of the first real membership charge, separately from authorisation. |

Sources: [Test authorisation examples](https://razorpay.com/docs/payments/subscriptions/test/),
[Subscriptions capture FAQ](https://razorpay.com/docs/payments/subscriptions/faqs/),
[UPI AutoPay product](https://razorpay.com/upi-autopay/),
[eMandate registration FAQ](https://razorpay.com/docs/payments/recurring-payments/emandate/faqs/).

Subscription fees and upfront amounts are documented as auto-captured; token authorisation is
refunded. eMandate confirmation can be delayed, so a completed browser interaction is not enough
to show paid activation.
[Subscriptions FAQ](https://razorpay.com/docs/payments/subscriptions/faqs/).

**Recommendation:** initially validate the card Test flow, then exercise each method intended for
launch. Use cautious, method-specific authorisation copy. Do not promise that no money can be
debited during optional setup, and do not collect card, UPI PIN or bank credentials in MithraDirect UI.

UPI mandate authorisation is documented as real-time, while subsequent debits can complete by
9 PM IST on the scheduled date and potentially the next day with retries. eMandate registration and payment
cannot happen the same day, and bank confirmation can lag. Reviewed documentation establishes no
universal minimum lead time guaranteeing setup minutes before expiry. A provider `start_at` is a
schedule, not a guarantee of cash confirmation at that instant.
[Method timing FAQ](https://razorpay.com/docs/payments/subscriptions/faqs/).

The Test guide says future-start authentication has no webhook events, while the event guide
defines `subscription.authenticated` for authorisation transactions. This documentation mismatch
requires provider-state reconciliation; the app cannot depend solely on that event arriving.
[Test guide](https://razorpay.com/docs/payments/subscriptions/test/),
[subscription events](https://razorpay.com/docs/payments/subscriptions/subscribe-to-webhooks/).

## Notifications and recurring failures

Razorpay documents lifecycle email/SMS for link creation, initialisation, successful charges,
failures, completion, payment-method changes, halted billing, cancellation and updates. These
pages do not document a configurable MithraDirect 3-days-left/last-day trial campaign or WhatsApp
delivery. `customer_notify` does not define such a schedule.
[Subscription notifications](https://razorpay.com/docs/payments/subscriptions/notifications/),
[notification ownership parameter](https://razorpay.com/docs/api/payments/subscriptions/create-subscription/).

The card FAQ describes bank pre-debit notifications, but contains both 24-hour and 36-hour timing
descriptions. Those notices are about a debit, not a guarantee of product trial reminders.
[Card notification FAQ](https://razorpay.com/docs/payments/subscriptions/faqs/).

**Recommendation:** schedule MithraDirect reminders from the authoritative expiry, with proposed
offsets such as 3 days left and the last day still awaiting approval. Store delivery/deduplication
state and return in-app status. Distinguish setup needed, confirmed future billing and cancelled
renewal; suppress payment-needed wording once an early first fee is paid, including while it is
being confirmed. Channels and delivery
times remain product decisions. A trial without a mandate has no provider debit notice to rely on.

Cards and UPI document an initial scheduled attempt plus retries on each of the three days after
the debit date, then
`halted` if unsuccessful; recovery preserves the subsequent billing schedule. eMandate retries
wait for bank confirmation; documented holiday handling can move a debit one or three days earlier. Manual
charging of domestic cards is not supported by the retries guide. A `halted` subscription still
raises invoices but does not charge them; it returns to `active` if the customer changes the card,
though the FAQ also says UPI-authorised subscriptions cannot be updated.
[Payment retries](https://razorpay.com/docs/payments/subscriptions/payment-retries/),
[Subscriptions FAQ](https://razorpay.com/docs/payments/subscriptions/faqs/).

Razorpay's Subscriptions Test guide documents cards only. The `success@razorpay` and
`failure@razorpay` UPI IDs are documented for one-time payments; whether they authorise a Test
UPI AutoPay subscription is unverified (checked 24 September 2026).
[Subscriptions test guide](https://razorpay.com/docs/payments/subscriptions/test/),
[Test UPI details](https://razorpay.com/docs/payments/payments/test-upi-details/).

**Approved launch rule:** offer only methods proven by testing to meet the required timing for the
relevant phase. Cards and UPI are decided, with UPI's accounts and launch evidence in the
[decision record](../VENDOR_BILLING_DECISIONS.md#upi-accounts-and-launch-evidence).
eMandate is excluded; MithraDirect's Checkout account still offered it on 30 September 2026 and
must switch it off before release. Before reconsidering it, establish a configuration that meets
the early first fee's "₹299 now" and the exact next charge date. Earlier holiday debits would
conflict with the approved policy. Treat an unsupported timing promise as a launch-method gap.
Since 24 September 2026, a scheduled fee that is pending or being retried keeps service; only a
`halted` collection is a failure that stops it, with no grace after that. A fee paid immediately
after expiry still needs confirmation before access. Failed renewal must not erase existing paid
coverage.

**Approved retry policy:** when a scheduled charge succeeds on retry, keep its original billing
cycle and preserve the renewal date. Do not create a new month from retry
confirmation or compensate by extending the period. Other refund cases, pause/resume and finite
schedule completion remain product questions; ordinary cancellation has no automatic proration.

## Test lifecycle, expiry and safe reuse

The Test Dashboard's **Charge this now** action simulates future recurring charges. Test card
tokens support subsequent debits for only three days after creation. Subscription updates cannot
be tested after subsequent simulated charges beyond the initial authentication. Use separate
fresh test subscriptions for update and renewal scenarios.
[Test lifecycle constraints](https://razorpay.com/docs/payments/subscriptions/test/).

Cancelled subscriptions cannot restart; expired subscriptions cannot be reused. A completed
subscription represents the end of its configured lifecycle. An already authenticated/active
subscription is not a fresh signup fixture; the integration guide warns against paying the next
billing cycle during the current one.
[Lifecycle states](https://razorpay.com/docs/payments/subscriptions/states/),
[Checkout stage errors](https://razorpay.com/docs/payments/subscriptions/integration-guide/).

**Recommendations for development:**

- Inspect the supplied Test subscription's current status, account/mode, plan, quantity, start,
  expiry and payment history before opening it. Its hosted URL is for the same provider object;
  it is not a reusable subscription factory.
- Use fresh per-scenario objects for immediate paid signup, future authorisation, abandoned setup,
  expired setup and cancellation. Do not share one subscription across vendors or scenario intents.
- Keep `total_count: 12` explicitly marked as a finite test schedule. The production duration and
  behavior when the schedule completes need an approved decision; no “forever” assumption.
- Simulate a scheduled debit promptly within the Test token window. Waiting 14 actual days with
  the original Test card token does not establish that the production 14-day schedule works.
- Never bundle API secrets or webhook secrets, or log personal payment/contact details. Test Mode
  identifiers/configuration do not make callback data authoritative.

### Evidence to collect in the application preview and backend integration

| Check | Required observation | Status for this research |
|---|---|---|
| Official Checkout opens | Correct Test merchant, subscription and expected amount/schedule | Not executed |
| Successful immediate signup | Callback captured; backend confirms linked captured first ₹299 membership charge | Not executed here; the backend billing API now exists (see the backend billing brief) |
| Failed attempt then retry | Failure shown; later success remains possible; no duplicate creation | Not executed |
| Dismissal and reload | No local access grant; authoritative status can be refreshed | Not executed |
| Future authorisation | Confirmed mandate shown separately from first paid membership | Not executed |
| Trial grant and clock | Completed onboarding plus genuine approval grants one trial without Checkout; delayed approval consumes no days | Policy approved; backend pending |
| Optional setup during trial | Original expiry preserved, including ten days remaining; first monthly fee scheduled for that expiry | Withdrawn 29 September 2026 |
| Cancellation before first fee | Provider subscription cancelled, no first monthly fee, original trial retained | Withdrawn 29 September 2026 |
| Early first fee | One ₹299 now; paid period from the trial end; `start_at` one month after it; trial retained | Razorpay side verified on Test, 30 September 2026 (card); backend pending |
| Stop after an early first fee | Immediate Razorpay cancel; paid ₹299 kept; trial and paid month retained | Razorpay side verified on Test, 30 September 2026; backend pending |
| Cancellation during a paid period | No subsequent renewal, access retained to confirmed paid-through date | Policy approved; not executed |
| Setup/cancellation boundary races | No duplicate chargeable subscriptions, lost charges, false cancellation confirmation or trial reset | Backend pending |
| Debit despite timely cancellation | Full refund based on backend receipt time, original coverage retained, duplicate/failed refund recovery tracked | Policy approved; not executed |
| Successful scheduled-charge retry | Service continued through the retries; renewal date unchanged | Policy approved; not executed |
| External mandate revocation | Provider/bank cancellation reconciles to billing actions without erasing retained trial/paid coverage | Not executed |
| Webhook reconciliation | Signature failures rejected; duplicates/out-of-order delivery safe | Backend pending |
| Simulated renewal | Charged/pending/halted/cancelled outcomes reflected from authoritative state | Backend pending |
| Other launch methods | Actual authorisation amount, refund and timing recorded for each; unavailable until required timing is proven | Launch rule approved; method evidence pending |

## Decisions that must not be hidden in the prototype

The hybrid, cancellation/refund rules, retry recovery and method-validation gate are approved;
remaining decisions are owned by [the billing decision record](../VENDOR_BILLING_DECISIONS.md#remaining-decisions-and-evidence).
Do not infer further product policies from provider behavior or fixtures. The product currently
permits one store per vendor with no trial transfer. Read recommendations against that current record.

The [preview record](../VENDOR_BILLING_PREVIEW.md) owns actual manual and automated observations.
Its earlier immediate-charge and setup-before-trial flows are historical behavior, not validation
of this hybrid. This 19 September review retrieved documentation only; it did not exercise a
payment, cancellation, refund, renewal or real bank mandate.
