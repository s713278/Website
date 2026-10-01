# Vendor platform billing: hybrid trial and cancellation

**Status:** hybrid trial, cancellation/refund, retry recovery and launch-method rules accepted;
current Test Mode method scope clarified ·
19 September 2026. UPI decided and the failure boundary moved to a halted collection ·
24 September 2026; UPI on standby for a capable Razorpay account · 25 September 2026, withdrawn
because MithraDirect's account offers UPI · 30 September 2026
([UPI and collection retries](#upi-and-collection-retries--24-september-2026)). Live API billing on
the published backend API agreed · 29 September 2026 ([Live API billing](#live-api-billing--29-september-2026)).
The early first fee replaces AutoPay-only setup during the trial · 29 September 2026
([Early first fee](#early-first-fee--29-september-2026)).
This amends the 18 September decisions. Open edge-case policies are listed below; the development
preview and production backend do not yet implement this model.

Vendors pay MithraDirect a monthly platform fee for their registered store. Customer-to-vendor
payments and recurring delivery subscriptions remain outside this integration. Razorpay Checkout
collects authorisation/payment results; the backend alone confirms membership and platform access.
This prevents an authenticated mandate or browser callback from being mistaken for a paid fee.

**Development authorisation, 19 September:** the user permits fabricated backend data and simulated
outcomes to unblock frontend implementation/testing. The
[mock dataset](./VENDOR_BILLING_MOCK_DATASET.md) records the proposed data contract and fixtures,
which demo mode still uses. This does not change the product rules below: simulated entitlement is labelled as such,
and a real Razorpay Test callback remains unverified until a backend confirms it. Production
commercial decisions stay open; mock values are not new commercial policy.

The follow-up context alignment uses the existing vendor context API for all billing status and
keeps only the minimal missing fields. This reduces the transport proposal, without changing trial,
payment, cancellation/refund or retained-access rules. The [mock dataset](./VENDOR_BILLING_MOCK_DATASET.md) records the exact additions.
*(Superseded on 29 September 2026: the backend published its own billing API, which the Live API
reads; see [Live API billing](#live-api-billing--29-september-2026).)*

## Agreed product rules

- The platform fee is ₹299/month, INR. Production tax and invoicing treatment remains pending.
- One eligible 14-day trial per verified vendor identity. It starts only when a store has **both
  completed onboarding and received successful approval**. Submission alone does not start it;
  delayed approval must not consume trial days. Repeated completion/approval events or login
  cannot grant another identity trial. The current product allows **one store per vendor**;
  membership and the identity's trial are attached to that store. Trial time cannot transfer to
  another store. Multi-store billing is outside the current scope. On the development backend
  (1 October 2026), a successful go-live counts as completed onboarding and approval, because no
  vendor verification step exists yet, so the trial starts at go-live. A verification and approval
  step is expected before production launch; the trial must then start at approval.
- MithraDirect owns the authoritative trial entitlement and expiry. No Razorpay Checkout,
  authentication transaction or AutoPay setup is required to start or use the trial. The backend
  must expose the missing entitlement information; the frontend displays it and available actions.
  Browser dates and existing incomplete vendor context are not entitlement authority.
- A voluntary billing CTA is available from the beginning of the trial. During an active trial,
  it collects the first monthly platform fee at once, the
  [early first fee](#early-first-fee--29-september-2026), for a paid period that starts at the
  **original trial end**. All remaining trial time is retained, and AutoPay collects the next fee
  when that period ends. (Amended 29 September 2026; this previously set up a subscription whose
  first fee was due at the trial end, with only an authorisation at setup.)
- The CTA label is **Pay Now** in every payment/setup phase. Supporting text must explain the
  phase: during trial, pay the first monthly fee now for a paid period that starts at the trial
  end (amended 29 September 2026); after expiry, collect the first fee now to activate paid
  membership. Explain any method-specific
  authorisation transaction separately (demo mode only: the early first fee has no separate
  authorisation). The label does not change the underlying payment timing.
  The development [six-state Plan prototype](#six-state-demo-plan-prototype--24-september-2026)
  replaces this label with state-specific ones; the diagnostic preview and demo-mode production
  builds keep it. The Live API also uses state-specific labels ("Pay ₹299 with Razorpay", "Keep shop
  open", "Stop the plan"); see [Live API billing](#live-api-billing--29-september-2026).
- After unpaid trial expiry, explicit signup uses an immediate-start subscription and collects
  the first monthly platform fee upfront. Paid access requires backend confirmation of that fee;
  a browser success callback or mandate authorisation alone is insufficient.
- After unpaid trial expiry, hide the store from the marketplace and block new orders and new
  vendor operations. Keep billing, account and existing orders accessible, **including permission
  to fulfill orders placed before expiry**. This exception supersedes the initial strictly
  read-only order proposal. Backend enforcement is required; none of these gates ship in the preview.
- There is **no grace period** for a **failed platform fee**, but a scheduled first fee or renewal
  that is pending or being retried has not failed. Service continues through that collection retry
  period for every payment method, and stops only when collection is halted with every retry
  used. Keep billing, account and existing-order fulfillment available for recovery. A fee the
  vendor pays immediately after expiry has no retry period; access waits for its confirmation.
  (Amended 24 September 2026; this previously stopped service while confirmation was pending.)
  Since the [early first fee](#early-first-fee--29-september-2026) (29 September 2026), the Live
  API schedules only renewals: an early first fee still unconfirmed at the trial end has no
  collection retry period and hides the shop until it is confirmed. Scheduled first fees remain
  only in the frozen demo.
- When a scheduled first fee or renewal succeeds on retry, the vendor stays in the **original
  billing cycle**. Preserve its renewal date; do not start a new month from the retry or add the
  retry days to the end. This differs from a new immediate-start signup after expiry, which
  begins its own confirmed paid period.
- Cancelling a subscription before the trial ends, before the first platform fee is collected,
  must stop that subscription's future collection while preserving the trial until its original
  expiry. Cancellation neither consumes nor restarts trial time. Since the
  [early first fee](#early-first-fee--29-september-2026) (29 September 2026), the first fee is
  collected at setup, so no such subscription exists: stopping after an early first fee is a
  cancellation during a paid period, which keeps the remaining trial and the paid period.
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
- Vendors may pay again before their retained paid period ends. The fee is collected at once and
  pays for the period that starts at that boundary; AutoPay collects the next fee when it ends.
  Grant no fresh trial and collect no duplicate fee for time already covered. Reconcile the old
  subscription before enabling a replacement. This is permission to rejoin, not a promise that
  Razorpay cancellation is reversible. (Amended 29 September 2026; this previously set AutoPay up
  again with the next fee scheduled for that boundary.)
- Offer only payment methods **proven by testing to meet the required timing rules** for the
  relevant signup phase. A method that cannot preserve the free trial or meet after-expiry payment
  requirements stays unavailable until resolved. Neither a generic provider capability list nor
  one successful card test establishes that every method is ready for launch. Cards and UPI are
  decided; which account offers which methods is in
  [UPI: accounts and launch evidence](#upi-accounts-and-launch-evidence).

## Current Test Mode method scope

The 19 September review is for **Test Mode development**, using the supplied Test credentials and
₹299 monthly plan. That account, which the local test server uses, offers cards only; Live API
Checkout uses MithraDirect's own account, which offers UPI too. Production bank acceptance for other
methods remains deferred.
The launch-method rule above is a later release gate, not a requirement to test every method before
implementing the hybrid panel. The existing card Checkout observation is a starting point; future
authorisation (now the early first fee) and the hybrid lifecycle still need their own Test evidence.

**eMandate is removed from this version**, as authorised by the user if it does not fit the model.
Razorpay documents that registration and payment cannot occur on the same day, holiday handling can
move a debit before its scheduled date, and payment confirmation may arrive one or two days later.
These conflict with immediate signup after expiry and with preserving the promised first-fee date
at trial end. Supporting those exceptions would expand this iteration without establishing the
agreed behaviour. This is a scope decision, not a claim that Razorpay lacks eMandate support.
[Razorpay Subscriptions FAQ](https://razorpay.com/docs/payments/subscriptions/faqs/?preferred-country=IN).

Configure the Test account through **Subscriptions → Settings**, with cards enabled and eMandate
disabled (UPI enabled too, on an account that allows it), then check the methods actually offered by hosted Checkout. Razorpay documents these
controls, including disabling eMandate; no custom method selector is required. For the Live API,
eMandate must be switched off on MithraDirect's Checkout account, a
[release blocker](./VENDOR_BILLING_BACKEND_BRIEF.md#5-release-blockers). This documentation
review has not changed the account configuration.
[Subscription settings](https://razorpay.com/docs/payments/subscriptions/settings/?preferred-country=IN).

Removing eMandate does not remove AutoPay authorisation for cards. Reconsider the excluded method
only through a later scope decision with evidence that its timing meets the product rules. The
supplied plan can be reused; consumed subscriptions cannot serve as fresh-signup fixtures. The
[preview record](./VENDOR_BILLING_PREVIEW.md#test-object-inspection) owns the observed object history.

**UPI is decided (24 September 2026)**, superseding the same day's earlier deferral. Its standby
from 25 September covered only an account that could not enable it, and was withdrawn on
30 September ([accounts](#upi-accounts-and-launch-evidence)). Its debits can
complete by 9 PM IST on the scheduled date and potentially the next day with retries
([method timing](./research/razorpay-vendor-subscriptions.md#payment-methods-and-authorisation-charges)).
That conflicted with the old no-grace boundary; the product owner resolved it by moving the failure
boundary for every method, not by a UPI-only exception. See
[UPI and collection retries](#upi-and-collection-retries--24-september-2026).

## Approved lifecycle

Let `T` be the persisted trial expiry. These are intended product outcomes, not current API enums.

| Situation | Billing behavior | Entitlement |
|---|---|---|
| Eligible store completes onboarding and approval | Grant the identity's trial without payment setup | Trial through `T` |
| Vendor opens Checkout with 10 days left | Collect the first monthly fee now (the early first fee), for a paid period starting at `T` | All 10 remaining days retained |
| Early first fee confirmed during trial | Confirm the fee and its covered period, from `T` to one billing month later; AutoPay collects the next fee when it ends | Trial through `T`, then paid membership for the confirmed period |
| Early first fee fails, is dismissed or remains unconfirmed | Reconcile any provider attempt; no new trial or automatic duplicate subscription | Original trial remains through `T`; a fee still unconfirmed at `T` restricts service until it is confirmed |
| Trial expires without paid membership | Restrict service; offer immediate paid signup | Billing, account and existing-order fulfillment retained |
| Vendor signs up after expiry | Collect the first monthly fee through immediate-start Checkout | Restore paid service only after backend confirmation |
| Scheduled first fee succeeds (demo only since 29 September 2026) | Confirm the fee and its covered period | Paid membership for the confirmed period |
| Scheduled first fee or renewal is pending or being retried at the access boundary | Let the provider keep collecting from the vendor's chosen method; show no retry message | Service continues unchanged through the collection retry period |
| Scheduled fee succeeds on retry two days later | Confirm the charge against its original billing cycle; keep its renewal date | Service continued throughout; the cycle keeps its dates, with no two days added and no new month |
| Collection halts with every retry used (failed platform fee) | Cancel the halted subscription; offer immediate paid signup; no automatic second subscription | Full service stops with no grace; existing-order fulfillment remains |
| Vendor pays after a halt | Collect the first monthly fee through immediate-start Checkout | A new paid period from confirmation; the unpaid retry days are forgiven, not billed |
| Vendor cancels during the collection retry period | Confirm cancellation, which ends the retries | Coverage has already ended, so full service stops immediately |
| Vendor stops after an early first fee, before `T` | Stop renewal; no automatic prorated refund (whether to refund the fee in full is undecided) | Trial through `T` and the paid period through its end |
| Vendor cancels during a paid period | Stop subsequent renewal; no automatic prorated refund | Service remains through the confirmed paid-through date |
| Timely cancellation races the next monthly debit | Honour MithraDirect's receipt time and fully refund the unintended fee | Only the original trial/paid coverage remains; refund pending does not extend access |
| Vendor changes their mind before paid access ends | Collect the next fee now for the period starting at that boundary, after reconciling the old subscription | No new trial, lost covered time or duplicate fee |

Rows for the trial were amended on 29 September 2026 for the
[early first fee](#early-first-fee--29-september-2026). They previously prepared a future-start
subscription at `T` with only an authorisation at setup, and let the vendor cancel it before `T`.

Provider timing is not a guarantee of entitlement. No grace applies once a scheduled first/renewal
fee has failed, meaning collection halted; a pending or retrying one keeps service. The timely-cancellation refund policy is approved; its implementation and
method timing still need validation. Never label an unconfirmed provider cancellation or refund
completed, or equate a provider `active` status with confirmed paid coverage.

## Changes from the earlier specification

- The old choice between Option A and Option B is superseded by this hybrid. AutoPay is optional
  during an independently granted platform trial; the provider's future-start interval covers
  only the time remaining when the vendor chooses setup. (Amended 29 September 2026: with the
  [early first fee](#early-first-fee--29-september-2026), the provider's first automatic charge
  starts one billing month after the trial end.)
- The old rule that early payment forfeits remaining trial days is withdrawn. There is no approved
  action to bring the monthly fee forward during the trial. (Amended 29 September 2026: the
  [early first fee](#early-first-fee--29-september-2026) now brings the first fee forward without
  forfeiting any trial days.)
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
| Other refunds | Discretionary refunds, errors outside the cancellation-race case and access following those refunds remain open. A full Test refund of a confirmed first ₹299 currently leaves the prototype Paid and "verified" ([evidence](./VENDOR_BILLING_PREVIEW.md#prototype-evaluation-and-fixes--24-september-2026)). Ordinary cancellation has no automatic proration; timely cancellation racing a debit requires a full refund with only original coverage retained. Whether a vendor who stops after an early first fee, before the trial end, gets that fee back in full is undecided (today: no automatic refund); Razorpay refunds come from the merchant balance and its fee is not reversed ([backend brief](./VENDOR_BILLING_BACKEND_BRIEF.md#other-razorpay-facts)). |
| Payment-method evidence | Cards and UPI are offered in Live API Checkout; the local test server's account offers cards only; eMandate is excluded, though MithraDirect's Checkout account still offered it on 30 September 2026 and must switch it off. UPI's launch evidence is in [UPI: accounts and launch evidence](#upi-accounts-and-launch-evidence) and is unobserved. Card future authorisation, immediate signup, renewal success, a failed renewal debit and cancellation were observed in Test Mode on 23 September 2026 ([Plan evidence](./VENDOR_BILLING_PREVIEW.md#plan-test-mode-evidence--23-september-2026)); renewal recovery is unobserved, so that evidence remains open, but it no longer gates UPI. The early first fee (an upfront ₹299 with a future start) was verified by Test card on 30 September 2026; UPI with it is unobserved and a [release blocker](./VENDOR_BILLING_BACKEND_BRIEF.md#5-release-blockers). Do not silently shift `T` or shorten the trial. |
| Lifecycle completion | Pause/resume and the end of the finite production schedule still need decisions. A pause made at Razorpay is not shown: the demo Plan keeps naming the next ₹299 ([evidence](./VENDOR_BILLING_PREVIEW.md#prototype-evaluation-and-fixes--24-september-2026)). Successful retries keep the original billing anchor. The finite Test Mode count is not a production duration decision. |
| Reminders | Decide channels, delivery times/timezone and offsets. Distinguish an action-needed setup reminder from notice of an already-scheduled debit, and from a cancellation/no-renewal notice. |
| Production commercial terms | Production taxes/invoicing, subscription duration and refund handling need decisions separate from the ₹299 monthly fee. |
| Prototype copy | Awaiting product-owner review: the 3 days left body and banner ("Set up AutoPay now…" instead of the mockup's "Pay ₹299 with Razorpay now…"); the calmer neutral copy once trial AutoPay is on; relative history labels that differ from the mockups; the "Pay ₹299" banner and header label beside Plan's "Set up AutoPay" button; the banner's position under the top bar; the "AutoPay ended" Stopped copy and its "AutoPay ended · Cancelled outside MithraDirect" history row, added on 24 September; the free-days copy once the first ₹299 is collected early ("AutoPay on — first ₹299 paid, shop open until ‹date›. Next ₹299 on ‹date›."), added on 25 September. The prototype is frozen since 29 September 2026. |

[Provider research](./research/razorpay-vendor-subscriptions.md) records provider facts and limits;
the [backend billing brief](./VENDOR_BILLING_BACKEND_BRIEF.md) owns required contract capabilities
and acceptance evidence. This document owns product decisions, including any answers added during
the follow-up interview.

## Dashboard Test Mode pivot — 23 September 2026

**Status:** accepted design; shared understanding confirmed on 23 September 2026. The helper was
implemented as described. On demo Plan, the explicit Test Mode switch, its scenarios and the sample
billing panel were then replaced by the
[six-state prototype](#six-state-demo-plan-prototype--24-september-2026), which reuses the helper.
The bullets below keep the pivot's original wording. Since 29 September 2026 the helper is frozen
with demo mode and keeps the trial AutoPay flow, so "the approved hybrid trial and payment rules
above" means those rules as they stood on 23 September, before the
[early first fee](#early-first-fee--29-september-2026).

- Demonstrate Razorpay Test Mode Checkout for platform membership from the vendor dashboard's
  `/vendor/plan` page, preserving the approved hybrid trial and payment rules above. The
  demonstration must support creating Test subscriptions using the supplied Test plan.
- **Local development only**, confirmed in the first interview round. A deployed staging or
  public demonstration is outside this pivot.
- A temporary **server helper** will create Test subscriptions, verify Checkout results and read
  provider state, so the Plan page can show provider-confirmed Test outcomes before the Spring
  billing backend is available. The Test secret stays server-side. Signature authenticity,
  AutoPay authorisation and a confirmed platform fee remain distinct facts.
- An **explicit Razorpay Test Mode switch on the Plan page** selects this demonstration. Its
  existing Pay Now action then opens hosted Checkout. Ordinary app demo billing remains usable
  with simulated sample data and without Razorpay configuration.
- Keep `/dev/vendor-billing` as a secondary diagnostic preview. `/vendor/plan` is the primary
  surface for demonstrating the new Test integration.
- The operator may use the **Razorpay Test Dashboard to trigger accelerated Test charges**, then
  refresh Plan to read their actual provider outcomes. Creating subscriptions, opening Checkout
  and requesting cancellation remain part of the Plan journey through the helper.
- Use **separate repeatable scenarios**, such as a trial in progress, a trial already expired and
  paid membership. Keep each scenario's displayed billing dates aligned with its provider records.
  A continuous demonstration clock is outside this pivot; the 14-day trial and monthly fee remain
  the product rules. An accelerated provider charge is not evidence that the app's trial elapsed.
- Preserve the selected demo vendor's trial, billing attempts and provider associations locally
  across **browser reloads and helper restarts**. Starting a fresh demonstration requires an
  explicit reset workflow; reloading must not silently create a replacement subscription.
- Show lifecycle and restriction outcomes **on Plan**: trial/paid/expired status, retained coverage
  and restriction messages. Enforcing those restrictions across the sample storefront and vendor
  workflows is outside this pivot.
- Require actual **provider Test evidence** for trial AutoPay setup, immediate payment after
  expiry, renewal success/failure/recovery, cancellation and rejoining. Demonstrate cancellation
  races and refund progress separately with labelled fixtures; an actual Test refund is not
  required for this pivot. The approved refund policy is unchanged.
- Reset must reconcile and cancel any unfinished Test subscription created for that scenario
  before permitting a replacement, while retaining its history. If cancellation is unconfirmed,
  reset stays pending. Subscriptions outside the helper's scenarios are outside reset's scope.
- Offer the Test Mode switch in both **demo and backend-authenticated vendor sessions**, locally.
  Use the selected vendor to associate an isolated Test scenario. Provider Test results and
  simulated membership access must not overwrite the account's real billing, shared context,
  authentication or order state, or change the global API mode.
- Preserve the completed panel, mapper, service and shared-context work. The existing
  [preview and dashboard behavior](./API_ARCHITECTURE.md#vendor-platform-billing-preview) remains
  the implementation baseline while the revised scope is designed.

All three interview rounds and the final confirmation are complete. This scope supersedes the
earlier restriction reserving Test Checkout to the separate preview until Spring billing integration.
The spec and remaining tickets still need to be revised to match. Ordinary demo billing remains
provider-isolated; the explicit local Test selection is the new exception.

Provider confirmation applies to observed Test authorisation, payment and subscription records.
The helper's trial eligibility and membership/access presentation are demonstration state. Future
trial setup must retain the original expiry and provider start date; use the separate paid scenario
for accelerated renewal exercises. An early Test charge or failure cannot move an unexpired access
boundary or stand in as evidence of production enforcement. The
[provider research](./research/razorpay-vendor-subscriptions.md#test-lifecycle-expiry-and-safe-reuse)
owns Test timing constraints.

The next specification and ticket revision must add helper provisioning, verification, persistence
and safe reset work, and retarget the remaining lifecycle and manual evidence work to Plan.
Completed work remains the baseline. Published Spring billing integration and real access
enforcement remain separate work; the temporary helper is not the production billing backend.

## Six-state demo Plan prototype — 24 September 2026

**Status:** agreed with the product owner and implemented on 24 September 2026.
It changes only the development demo Plan, its button labels and which billing views Plan shows.
It follows the [agreed product rules](#agreed-product-rules) as they stood on 24 September; since
29 September 2026 it is frozen with demo mode and keeps trial AutoPay, so its actions differ from
the Live API's [early first fee](#early-first-fee--29-september-2026). The
[architecture owner](./API_ARCHITECTURE.md#six-state-plan-prototype) describes the implementation,
and the [preview record](./VENDOR_BILLING_PREVIEW.md#six-state-prototype-evidence--24-september-2026)
holds the hosted Test evidence.

- **Scope.** Local development and demo mode (`VITE_USE_API=false`) only. Demo-mode production builds,
  the deployed demo site included, contain none of it and keep the simulated billing panel. The
  Live API has no prototype; its "Billing unavailable" read was replaced by
  [Live API billing](#live-api-billing--29-september-2026). The deployed demo gets six-state
  billing only once Razorpay runs through the backend APIs. The seeded states have no backend
  equivalent, and demo mode has no backend, so both need a decision at that point. The Live API
  part was decided on 29 September 2026: see [Live API billing](#live-api-billing--29-september-2026).
- **Only six states** appear on Plan and the dashboard. The demo vendor is always approved and
  active; the demo store-state switcher is removed. Live store-state screens are unchanged.

| State | Seed (relative to selection) | Primary action | On a verified success | Other action |
|---|---|---|---|---|
| Free days | Trial ends in 12 days; no AutoPay | **Set up AutoPay · ₹299 on ‹trial end›**: a future-start subscription at the trial end, with a ₹5 card authorisation | Stays Free days, "AutoPay on — first ₹299 on ‹date›" | **Turn off AutoPay** cancels, back to plain Free days with the trial kept |
| 3 days left | Trial ends in 3 days; no AutoPay | Same as Free days | Same | Same |
| Paid | A labelled sample: paid through +1 month, AutoPay on; no provider object | — | — | **Stop the plan** → Stopped |
| Payment failed | Trial ended 3 days ago; AutoPay's first ₹299 was retried until Razorpay halted collection (amended 25 September) | **Pay ₹299 with Razorpay**: an immediate charge | Paid, a new period from now | — |
| Stopped | Paid through 8 days from now; AutoPay cancelled | **Keep shop open · ₹299**: a future start at paid-through, with a ₹5 authorisation | Paid, same paid-through, next ₹299 then | — |
| Shop closed | Paid through ended 2 days ago; AutoPay cancelled | **Pay ₹299 with Razorpay**: an immediate charge | Paid, a new period from now | — |

Demo only. In the Live API, paying in the free days is the
[early first fee](#early-first-fee--29-september-2026) (₹299 now), and Keep shop open charges ₹299
now for the month after paid-through.

- **Labels.** These button labels replace the "Pay Now in every phase" rule on the prototype.
  Supporting text still explains timing: "Opens Razorpay Checkout…", and for AutoPay the refundable
  ₹5 charge now and the first-fee date. The help text names card payment only, because the local
  test server's account offers cards only.
- **Real Test Checkout only.** Every action runs hosted Razorpay Test Checkout through the local
  helper; there is no simulated fallback. A failed or dismissed Checkout leaves the state unchanged,
  with an inline notice. Nothing changes until the helper has verified the callback and read the
  provider. Trial AutoPay setup never makes the vendor Paid, and there is no clock.
- **Helper down.** The state still renders, with actions disabled and a notice to start the helper.
  Chips still switch the displayed state, display-only and not persisted. One seed definition
  serves both paths.
- **Separate helper vendor key `r1-prototype`.** Vendor `r1` is never reset or touched: it holds a
  subscription parked for the renewal-recovery recheck after 2026-11-26T18:30:00Z. Choosing a
  different chip first runs the guarded reset of the current prototype scenario, which cancels its unfinished Test
  subscriptions and keeps history. The chip reads "Switching…" meanwhile, with no dialog.
- **Stop and keep open.** A stop on the sample is local only. On a real subscription, the helper
  asks Razorpay for a cycle-end stop, and Razorpay's acceptance moves Paid to Stopped. Reads cannot
  show a scheduled stop, so Plan labels the helper's record of that acceptance as the source. An
  immediate stop waits for a read showing the subscription closed. **Keep shop open** first cancels
  the stopped subscription now and reads it closed, then creates the replacement at paid-through, so
  two agreements never overlap. Paid days come from the helper's record of the confirmed fee; no
  refund is made.
- **AutoPay ended outside Plan (24 September, user-approved fix).** When Razorpay shows Paid's
  agreement closed without **Stop the plan**, for example after the card issuer revokes the mandate,
  Paid moves to Stopped with the same paid-through date, and the card says so. **Keep shop open** then
  offers AutoPay again at that boundary. Before this fix, Paid kept saying "Shop is open" and gave no
  way to set AutoPay up again. This keeps the six states; it adds no seventh.
- **Dates.** "Open until" names the last paid day in India time. Razorpay ends a first immediate
  cycle at IST midnight, so the next ₹299 falls on the following day.
- **Beyond Plan.** The chips ("Prototype: try each shop-plan state") appear at the bottom of Plan
  only. The state's banner and a header button ("Pay ₹299", "Keep open · ₹299" or, in Paid and with
  trial AutoPay on, "Shop plan") show on every demo vendor page, Overview included, and link to Plan.
  Checkout opens only on Plan. They are messages only: the storefront and orders are not gated. An
  Overview plan card was built and then withdrawn on 24 September, because it duplicated the banner
  and header.

## UPI and collection retries — 24 September 2026

**Status:** agreed with the product owner on 24 September 2026. The collection-retry rules are
implemented for cards in the local helper, the six-state prototype and the simulated panel
(25 September 2026); production enforcement remains Spring work. It amends the
[agreed product rules](#agreed-product-rules) and supersedes the same day's UPI deferral.
**UPI's standby (25 September 2026) is withdrawn (30 September 2026):** it covered only the local
test server's account, and Live API Checkout uses MithraDirect's account, which offers UPI
([below](#upi-accounts-and-launch-evidence)).

### Collection retries (every method)

These rules apply to cards and UPI.

- **The failure boundary is a halted collection.** A scheduled first fee or renewal that is pending
  or being retried is in its collection retry period, and service continues unchanged. Razorpay
  retries cards and UPI on each of the three days after the debit date, then halts
  ([retries](./research/razorpay-vendor-subscriptions.md#notifications-and-recurring-failures)),
  so a failing vendor keeps service for about four unpaid days. The product owner accepts this so
  that the vendor's chosen method gets every attempt.
- **At the halt**, the fee is a failed platform fee: MithraDirect stops the service (the shop is
  hidden and new orders stop; billing, account and existing-order fulfillment remain) and cancels
  the halted subscription itself, so nothing can charge the vendor later. "Stop the plan" remains
  the vendor's own cancellation.
- **Recovery** is the existing immediate-start "Pay ₹299". It begins a new paid period from its
  confirmation; the unpaid retry days are forgiven, not billed.
- **A cancellation during the retry period** ends the retries. Coverage has already ended, so
  service stops immediately.
- **A fee paid immediately has no retry period.** A pending payment from "Pay ₹299" after the
  trial or a halt leaves the shop closed until it is confirmed.
- **Nothing is shown during retries.** Plan and the banner show no failed-attempt or next-retry
  message. The card drops the past paid-through or trial-end date and its countdown, and reads
  only "Shop is open · AutoPay on".
- **Implemented (25 September 2026).** Payment failed is seeded as a halted collection. The local
  helper treats Razorpay's retrying `pending` as service-continuing, treats only `halted` as failed
  and cancels a halted subscription. A halt past the boundary moves the prototype to Payment failed;
  a Test-accelerated halt before paid-through keeps the paid days and ends AutoPay (Stopped). The
  [architecture owner](./API_ARCHITECTURE.md#six-state-plan-prototype) describes it.

### UPI: accounts and launch evidence

**Product decision:** every Live API platform-fee Checkout offers UPI alongside cards: the early
first fee, "Pay ₹299" and "Keep shop open". (Trial AutoPay setup, listed here originally, was
replaced by the [early first fee](#early-first-fee--29-september-2026) on 29 September 2026. The local
test server's account offers cards only.) Hosted Checkout offers the same methods everywhere;
there is no per-action method selector. eMandate stays excluded.

**Accounts.** On 25 September 2026, enabling UPI under **Subscriptions → Settings** on the
supplied Test account redirected to Razorpay account onboarding and video KYC. That account, which
the local test server uses, therefore offers cards only, and its cards-only implementation stays as
it is: demo mode is frozen, and scripted test runs pay by card. UPI was put on standby for a
UPI-capable account. That standby is **withdrawn (30 September 2026)**: Live API Checkout uses
MithraDirect's own Razorpay account, which offers UPI
([Live API billing](#live-api-billing--29-september-2026)).

**Switch-on checklist (withdrawn 30 September 2026).** It planned moving the local test server to a
UPI-capable account, which no longer happens, so none of its steps apply as written: steps 1–3
assumed that move, step 4's trial AutoPay setup is withdrawn, and step 5's "launch-approved" is
replaced by the release blocker below. UPI's launch evidence with the early first fee is a
[release blocker](./VENDOR_BILLING_BACKEND_BRIEF.md#5-release-blockers). Kept for
history:

1. **Account.** In the new account's Test mode, confirm UPI and cards are enabled and eMandate is
   disabled under Subscriptions → Settings, and create or confirm the monthly ₹299 plan.
2. **Local credentials.** Replace `RAZORPAY_TEST_KEY_ID`, `RAZORPAY_TEST_KEY_SECRET` and
   `RAZORPAY_TEST_PLAN_ID` in the local, git-ignored helper environment
   ([README](../README.md#environment-variables)); never in `VITE_*` variables or tracked files.
   Point `VENDOR_BILLING_TEST_STORE` at a fresh local file: the existing store holds subscriptions
   from the old account, which the new keys cannot read. Keep the old store and credentials for the
   card renewal-recovery recheck parked on vendor `r1` after 26 November.
3. **Code and copy.** Checkout help names "card or UPI". Failed-Checkout notices read "The payment
   did not go through…" rather than naming a card. Authorisation help says "a small refundable
   charge" until Test evidence shows the UPI amount; Razorpay documents both ₹5 and ₹1. Update the
   six-state section's "card payment only" note and the
   [architecture owner](./API_ARCHITECTURE.md#six-state-plan-prototype) with the implementation.
4. **Test evidence.** By UPI, observe trial AutoPay setup, an immediate ₹299, and one scheduled
   debit that succeeds and one that fails; record it in the
   [preview record](./VENDOR_BILLING_PREVIEW.md). Razorpay does not document UPI subscriptions in
   Test Mode; if Test cannot run them, one small real-money Live check (set up, charge, cancel,
   refund) replaces it. Card renewal recovery does not gate UPI.
5. **Live.** Enable UPI in the same account's Live Subscriptions Settings, and treat UPI as
   launch-approved. Live API billing now uses MithraDirect's account, which offers UPI. Live keys
   belong to the Spring backend, never the browser or this repository.

## Live API billing — 29 September 2026

**Status:** agreed with the product owner on 29 September 2026, and implemented in the app on 29–30
September 2026. It replaced the Live API's "Billing unavailable" read. The
[agreed product rules](#agreed-product-rules) still
apply. The same day's [early first fee](#early-first-fee--29-september-2026) replaces this
section's trial AutoPay state rule, its "small refundable charge" wording and its release list. The contract gaps go to [API gaps](./API_GAPS.md#vendor-platform-billing), and the
implementation to the [architecture owner](./API_ARCHITECTURE.md), with the wiring work.

- **Scope.** With the Live API (`VITE_USE_API=true`), Plan, the banner and the header button show
  the six billing states of the [prototype](#six-state-demo-plan-prototype--24-september-2026),
  driven only by the published backend billing API. The Live API never uses the local test server.
  Chips and sample lines stay in demo mode.
- **Demo mode is frozen.** The local test server and the prototype stay as they are, with no new
  features. The server is deleted once the backend covers what only it does today: keeping the
  trial while AutoPay is on, cancelling before the first fee, setting AutoPay up again before the
  paid days end, and treating a fee as paid only once it is captured. (Since the early first fee,
the backend equivalents are gaps K, A, E and B in the
[backend billing brief](./VENDOR_BILLING_BACKEND_BRIEF.md).)
- **Source.** `GET /v1/vendors/{vendor_id}/subscription` is the billing read: state, trial dates,
  paid period and AutoPay. The plans list supplies the plan and its price. The vendor context keeps
  supplying plan limits and features only. Since 29 September 2026 it is flat (top-level `features`
  and `limits`) and has no trial or lifecycle fields; the Live API's rail chip and Settings take the
  plan name from the subscription read. The
  app counts free days itself from the trial end, rounded up, and MithraDirect owns all wording.
- **Build on today's API.** The app reads today's responses and the corrected ones alike, so
  backend fixes land without app changes. [API gaps](./API_GAPS.md#vendor-platform-billing) owns
  each deviation.
- **State rules.**
  - A trial that ends without AutoPay shows **Shop closed** with free-days wording ("Free days are
    over…"). It is a wording variant, not a seventh state.
  - Trial AutoPay whose first fee is due but not yet confirmed keeps the shop open ("Shop is open ·
    AutoPay on"), like a collection retry. A fee paid immediately after expiry keeps the shop closed,
    with "Confirming payment…", until it is confirmed. *(The trial AutoPay part is replaced by the
    [early first fee](#early-first-fee--29-september-2026); only demo mode keeps trial AutoPay.)*
  - Paid is shown only once a paid period exists.
  - AutoPay that ends outside MithraDirect, for example at the bank, keeps the paid days: Stopped
    until the paid-through date, then Shop closed.
- **Shop wording.** Plan keeps saying that customers cannot see a lapsed shop. Backend enforcement
  (MFPS-66) is a release blocker, so the wording is true in production.
- **Actions.** Every action calls the backend now, even where a known backend gap makes it fail;
  the vendor then sees a specific message. No action is hidden because of a gap.
- **Payments you made** comes from the subscription history, without amounts until the backend
  supplies them. The app never infers an amount.
- **Payment methods.** Live API Checkout uses MithraDirect's own Razorpay account, which offers UPI
  ([accounts](#upi-accounts-and-launch-evidence)).
  Live API wording says "card or UPI". (It also said "a small refundable charge" until the
  [early first fee](#early-first-fee--29-september-2026) replaced trial AutoPay.) eMandate stays
  excluded; on 30 September the account still offered it, and it is being switched off.
- **Release to production** waits for: cancelling trial AutoPay before the first fee (it currently
  fails), the first fee falling exactly at the trial end (it was a day late), paying immediately
  after the trial ends (it currently fails, so a lapsed vendor cannot pay), a 14-day trial in
  production (the development backend uses 1 day on purpose) and backend shop enforcement
  (MFPS-66). The app tolerates the other known deviations. *(Replaced by the
  [early first fee](#early-first-fee--29-september-2026)'s release list.)*

## Early first fee — 29 September 2026

**Status:** decided by the backend team on 29 September 2026; its consequences for the app were
agreed with the product owner the same day. Implemented in the app on 30 September 2026, building
to the read requested from the backend; not yet built in the backend (gap K in
[API gaps](./API_GAPS.md#billing-gaps-ak)). It amends
the [agreed product rules](#agreed-product-rules), the [approved lifecycle](#approved-lifecycle) and
[Live API billing](#live-api-billing--29-september-2026). The contract change goes to
[API gaps](./API_GAPS.md#vendor-platform-billing) and the implementation to the
[architecture owner](./API_ARCHITECTURE.md), with the work.

- **Paying during free days.** A vendor who pays during the trial pays the first ₹299 at once. Its
  paid period starts at the trial end `T` and runs one billing month, to the paid-through date the
  backend records. The same Checkout approves AutoPay, which collects the next ₹299 when that
  period ends. All remaining trial time is kept.
- **Withdrawn:** setting up AutoPay alone during the trial (a future-start subscription with a
  small refundable authorisation now and the first ₹299 at `T`), and turning it off before `T`.
- **Keep shop open** follows the same rule. A vendor who stopped the plan pays ₹299 at once for
  the period after their paid-through date, and AutoPay collects the next ₹299 when it ends.
- **After an early first fee** Plan shows Paid and says the free days are kept. Stop the plan is
  offered; stopping keeps the remaining trial and the paid period, with no automatic refund.
- **An unconfirmed early first fee** leaves the shop open, with "Confirming payment…", until `T`.
  If it is still unconfirmed at `T`, the shop is hidden until it is confirmed, as for a fee paid
  after expiry: a fee paid now has no collection retry period.
- **A renewal due at the paid-through date** is being collected, not failed: Plan shows "Shop is
  open · AutoPay on" until the backend reports the result. Only a stopped plan or ended AutoPay
  closes the shop at that date.
- **AutoPay ended outside Plan** reads "AutoPay off", with wording that is true whether the vendor
  or the bank stopped it. A backend that reports the vendor's own stop as cancelled then shows no
  false claim.
- **No second payment while one is confirming.** After Checkout reports success, Plan offers no
  payment action while it still shows that payment as being confirmed, including after its
  90-second confirmation poll ends.
- **Reading the backend.** The app reads today's responses and the corrected ones requested in
  API gaps. A combination not yet seen on the development backend shows the read error until it
  has been checked there.
- **Demo mode** keeps the earlier trial AutoPay flow; it stays frozen.
- **Release to production** waits for:
  - the early first fee in the backend: one ₹299 at setup, a paid period from `T` to one billing
    month later, the next ₹299 exactly then, and card and UPI tested with it;
  - stopping after an early first fee, which fails today because cancel is refused before
    Razorpay's first cycle;
  - paying immediately after the trial ends, which currently fails;
  - a 14-day trial in production;
  - eMandate switched off on the Checkout account;
  - backend shop enforcement (MFPS-66) that keeps the shop open while a renewal is collected and
    through a paid period that AutoPay ending cut short, and hides it while an early first fee is
    unconfirmed after `T`.

  This replaces the Live API billing release list. The app tolerates the other known deviations.
