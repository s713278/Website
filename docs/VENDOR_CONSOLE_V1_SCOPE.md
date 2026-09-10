# Vendor console — v1 scope

**Status: accepted, 8 September 2026.** This document supersedes
[VENDOR_CONSOLE_FRONTEND_DELIVERY_PLAN.md](./VENDOR_CONSOLE_FRONTEND_DELIVERY_PLAN.md), which was
written while backend fixes were expected. Where the two disagree, this one wins.

It owns **what the vendor console contains in v1, what it deliberately excludes, and why** — so that
a later session does not rebuild something that was cut on purpose.

## Why the plan changed

The backend team **declined all work** on [VENDOR_CONSOLE_BACKEND_ASKS.md](./VENDOR_CONSOLE_BACKEND_ASKS.md),
and asked for a minimal first version. Nothing is pending a backend fix any more: every item is
either built on data that already exists, or cut. The three surfaces named as essential were orders
and their details, the vendor's plan, and whatever else the backend already returns.

[VENDOR_CONSOLE_CLAIM_AUDIT.md](./VENDOR_CONSOLE_CLAIM_AUDIT.md) remains accurate and is still the
evidence behind every capability claim here.

## The console in v1

Six navigation entries: **Overview, Orders, Products, Plan, Storefront, Settings.** Five on mobile,
with Settings in the account menu.

| Surface | Contains |
|---|---|
| Overview | The day's work queue and order counts. **Nothing plan-related.** |
| Orders | Delivery-date filtering, paging, order detail, status advance, cancel, and the vendor's own device-local payment record |
| Orders → Subscriptions | Read-only list at `/vendor/orders/subscriptions`, reached by a tab strip on Orders, which stays highlighted in the rail |
| Products | Grouped sizes and price editing |
| Plan | Usage against limits, then plan name, then status |
| Storefront | Store presentation |
| Settings | Store details, read-only |

### Subscriptions

`GET /v1/vendors/{id}/subs` returns a complete row schema — `sub_id`, `mobile`, `customer_id`,
`sku_name`, `quantity`, `frequency`, `delivery_mode`, `payment_type`, `start_date`, `next_delivery`,
`status`. Every field a detail page would show is already in the row, so **there is no detail page**;
a click would re-render the same data.

The status filter mirrors the Orders idiom exactly: four chips (`PENDING`, `ACTIVE`, `DELETED`,
`EXPIRED`) plus a clear, defaulting to all, with filter state in the URL. `DELETED` is shown rather
than hidden — it is in the vendor's data either way, and a list whose rows cannot be reconciled
against a backend count is worse than a row labelled deleted.

## What v1 excludes, and why

**Nothing here is an oversight. Each was considered and cut.**

| Cut | Reason |
|---|---|
| The tier/upgrade list | `GET /v1/api/subscription-plans` returns **403** on a vendor token. Only the FREE tier's own limits are readable. Every other tier's name, limits and price would be invented. |
| Plan prices | Pricing is undecided. A displayed number gets quoted back at you. |
| A trial countdown | The backend models no trial: `trial_days: 0` and no `trial_ends_at` key in any deployed response. |
| `eligible_features` in the UI | It returns opaque tokens (`DASHBOARD`, `VIEW`, `CATALOG`) whose meaning is unexplored. Rendering them tells a vendor nothing; labelling them would be invented copy. The mapper still carries the field. |
| The Customers screen | `GET /v1/vendors/{id}/customers` returns an empty result with no declared row schema, on every account tested. |
| ~~Mark paid~~ — **reversed 10 September 2026** | Cut on 8 Sep because no part of the backend can record a payment. That fact is unchanged and was re-verified on 10 Sep: both `PATCH` routes carrying `payment_status` return 417 for every body, `PATCH /v1/users/{u}/orders/{o}` returns a false `200`, and none of the 117 paths is a payment endpoint. **The product decision changed, not the contract.** MithraDirect never handles the money, so payment status was never a fact the backend could observe — it is the vendor's own note that they were paid, and it now lives on the device, scoped to the vendor and layered over the backend's read behind one service function. See `docs/adr/0003-payment-status-is-a-device-local-vendor-record.md`. Cancel stays — it works. |
| Resubmission after rejection | Nothing in the contract reopens a submitted store. This is the first thing to build once verification ships. |

