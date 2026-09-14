# AGENTS.md — MithraDirect

Canonical, tool-neutral guidance for coding agents working in this repository.

The user's request defines the task; apply this guidance within the environment's instruction and
permission rules. Reference documents provide context, not authorization for unrelated actions.

Source code establishes implemented behavior; the current backend OpenAPI document owns the HTTP
contract. When either disagrees with documentation or an accepted domain decision, identify the
discrepancy before changing the affected behavior. Keep current behavior distinct from intended behavior.

## Product in brief

MithraDirect is a hyperlocal e-commerce platform for nearby customers and independent vendors.
Customers browse storefronts and place orders; vendors manage their storefront, catalog, and order
operations. Production identity uses WhatsApp phone-number OTP. One Vite + React 19 + TypeScript app
consumes a separately maintained Spring Boot API through the source-resolved `packages/api-client`.

## Before changing anything

- Inspect the repository root, branch, remotes, and complete staged/unstaged/untracked state.
- Preserve existing work. Do not discard, overwrite, commit, push, stash, switch branches, or open a
  pull request unless the user explicitly requests that action.
- `integration` is the shared integration branch and normal pull-request target. Feature work belongs
  on a separate task branch.
- Never commit secrets, `.env`, credentials, test tokens, or private local tooling configuration.
- Personal tooling belongs in user-level or locally excluded locations. Do not reference it from
  tracked project documentation.

## Working method

Scale the process to the task. A small, unambiguous edit needs a direct change and a focused check;
multi-step work needs a brief plan pairing each step with its verification.

### 1. Think before changing

Read the relevant implementation, tests, and owning documents; define the outcome and evidence of
success. State assumptions that affect behavior and surface simpler alternatives or conflicts.
Resolve routine choices from conventions; ask when uncertainty materially changes scope, correctness,
or an irreversible action. Pause only dependent work and continue what is clear and authorized.

### 2. Keep the solution simple

Implement the smallest complete solution using existing seams and conventions. Add abstractions,
dependencies, or configuration only when the requested behavior needs them. Handle actual failure
modes at their owning boundary; preserve validation, error reporting, and demo behavior.

### 3. Make surgical changes

Every changed line should support the request. Match nearby style; keep unrelated formatting,
refactors, and cleanup out of the diff. Remove imports, variables, and helpers made unused by this
change; report relevant pre-existing problems separately. Update affected documentation in its owner.
A factual correction is not a new product decision; surface unresolved policy changes to the user.

### 4. Work toward verifiable completion

Reproduce bugs before fixing them; add regression tests that protect meaningful behavior. Check
features against requested behavior and failure cases, and refactors against preserved behavior.
Run the checks under **Verification**, review the final diff, and fix failures caused by the change
without weakening checks. Report what changed, actual check results, and unresolved limitations,
including unrelated failures or unavailable checks. Static checks alone do not verify a live journey.

When handing work to another environment or resuming it, carry forward the outcome, decisions,
changed files, verification results, and blockers. Recheck the working tree before continuing.

## Documentation ownership and reading triggers

Read the relevant owner before changing its area; load additional documents as the task needs them.

| Before working on | Owning document |
|-------------------|-----------------|
| Setup, stack, commands, environment, routes, or project layout | [README.md](./README.md) |
| Domain behavior, naming, or user-facing language | [CONTEXT.md](./CONTEXT.md) — glossary only; keep implementation and plans elsewhere |
| An architectural or domain decision | Relevant [docs/adr/](./docs/adr/) entries — decisions, trade-offs, and removal conditions |
| API calls, transport, mapping, or demo/live behavior | [docs/API_ARCHITECTURE.md](./docs/API_ARCHITECTURE.md) |
| A missing contract capability or temporary exception | [docs/API_GAPS.md](./docs/API_GAPS.md) |
| Authentication, roles, route gates, or session-owned state | [docs/SESSION.md](./docs/SESSION.md) — current lifecycle and separately marked target model |
| Adding or changing tests | [docs/TESTING.md](./docs/TESTING.md) — tiers, writing rules, and runner limits |
| API package commands or exports | [packages/api-client/README.md](./packages/api-client/README.md) |
| Editing the static design reference | [design-reference/README.md](./design-reference/README.md) |

Keep each detailed fact in one owner; summarize and link elsewhere. Keep always-loaded guidance
focused on recurring decisions and guardrails, with detailed procedures behind reading triggers.
When a rule fails in practice, clarify or replace it instead of appending a competing instruction.

## Verification

The package manager is npm (`package-lock.json` is authoritative). The committed
`pnpm-workspace.yaml` is currently unused.

For code changes, the baseline is:

```bash
npm run typecheck && npm run lint && npm run test
```

`npm run lint` covers `src`, not `packages/api-client`. When the package changes, also run:

```bash
npm --prefix packages/api-client run typecheck
```

Use focused checks while iterating, then run the baseline on the final code change. Build when
bundling or production behavior is affected; exercise the affected UI flow when static checks cannot
establish the result. One `npm run test` runs all Vitest tiers; there is no end-to-end runner.
Automated tests must isolate the network through the seams in [docs/TESTING.md](./docs/TESTING.md).

