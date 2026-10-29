# Vendor billing development preview

> **Frozen, demo only.** Since 29 September 2026 demo mode, this preview, the six-state prototype
> and the local test server are frozen with the trial AutoPay flow described below (Set up AutoPay,
> Turn off AutoPay, a ₹5 authorisation, a future-start Keep shop open). The Live API follows the
> [early first fee](./VENDOR_BILLING_DECISIONS.md#early-first-fee--29-september-2026) instead: paying during the trial charges ₹299 at once. Nothing here describes Live API
> behavior.

The development route demonstrates the [hybrid trial](./VENDOR_BILLING_DECISIONS.md) as approved
on 19–24 September 2026, with the [mock dataset](./VENDOR_BILLING_MOCK_DATASET.md)'s
[wire-shaped contexts](./examples/vendor-billing/mock-responses.json). An eligible
vendor's trial is already active without Checkout. **Pay Now** during trial optionally prepares
AutoPay for the original expiry; a separate method authorisation amount is disclosed when supplied.
A simulated acknowledgement remains pending until the explicit **Simulate confirmation** action.
That confirmation keeps trial access and its expiry. The preview also retains a deliberate Razorpay
Test Mode Checkout path, whose callback remains unverified.

The fixture statuses are labelled **Simulated billing** and grant no real entitlement. No backend
billing write, provider cancellation, real refund or expiry enforcement is shipped by this preview.
`/vendor/plan` has separate demo billing, and the Live API reads the backend billing API
([Live API billing](./API_ARCHITECTURE.md#vendor-platform-billing-live-api)); see the
[architecture owner](./API_ARCHITECTURE.md#vendor-platform-billing-preview). Fixture cancellation
and race-refund progress are simulated presentation only. After a real Test callback, the preview
refuses cancellation rather than pretend it cancelled a Razorpay object. The historical 18
September provider observations below describe the earlier Checkout exercise only. The dated
[Plan Test Mode evidence](#plan-test-mode-evidence--23-september-2026) records Plan's hosted
Test journeys.

Since 24 September, demo Plan in development no longer offers **Show a sample billing status** or
**Use local Razorpay Test Mode**. It shows a six-state prototype instead (Free days, 3 days left,
Paid, Payment failed, Stopped, Shop closed). Its chips are seeded through the local helper under
its own vendor key, and choosing a chip runs the guarded reset before selecting. In Free days and
3 days left, **Set up AutoPay** opens hosted Test Checkout for a future-start subscription at the
trial end (demo only; the Live API charges ₹299 now instead). Only after helper verification and a provider read does Plan show AutoPay on; the
state and free days stay unchanged. **Turn off AutoPay** cancels through the helper. In Payment
failed and Shop closed, **Pay ₹299 with Razorpay** opens hosted Test Checkout for an immediate-start
subscription. Plan shows "Confirming payment…" until a provider read shows the fee captured. Then
the helper moves the scenario to Paid, paid through the end of the provider's first invoice
period, and adds a "Paid ₹299" history row. In Paid, **Stop the plan** asks once, then moves to
Stopped with the same paid-through date. The seeded sample stops locally. A real Test subscription
is cancelled at cycle end, and Stopped then rests on the helper's record of Razorpay accepting
that request, because provider reads cannot show a scheduled stop. In Stopped, **Keep shop open**
first closes any stopped subscription and reads it back closed. It then opens hosted Test
Checkout for a future-start subscription at the paid-through date. Once the provider read shows
it authorised, the state returns to Paid with the same paid-through and the next ₹299 due then.
Every demo vendor page in development shows the current state's banner and a header button ("Pay
₹299", "Keep open · ₹299" or "Shop plan"), Overview included. Both read the state Plan shows and
only link to Plan, so Checkout opens nowhere else. They are messages only: the storefront and orders
are not gated. The demo "store state" switcher and its fixture states are removed; the demo store
is always approved and active. As of 24 September, Live API and production demo builds were
unchanged; the Live API's own chrome is described in
[Live API billing](./API_ARCHITECTURE.md#vendor-platform-billing-live-api). The
[decision record](./VENDOR_BILLING_DECISIONS.md#six-state-demo-plan-prototype--24-september-2026)
owns the six states. The 23 September and first 24 September Plan evidence below describes the
earlier controls; the [six-state evidence](#six-state-prototype-evidence--24-september-2026) records
the prototype, and the [evaluation](#prototype-evaluation-and-fixes--24-september-2026) records its
edge cases and two fixes.

## Differences from the approved model

The preview supplies fabricated entitlement and schedule facts. The backend has not granted a
real trial, verified a provider callback, enforced expiry, or supplied cancellation and refund
progress; the displayed cancellation and refund progress comes from fixtures. Its status controls
demonstrate presentation only. The Live API's integration is separate and does not use the
preview ([Live API billing](./API_ARCHITECTURE.md#vendor-platform-billing-live-api)).

The biggest difference since 29 September 2026: the approved model is the [early first fee](./VENDOR_BILLING_DECISIONS.md#early-first-fee--29-september-2026) (₹299 at once during
the trial, for the month that starts at the trial end), while the preview and prototype keep the
withdrawn AutoPay-only trial setup.

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

## Related decisions

- [Agreed scope and product rules](./VENDOR_BILLING_DECISIONS.md), including the [early first fee](./VENDOR_BILLING_DECISIONS.md#early-first-fee--29-september-2026).
- [Official-source research, reviewed 19 September 2026](./research/razorpay-vendor-subscriptions.md):
  lifecycle, method restrictions, signature formulas, reminders, charges, timing and test limits.
- [Backend billing brief](./VENDOR_BILLING_BACKEND_BRIEF.md): where the published billing API
  falls short, verification, enforcement, and acceptance cases.
- Module boundaries: [Live API billing](./API_ARCHITECTURE.md#vendor-platform-billing-live-api) and
  [the preview](./API_ARCHITECTURE.md#vendor-platform-billing-preview).

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
2. *(Historical: this control was removed on 24 September.)* Open `/vendor/plan`, choose **Use local Razorpay Test Mode**, then choose one scenario per
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

## Six-state prototype evidence — 24 September 2026

Hosted Razorpay Test runs of the six-state prototype on demo Plan, recorded between 15:15 and 15:22
UTC. The two Plan Test Mode records above stay unchanged. **No Spring backend was involved**:
states, trial and access are the helper's local simulation, and Razorpay facts are Test Mode facts.

**Environment.** Linux (WSL2). Headless Chromium drove the local development app in demo mode
(`VITE_USE_API=false`) and the official hosted Checkout. The helper ran on `127.0.0.1:4179` with
its default local store. Every scenario used helper vendor key `r1-prototype`; vendor `r1` was not
touched. Provider reads were read-only REST calls with the helper's Test key.

**Evidence sources.** *App* is Plan's visible text. *Helper* is the helper's status response.
*Provider* is a Razorpay Test read.

**Checkout steps.** These were the same for every payment. Contact details came first (synthetic
values), then the domestic Visa test card ending 4366, typed key by key. Then **Save this card as
per RBI guidelines**, **Skip OTP**, **Pay on bank's page**, and the simulator's **Success** or
**Failure**. Checkout offered cards only.

### Free days: AutoPay setup and turn off (generation 48, 15:15–15:16)

- *App:* the button read **Set up AutoPay · ₹299 on 6 Oct**, with "Your card is checked with a
  refundable ₹5 charge now; the first ₹299 is charged on 6 Oct, when free days end."
- *App (failure):* the bank page's **Failure**, then closing Checkout, showed "The card payment did
  not go through (Payment failed), so AutoPay is not set up. Nothing changed; your free days are the
  same." The state stayed on 12 days left.
- *App (success):* Plan stayed in Free days with 12 days left and showed "AutoPay on — first ₹299 on
  6 Oct". The banner read "12 free days left — AutoPay is on, so the first ₹299 is charged on 6
  Oct.", and history gained "AutoPay on · First ₹299 on 6 Oct".
- *Helper:* the attempt was `authorised`, with authorisation `confirmed`. `nextChargeAt` equalled
  the trial end, `2026-10-06T14:48:34.857Z`. Access stayed `TRIAL`, with payment `none` and no
  paid-through date.
- *App/helper (turn off):* **Turn off AutoPay** gave an immediate cancellation, confirmed at
  15:16:05.984Z. Plan returned to plain Free days with the same trial end, **Set up AutoPay**
  offered again, and a new "AutoPay turned off" row.
- *Provider:* `sub_Tfv5nhXrg0DK4A` is `cancelled`, with `start_at` `2026-10-06T14:48:34Z` (the trial
  end), `paid_count` 0 and no invoice.

### 3 days left: dismissal, failure, AutoPay setup and turn off (generation 49, 15:16–15:17)

- *App (dismissal):* Checkout was opened, then closed with **Yes, exit** before any card entry. Plan
  showed "Checkout was closed before AutoPay was set up. Nothing changed; your free days are the
  same.", still 3 days left.
- *App (failure):* the same failure notice as in Free days, with the state unchanged.
- *Helper:* the dismissal, the failure and the success reused one prepared Test subscription.
- *App (success):* "AutoPay on — first ₹299 on 27 Sept", still in 3 days left, with a neutral
  banner.
- *Helper:* `nextChargeAt` equalled the trial end, `2026-09-27T15:16:19.046Z`, and access stayed
  `TRIAL`.
- *App/helper (turn off):* confirmed at 15:17:19.007Z, back to "Set up AutoPay now so customers can
  still open your shop when free days end."
- *Provider:* `sub_Tfv6xjIg99y5zg` is `cancelled`, with `start_at` `2026-09-27T15:16:19Z`,
  `paid_count` 0 and no invoice.

### Payment failed → Paid (generation 50, 15:17–15:18)

- *App (failure):* "The card payment did not go through (Payment failed). Nothing changed; your shop
  is still hidden." The state was unchanged.
- *App (success):* Plan showed Paid: "Shop is open. You paid ₹299 via Razorpay. Shop stays open
  until 23 Oct. Next ₹299 is charged on 24 Oct." There was no banner, and history gained "Paid ₹299
  · Shop open until 23 Oct".
- *Helper:* the scenario moved to `paid` in the same generation. The attempt was `fee_confirmed`,
  for the fee period `2026-09-24T15:18:08Z` → `2026-10-23T18:30:00Z`. The first cycle ends at IST
  midnight, so the last paid day is 23 Oct. Access was `PAID`, and every provider-verified flag was
  true.
- *Provider:* `sub_Tfv8FzK4qXrgP8` has `paid_count` 1 and one ₹299 invoice, `paid`. The next chip
  choice cancelled it (`ended_at` 15:18:41Z), and the invoice was kept, not refunded.
- *Not observed live:* "Confirming payment…". The fee was already captured at the first reread
  after Success.

### Shop closed → Paid (generation 51, 15:18–15:19)

- *App:* the same failure notice, then Paid "until 23 Oct. Next ₹299 is charged on 24 Oct."
  History kept the seeded "Plan stopped" and "Paid ₹299" rows below the new one.
- *Helper:* `fee_confirmed`, for the fee period `2026-09-24T15:19:16Z` → `2026-10-23T18:30:00Z`.
- *Provider:* `sub_Tfv9Sat0SFLm04` has `paid_count` 1 and one ₹299 invoice, `paid`. The next reset
  cancelled it (`ended_at` 15:19:48Z).

### Real Paid → Stop → Stopped → Keep shop open → Paid (generation 52, 15:19–15:21)

1. *App/helper:* in Payment failed, **Pay ₹299 with Razorpay** → **Success** → Paid on
   `sub_TfvAceDGhhkH3A`. The fee period began at 15:20:00Z and ran to `2026-10-23T18:30:00Z`.
2. *App:* **Stop the plan** asked "Stop the plan? No more ₹299 is charged. Your shop stays open
   until 23 Oct, then customers cannot see it."
3. *Helper (stop):* **Yes, stop the plan** requested a **cycle-end** stop at 15:20:17.806Z.
   Razorpay's acceptance moved the scenario to `stopped`, keeping the same paid-through date.
4. *App (Stopped):* "Shop stays open until 23 Oct" and **Keep shop open · ₹299**. The source line
   read "Razorpay Test accepted a stop at the end of the paid days. Its reads cannot show a scheduled
   stop, so this comes from the local helper's record of that acceptance." The banner and header
   read "Keep open · ₹299".
5. *App:* the Keep shop open help text read "Your card is checked with a refundable ₹5 charge now;
   ₹299 is charged on 24 Oct, when paid days end."
6. *Helper (keep open):* the helper persisted the close intent at 15:20:20.389Z and cancelled the
   stopped subscription immediately. Its read showed it closed at 15:20:21.608Z. Only then did it
   create `sub_TfvBDLB9yapAEg`.
7. *App/helper (Paid again):* after **Success**, the replacement read `authorised` and Plan showed
   Paid "until 23 Oct. Next ₹299 is charged on 24 Oct." History gained "Plan stopped" and "AutoPay
   set up again · Next ₹299 on 24 Oct".
8. *App/helper (second stop):* a second **Stop the plan** cancelled the pre-fee replacement
   immediately. Plan moved to Stopped only after a read confirmed it (15:20:51.464Z), with "Razorpay
   Test shows the stopped subscription cancelled. The days you already paid for are kept."
- *Provider:* `sub_TfvAceDGhhkH3A` is `cancelled` (`ended_at` 15:20:21Z), with `paid_count` 1 and
  its one ₹299 invoice `paid`, not refunded.
- *Provider:* `sub_TfvBDLB9yapAEg` is `cancelled`, with `start_at` `2026-10-23T18:30:00Z` (the
  paid-through date), `paid_count` 0 and no invoice. No second ₹299 was charged for the covered
  period.
- *Provider fact relied on:* after accepting a cycle-end stop, Razorpay Test still accepted an
  immediate cancel of the same subscription. A read then showed it `cancelled`, with its paid
  invoice kept and no refund. The 23 September reset observation above found the same.

### Clean-up and limitations

- *Helper:* a final chip choice left `r1-prototype` on Free days, generation 53. All six
  subscriptions above read `cancelled` at the provider. Only `r1-prototype` helper routes were
  called, and there were no page errors. Vendor `r1`'s stored record and history were identical
  before and after.
- *App:* `/dev/vendor-billing` still loaded, with its simulated billing and no page errors.
- **Not repeated in this run:** the sample Paid's local stop, a failed Keep shop open Checkout, the
  banner and header on the other vendor pages, and the helper-down display. Automated tests cover
  them, and earlier local runs on 24 September exercised them.
- **Never exercised live:** a dismissed Keep shop open Checkout, and a refused or unanswered close
  of the stopped subscription. Only automated helper-fake tests cover them.
- Real renewal, a production bank, Spring verification and enforcement remain unexercised. The
  prototype has no clock, and a Test charge never advances a trial.

## Prototype evaluation and fixes — 24 September 2026

Edge-case evaluation of the six-state prototype, about 17:35–18:45 UTC, after the record above. No
Spring backend was involved. The helper ran on its own port with a separate temporary store, so the
operator's helper on 4179, its store and vendor `r1` were untouched. Vite ran in demo mode and
proxied to that helper, and headless Chromium drove hosted Test Checkout with the steps above.
**Evidence sources** are as above, plus two more. *CLI* is a Razorpay CLI write with the helper's
Test key, standing in for a change made outside Plan. *Induced* is a deliberate local fault.

### Automated checks

- `npm run typecheck` and `npm run lint` passed (0 errors, the two existing Fast Refresh warnings).
  `npm run test` passed 67 files / 951 tests before the fixes and 954 after.
  `npm run test:billing-helper` passed 46 tests before and 48 after.
- `npm run build` passed. `dist` contains no prototype code, helper route or new copy.
- `npm run test` does not run the helper suite, because `vitest.config.ts` includes only `src`.
  Run `npm run test:billing-helper` separately.
- Two full runs alongside browser work, at a load average near 11, hit the known router-assertion
  and onboarding timeouts, plus one Plan production-build timeout. Each file passed alone, and a
  full run under lower load passed 954/954.
- The production bundle contains the Razorpay Checkout script URL, through the committed billing
  panel's import. The script loads only when Checkout opens. The 18 September "absent" observation
  below predates that panel.

### Regression walks (all passed)

- **Free days and 3 days left:** a dismissal, a bank-page Failure and a Success each used one
  subscription (`sub_TfxUybQNvpxXXC`, `sub_TfxWUODUiyTBR2`). AutoPay turned on with the free days
  unchanged, and Turn off AutoPay was confirmed by a read.
- **Payment failed → Paid** (`sub_TfxXgCaUz9yZJa`): open until 23 Oct, next ₹299 on 24 Oct.
- **Sample Paid and real Paid:** Stop → Stopped → Keep shop open → Paid → Stop again, with the same
  paid-through date throughout.
- **Chrome:** the banner and header showed on every demo vendor page, and the header button opened
  Plan without Checkout.

### Newly exercised live

- **Keep shop open, dismissed and failed** (*app/helper/provider*): the scenario was a real Stopped
  with a scheduled cycle-end stop.
  - A dismissed Checkout left Stopped with the same paid-through date. Preparation had already
    closed the stopped subscription, so the source line changed to "Razorpay Test shows the stopped
    subscription cancelled".
  - A bank-page Failure also left Stopped, and Success returned to Paid.
  - All three used one replacement, `sub_TfxaVmmBr2a1XS`, starting at the paid-through date.
- **Callback never delivered** (*induced/app/helper*): a reload while Checkout still showed "Payment
  Successful", before its handler ran, left the fee unsubmitted. The next load's provider read
  showed Paid. F3 below covers a submission that fails.
- **Concurrency** (*helper/provider*): two simultaneous preparations got 200 and 409 "already in
  progress". A third key and a replayed key converged on the same `sub_TfxhxFwxr52KrV`, and no
  second object was created.
- **Helper restart and helper down** (*app*): trial AutoPay on survived a helper restart and reload.
  With the helper stopped, Plan showed its notice, disabled every payment button and kept the chips
  display-only. Orders still showed the banner.
- **Unconfirmed reset** (*induced/app/helper/provider*): every Razorpay cancel request was made to
  fail.
  - A chip switch showed "Switching…" and **Retry switch**. The helper kept the reset pending and
    refused a preparation with 409.
  - After a normal restart, Retry switch from a fresh page completed, and `sub_TfxhxFwxr52KrV`
    read `cancelled`.
  - From a reloaded page, the retry reseeded the previous state rather than the chip first chosen.
- **Hostile requests** (*helper*):
  - A foreign `Origin` or a non-JSON write got 403.
  - Forged signatures on the real attempt got 400, with nothing recorded.
  - A callback for another subscription got 409, as did a replayed key from a reset generation and
    a reset naming the wrong generation.
  - An oversized body got 500 "Local helper storage failed", and invalid JSON got 500. Both were
    refused, but with misleading status codes.
- **External trial cancellation** (*CLI/app*): cancelling trial AutoPay (`sub_TfxgZ63cyS3Fkp`) at
  Razorpay returned Plan to plain 3 days left, with Set up AutoPay offered again. Its history row
  reads "AutoPay turned off", as if the vendor did it.

### Defects fixed

- **F3, lost callback submission** (*induced/app*): the helper's submission route was blocked after
  a successful ₹299.
  - *Before:* Plan said "The local Test helper is not running", kept Payment failed ("Shop is
    hidden") and disabled every button. The helper was up, and a reload showed Paid. No second
    charge was possible.
  - *Fix:* Plan shows "Checkout finished, but its result did not reach the local helper…" and
    rereads. It shows the helper down only if that reread also fails.
  - *After (18:36Z, `sub_TfyVua86iUKngC`):* Plan showed Paid at once, with that notice.
- **F5, AutoPay ended outside Plan** (*CLI/app/helper*): a real Paid's subscription was cancelled at
  Razorpay.
  - *Before:* Plan kept "Shop is open… until 23 Oct" but dropped the next-charge line, disabled
    Stop the plan and offered no way to set AutoPay up again.
  - *Fix:* the helper moves Paid to Stopped with an `autopay_ended` event
    ([decision](./VENDOR_BILLING_DECISIONS.md#six-state-demo-plan-prototype--24-september-2026)).
  - *After (18:37–18:38Z):* Plan read "AutoPay ended" with the same paid-through date (24 Oct),
    "Keep open · ₹299" in the header and a history row. Keep shop open's hosted Checkout created
    `sub_TfyXxTydXE1j1e` at that date and returned to Paid.

### Open findings (not fixed)

- **Pause at Razorpay** (*CLI/app*): after a real Paid subscription was paused, the helper reported
  authorisation pending, and Plan still named the next ₹299 on 24 Oct. A paused subscription is not
  charged. The withdrawn 24 September context proposal's `autopay_status` had no paused value;
  pause/resume is an open decision.
- **Stop after pause and resume** (*CLI/provider*): Razorpay accepted a cycle-end stop on the
  paused subscription. After resume it read `active`, with `charge_at` 23 Oct and no visible
  scheduled change, so whether the stop survives cannot be read before that date. The object was
  then cancelled, leaving nothing to charge.
- **Refund of a confirmed fee** (*CLI/helper*): a full Test refund of the first ₹299 (payment
  `refunded`, `full`) left the helper Paid, with the payment confirmed and provider-verified. A
  confirmed fee is never reread, and access after such a refund is an open decision.
- **No clock** (*helper clock moved 13 days ahead, on a copy of the store*): the helper reported the
  trial ended, the store hidden and only `pay_first_fee` available. Plan still showed Free days, 0
  days left and a disabled Set up AutoPay. A 3 days left demo reaches this after three real days.
- **Copy:** "Payments you made" lists AutoPay rows, and "If you do not pay" stays after AutoPay is on.

### Operator checks — 24 September, 19:20–21:30 UTC

These checks were run by the Test account operator on the operator's own helper (4179), store and
demo Vite (5173). The Test Dashboard's **Charge this now** offers **Charge as Success** and **Charge
as failure**. Provider reads were REST calls with the helper's Test key.

1. **First AutoPay fee collected early** (*operator/provider/helper/app*):
   - The operator set up 3 days left AutoPay (`sub_TfzIAnTYW5hmN4`), then used **Charge as Success**.
   - The ₹299 was captured at 19:30:36Z. Its invoice covered the original trial end
     (`2026-09-27T19:20:17Z`) to `2026-10-27T18:30:00Z`, and the next charge was 28 Oct IST.
   - The helper recorded the fee as confirmed, with the trial and its days unchanged.
   - **Defect F6:** Plan still read "AutoPay on — first ₹299 on 28 Oct", and history gained no Paid row.
2. **First AutoPay fee failing: not testable on this account** (*operator/provider*):
   - **Charge as failure** on a trial AutoPay subscription produced a captured ₹299, with no failed
     attempt, on `sub_TfzjaezxBaysqR` (19:52Z), `sub_Tg0K6G4eY1TLhL` (20:24Z) and
     `sub_Tg0a1hWrGpcC46`.
   - On the last, the operator's choice was confirmed. The invoice stayed `issued` with its payment
     `created` from 20:41:43Z, then was captured by 20:47:30Z.
   - *Control:* an authorised future-start subscription left untouched (`sub_Tg02cuYuMb6Nkp`, from
     20:07Z) stayed `authenticated`, with no invoice, for 13.5 minutes. Razorpay does not charge
     early by itself.
   - The risk read from the code stays unverified: after a failed first AutoPay fee, Pay ₹299 is
     refused while that subscription is open.
3. **Renewal, then a Dashboard cancel** (*operator/provider/helper/app*):
   - On a real Paid (`sub_Tg0u2fx98pxrTK`, first fee paid in Checkout), **Charge as Success** issued
     the next original cycle's invoice, `2026-10-24T18:30Z` → `2026-11-24T18:30Z`. It was captured
     at about 21:06Z.
   - Unlike 23 September, no per-cycle mandate limit applied: the first fee here was a Checkout
     payment, not a mandate debit.
   - Plan read "Shop stays open until 24 Nov. Next ₹299 is charged on 25 Nov."
   - **Defect F7:** the renewal added no Paid row to history.
   - The Dashboard **Cancel** (immediate, at 21:17:24Z) moved Plan to **AutoPay ended** on the next
     read. It showed "Shop stays open until 24 Nov", 61 days left and Keep shop open · ₹299. This
     confirms the F5 fix outside the CLI.
4. **Phone-sized Checkout** (*operator/provider*):
   - In desktop Chrome's device mode, Payment failed → Pay ₹299 was run: two bank-page failures,
     then a success, all on `sub_Tg1OsrKrMtFLfG`. Plan moved to Paid.
   - No layout problem was reported. A real phone cannot reach the helper, which accepts only
     `localhost` origins.

**F6 and F7 fixed (25 September, automated evidence only):**
- A fee confirmed outside Pay ₹299 now appends one Paid row, dated at the read. That covers a trial
  AutoPay fee collected early and each renewal.
- In free days, once the first ₹299 is collected, the card reads "AutoPay on — first ₹299 paid, shop
  open until ‹date›. Next ₹299 on ‹date›." The banner says the first ₹299 is already paid.
- Helper and card tests cover both. Hosted confirmation needs one more Charge this now.

### Not exercised

- A failed first AutoPay fee and a failed renewal: the Test Dashboard's failure option captured the
  payment.
- Hosted Checkout on a real phone.
- The renewal-recovery recheck after 2026-11-26.

### Clean-up

All 14 Test subscriptions from the agent's evaluation read `cancelled`. Six collected a Test ₹299,
one of which was then refunded. The operator's helper store and vendor `r1` were not changed by
the agent's runs.

Of the operator checks' seven subscriptions, six read `cancelled`, with their paid invoices kept.
`sub_Tg1OsrKrMtFLfG` stays `active` as the operator's current Paid scenario, with its next ₹299
due 24 Oct 18:30Z. Choosing any chip cancels it.

## Validation record

**Historical evidence from 18 September 2026, before the hybrid migration.** The results below
establish the earlier immediate-start Test Checkout path only; they do not verify demo's
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
production billing/access journeys remain unverified until the backend is available. The 19 September
hybrid's trial preservation, optional setup, no-grace expiry, cancellation and rejoining (since
amended; see the [early first fee](./VENDOR_BILLING_DECISIONS.md#early-first-fee--29-september-2026)) have not been exercised by this preview. Test card tokens expire after three days; follow the
research's simulated-renewal procedure rather than waiting 14 days with the same token.
