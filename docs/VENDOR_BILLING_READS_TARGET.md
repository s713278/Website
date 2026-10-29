# Vendor billing reads: target design and temporary workaround

**As of 4 October 2026.** This document owns how the Live API billing read *should* behave under a
future query cache, and the temporary store behavior, tagged `TEMP(vendor-billing-reads)`, that
already sends the same requests without one. [API_ARCHITECTURE.md](./API_ARCHITECTURE.md#vendor-platform-billing-live-api)
owns the current implementation; the [decision record](./VENDOR_BILLING_DECISIONS.md) owns the
product rules.

Scope is the billing family only: the vendor's subscription read
(`GET /v1/vendors/{vendor_id}/subscription`), the plans catalog (`GET /v1/subscription-plans`),
Plan's history read and the billing writes. Other dashboard reads, persisting billing and demo or
preview billing are out of scope.

## Why

Before the workaround, every window focus on any vendor page reread billing with no minimum age,
every reread fetched the static plans catalog again, and Plan force-reread on every mount. Plain
navigation sent nothing. Every backend endpoint answers `Cache-Control: no-store`, so only client
memory can avoid the repeats. The app has no query library by decision
([API_ARCHITECTURE.md §6](./API_ARCHITECTURE.md#6-how-to-call-the-api-from-a-component)), so the
shared read store reproduces the target's request counts until one is adopted.

## Request counts (current and target)

| Event | Subscription read | Plans catalog |
|---|---|---|
| Hard load or new tab | 1 | 1 |
| Client navigation, any page | 0 | 0 |
| Focus, last good read < 15 min old, no hold, not confirming, no error | 0 | 0 |
| Focus, read ≥ 15 min old, or last read failed, or hold active, or view confirming, or another tab signalled | 1 | 0 |
| Plan opens | 1 (Checkout disabled while reading) | 0 |
| T/P boundary timer | 1 | 0 |
| 5 s poll after Checkout (≤ 90 s), Try again / Check again | 1 each | 0 |
| Stop the plan (cancel) | 0 (the response is the view) | 0 |
| First read after a plans catalog failure | 1 | 1 |

A change made on another device shows in an open tab only once the read is 15 minutes old, on Plan,
or at the next T or P. This is accepted: Plan's read on open, with Checkout disabled while it runs,
guards every money action.

## Target design

### Ownership

The query cache owns server state. Zustand owns only the confirmation hold, in memory, keyed by
vendor.

### Keys and policies

| Key | Policy |
|---|---|
| `['billing','plans']` | `staleTime: Infinity`; memory only, never persisted. A reload shows a price change |
| `['vendor', id, 'billing', 'subscription']` | `staleTime` 15 min; focus and mount refetch only when stale. `refetchInterval(data)`: 5 s while a payment is pending (cap 90 s); otherwise the ms until the view's next T or P, in steps of at most 2³¹−1 ms; otherwise `false` |
| `['vendor', id, 'billing', 'history']` | Plan only; `staleTime` 15 min; invalidated by `confirm` and cancel |

The workaround approximates the history query by the subscription response's content (see below).

### View

A `select` over the subscription and plans queries through `mapLiveBilling` gives one billing view
for the chrome, the rail, Settings and Plan, so they cannot disagree.

### Plan

`refetchOnMount: 'always'`, with Checkout disabled while fetching. No server guarantee against a
second subscribe is known ([billing read gaps](./API_GAPS.md#billing-read-gaps)), so Plan never
offers Checkout from a read it has not just confirmed.

### Mutations

- **Cancel:** `setQueryData` with the response, which is the subscription.
- **Confirm:** invalidate history (it refetches, as today) and mark the subscription stale with
  `invalidateQueries({ refetchType: 'none' })`; the pending `refetchInterval` rereads it.
- Both post `{ vendorId }` on a `BroadcastChannel`; receiving tabs call
  `invalidateQueries({ refetchType: 'none' })` for that vendor's billing queries, marking them stale
  so the next focus or mount refetches. An active refetch would add requests the counts above do
  not allow.

### Session

Sign-out, explicit or involuntary, and a vendor switch remove the `['vendor', id]` queries and the
hold. The plans query may stay: the catalog is public and holds no vendor data.

### Errors

- `retry` / `retryDelay` at 5, 15 and 30 s for `isBriefOutage` (502, 503 or network) only.
- Keep `data` beside the error, so a failed reread keeps the last view; a failed query counts as
  stale.
- Messages go through `getErrorMessage`.

## Temporary workaround — TEMP(vendor-billing-reads)

The shared read store, `src/modules/vendor/store/live-billing.ts`, and Plan,
`src/modules/vendor/components/LiveVendorPlan.tsx`, send the counts above without a query library.
Every change carries a `TEMP(vendor-billing-reads)` comment.

| Workaround | Target |
|---|---|
| Module-level single-flight plans promise, kept for the page load and dropped on failure | The `['billing','plans']` query |
| The read's `readAt` (set by a read or a cancel response) plus the 15 min `freshFor` focus gate | `staleTime` |
| The boundary timer at the view's next T or P | `refetchInterval` |
| Plan's 5 s poll for up to 90 s after Checkout | The pending `refetchInterval` |
| The `md-vendor-billing` `BroadcastChannel` message `{ vendorId }`, posted on a hold, a cancel and a hold's end, which marks the receiving tab's read stale | `invalidateQueries({ refetchType: 'none' })` |
| Plan's forced read on mount, with Checkout disabled while reading | `refetchOnMount: 'always'` with the same disabled Checkout |
| Plan's last good history, kept in memory per vendor against the JSON of the subscription response it followed (a read or a cancel response); reread when that content changes, after `confirm` and on Try again; never kept on failure; cleared with the read | The `['vendor', id, 'billing', 'history']` query and its invalidations |

The focus gate rereads when the read belongs to another vendor, nothing was read, the last read
failed, a confirmation hold is active, the view is a Confirming view, the last good read is 15
minutes old or more, or another tab signalled a change (even during a read in flight). The gate
does not use `isSettledView`, which treats an offered Checkout as unsettled and would make a trial
vendor reread on every focus. The channel is open only while something shows the read, as it always
does on Plan.

A plans catalog failure still fails the whole billing read, as before. The plans catalog is not
cleared on sign-out or a vendor switch; the subscription read, the hold and the kept history are.
The history key is the raw response, not the mapped view, because the view depends on the clock;
any response difference, even an irrelevant one, rereads.

### Removal

1. Implement the target design above.
2. Delete every `TEMP(vendor-billing-reads)` change and comment, this section, the marker bullet in
   [API_ARCHITECTURE.md](./API_ARCHITECTURE.md#vendor-platform-billing-live-api) (then describe the
   cache there), and the `AGENTS.md` mention.
3. `grep -rn "TEMP(vendor-billing-reads)" src docs AGENTS.md` must return nothing.

A closed [billing read gap](./API_GAPS.md#billing-read-gaps) may retire part of the target as well,
such as Plan's read on open or the 15 min staleness.
