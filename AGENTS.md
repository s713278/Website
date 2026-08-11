# AGENTS.md — MithraDirect

Guidance for coding agents (Cursor, Claude, Codex, etc.) working in this repo.
Prefer this file over older docs that mention `apps/web`, `src/features/*`, axios, or root `assets/` HTML.

Human setup detail lives in [README.md](./README.md). Keep both in sync when architecture changes.

---

## What this repo is

Single **Vite + React 19 + TypeScript** app (`mithradirect`) with three surfaces:

| Surface | Module | Routes (examples) |
|---------|--------|-------------------|
| Marketing | `src/modules/marketing` | `/` |
| Storefront (customer) | `src/modules/storefront` | `/stores`, `/cart`, `/checkout`, `/orders` |
| Vendor | `src/modules/vendor` | `/vendor`, `/vendor/orders`, `/vendor/products` |

Auth UI lives in `src/shared/auth`. HTTP + domain services live in `src/shared/api`.

**Not product source:** `design-reference/` is frozen static HTML for visual reference only (not served by Vite).

There is **no** `apps/web` package and **no** axios client on this branch.

---

## Commands

```bash
npm install
cp .env.example .env   # never commit .env
npm run dev            # http://localhost:5173
npm run typecheck      # tsc -b
npm run lint           # eslint src (react-hooks deps enforced)
npm run build
```

| Env | Purpose |
|-----|---------|
| `VITE_USE_API=false` | Demo mocks (default) |
| `VITE_USE_API=true` | Live Spring Boot at `VITE_API_BASE_URL` |

---

## Where to put code

| Adding… | Put it here |
|---------|-------------|
| Screen / page | `src/modules/<module>/pages/` |
| Module-only UI | `src/modules/<module>/components/` |
| Module Zustand store | `src/modules/<module>/store/` |
| Shared UI (2+ modules) | `src/shared/components/` |
| API / domain call | `src/shared/api/services/` → export from `@/shared/api` |
| API → domain mapping | Prefer `src/shared/api/mappers/` when shared across services |
| Auth UI / store | `src/shared/auth/` |
| Routes / layouts | `src/app/router/`, `src/app/layouts/` |
| shadcn primitive | `npx shadcn@latest add …` → `src/components/ui/` |
| Design tokens | `src/styles/global.css` |

```ts
import { Button, EmptyState } from '@/shared/components'
import { catalogService, getErrorMessage } from '@/shared/api'
import { cn } from '@/lib/utils'
```

Prefer `@/` imports over deep relatives.

---

## Architecture rules

1. **Pages call services only** (`@/shared/api`). Do not `fetch` from pages/components.
2. **HTTP lives in** `src/shared/api/client.ts` (native `fetch` wrapper: auth header, JSON, non-2xx → `ApiError`, 401 refresh). Do not introduce axios unless explicitly requested.
3. **Demo vs live:** services branch on `isLiveApi()` from `@/shared/api` (not a React hook).
4. **State:** Zustand for auth/cart; keep ephemeral UI state in the component.
5. **UI:** App wrappers in `src/shared/components`; raw shadcn in `src/components/ui`. Don’t invent a parallel design system.
6. **Brand:** emerald + Poppins (display) + Inter (body) via `src/styles/global.css`. Prefer `--md-*` / shadcn CSS vars. No purple-glow / cream-serif AI defaults.
7. **Small-vendor UX:** one job per screen, clear primary CTA, collapse secondary detail.
8. **design-reference/** may be read for look-and-feel; do not treat it as runtime source. Mirror into React/`src/styles`.
9. **Secrets:** never commit `.env` or credentials.
10. **Scope:** only change files needed for the task; don’t drive-by refactor.

---

## React / hooks

- Function components only.
- Data-fetch `useEffect`s must list real deps (`storeId`, `vendorId`, `query`, …) and cancel in-flight work.
- Run `npm run lint` — `react-hooks/exhaustive-deps` and `rules-of-hooks` are errors.
- Don’t rename non-hooks to `use*` (e.g. use `isLiveApi`, not `useLiveApi`).

---

## design-reference (static)

Serve locally if needed:

```bash
npx --yes serve design-reference -p 4173
```

Static conventions (only when editing that folder):

- Tokens historically in `design-reference/assets/css/global.css`
- Page JS depends on `MithraDraft` / `StoreAPI` load order
- Do not move product work back into static HTML

Cursor rules under `.cursor/rules/` cover scoped editing for `src/**` and `design-reference/**`.
