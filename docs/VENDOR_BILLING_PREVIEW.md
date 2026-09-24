# Vendor billing development preview

The development route now demonstrates the [approved hybrid trial](./VENDOR_BILLING_DECISIONS.md)
with the [proposed wire-shaped contexts](./examples/vendor-billing/mock-responses.json). An eligible
vendor's trial is already active without Checkout. **Pay Now** during trial optionally prepares
AutoPay for the original expiry; a separate method authorisation amount is disclosed when supplied.
A simulated acknowledgement remains pending until the explicit **Simulate confirmation** action.
That confirmation keeps trial access and its expiry. The preview also retains a deliberate Razorpay
Test Mode Checkout path, whose callback remains unverified.

The fixture statuses are labelled **Simulated billing** and grant no real entitlement. No backend
billing write, provider cancellation, real refund or expiry enforcement is shipped by this preview.
`/vendor/plan` has separate demo billing and safe unavailable live billing; see the
[architecture owner](./API_ARCHITECTURE.md#vendor-platform-billing-preview). Fixture cancellation
and race-refund progress are simulated presentation only. After a real Test callback, the preview
refuses cancellation rather than pretend it cancelled a Razorpay object. The historical 18
September provider observations below describe the earlier Checkout exercise only. The dated
[Plan Test Mode evidence](#plan-test-mode-evidence--23-september-2026) records Plan's hosted
Test journeys.

On Plan in development, **Show a sample billing status** selects an isolated fixture panel. Its
phase selector includes AutoPay set up during trial, paid membership, expired trial, failed
first-fee/AutoPay, cancelled trial, revoked AutoPay (trial and paid) and completed Test schedule
examples. **Pay Now**, **Cancel AutoPay** and explicit simulated outcomes demonstrate all seven
dataset journeys without changing the selected account: trial setup, expired signup, trial
cancellation, paid rejoin, renewal retry, and refund success and failure. Choosing another phase
recreates the fixture only; it never resets provider state and is not the provider-safe
**Reset Test scenario** on Plan's local Razorpay Test Mode.

## Differences from the approved model

The preview supplies fabricated entitlement and schedule facts. The backend has not granted a
real trial, verified a provider callback, enforced expiry, or supplied cancellation and refund
progress; the displayed cancellation and refund progress comes from fixtures. Its status controls
demonstrate presentation only; the remaining lifecycle and live integration are owned by later
tickets.

## Run it

```bash
npm run dev
```

Open [http://localhost:5173/dev/vendor-billing](http://localhost:5173/dev/vendor-billing).
The route requires no login and works regardless of `VITE_USE_API`. It is excluded from production
builds and is not linked from production navigation. Test configuration may be entered on the page,
or supplied through these optional public development values in an ignored `.env.development.local`:

```dotenv
VITE_RAZORPAY_TEST_KEY_ID=rzp_test_REPLACE_WITH_PUBLIC_KEY_ID
VITE_RAZORPAY_TEST_SUBSCRIPTION_ID=sub_REPLACE_WITH_IMMEDIATE_SUBSCRIPTION
VITE_RAZORPAY_TEST_FUTURE_SUBSCRIPTION_ID=sub_REPLACE_WITH_FUTURE_SUBSCRIPTION
```

Restart Vite after changing environment values. These are public IDs, **never key secrets**.
The browser accepts only a Test-prefixed key. Razorpay controls the actual price and schedule; the
preview cannot authenticate subscription metadata. Use fresh Test subscriptions from the same Test
account and inspect them before each attempt.

1. Leave Test configuration empty to walk the simulated trial setup. Choose **Trial active**, apply
   the fixture, select **Pay Now**, observe pending authorisation with the original expiry, then use
   **Simulate confirmation** to see the scheduled first fee and retained trial access.
2. For a real Test trial setup, provide a separate future-start subscription and enter the
   inspected `start_at` timestamp in the page's ISO field. Checkout opens only when it matches the
   fixture trial expiry. A mismatch keeps the attempt simulated; changing a scenario never changes
   Razorpay's schedule. Use the official
   [subscription test card details](https://razorpay.com/docs/payments/subscriptions/test/).
3. For after-expiry signup, select **Trial expired** and provide a fresh immediate-start Test
   subscription. Checkout can collect the first fee immediately. Its callback still produces only
   pending fixture status, with no paid-access claim.

The earlier hosted Checkout screens and card observations below come from the dated validation
record. They have not been re-observed for this hybrid trial flow.

The hosted UI observed during validation included optional card-saving OTP, with a **Skip OTP**
control, followed by payment OTP. **Pay on bank's page** led to the Test simulator's **Success**
button. These are provider-owned screens and may change. For automated browser checks, normal
key events were needed for masked card fields; assigning their values alone did not advance the
flow. Use synthetic contact data and the provider's Test simulator, never real card credentials.

## Test object inspection

Read-only provider inspection on **18 September 2026** established:

| Supplied object | Observed metadata before browser testing |
|---|---|
| Plan `plan_TcleJ0esLkwUPM` | `MITHRADIRECT_MONTHLY_PLATFORM_FEE`, monthly, interval 1, INR 29900 paise |
| Subscription `sub_TclqOFyw2IxhtG` | `created`, `auth_attempts: 0`, `paid_count: 0`, matching plan |
| Schedule | `start_at`, `charge_at`, `expire_by`, `end_at`: null; no scheduled changes |
| Finite duration | **`total_count: 7`, `remaining_count: 6`**, differing from the discussed test value 12 |

This is a dated observation, not a permanent usable fixture. The hosted link names the same
subscription; it does not create a fresh object. Test count 12 is allowed for testing but no
production count is approved. Neither 7 nor 12 is embedded in the integration.

The supplied subscription was subsequently used for a successful **simulated Test payment** in
this preview. A provider read then returned `active`, `paid_count: 1`, `remaining_count: 6`, with
current-period dates. It is no longer a fresh-signup fixture. A new immediate-start Test subscription,
`sub_TdZ4q2zOgoOlB1`, was created against the same plan with `total_count: 12` and
`customer_notify: false`; the ignored local development configuration now uses that ID. Creation
returned `created` and `paid_count: 0`. Inspect its current state before each later use.

The official Checkout opened from this app and displayed Test Mode, ₹299 charged now and monthly
recurrence for the supplied subscription. It offered cards in this account. This confirms script,
subscription configuration and modal launch; verification and recurring-payment enforcement still
require the backend. See the validation record below for subsequent results.

## Preview limitations and reset behavior

- Fixture trial dates, remaining days, notices and access values are illustrative. The panel
  renders those service values and does not derive entitlement from `trial_days` or the device clock.
- A simulated action never loads the provider script or passes fixture IDs to Checkout. The
  explicit simulated failure/confirmation changes only this service instance's fixture context.
- Expired signup and its first-fee retry stay restricted through acknowledgement and simulated
  failure. Only explicit simulated paid reconciliation shows restored access. Changed prepared
  fees/dates require agreement; an expired preparation requires a fresh status and review.
- Real Test callback fields remain in memory. The preview checks association/shape and returns
  pending; it cannot perform signature verification or authoritative reconciliation. Callback
  fields are cleared after the in-memory submission completes.
- The same instance prevents duplicate modal opens. Leaving/resetting closes Checkout and ignores
  late work. Failure remains retryable inside Razorpay; dismissal does not prove payment failure.
  A script failure offers retry of the same unexpired prepared attempt. An uncertain response
  requires status reconciliation before an explicit new action; the panel is not a restart or
  cross-tab lock. Supplied retry delays pause manual recovery without automatic chargeable retries.
- After a callback, no repeat setup/signup action is offered until authoritative confirmation.
  Refreshing this service still returns pending. Reloading/resetting clears local progress but
  **does not reset Razorpay state**; inspect provider status and use a fresh subscription as needed.
- Live-key input is refused. Secrets, new subscription creation, callback verification, status
  reconciliation and webhooks belong on the backend. There is no browser-to-provider REST call.

## Handoff and pending decisions

- [Agreed scope and product rules](./VENDOR_BILLING_DECISIONS.md).
- [Official-source research, reviewed 19 September 2026](./research/razorpay-vendor-subscriptions.md):
  lifecycle, method restrictions, signature formulas, reminders, charges, timing and test limits.
- [Backend implementation requirements](./API_GAPS.md#vendor-platform-billing): proposed data and
  operations, ownership, verification, enforcement, and acceptance cases.
- [Module boundaries and migration](./API_ARCHITECTURE.md#vendor-platform-billing-preview).

## Plan Test Mode evidence — 23 September 2026

Manual observations of `/vendor/plan`'s explicit local Razorpay Test Mode, recorded between
21:35 and 22:55 UTC. Every provider fact is from the Test account and the supplied monthly
plan `plan_TcleJ0esLkwUPM` (₹299 INR). Scenario dates, trial and access are the helper's local
simulation. **Razorpay Test verified** labels mean helper verification plus provider reads. They are
not Spring verification, entitlement or enforcement. No production bank behavior, real refund or
Live Mode readiness is claimed.

**Environment.** Linux (WSL2) and headless Chromium, driving the official hosted Checkout and
the Test bank simulator. The helper ran on `127.0.0.1:4179` with a fresh local store, and was
restarted during the run. Vite ran in demo mode (vendor `r1`) and, separately, in API mode on
port 5173 against the development backend (a freshly created development vendor). Provider reads used the
Razorpay CLI with the same Test key. Six helper-tagged Test subscriptions from earlier manual runs
already existed on the plan. Their store no longer exists, so they are outside every scenario
below and were left untouched.

**Evidence sources.** *App* is Plan's visible text. *Helper* is the helper's HTTP response or local
store. *Provider* is a Razorpay Test read through the CLI. *Operator* is an action in the Razorpay
Test Dashboard. *Induced* is a deliberate local transport fault. *Fixture* is the labelled sample
billing panel.

### Methods and Checkout

- *Operator:* Subscriptions → Settings already offered cards only, with UPI and eMandate
  disabled. Nothing was changed.
- *App/provider:* every hosted Checkout offered **Cards** as its only payment option.
  - A future-start attempt disclosed "a refundable amount of ₹5 will be charged now", then
    ₹299 monthly.
  - An immediate attempt charged ₹299 with no separate authorisation.
- *Provider:* Razorpay's documented Mastercard test
  cards ending 5558 and 0008 failed with `international_transaction_not_allowed`, whose provider description says the account accepts
  domestic (Indian) cards only. The Visa test
  card ending 4366 is domestic, and it produced every successful payment below.
- *Checkout steps with the domestic card:*
  1. Tick **Save this card as per RBI guidelines**.
  2. **Skip OTP** for Razorpay's saved-card OTP.
  3. Choose **Pay on bank's page** for the simulator's **Success**/**Failure** choice.

### Active trial: future-start AutoPay (vendor `r1`, generation 1)

- *Helper/provider:* the scenario's trial expiry was `2026-10-07T21:37:15.415Z`. The created
  subscription `sub_Tfd4FSOoepVQxG` had `start_at` `2026-10-07T21:37:15Z`, which matches at
  Razorpay's whole-second precision, with `total_count` 12 and quantity 1.
- *App:* dismissing Checkout (close, then exit) showed "Checkout was closed. Refresh billing
  status before retrying". Trial access stayed and nothing was authorised.
- *App/provider, one Checkout:*
  1. The simulator's **Failure** showed "Payment failed" with **Try again**. The provider shows
     that ₹5 payment `failed` (`payment_failed`).
  2. **Try again**, then **Success**, returned the callback.
  3. The helper verified the signature and its immediate status read found `authenticated`.
- *App:* the result showed **AutoPay authorisation: Confirmed · Razorpay Test verified**, **No
  confirmed payment**, trial until 8 Oct 2026 3:07 am IST, and the first fee scheduled for that
  expiry.
- *Provider:* `paid_count` 0 and no invoice. Razorpay automatically reversed the ₹5
  authorisation in full. This is provider token handling, not evidence of the refund policy.
- *Reload and restart (app/helper, 21:57Z, demo mode):* a browser reload, then a helper restart
  and another reload, returned the same vendor `r1`, trial expiry, generation, attempt and
  association. The plan's subscription count rose only by this
  object. Pay Now was not offered again.

### Expired trial: immediate signup (vendor `r1`, generation 2)

- *Helper:* preparation expected ₹299 INR with no future `chargeAt`.
- *Helper, callback response at 22:03:23Z:* attempt `callback_verified`, payment `pending`,
  access `TRIAL_ENDED`, every provider-verified flag false.
- *App/provider, next status read about 1.5 s later:* subscription `sub_TfdVBSoj5FQzVX` was
  `active`, with `paid_count` 1 and `remaining_count` 11.
  - Invoice `inv_TfdVC451NEq23v` was `paid`: ₹299 INR for the period
    `2026-09-23T22:03:05Z` → `2026-10-23T18:30:00Z`, with the payment captured.
  - Plan then showed **Confirmed paid · Razorpay Test verified**, PAID access and the next fee on
    24 Oct 2026 12:00 am IST.
  - Razorpay ended the first cycle at IST midnight, not one month after the payment. The helper
    stores the provider's period.
- *Provider:* the next `charge_at` was `2026-10-23T18:30:00Z`, the monthly recurrence.

### Paid sample: renewal (vendor `r1`, generation 3)

- *Helper/provider:* the sample was paid through `2026-10-23T22:05:41Z`. AutoPay setup created
  `sub_TfdYc1G2dL4mlz`, `authenticated`, with `start_at` equal to that date, after a refunded ₹5
  authorisation.
- *Operator:* **Charge this now** → Success at about 22:25Z.
  - *Provider:* the subscription became `active`, with `auth_attempts` 1. Invoice
    `inv_Tfdssm6usHB5cF` covered `2026-10-23T22:05:41Z` → `2026-11-23T18:30:00Z`, the original
    boundary, not the charge time.
  - *Provider:* the invoice stayed `issued`, with its ₹299 payment `created`, until the payment
    was captured about 5.3 minutes after the charge (invoice `paid` at 22:30:38Z).
  - *App:* until then, Plan showed AutoPay confirmed and **No confirmed payment**.
  - *App (renewal success):* after the capture, Refresh showed **Confirmed paid · Razorpay Test
    verified** for 24 Oct 2026 3:35 am IST to 24 Nov 2026 12:00 am IST. That is the original
    cycle after the sample boundary; neither the charge time nor the trial moved.
- *Operator:* **Charge this now** → Failure twice.
  - *Provider (failed renewal debit):* both debits reached Razorpay about five minutes later
    (22:40:28Z and 22:40:58Z).
    - A new invoice `inv_Tfe8uo19clbLaT` covered the next original cycle, `2026-11-23T18:30:00Z`
      → `2026-12-23T18:30:00Z`, and stayed `issued`.
    - Both ₹299 payments failed with `card_mandate_current_cycle_allowed_debit_exceeds`.
    - The subscription became `pending`. `charge_at` moved to the retry date while the cycle
      stayed unchanged.
  - *Caveat:* every failed debit reported the card mandate's per-cycle debit limit rather than a
    simulator result, and it hit the next cycle's invoice right after that cycle was paid early.
    The Dashboard **Failure** choice is therefore not shown to be the cause. The observation is a
    failed renewal debit, not a clean simulated renewal failure.
  - *App:* **Failed · Razorpay Test verified**, with paid coverage still ending 24 Nov 2026
    12:00 am IST and no grace period.
  - *Provider:* two more ₹299 debits failed with the same reason at 22:43:08Z and 22:44:40Z. The
    operator reported no further charge action. The subscription then read `halted`, with
    `charge_at` on the next cycle.
  - *App:* Plan added "collection halted after failed retries. Confirmed coverage is kept".
- **Recovery was not observed.** The Test Dashboard offers no **Charge this now** while the
  subscription is pending or halted.
  - *Agent, hosted page:* the customer subscription page offered **Update Payment Method** (cards only, with a
    refundable ₹5 token). In headless Chromium it failed inside Razorpay's saved-card step
    ("Payment failed. Please login.") and created no payment.
  - Every debit after the first successful accelerated charge failed with the card mandate's
    per-cycle debit limit. That suggests, but does not establish, that a Dashboard-triggered
    success in the same real-time cycle is unavailable.

### Cancellation, rejoining and reset

- **Trial cancellation** (*app/helper/provider*): an immediate stop before the first fee.
  - Requested at 21:58:27.5Z. Razorpay recorded `ended_at` 21:58:28Z, and Plan's next read
    confirmed it at 21:58:29.2Z.
  - Plan showed **Cancellation confirmed · Razorpay Test verified**, trial retained, "no refund
    was requested".
- **Rejoining** (*app/provider*): Pay Now created a new `sub_TfdRZqv9bdWf9j`, `authenticated`,
  with the same `start_at`. The old object stayed `cancelled`, so no agreement overlapped.
- **Paid-cycle cancellation** (*app/provider*): a cycle-end stop.
  - Plan showed "Renewal cancellation scheduled" for 24 Oct 2026 12:00 am IST, kept PAID coverage
    and offered no replacement.
  - Razorpay's subscription read still showed `active`, with `charge_at` unchanged and
    `has_scheduled_changes` false. In this read the scheduled stop was not visible; only the
    helper's record of the accepted request shows it.
- **Reset over a scheduled cycle-end stop** (*helper/provider*): Razorpay Test accepted an
  immediate cancel.
  - The helper's following read showed `cancelled`, and the reset completed 1.4 s after it was
    requested.
  - The captured ₹299 was not refunded.
- **Pending reset** (*induced*, 22:01–22:02Z): the helper ran with a preload that failed every outgoing cancel
  request.
  - Reset stayed pending ("cancellation requested, but Razorpay Test has not answered").
  - The helper refused a new scenario and a preparation with 409.
  - Razorpay still showed that object `authenticated`.
  - After a normal restart, **Retry reset** cancelled it (`ended_at` 22:01:50Z) and completed.
  - The already-cancelled sibling was recorded as `closed`.
- **Reset on a `created` subscription** (*app/provider*, 22:15Z): a never-authorised object was cancelled immediately and
  confirmed by the next read.
- **History** (*app/helper*): generations show a scrubbed history. The next generation started only
  after an explicit scenario choice.
- **Fixture only:** cancellation races and refund progress appear only in **Show a sample billing
  status**. That panel is labelled "Simulated · cancellation progress" and "Simulated · refund
  progress", and made no helper or Razorpay request.

### Isolation

- **Ordinary demo billing** (*app, request log*, 21:36Z): Plan loaded, and its simulated Pay Now ran, with no helper request,
  no `checkout.razorpay.com` script and no API request.
- **Backend session** (*app/helper/provider, request log*, 22:13–22:16Z): in an API-mode session
  for the development vendor, the Test switch created a separate vendor-scoped Active trial
  (generation 1, expiry `2026-10-07T22:13:21.540Z`). Checkout opened for a future-start object whose `start_at` matched that
  scenario's expiry.
  - The backend received only `GET /v1/vendors/{vendor_id}/context` reads, with no writes.
  - Stored auth user, access-token and refresh-token lengths, and the cart were unchanged.
  - Returning to ordinary billing cleared the Test selection and resumed the account's API-mode
    billing read, so global API mode was unchanged.
  - The scenario was then reset.

### Defect and limitations

- **Defect** (*app/helper*, 21:39Z; frontend owner): on each page load with a scenario, simultaneous helper status
  reads return `deferred`. Plan then shows "Razorpay Test status could not be read just now",
  and Pay Now stays hidden until **Refresh billing status**.
  - Reproduced 3/3 on reload; one Refresh cleared it 3/3.
  - Observed in the development build.
- **Recovery:** renewal recovery remains **unobserved**. It needs a Razorpay Test route that can
  collect a pending cycle's invoice.
- **Scheduled stops:** a provider read cannot distinguish a scheduled cycle-end stop.
- **Left open:** the halted Paid sample (generation 3) was left for inspection, not reset. A
  second development vendor's scenario, created outside this run, was left untouched.
- **Other methods:** UPI and other launch methods were not exercised. Spring signature, webhook
  and enforcement evidence, real refunds and production bank timing remain separate gates.

### Reproduce

1. Run the helper as in the [README](../README.md#environment-variables), with a locally excluded store.
2. Open `/vendor/plan`, choose **Use local Razorpay Test Mode**, then choose one scenario per
   journey. Since the 24 September helper fix, a load reads provider status without a manual
   **Refresh billing status**.
3. Pay with the Visa test card and the Checkout steps above.
4. Inspect each object's `start_at`, invoices and payments with the Razorpay CLI before and after
   each step.
5. Use only the Paid sample scenario for **Charge this now**, within three days of AutoPay setup.
   Accelerated charges never advance the trial.

## Plan Test Mode evidence — 24 September 2026

Continuation of the 23 September record, which stays unchanged. Local development app in demo
mode, the local helper and hosted Razorpay Test Checkout driven by headless Chromium, provider
reads through the Razorpay CLI, and Dashboard steps by the Test account operator. Times are UTC.

### Status-read defect fixed (*app/helper*)

- *Cause:* the helper answered any status read that arrived while another read for the same vendor
  was in flight with `deferred`. Plan and its local Test panel both read on mount, so one read
  always lost.
- *Fix:* simultaneous status reads for one vendor now share the in-flight provider read. A read
  during a write still returns `deferred`, and a write during a read still gets 409. A helper
  regression test covers both.
- *App:* three Plan loads for vendor `r1` at about 04:20Z showed no "could not be read just now"
  notice. After a new scenario was selected, **Pay Now** appeared without a manual Refresh.

### Paid sample: second renewal attempt (vendor `r1`, generation 4)

- *Helper/provider:* **Reset Test scenario** cancelled the halted generation 3 object
  `sub_TfdYc1G2dL4mlz` (read `cancelled` at 04:22Z). Paid sample generation 4 was sample-paid
  through `2026-10-24T04:22:27Z`. AutoPay setup created `sub_Tfjyg54hFopFPn`, `authenticated`,
  with `start_at` equal to that date, after a ₹5 authorisation that was fully refunded.
- *Operator:* **Charge this now** → **Failure**, at about 04:25Z.
  - *Provider:* the first invoice, covering `2026-10-24T04:22:27Z` → `2026-11-23T18:30:00Z`, was
    issued at 04:28:27Z. Its single ₹299 payment was created at 04:28:30Z and captured, and the
    invoice read `paid` at 04:34:13Z. No failed payment exists for that invoice.
  - *Finding:* the Dashboard **Failure** choice did not produce a failed debit in this run, so a
    clean simulated renewal failure is still not observed.
  - An operator **Charge this now** → Success at about 04:33Z preceded the capture. The provider
    records do not show which action the capture came from.
- *Provider (failed renewal debit):* Razorpay then issued the next original cycle's invoice,
  `2026-11-23T18:30:00Z` → `2026-12-23T18:30:00Z`. Its ₹299 debit failed at 04:39:52Z with
  `card_mandate_current_cycle_allowed_debit_exceeds`, and the subscription read `pending`.
- *App:* Refresh showed **Failed · Razorpay Test verified**, with a verified fee period of 24 Oct
  2026 9:52 am IST to 24 Nov 2026 12:00 am IST. Paid coverage still ended at that original
  boundary, with no grace and an unchanged renewal date.
- **Recovery was not observed.**
  - *Operator, Dashboard:* a pending subscription offers **Attempt Retry** (Test Mode: retry the
    last issued invoice now), not **Update Payment Method**.
  - *Operator:* **Attempt Retry** → charge as success showed a success notification.
  - *Provider:* the retry's debit failed at 04:47:56Z and again at 04:51:29Z, both with the same
    per-cycle mandate reason. The subscription stayed `pending`, 3 attempts failed, and the
    Dashboard reported the next retry about 1526 hours later. The provider's `charge_at` read
    `2026-11-26T18:30:00Z`.
  - Together with 23 September, every debit after a cycle's first accelerated success failed on
    the card mandate's per-cycle limit, whatever outcome the Dashboard chose. The Test tools
    therefore cannot collect a second cycle within one real-time mandate cycle.

### Remaining

- `sub_Tfjyg54hFopFPn` is left `pending` and untouched. Razorpay's own retry, scheduled for
  `2026-11-26T18:30:00Z`, falls in a later mandate cycle. If it collects the same invoice, reading
  the provider and refreshing Plan after that date is the remaining recovery check: a verified
  renewal for 24 Nov → 24 Dec 2026 IST, and no new cycle.
- A clean simulated renewal failure remains unobserved.

## Validation record

**Historical evidence from 18 September 2026, before the hybrid migration.** The results below
establish the earlier immediate-start Test Checkout path only; they do not verify the current
future-start setup or any real billing entitlement.

On 18 September 2026: `npm run typecheck` passed; `npm run lint` passed with two existing
Fast Refresh warnings in the shared badge/button primitives; `npm run test` passed **57 files /
731 tests**, including 19 new billing tests; `npm run build` passed with the existing transport
dynamic-import and bundle-size warnings. Searching the built JavaScript confirmed the development
page, preview route, Razorpay script URL and Test-key marker were absent. Relative documentation
links and `git diff --check` passed. A run concurrent with browser work hit existing router
assertion timing and onboarding timeout failures; both suites passed a focused rerun without
changing assertions or timeouts. The subsequent full run passed all 731 tests, followed by a
successful production build.

Automated tests isolate the provider and backend network. They cover script failure/timeout and
retry; subscription-specific inputs; failure followed by success in one modal; dismissal; teardown
and late callbacks; duplicate-click prevention; early-payment acknowledgement; and preservation of
trial/access across unverified callbacks. They do not prove provider or bank behavior.

Manual browser observation used the official Checkout with the supplied subscription: Test Mode,
₹299 initial fee, monthly recurring schedule, and contact/card entry were visible. The Test bank
simulator completed successfully and the application received the subscription callback. The page
showed **confirmation pending**, retained **TRIAL** access and did **not** show confirmed paid
membership. A separate CLI read confirmed provider `active` / `paid_count: 1`; that read is a test
observation, not an implemented backend verification path. No app page errors were observed.
The fresh subscription was opened and dismissed using **Close Checkout → Yes, exit**. The app
showed the dismissed message, kept trial access and re-enabled its paid-signup action; no payment
was submitted on that object.
Failure/retry assertions are automated simulations, not claimed live provider results. No real-money
payment, provider cancellation or schedule change was performed.

Provider verification, webhooks, recurring debits, real refunds, all launch payment methods, and
production billing/access journeys remain unverified until the backend is available. The approved
hybrid's trial preservation, optional setup, no-grace expiry, cancellation and rejoining have not
been exercised by this preview. Test card tokens expire after three days; follow the
research's simulated-renewal procedure rather than waiting 14 days with the same token.