### What the Mark paid reversal did not bring back

The record is a badge and two controls, and nothing else. Each of these was considered again on
10 September and stays cut, because the orders endpoint has **no `payment_status` parameter** — its
filters are `mobile_no`, `start_date`, `end_date`, `order_status`, `page`, `size`:

- **No payment filter and no unpaid count.** Either could only narrow or count the page already
  fetched, and would read as though it had narrowed or counted the business.
- **No paid/unpaid split in the delivery-window subtotal**, for the same reason.
- **No dues figure.** `payment_dues` sums *all* orders regardless of status — the probe confirmed
  cancelled orders are counted and that it only ever grows. It stays unmapped.
- **`payment_method` stays unmapped.** It reads `CASH_ON_DELIVERY` on every order measured, and the
  vendor may be paid by UPI regardless.

The record is also **never offered on a cancelled order**: marking one paid raises a refund question
v1 has no answer for, and `REFUNDED` is not in the backend's enum.

### §3B of the delivery plan is upheld, not reversed

The superseded plan says at §3B: *"Show existing plan usage and limits when supplied. Do not invent
trial deadlines or billing data."*

**v1 complies with that instruction.** The cuts above are what compliance costs: with no readable
tier catalog, no prices and no trial modelled, the honest Plan page is usage-against-limits plus a
name and a status. Usage and limits are real, measured, and the only part of the plan surface that
tells a vendor anything actionable — specifically, why a catalog add will be refused.

If a tier catalog becomes readable later, the Plan page has an obvious place for it. Do not add one
before then.

## Approval and store state

Vendors are auto-approved. A verification system runs between the final onboarding submission and
go-live, and go-live fires only once it accepts. Any vendor who reaches the console therefore
carries `vendor_status: ACTIVE` and `approval_status: APPROVED` together.

**That system is not built yet**, so the backend still returns `PENDING` after go-live. Until it
does not:

- Store state derives from submitted-and-approved **only**. It does not read `onboarding.next_step`,
  which is resource-derived and moves backwards: a submitted vendor still reports `IN_PROGRESS` with
  an earlier step whenever any assigned product lacks a size, which can trap an approved store on
  the setup screen indefinitely.
- `PENDING` is coerced to `APPROVED` behind a named flag, in the store-state derivation **only**.
  It is not applied at the mapper: `approval_status` must stay truthful everywhere else, so that the
  day the backend is corrected is detectable.
- **Remove the flag when the backend returns `approval_status: APPROVED` on completed onboarding.**
  That is the whole removal condition.

The onboarding wizard keeps its own independent, uncoerced reading of `approval_status`. This
matters: the backend refuses size creation with a 417 while a store is unapproved, so a wizard that
adopted the coerced value would offer a control that always fails. The two readings must not be
unified into one shared helper.

`UNDER_REVIEW` is unreachable in production — a vendor waiting on verification has not gone live and
is still in the onboarding wizard, which owns that wait. The state is retained anyway, for demo
parity and for the day verification becomes asynchronous with console access.

`REJECTED` shows one sentence and a read-only view of what was submitted. No rejection-reason field
exists anywhere in the contract; `approval_status` is a bare `PENDING | APPROVED | REJECTED`. That
sentence is the complete extent of the rejection surface, not a gap to re-file.

## Demo mode

Demo must mount the vendor shell, which it currently cannot. It needs a vendor-context fixture
carrying a wire-shaped `subscription` block, and subscription rows for the new surface, both shaped
to the payloads recorded in the claim audit.

Three states — setting up, under review and rejected — are built but essentially unshowable on live
data. Demo plus the store-state switcher is what stops them rotting.

## Related documents

| Document | Still authoritative for |
|---|---|
| [VENDOR_CONSOLE_CLAIM_AUDIT.md](./VENDOR_CONSOLE_CLAIM_AUDIT.md) | Evidence behind every capability claim, and its limits |
| [VENDOR_CONSOLE_BACKEND_ASKS.md](./VENDOR_CONSOLE_BACKEND_ASKS.md) | The record of what was asked for and refused |
| [API_GAPS.md](./API_GAPS.md) | Confirmed contract gaps and approved temporary behavior |
| [../CONTEXT.md](../CONTEXT.md) | Domain vocabulary, including Verification, Approved and Plan |
