# MithraDirect

Single Vite + React + TypeScript app with three modules: **marketing**, **storefront**, **vendor**.

## Stack

- Vite
- React 19
- TypeScript
- React Router
- Zustand
- Tailwind CSS v4

## Prerequisites

- **Node.js** 20+ (22 LTS recommended)
- **npm** 10+ (comes with Node)

## Local setup

```bash
# clone and enter the repo
git clone <repo-url>
cd Website

# install dependencies
npm install

# create env from the example (optional — defaults work for demo mode)
copy .env.example .env   # Windows
# cp .env.example .env   # macOS / Linux
```

### Environment

Copy `.env.example` to `.env` and adjust as needed:

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_API_BASE_URL` | Spring Boot API URL | Base URL for live HTTP calls |
| `VITE_APP_ENV` | `development` | App environment label |
| `VITE_USE_API` | `false` | `false` = demo mocks; `true` = live API |

Do not commit `.env` (it is gitignored).

## Scripts

| Command | What it does |
|---------|----------------|
| `npm run dev` | Start Vite dev server at [http://localhost:5173](http://localhost:5173) |
| `npm run build` | Typecheck (`tsc -b`) then production build into `dist/` |
| `npm run preview` | Serve the `dist/` build locally (after `build`) |
| `npm run typecheck` | TypeScript check only |

## Run locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

Useful routes:

| Path | Surface |
|------|---------|
| `/` | Marketing home |
| `/stores` | Store list |
| `/stores/:storeId` | Store detail |
| `/cart` | Cart |
| `/login`, `/register` | Auth |
| `/checkout`, `/orders` | Customer (protected) |
| `/vendor` | Vendor dashboard (protected) |

## Build for production

```bash
npm run build
```

Output is written to `dist/`. Preview the production bundle:

```bash
npm run preview
```

## UI

- **Tailwind CSS v4** + **shadcn/ui** (Radix Nova)
- Primitives: `src/components/ui/*`
- App wrappers (Button/Badge/Card/Input/EmptyState…): `src/shared/components`
- Tokens / theme: `src/styles/global.css` (emerald primary + Poppins/Inter)

Add more shadcn components:

```bash
npx shadcn@latest add dialog dropdown-menu sheet
```

## Structure

```
design-reference/           # frozen static HTML + assets (visual reference only)
src/
  app/                      # layouts, providers, router
  modules/
    marketing/              # landing pages
    storefront/             # browse, cart, checkout, orders
    vendor/                 # pages, demo data/types
  shared/
    api/                    # HTTP client + ALL services (common access point)
      client.ts
      errors.ts
      services/             # auth, catalog, cart, orders, vendor*
    auth/                   # login/register UI + auth store
    components/             # shadcn wrappers
  components/ui/            # shadcn primitives
  styles/
```

For pixel/layout reference while building React screens, open pages under `design-reference/` (see that folder’s README). They are not served by `npm run dev`.

```bash
npx --yes serve design-reference -p 4173
# http://localhost:4173/index.html
```

## API layer

Single import point: `@/shared/api`

| Piece | Path | Role |
|-------|------|------|
| Config | `shared/api/config.ts` | `VITE_API_BASE_URL`, `VITE_USE_API` |
| HTTP client | `shared/api/client.ts` | `apiGet/Post/Put/Patch/Delete`, auth header, 401 refresh |
| Errors | `shared/api/errors.ts` | `ApiError`, `toApiError`, `getErrorMessage` |
| Tokens | `shared/api/tokens.ts` | access/refresh storage |
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

Toggle live API in `.env`:

```bash
VITE_USE_API=false   # demo mocks (default)
VITE_USE_API=true    # hit Spring Boot at VITE_API_BASE_URL
```

Pages call **services** only; services call the API client (or demo data). UI uses `getErrorMessage()` for display.

## Demo logins (`VITE_USE_API=false`)

| Role     | Email             | Password |
|----------|-------------------|----------|
| Customer | customer@demo.com | demo1234 |
| Vendor   | vendor@demo.com   | demo1234 |

Live auth uses OTP via `authService.requestOtp` / `verifyOtp`.
