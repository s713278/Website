# Vendor platform billing: hybrid trial and cancellation

**Status:** hybrid trial, cancellation/refund, retry recovery and launch-method rules accepted;
current Test Mode method scope clarified ·
19 September 2026.
This amends the 18 September decisions. Open edge-case policies are listed below; the development
preview and production backend do not yet implement this model.

Vendors pay MithraDirect a monthly platform fee for their registered store. Customer-to-vendor
payments and recurring delivery subscriptions remain outside this integration. Razorpay Checkout
collects authorisation/payment results; the backend alone confirms membership and platform access.
This prevents an authenticated mandate or browser callback from being mistaken for a paid fee.

**Development authorisation, 19 September:** the user permits fabricated backend data and simulated
outcomes to unblock frontend implementation/testing. The
[backend meeting handoff](./VENDOR_BILLING_BACKEND_HANDOFF.md) supplies the proposed data contract and
fixtures. This does not change the product rules below: simulated entitlement is labelled as such,
and a real Razorpay Test callback remains unverified until a backend confirms it. Production
commercial decisions stay open; mock values are not new commercial policy.

The follow-up context alignment uses the existing vendor context API for all billing status and
keeps only the minimal missing fields. This reduces the transport proposal, without changing trial,
payment, cancellation/refund or retained-access rules. The handoff owns the exact additions.

## Agreed product rules

- The Test Mode total is ₹299/month, INR. Production tax and invoicing treatment remains pending.
- One eligible 14-day trial per verified vendor identity. It starts only when a store has **both
  completed onboarding and received successful approval**. Submission alone does not start it;
  delayed approval must not consume trial days. Repeated completion/approval events or login
  cannot grant another identity trial. The current product allows **one store per vendor**;
  membership and the identity's trial are attached to that store. Trial time cannot transfer to
  another store. Multi-store billing is outside the current scope.
- MithraDirect owns the authoritative trial entitlement and expiry. No Razorpay Checkout,
  authentication transaction or AutoPay setup is required to start or use the trial. The backend
  must expose the missing entitlement information; the frontend displays it and available actions.
  Browser dates and existing incomplete vendor context are not entitlement authority.
- A voluntary billing CTA is available from the beginning of the trial. During an active trial,
  it sets up a Razorpay subscription with its paid start scheduled for the **original trial end**.
  All remaining trial time is retained. The monthly platform fee is due after the trial, rather
  than at setup; a method-specific authorisation/token transaction is a separate matter.
- The CTA label is **Pay Now** in every payment/setup phase. Supporting text must explain the
  phase: during trial, set up AutoPay with the first monthly fee scheduled for the trial-end date;
  after expiry, collect the first fee now to activate paid membership. Explain any method-specific
  authorisation transaction separately. The label does not change the underlying payment timing.
- After unpaid trial expiry, explicit signup uses an immediate-start subscription and collects
  the first monthly platform fee upfront. Paid access requires backend confirmation of that fee;
  a browser success callback or mandate authorisation alone is insufficient.
- After unpaid trial expiry, hide the store from the marketplace and block new orders and new
  vendor operations. Keep billing, account and existing orders accessible, **including permission
  to fulfill orders placed before expiry**. This exception supersedes the initial strictly
  read-only order proposal. Backend enforcement is required; none of these gates ship in the preview.
- There is **no grace period** for a failed or unconfirmed first fee or renewal. Full service stops
  when trial or confirmed paid coverage ends, including while bank/provider confirmation is
  pending. Keep billing, account and existing-order fulfillment available for recovery.
- When a scheduled first fee or renewal succeeds on retry, resume access for the **remainder of
  the original billing cycle**. Preserve its renewal date; do not start a new month from the retry
  or add the interrupted days to the end. This differs from a new immediate-start signup after
  expiry, which begins its own confirmed paid period.
- Cancelling a subscription before the trial ends, before the first platform fee is collected,
  must stop that subscription's future collection while preserving the trial until its original
  expiry. Cancellation neither consumes nor restarts trial time.
