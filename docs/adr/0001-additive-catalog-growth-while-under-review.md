# Additive catalog growth while a store is under review

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
