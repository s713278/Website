# AGENTS.md — MithraDirect

Canonical, tool-neutral guidance for coding agents working in this repository.

Source code and the current backend OpenAPI document take precedence when documentation disagrees
with implementation. Human setup and project orientation live in [README.md](./README.md). Detailed
API behavior lives in [docs/API_ARCHITECTURE.md](./docs/API_ARCHITECTURE.md).

## Product in brief

MithraDirect is a hyperlocal e-commerce platform for nearby customers and independent vendors.
Customers browse storefronts and place orders; vendors manage their storefront, catalog, and order
operations. Production identity uses WhatsApp phone-number OTP. The React/TypeScript web application
consumes a separately maintained Spring Boot API through the repository's OpenAPI/Axios layers.

## Before changing anything

- Inspect the repository root, branch, remotes, and complete staged/unstaged/untracked state.
- Preserve existing work. Do not discard, overwrite, commit, push, stash, switch branches, or open a
  pull request unless the user explicitly requests that action.
- `integration` is the shared integration branch and normal pull-request target. Feature work belongs
  on a separate task branch.
- Keep changes limited to the requested task; do not mix in opportunistic refactors.
- Never commit secrets, `.env`, credentials, test tokens, or private local tooling configuration.
- Personal tooling belongs in user-level or locally excluded locations. Do not reference it from
  tracked project documentation.

## Documentation ownership

| File | Owns |
|------|------|
| [README.md](./README.md) | Human setup, stack, commands, environment, routes, and project map |
| [CONTEXT.md](./CONTEXT.md) | Product domain glossary and distinctions between platform, vendor, draft, and storefront concepts |
| [docs/API_ARCHITECTURE.md](./docs/API_ARCHITECTURE.md) | Implemented API layers, endpoint workflow, transport behavior, and mapping |
| [docs/API_GAPS.md](./docs/API_GAPS.md) | Confirmed frontend/backend contract gaps and approved temporary behavior |
| [docs/SESSION.md](./docs/SESSION.md) | Implemented authentication, token, refresh, logout, and route-session lifecycle |
| [packages/api-client/README.md](./packages/api-client/README.md) | Local API package commands, exports, and package-specific usage |
| [design-reference/README.md](./design-reference/README.md) | Static-reference purpose and inventory |

Each detailed fact should have one owning document. Elsewhere, summarize it briefly and link to the
owner instead of copying the full explanation.

## Repository map

This repository contains one Vite + React 19 + TypeScript application and one source-resolved local
package.

| Surface | Location | Routes (examples) |
|---------|----------|-------------------|
| Marketing | `src/modules/marketing` | `/` |
| Storefront | `src/modules/storefront` | `/stores`, `/cart`, `/checkout`, `/orders` |
| Vendor | `src/modules/vendor` | `/vendor`, `/vendor/orders`, `/vendor/products` |
| Shared app code | `src/shared` | auth, API facade, components, hooks, utilities, types |
| HTTP/OpenAPI package | `packages/api-client` | generated schema, Axios transport, auth infrastructure, backend services |

`design-reference/` is frozen static HTML used for visual reference. It is not Vite product source.
There is no `apps/web` package and no `src/features/*` layout in this repository.

## Commands

The package manager is npm (`package-lock.json` is authoritative). The committed
`pnpm-workspace.yaml` is currently unused.

```bash
npm install
cp .env.example .env
npm run dev
npm run typecheck
npm run lint
npm run test
npm run build
npm run preview
```

For code changes, the baseline is:

```bash
npm run typecheck && npm run lint && npm run test
```

Vitest runs in the node environment over `src/**/*.test.ts` and covers the pure onboarding logic
only — resume, validation, entry routing, and payload mapping. There is no DOM, component, or
end-to-end runner: verify UI behaviour by running the app. `vitest.config.ts` merges `vite.config.ts`,
so path aliases are defined once.

`npm run lint` covers `src`, not `packages/api-client`. The package has its own typecheck:

```bash
npm --prefix packages/api-client run typecheck
```

## Backend contract and OpenAPI workflow

The Spring Boot backend is maintained separately. Its `/api/v3/api-docs` document is the frontend's
authoritative HTTP contract. The development server base configured in the client is
`https://subscriptionapp-wgf8.onrender.com/api`; service paths begin with `/v1`, producing requests
under `https://subscriptionapp-wgf8.onrender.com/api/v1/*`.

