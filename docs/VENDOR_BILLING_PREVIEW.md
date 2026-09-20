# Vendor billing development preview

Implemented 18 September 2026. This is a real **Razorpay Test Mode Checkout** inside the React app,
with an isolated fixture service in place of the missing billing backend. It does not implement
production billing, register a real membership, or change store visibility/access. The vendor
login, onboarding, `/vendor/plan`, and customer checkout flows keep their existing behavior.

**Specification revised 19 September 2026:** the [approved hybrid](./VENDOR_BILLING_DECISIONS.md)
supersedes the trial policies demonstrated here. Application code and its existing tests have not
been migrated by this documentation review. The instructions and 18 September validation below
describe the **legacy preview**, not an implementation or successful test of the approved hybrid.

## Differences from the approved model

| Existing preview behavior | Required hybrid behavior |
|---|---|
| Option A active-trial action uses an immediate-start subscription and asks the vendor to give up remaining days | **Pay Now** optionally authorises future fees at the original trial expiry; explanation must preserve every remaining day |
| Option B requires AutoPay setup before a trial is shown | Grant the platform trial after completed onboarding and genuine approval, without any Checkout requirement |
| Labels say neither trial policy is approved | Hybrid policy is approved; only explicitly listed edge cases remain open |
| Confirmed-trial fixture offers a disabled early-conversion action | Show confirmed future billing and cancellation/rejoining actions backed by authoritative status |
| No cancellation operation or cancellation progress in the service interface | Cancel before first fee while retaining trial; stop paid renewal while retaining paid-through access; allow setup again for that same boundary |
| Dates are recreated on fixture reset; paid-through is an illustrative 30 days | Persist original trial dates on the backend and use confirmed monthly billing periods |
| Callbacks remain pending and no real access gates exist | Reconcile provider evidence server-side; enforce expiry without grace and retain existing-order fulfillment |

The existing `BillingIntent` values, forfeiture acknowledgement and tests encode the older proposals.
They need a coordinated implementation change; renaming scenarios alone cannot establish the hybrid.
The Checkout adapter's browser/script handling remains reusable. Current production access is unchanged.

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
The browser accepts only a Test-prefixed key in this preview. Razorpay controls the actual price
and schedule: inspect the subscription in the Test Dashboard before entering its ID. The preview
cannot authenticate that metadata. Use the same Test account as the subscription.

These steps reproduce the old Option A Checkout path. Its early fee and forfeiture text must not
be reused as the approved trial experience.

1. Configure an unused immediate-start subscription on the INR 29900-paise monthly plan.
2. Select an Option A scenario and click **Apply configuration and reset preview**.
3. For an active trial, acknowledge that confirmed payment ends the remaining trial days.
4. Click **Pay ₹299 now and start paid membership**. Use only the official
   [subscription test card details](https://razorpay.com/docs/payments/subscriptions/test/).
5. On callback, the page stays **confirmation pending**. Existing trial expiry/access remains
   unchanged. There is deliberately no local “verify signature” or “grant paid access” button.

The hosted UI observed during validation included optional card-saving OTP, with a **Skip OTP**
control, followed by payment OTP. **Pay on bank's page** led to the Test simulator's **Success**
button. These are provider-owned screens and may change. For automated browser checks, normal
key events were needed for masked card fields; assigning their values alone did not advance the
flow. Use synthetic contact data and the provider's Test simulator, never real card credentials.

The legacy Option B setup action uses a **different** future-start subscription already configured with
the intended date. Selecting that scenario does not schedule a provider payment. Authorisation
does not activate a fixture trial; it remains pending. The separate confirmed-trial and paid
scenarios demonstrate presentation using labeled fixture data only. Early conversion of an
existing future-start subscription is disabled pending backend coordination.

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

- Fixture trial dates, remaining days, three-day/last-day reminders and access values are
  illustrative. They are not calculated from any registered vendor's zero `trial_days` field.
- **Continue free trial** demonstrates the payment-free Option A entry; it neither calls Razorpay
  nor starts/resets an entitlement. The trial is already granted in that scenario's service data.
- Callback fields are handed to `submitCheckout` in memory. They are neither logged nor stored in
  localStorage. The development implementation checks association/shape and returns pending; it
  cannot perform signature verification or authoritative reconciliation.
- The same instance prevents duplicate modal opens. Leaving/resetting closes Checkout and ignores
  late work. Failure remains retryable inside Razorpay; dismissal does not prove payment failure.
- After a callback, no repeat paid/signup action is offered until authoritative confirmation.
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

## Validation record

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
