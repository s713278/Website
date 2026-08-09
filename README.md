# MithraDirect

Single Vite + React + TypeScript app with three product surfaces: **marketing**, **storefront** (customer), and **vendor**.

Use this README as the source of truth for local setup, the tech stack, and where new code belongs.

---

## Tech stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Language | **TypeScript** 5.7 | Strict project references (`tsconfig.app.json` / `tsconfig.node.json`) |
| UI library | **React** 19 | Function components only |
| Bundler / dev server | **Vite** 6 | `@` → `src/` alias; default port **5173** |
| Routing | **React Router** 7 | Nested layouts + role-based `ProtectedRoute` |
| State | **Zustand** 5 | Auth store, cart store; keep UI state local when possible |
| Styling | **Tailwind CSS** v4 | Via `@tailwindcss/vite`; tokens in `src/styles/global.css` |
| Components | **shadcn/ui** (Radix Nova) | Primitives in `src/components/ui/*` |
| Icons | **lucide-react** | Prefer Lucide over custom SVGs |
| Class helpers | `clsx`, `tailwind-merge`, `class-variance-authority` | Use `cn()` from `@/lib/utils` |
| Backend | Spring Boot HTTP API | Toggled with `VITE_USE_API` |

### Brand / UI conventions

- Emerald primary + **Poppins** (display) + **Inter** (body) — defined in `src/styles/global.css`
- Prefer `--md-*` / shadcn CSS variables over hardcoded colors
- App-facing wrappers live in `src/shared/components` (Button, Badge, Card, EmptyState, …)
- Raw shadcn primitives live in `src/components/ui` — add more with:

```bash
npx shadcn@latest add dialog dropdown-menu sheet
```

---

## Project structure

```
Website/
├── design-reference/          # Frozen static HTML (visual reference only — not served by Vite)
├── public/                    # Static assets copied as-is into build
├── dist/                      # Production output (gitignored)
├── index.html                 # Vite HTML entry
├── package.json
├── vite.config.ts             # React + Tailwind plugins, `@` alias, port 5173
├── components.json            # shadcn config
├── .env.example               # Env template (copy to `.env`)
└── src/
    ├── main.tsx               # React bootstrap
    ├── App.tsx                # Providers + router
    ├── vite-env.d.ts          # Vite / env typings
    ├── lib/
    │   └── utils.ts           # `cn()` helper (shadcn alias target)
    ├── styles/
    │   └── global.css         # Tailwind + design tokens + brand fonts
    ├── components/
    │   └── ui/                # shadcn primitives (button, card, input, …)
    ├── app/                   # App shell (cross-cutting)
    │   ├── layouts/           # Root / marketing / vendor shells
    │   ├── providers/         # AppProviders
    │   └── router/            # Routes, ProtectedRoute, role home redirects
    ├── modules/               # Feature modules (pages + local state/data)
    │   ├── marketing/         # Landing / marketing home
    │   │   ├── components/
    │   │   └── pages/
    │   ├── storefront/        # Customer browse, cart, checkout, orders
    │   │   ├── components/
    │   │   ├── data/          # Demo catalog when API is off
    │   │   ├── pages/
    │   │   ├── store/         # Zustand (e.g. cart)
    │   │   └── types/
    │   └── vendor/            # Vendor dashboard, orders, products
    │       ├── components/
    │       ├── data/
    │       ├── pages/
    │       └── types/
    └── shared/                # Code reused across modules
        ├── api/               # Single HTTP + service access point
        │   ├── client.ts      # apiGet/Post/Put/Patch/Delete + auth header
        │   ├── config.ts      # VITE_API_BASE_URL, VITE_USE_API
        │   ├── errors.ts
        │   ├── tokens.ts
        │   ├── mode.ts
        │   ├── types.ts
        │   ├── index.ts       # Re-exports — import from `@/shared/api`
        │   └── services/      # auth, catalog, cart, orders, vendor*
        ├── auth/              # Login/register UI + auth Zustand store
        │   ├── pages/
        │   ├── store/
        │   └── api/           # Demo auth helpers
        ├── components/        # App wrappers over shadcn
        ├── hooks/
        ├── lib/
        └── types/
```

### Where to put new code