- Do not invent endpoints, request fields, response shapes, or undocumented status transitions.
- If the contract is missing, inconsistent, or unsuitable, record a backend gap and describe the
  required contract change. Do not hide it behind a silent frontend workaround.
- Generic OpenAPI response objects do not provide generated end-to-end safety. Verify real response
  shapes with safe test data before treating an integration as production-ready.
- Never put live tokens or personal test data in source, documentation, fixtures, logs, or examples.

Regeneration is a two-step workflow:

```bash
npm run fetch:openapi
npm run generate:api
```

The first command fetches Swagger into `packages/api-client/openapi.json`; the second generates
`packages/api-client/src/schema.d.ts` with `openapi-typescript`. Both files are generated: never edit
them manually. Review and commit their regenerated diff together when the backend contract changes.
`npm run sync:api` currently delegates to `pnpm` internally, so use the two npm commands above until
that script is corrected.

## Current API architecture

Read [docs/API_ARCHITECTURE.md](./docs/API_ARCHITECTURE.md) before changing API code. The implemented
relationship is:

1. `packages/api-client` owns Axios, client configuration, token storage and refresh, normalized
   errors, generated OpenAPI declarations, and handwritten domain service wrappers. The generated
   `schema.d.ts` is exported, but the existing domain wrappers are not consistently derived from its
   operation types.
2. `src/shared/api` is the React application's facade. Its services select demo/live behavior and
   shape backend payloads into application view models.
3. Current app-facing services call the package's raw `apiGet`/`apiPost`/other transport primitives
   through thin re-export shims. They do not currently consume the package's parallel domain-service
   wrappers.

Therefore, the repository has two service sets, but they are not yet a fully stacked typed pipeline.
Do not casually bypass or redesign this boundary during an unrelated feature. Any migration should
first document current caveats, the target design, ownership, and an incremental transition plan.

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

## Authentication: current state and guardrails

The backend contract exposes WhatsApp-phone OTP endpoints under `/v1/auth`, then returns an access
token and refresh token after verification. The OpenAPI security scheme is HTTP Bearer. The current
frontend stores both tokens in `localStorage` and attaches the access token as an `Authorization`
header; this is implemented behavior, not a final browser-security recommendation.

The current React login/register pages still use demo email/password actions. Those actions throw in
live mode; OTP services exist but the production OTP UI is not wired yet. Do not claim otherwise.

Backend identities may hold multiple roles, while the current app `User` model and route guard assume
one active role. Do not infer authorization solely from the role requested during OTP. The production
auth task must define how verified roles and the active audience are mapped into frontend session and
route authorization.

Until that task replaces the lifecycle:

- Route token/user changes through `applySession()` and `clearSession()` in `auth-store.ts`.
- Keep `onUnauthorized` wired to local session clearing, not server sign-out.
- Preserve single-flight refresh and one retry after a 401.
- Verify sign-out against the OpenAPI contract: it requires the refresh-token request body, which the
  current frontend does not send.

See [docs/SESSION.md](./docs/SESSION.md) for the currently implemented lifecycle. Update that document
with the implementation, not in advance of it.

## Current behavior to preserve deliberately

- Demo mode is the `.env.example` default. Preserve an existing demo path unless the task explicitly
  changes demo support; do not let a live-only branch fail as an unexplained blank screen.
- `assertApiSuccess` can reject an HTTP 200 envelope whose `success` field is false.
- `isLiveApi()` configuration is currently one-way: an environment-enabled API cannot be disabled by
  passing `useApi: false` later.
- The Zustand cart (`md-cart`) is local-only and single-store. Existing cart service files are not
  wired into its runtime flow.
- `openapi-fetch` is declared by the API package but currently unused.

## UI and design reference

The product uses emerald brand colors, Poppins for display text, Inter for body text, Tailwind v4,
and shadcn variables defined in `src/styles/global.css`. Prefer established variables and shared UI.
For small-vendor workflows, keep one primary job per screen and make the next action obvious.

Use `design-reference/` only to study layout and behavior, then implement the result in React and
`src/styles`. Do not move product work back into static HTML. Read
[design-reference/README.md](./design-reference/README.md) before editing the reference itself.
