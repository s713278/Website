# Additive catalog growth while a store is under review

> **Amended 2026-08-30 — sizes excluded.** Step 6 (sizes) is no longer part of the additive
> seam; a Submitted store may add categories and products only. The backend rejects
> `POST /v1/vendors/{id}/skus` with a 417 while a store is under review, so a new size cannot
> be created until the store is approved. See the [Amendment](#amendment-2026-08-30--sizes-are-not-additive-under-review)
> below; the original decision text is kept unchanged as the historical record.

## Context and decision

Until now a Submitted store was fully immutable — recent hardening (`50961e9` making "Start
over" sign out, `d7d3be1` enforcing cumulative catalog limits) existed precisely so a submitted
store could not be edited around. We are deliberately reopening one narrow seam in that wall: a
Submitted store (`selectStoreIsSubmitted`) may still **add** to its catalog on the three catalog
steps — assign or author categories (Step 4) and products (Step 5), and create new sizes (Step
6) — within its plan limits. Nothing already on the store may be changed or removed, no other
step becomes editable, and adding never re-runs go-live or moves the resume pointer off Step 10.
The store stays exactly as submitted; only its catalog grows.

We can do this cheaply because onboarding already writes the catalog **incrementally** through
the same vendor-scoped endpoints (`createCategory`/`saveCategories`,
`createProduct`/`assignProducts`, `createSku`); go-live carries no catalog payload. So "let a
submitted store keep adding" needs no new contract — it reuses the persistence that was always
there, gated to the additive steps and validated against the same cumulative plan limits.

## Considered options

- **A separate post-onboarding catalog page** (`VendorProductsPage`) instead of reusing the
  wizard steps. Rejected for now: it would duplicate the authoring/assign/limit machinery that
  already lives on Steps 4–6, for a feature framed entirely in terms of those steps. Left as a
  future home.
- **Immediate per-item persistence** on each Add click, bypassing the draft + Continue flow.
  Rejected: the wizard's draft + Continue-flush model already does create→assign with dedup and
  cumulative-limit checks; reusing it is the smaller, more consistent change. The cost is that
  additions live in the draft until Continue commits them (a reload before Continue reconciles
  back to the account), which matches existing onboarding behaviour.
- **Running the full per-step validation on submitted adds.** Rejected: it would report
  whole-store readiness problems ("every product needs a size") on a store already with an
  administrator, on entries the vendor cannot fix from here. Submitted steps validate the
  additive delta only — plan limits and the well-formedness of new sizes.

## Consequences

- The domain meaning of **Submitted** changed; `CONTEXT.md` now records the additive exception.
- Authoring a category/product while under review still creates a **platform-wide** catalog
  entry (same as onboarding), because a submitted-but-unapproved vendor is the same trust tier
  as a mid-onboarding one.
- A newly added product may sit **sizeless** (unsellable) until the vendor prices it on Step 6,
  since there is no go-live gate to force completeness post-submission.
- Backend caveat to verify: the assign/create endpoints must not flip `vendor_status` off
  `ACTIVE`, which would silently un-submit the store. If they do, record an API gap.

## Amendment (2026-08-30): sizes are not additive under review

The original decision reopened three catalog steps (4, 5 and 6). Step 6 (sizes) is now
**removed** from the additive seam: a Submitted store may add categories and products only.

- **Why.** The backend rejects `POST /v1/vendors/{id}/skus` with a **417** while a store is
  under review (PENDING) — recorded in [`docs/API_GAPS.md`](../API_GAPS.md) ("Creating a SKU
  while under review"), which owns the endpoint detail. Offering size creation on Step 6
  therefore promised a write the backend refuses. Rather than surface that failure, the
  capability is withdrawn until approval.
- **What changed.** `ADDITIVE_CATALOG_STEPS` is now `[4, 5]`. Step 6 falls back to read-only
  under review (it joins Steps 3, 7-9 behind the wizard's read-only `fieldset`), and
  `additiveCatalogIssues` validates the category/product delta only. The `additiveOnly` write
  path (`planSkuWrites` / `persistSkus` / `persistStep`) — added solely to make a submitted
  store's size write additive — is removed, since no size write reaches the account under review.
- **Consequence.** The "sizeless product" consequence below is now **permanent until approval**:
  a product added while under review cannot be given a size or price until an administrator
  approves the store, at which point Step 6 reopens. The under-review copy on Step 6 and the
  Step-10 "Add more" affordance say so, so a vendor is not left wondering why pricing is locked.
- **A separate post-onboarding catalog page** (`VendorProductsPage`) remains the eventual home
  for growing sizes on an approved store; this amendment does not build it.