For documentation-only changes, check links, commands and claims against their sources, and run
`git diff --check`; application tests are unnecessary unless executable behavior also changed.
Setup and the complete command list live in [README.md](./README.md#commands).

## Backend contract and OpenAPI workflow

The Spring Boot backend is maintained separately. Its `/api/v3/api-docs` document is the frontend's
authoritative HTTP contract. Configure the base ending in `/api`; service paths already begin with
`/v1`. [README.md](./README.md#backend-contract-and-regeneration) records the development URL.

- Do not invent endpoints, request fields, response shapes, or undocumented status transitions.
- If the contract is missing, inconsistent, or unsuitable, record a backend gap and describe the
  required contract change in `docs/API_GAPS.md`. Preserve approved temporary behavior within its
  documented scope and removal condition; do not introduce a silent frontend workaround.
- Generic OpenAPI response objects do not provide generated end-to-end safety. Verify real response
  shapes with safe test data before treating an integration as production-ready.
- Never put live tokens or personal test data in source, documentation, fixtures, logs, or examples.

Regenerate with `npm run fetch:openapi`, then `npm run generate:api`. These produce
`packages/api-client/openapi.json` and `packages/api-client/src/schema.d.ts` respectively; never edit
either manually. Review the pair together and include both if a commit is explicitly requested.
`npm run sync:api` still delegates to `pnpm` internally, so use the two npm commands separately.

## Current API architecture

`packages/api-client` owns transport, tokens/refresh, normalized errors, generated declarations, and
backend wrappers. `src/shared/api` owns demo/live behavior and application view models. App services
mix raw transport shims with package wrappers; catalog and vendor onboarding use wrappers and
mappers. This is not yet a fully generated-type pipeline; trace the actual caller before editing.

Preserve this boundary during unrelated work. A migration must first document current caveats,
the target design, ownership, and an incremental transition plan in the architecture owner.

### API placement rules

| Change | Location |
|--------|----------|
| Axios/interceptors/config/refresh/errors | `packages/api-client/src/client/` |
| Generated backend declarations | regenerate `packages/api-client/src/schema.d.ts` |
| Backend-domain wrapper | `packages/api-client/src/services/` |
| Demo/live behavior or view-model shaping | `src/shared/api/services/` |
| Reusable wire-to-view-model mapping | `src/shared/api/mappers/` |
| App-facing export | `src/shared/api/index.ts` |

Pages and components import API behavior from `@/shared/api`. They must not call Axios/fetch directly
or import `@mithra/api-client` directly.

## Application architecture

Product modules are `src/modules/{marketing,storefront,vendor}`; shared app code is in `src/shared`.
There is no `apps/web` package or `src/features/*` layout.

| Adding | Location |
|--------|----------|
| Page | `src/modules/<module>/pages/` |
| Module-only component | `src/modules/<module>/components/` |
| Module Zustand store | `src/modules/<module>/store/` |
| Shared UI used by multiple modules | `src/shared/components/` |
| Auth UI or app session store | `src/shared/auth/` |
| Routes/layouts/providers | `src/app/` |
| shadcn primitive | `src/components/ui/` |
| Design tokens/global styling | `src/styles/global.css` |

- Prefer `@/` aliases to deep relative imports.
- Use function components. Keep ephemeral UI state local; use Zustand for established shared auth and
  cart state.
- Data-fetch effects must include their real dependencies, cancel/ignore stale work during cleanup,
  and present errors through `getErrorMessage`.
- Normalize reusable wire-format differences in mappers, not inline in pages.
- Use existing shared wrappers and shadcn primitives rather than creating a parallel component system.
- Keep vendor theming scoped to a component element and clear it during effect cleanup.

## Authentication guardrails

WhatsApp OTP is wired at `/login` and `/vendor/login`, including a demo path. The current transport
uses Bearer access tokens and keeps both tokens in `localStorage`; the approved cookie-based target
has not shipped. [docs/SESSION.md](./docs/SESSION.md) owns lifecycle details and limitations.

- Route token/user changes through `applySession()` and `clearSession()` in `auth-store.ts`.
- Build sessions from verified backend roles and phone verification. `role` is the active audience;
  `roles` governs route access. Multiple vendor memberships require an explicit store choice.
- Keep `onUnauthorized` wired to local session clearing, not server sign-out.
- Preserve single-flight refresh and one retry after a 401.
- Preserve the app-facing sign-out request's refresh-token body and local clearing on failure;
  the package's parallel `signOut` wrapper is not equivalent.
- Preserve ownership checks for session-bound drafts and the distinction between explicit sign-out
  and involuntary session loss.

Update the session document with the implementation, not in advance of it.

## Current behavior to preserve deliberately

- Demo mode is the `.env.example` default. Preserve an existing demo path unless the task explicitly
  changes demo support; do not let a live-only branch fail as an unexplained blank screen.
- `assertApiSuccess` can reject an HTTP 200 envelope whose `success` field is false.
- `isLiveApi()` configuration is currently one-way: an environment-enabled API cannot be disabled by
  passing `useApi: false` later.
- The Zustand cart (`md-cart`) persists vendor-scoped lines and summaries. Preserve its live API
  orchestration and local demo path; [cart behavior](./docs/API_ARCHITECTURE.md#storefront-cart) owns the details.
- `openapi-fetch` is declared by the API package but currently unused.

## UI and design reference

The product uses emerald brand colors, Poppins for display text, Inter for body text, Tailwind v4,
and shadcn variables defined in `src/styles/global.css`. Prefer established variables and shared UI.
For small-vendor workflows, keep one primary job per screen and make the next action obvious.

Use `design-reference/` only to study layout and behavior, then implement the result in React and
`src/styles`. Do not move product work back into static HTML. Read
[design-reference/README.md](./design-reference/README.md) before editing the reference itself.