| You are adding… | Put it here |
|-----------------|-------------|
| A customer or vendor screen | `src/modules/<module>/pages/` |
| Module-only UI | `src/modules/<module>/components/` |
| Module Zustand store | `src/modules/<module>/store/` |
| Shared UI used by 2+ modules | `src/shared/components/` |
| New API / domain call | `src/shared/api/services/` then export via `@/shared/api` |
| Auth flow UI | `src/shared/auth/` |
| Route + layout wiring | `src/app/router/`, `src/app/layouts/` |
| New shadcn primitive | `npx shadcn@latest add …` → `src/components/ui/` |
| Design tokens / global CSS | `src/styles/global.css` |

### Import conventions

```ts
// Path alias — always prefer `@/` over deep relative paths
import { Button, EmptyState } from '@/shared/components'
import { catalogService, getErrorMessage } from '@/shared/api'
import { cn } from '@/lib/utils'
```

Pages should call **services** only (`@/shared/api`). Do not call `fetch` from pages. Services talk to the HTTP client or demo data depending on `VITE_USE_API`.

---

## Prerequisites

- **Node.js** 20+ (22 LTS recommended)
- **npm** 10+ (bundled with Node)

---

## Local setup

```bash
git clone <repo-url>
cd Website

npm install

# Windows
copy .env.example .env
# macOS / Linux
# cp .env.example .env
```

### Environment

| Variable | Example / default | Purpose |
|----------|-------------------|---------|
| `VITE_API_BASE_URL` | `https://…/api` | Live Spring Boot API base URL |
| `VITE_APP_ENV` | `development` | Environment label |
| `VITE_USE_API` | `false` | `false` = demo mocks; `true` = live API |

Do not commit `.env` (gitignored). `.env.example` is the shared template.

---

## Scripts

| Command | What it does |
|---------|----------------|
| `npm run dev` | Vite dev server → [http://localhost:5173](http://localhost:5173) |
| `npm run build` | `tsc -b` then Vite production build → `dist/` |
| `npm run preview` | Serve `dist/` locally (run after `build`) |
| `npm run typecheck` | TypeScript check only |

---

## Run locally

```bash
npm run dev
```

| Path | Surface |
|------|---------|
| `/` | Marketing home |
| `/stores` | Store list |
| `/stores/:storeId` | Store detail |
| `/cart` | Cart |
| `/login`, `/register` | Auth |
| `/checkout`, `/orders` | Customer (protected) |
| `/vendor` | Vendor dashboard (protected) |
| `/vendor/orders`, `/vendor/products` | Vendor tools (protected) |

---

## Build for production

```bash
npm run build
npm run preview
```

Output lands in `dist/`. Configure your host to serve that folder (SPA: fall back to `index.html` for client routes).

---

## API layer

Single import point: `@/shared/api`

| Piece | Path | Role |
|-------|------|------|
| Config | `shared/api/config.ts` | `VITE_API_BASE_URL`, `VITE_USE_API` |
| HTTP client | `shared/api/client.ts` | `apiGet/Post/Put/Patch/Delete`, auth header, 401 refresh |
| Errors | `shared/api/errors.ts` | `ApiError`, `toApiError`, `getErrorMessage` |
| Tokens | `shared/api/tokens.ts` | Access / refresh storage |
| Services | `shared/api/services/*` | auth, catalog, cart, orders, vendor |

```ts
import {
  authService,
  catalogService,
  cartService,
  ordersService,
  vendorService,
  vendorOrdersService,
  vendorProductsService,
  getErrorMessage,
} from '@/shared/api'
```

```bash
VITE_USE_API=false   # demo mocks (default)
VITE_USE_API=true    # hit Spring Boot at VITE_API_BASE_URL
```

Use `getErrorMessage()` in the UI for user-facing errors.

---

## Demo logins (`VITE_USE_API=false`)

| Role     | Email             | Password |
|----------|-------------------|----------|
| Customer | customer@demo.com | demo1234 |
| Vendor   | vendor@demo.com   | demo1234 |

Live auth uses OTP via `authService.requestOtp` / `verifyOtp`.

---

## Design reference

Frozen static HTML under `design-reference/` is for pixel/layout reference only. It is **not** served by `npm run dev`.

```bash
npx --yes serve design-reference -p 4173
# http://localhost:4173/index.html
```

Mirror look-and-feel into `src/modules/*`; do not treat the static files as product source of truth. See `design-reference/README.md`.