- Cancelling during a paid billing period stops future renewal and retains service through the
  period already paid for. "Current month" means that paid billing period, not an assumed calendar
  month or a browser-calculated 30 days. In v1, ordinary cancellation gives **no automatic prorated
  refund**; it retains that paid coverage. This does not remove the refund obligation for an
  unintended fee collected despite timely cancellation.
- A cancellation received by MithraDirect **before the original trial or paid period ends** is
  honoured using the backend's recorded receipt time, even if provider confirmation comes later.
  If an in-flight debit still collects the next monthly fee, refund that unintended fee **in full**.
  Retain only the original trial/paid coverage; the unintended charge and a pending refund grant
  no additional period or grace. Refund completion must be tracked, with no instant-refund promise.
- Vendors may set up AutoPay again before their retained trial or paid period ends. Preserve the
  same expiry and schedule the next fee for that boundary; grant no fresh trial and collect no
  duplicate fee for time already covered. Reconcile the old subscription before enabling a
  replacement. This is permission to rejoin, not a promise that Razorpay cancellation is reversible.
- Offer only payment methods **proven by testing to meet the required timing rules** for the
  relevant signup phase. A method that cannot preserve the free trial or meet after-expiry payment
  requirements stays unavailable until resolved. Neither a generic provider capability list nor
  one successful card test establishes that every method is ready for launch.

## Current Test Mode method scope

The 19 September review is for **Test Mode development**, using the supplied Test credentials and
₹299 monthly plan. Use cards for this iteration; defer UPI validation and production bank acceptance.
The launch-method rule above is a later release gate, not a requirement to test every method before
implementing the hybrid panel. The existing card Checkout observation is a starting point; future
authorisation and the hybrid lifecycle still need their own Test evidence.

**eMandate is removed from this version**, as authorised by the user if it does not fit the model.
Razorpay documents that registration and payment cannot occur on the same day, holiday handling can
move a debit before its scheduled date, and payment confirmation may arrive one or two days later.
These conflict with immediate signup after expiry and with preserving the promised first-fee date
at trial end. Supporting those exceptions would expand this iteration without establishing the
agreed behaviour. This is a scope decision, not a claim that Razorpay lacks eMandate support.
[Razorpay Subscriptions FAQ](https://razorpay.com/docs/payments/subscriptions/faqs/?preferred-country=IN).

Configure the Test account through **Subscriptions → Settings**, with cards enabled and UPI/eMandate
disabled, then check the methods actually offered by hosted Checkout. Razorpay documents these
controls, including disabling eMandate; no custom method selector is required. This documentation
review has not changed the account configuration.
[Subscription settings](https://razorpay.com/docs/payments/subscriptions/settings/?preferred-country=IN).

Removing eMandate does not remove AutoPay authorisation for cards. Reconsider the excluded method
only through a later scope decision with evidence that its timing meets the product rules. The
supplied plan can be reused; consumed subscriptions cannot serve as fresh-signup fixtures. The
[preview record](./VENDOR_BILLING_PREVIEW.md#test-object-inspection) owns the observed object history.

## Approved lifecycle

Let `T` be the persisted trial expiry. These are intended product outcomes, not current API enums.

| Situation | Billing behavior | Entitlement |
|---|---|---|
| Eligible store completes onboarding and approval | Grant the identity's trial without payment setup | Trial through `T` |
| Vendor opens Checkout with 10 days left | Prepare future billing at `T`; explain authorisation separately from the monthly fee | All 10 remaining days retained |
| Setup succeeds during trial | Reconcile the mandate; first monthly fee remains scheduled for `T` | Still trial; not paid membership |
| Setup fails, is dismissed or remains unconfirmed | Reconcile any provider attempt; no new trial or automatic duplicate subscription | Original trial remains through `T` |
| Trial expires without paid membership or an authorised subscription | Restrict service; offer immediate paid signup | Billing, account and existing-order fulfillment retained |
| Vendor signs up after expiry | Collect the first monthly fee through immediate-start Checkout | Restore paid service only after backend confirmation |
| Scheduled first fee succeeds | Confirm the fee and its covered period | Paid membership for the confirmed period |
| First fee or renewal is failed/unconfirmed at the access boundary | Reconcile and offer payment recovery; no automatic second subscription | Full service stops with no grace; existing-order fulfillment remains |
| Scheduled fee succeeds on retry two days later | Confirm the charge against its original billing cycle; keep its renewal date | Resume for that cycle's remaining time, without adding two days or starting a new month |
| Vendor cancels before `T`, with no monthly fee collected | Confirm cancellation of the future subscription; no fee should be collected at `T` | Original trial remains through `T` |
| Vendor cancels during a paid period | Stop subsequent renewal; no automatic prorated refund | Service remains through the confirmed paid-through date |
| Timely cancellation races the next monthly debit | Honour MithraDirect's receipt time and fully refund the unintended fee | Only the original trial/paid coverage remains; refund pending does not extend access |
| Vendor changes their mind before retained access ends | Set up future billing again for that same boundary, after reconciling the old subscription | No new trial, lost covered time or duplicate fee |

Provider timing is not a guarantee of entitlement. No grace applies while a first/renewal debit is
failed or unconfirmed. The timely-cancellation refund policy is approved; its implementation and
method timing still need validation. Never label an unconfirmed provider cancellation or refund
completed, or equate a provider `active` status with confirmed paid coverage.

## Changes from the earlier specification

- The old choice between Option A and Option B is superseded by this hybrid. AutoPay is optional
  during an independently granted platform trial; the provider's future-start interval covers
  only the time remaining when the vendor chooses setup.
- The old rule that early payment forfeits remaining trial days is withdrawn. There is no approved
  action to bring the monthly fee forward during the trial.
- Step 10 alone is no longer the trial-start anchor; completed onboarding **and approval** are
  required. Earlier wording used `ACTIVE` for approval; the contract uses `approval_status: APPROVED`
  separately from `vendor_status: ACTIVE`, reconfirmed by the 19 September public OpenAPI read.
  Use those existing meanings; no approval enum rename is requested. The missing trial grant must
  rely on genuine backend approval. [API gaps](./API_GAPS.md#vendor-platform-billing) owns the gap;
  the console's temporary approval coercion cannot grant a trial.
- The old preview remains useful evidence of Checkout transport and browser outcomes. Its
  forfeiture acknowledgement and setup-before-trial examples are obsolete product behavior;
  [the preview record](./VENDOR_BILLING_PREVIEW.md) identifies the implementation differences.

## Remaining decisions and evidence

Recommendations in this table are **not approved defaults**. Unanswered choices stay open.

| Decision | Unresolved question / recommendation |
|---|---|
| Other refunds | Discretionary refunds, errors outside the cancellation-race case and access following those refunds remain open. Ordinary cancellation has no automatic proration; timely cancellation racing a debit requires a full refund with only original coverage retained. |
| Payment-method evidence | Current development uses Test cards as scoped above; eMandate is removed and UPI deferred. Future authorisation and hybrid Test evidence remain pending. Production method timing is a later release gate. Do not silently shift `T` or shorten the trial. |
| Lifecycle completion | Pause/resume and the end of the finite production schedule still need decisions. Successful retries keep the original billing anchor. The finite Test Mode count is not a production duration decision. |
| Reminders | Decide channels, delivery times/timezone and offsets. Distinguish an action-needed setup reminder from notice of an already-scheduled debit, and from a cancellation/no-renewal notice. |
| Production commercial terms | Production taxes/invoicing, subscription duration and refund handling need decisions separate from the ₹299 Test Mode total. |

[Provider research](./research/razorpay-vendor-subscriptions.md) records provider facts and limits;
[backend requirements](./API_GAPS.md#vendor-platform-billing) owns required contract capabilities
and acceptance evidence. This document owns product decisions, including any answers added during
the follow-up interview.
