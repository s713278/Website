# MithraDirect

MithraDirect is a hyperlocal e-commerce platform connecting nearby customers with independent
vendors. Customers browse local storefronts and place orders, while vendors manage their storefront,
catalog, and order operations. Production identity uses WhatsApp phone-number OTP for customer and
vendor roles. The React 19 + TypeScript frontend consumes a separately maintained Spring Boot API
through an OpenAPI/Axios integration.

> **Current status:** demo mode is the default. Live WhatsApp OTP is wired at `/login` (customer)
> and `/vendor/login` (vendor); the email/password forms remain demo-only.
> Vendor onboarding at `/onboarding` verifies the vendor's number through the shared OTP session and
> persists business type, categories and storefront settings to the vendor account. Products, SKUs,
> delivery, payments and go-live are still saved in the browser only, each labelled with the backend
> contract gap that blocks it — see [docs/API_GAPS.md](./docs/API_GAPS.md).

## Product surfaces

| Surface | Source | Routes (examples) |
|---------|--------|-------------------|
| Marketing | `src/modules/marketing` | `/` |
| Customer storefront | `src/modules/storefront` | `/stores`, `/cart`, `/checkout`, `/orders` |
| Vendor tools | `src/modules/vendor` | `/vendor`, `/vendor/orders`, `/vendor/products` |
| Vendor onboarding | `src/modules/vendor` | `/onboarding`, `/onboarding/preview/:draftSlug` |
| Authentication | `src/shared/auth` | `/login`, `/register` |

## Stack

| Layer | Choice |
|-------|--------|
| Language | TypeScript 5, strict project references |
| UI | React 19, function components |
| Build/dev server | Vite 6 |
| Routing | React Router 7 |
| Shared state | Zustand 5 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| HTTP | Axios |
| Backend declarations | `openapi-typescript` |
| Package manager | npm |

Exact resolved versions are recorded in `package-lock.json`.

### UI conventions

- Emerald is the primary brand color.
- Poppins is the display face and Inter is the body face.
- Shared tokens and shadcn variables live in `src/styles/global.css`.
- App-facing components live in `src/shared/components`.
- Raw shadcn primitives live in `src/components/ui`.
- Prefer Lucide icons and existing components before adding custom equivalents.

## Prerequisites

- Node.js 20.19 or newer; Node 22 LTS is recommended.
- npm 10 or newer.

The repository uses `package-lock.json`. The committed `pnpm-workspace.yaml` is currently unused.

## Local setup

```bash
git clone <repo-url>
cd <repository-directory>
npm install
cp .env.example .env
npm run dev
```

On Windows Command Prompt, use `copy .env.example .env` instead of `cp`.

The development server is available at [http://localhost:5173](http://localhost:5173).

### Environment variables

| Variable | Example/default | Purpose |
|----------|-----------------|---------|
| `VITE_USE_API` | `false` | `false` uses demo behavior; `true` enables the Spring Boot API |
| `VITE_API_BASE_URL` | `https://subscriptionapp-wgf8.onrender.com/api` | API base before operation paths such as `/v1/auth/request-otp` |
| `VITE_APP_ENV` | `development` | Reserved environment label; currently typed but not consumed by application logic |

The client currently falls back to the development API base when `VITE_API_BASE_URL` is unset.
Set the value explicitly for live development. Never commit `.env`, credentials, or test tokens.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Run Vite on port 5173 |
| `npm run typecheck` | Type-check the project references |
| `npm run lint` | Run ESLint over `src` |
| `npm run build` | Type-check and create `dist/` |
| `npm run preview` | Serve an existing production build |
| `npm run fetch:openapi` | Fetch backend Swagger into `packages/api-client/openapi.json` |
| `npm run generate:api` | Generate `packages/api-client/src/schema.d.ts` |

There is no test runner. The available baseline verification for source changes is:

```bash
npm run typecheck && npm run lint
```

`npm run lint` does not cover `packages/api-client`. Type-check that package directly when it
changes:

```bash
npm --prefix packages/api-client run typecheck
```

`npm run sync:api` currently invokes `pnpm` inside the local package. Until that script is fixed,
run `fetch:openapi` and `generate:api` separately.

## Project structure

```text
.
├── AGENTS.md                  # Canonical tool-neutral repository guidance
├── design-reference/         # Frozen static visual/behavior reference
├── docs/                     # API, backend-gap, and session documentation
├── packages/
│   └── api-client/
│       ├── openapi.json      # Generated backend contract snapshot
│       ├── scripts/          # OpenAPI fetch script
│       └── src/
│           ├── schema.d.ts   # Generated OpenAPI declarations
│           ├── client/       # Axios, config, errors, tokens, refresh
│           └── services/     # Handwritten backend-domain wrappers
├── public/                   # Static Vite assets
└── src/
    ├── app/                  # Providers, layouts, router
    ├── components/ui/        # shadcn primitives
    ├── modules/
    │   ├── marketing/
    │   ├── storefront/
    │   └── vendor/
    ├── shared/
    │   ├── api/              # Application-facing API facade and services
    │   ├── auth/             # Auth UI and Zustand session store
    │   ├── components/
    │   ├── hooks/
    │   ├── lib/
    │   └── types/
    └── styles/global.css
```

### Code placement

| Adding | Location |
|--------|----------|
| Customer/vendor page | `src/modules/<module>/pages/` |
| Module-only UI | `src/modules/<module>/components/` |
| Module Zustand state | `src/modules/<module>/store/` |
| Shared application UI | `src/shared/components/` |
| Auth UI or app session state | `src/shared/auth/` |
| Backend-domain wrapper | `packages/api-client/src/services/` |
| Demo/live behavior or view-model shaping | `src/shared/api/services/` |
| Wire-to-view-model mapper | `src/shared/api/mappers/` |
| Transport/interceptor behavior | `packages/api-client/src/client/` |
| Route/layout/provider wiring | `src/app/` |
| Design tokens/global CSS | `src/styles/global.css` |

Prefer the `@/` alias over deep relative imports:

```ts
import { catalogService, getErrorMessage } from '@/shared/api'
import { Button, EmptyState } from '@/shared/components'
import { cn } from '@/lib/utils'
```

Pages and components should use services exported by `@/shared/api`; they should not call Axios or
`fetch` directly.

## API architecture

The application currently has two API-related service sets:

1. **`packages/api-client` (`@mithra/api-client`)** owns the Axios transport, client configuration,
   token/refresh infrastructure, normalized errors, generated OpenAPI declarations, and handwritten
   backend-domain wrappers. Vite and TypeScript resolve this package directly from source; it has no
   package build step.
2. **`src/shared/api`** is the application facade imported by pages. Its services choose demo/live
   behavior and map backend payloads into application view models.

Most established app services use raw package transport primitives through thin re-export shims;
they do not consume the package's parallel domain-service wrappers. Vendor onboarding is a bounded
exception: its app-facing reference service consumes the package catalog wrapper and validates the
generic live envelopes in dedicated mappers. The generated schema is exported, but service wrappers
are not consistently built from generated operation types across the repository. This is the
implemented architecture—not yet a fully stacked generated-type pipeline.

Read [docs/API_ARCHITECTURE.md](./docs/API_ARCHITECTURE.md) before integrating or changing an endpoint.
Architecture improvements should be proposed and migrated explicitly rather than described as though
they are already implemented.

## Backend contract and regeneration

The backend is maintained separately. Its development OpenAPI document is:

```text
https://subscriptionapp-wgf8.onrender.com/api/v3/api-docs
```

It is the authoritative frontend contract. Operations are served below `/api/v1/*`; configure
`VITE_API_BASE_URL` as the base ending in `/api`, because service calls already include `/v1`.

When the contract changes:

```bash
npm run fetch:openapi
npm run generate:api
```

`packages/api-client/openapi.json` and `packages/api-client/src/schema.d.ts` are generated artifacts.
Never edit either manually. Review their regenerated changes together.

If a required capability or usable response schema is absent from OpenAPI, document the backend gap
and request the contract change. Do not invent an endpoint or undocumented payload.

## Authentication status

The backend's live contract currently uses WhatsApp-phone OTP and JWT bearer authentication:

- `POST /v1/auth/request-otp`
- `POST /v1/auth/verify-otp`
- `POST /v1/auth/refresh`
- `POST /v1/auth/signout`

The current frontend transport stores the returned access and refresh tokens in `localStorage`,
attaches the access token as a Bearer header, and attempts one single-flight refresh after a 401. That
describes current behavior. A backend-coordinated target using an in-memory access token and a rotating
Secure HttpOnly refresh cookie is approved but not implemented yet.

Live OTP is wired at `/login` and `/vendor/login`. The email/password forms are demo-only and
intentionally fail when live API mode is enabled.

A session is created only when the backend reports `mobile_verified: true` and lists the requested
role in `roles`; the role picked on the login screen is never treated as a grant. Multi-role
identities and multi-vendor memberships are represented on the session, and a vendor with several
stores must choose one explicitly.

Demo credentials when `VITE_USE_API=false`:

| Role | Email | Password |
|------|-------|----------|
| Customer | `customer@demo.com` | `demo1234` |
| Vendor | `vendor@demo.com` | `demo1234` |

See [docs/SESSION.md](./docs/SESSION.md) for the currently implemented lifecycle. It should be updated
alongside the production auth implementation.

## Routes

| Path | Surface |
|------|---------|
| `/` | Marketing home |
| `/stores` | Store list |
| `/stores/:storeId` | Store detail |
| `/cart` | Cart |
| `/login`, `/register` | Customer authentication |
| `/vendor/login` | Vendor WhatsApp OTP login |
| `/onboarding` | Ten-step vendor onboarding; Steps 1-2 verify the vendor by WhatsApp OTP |
| `/onboarding/preview/:draftSlug` | Same-browser, non-public storefront preview restored from the safe local draft |
| `/checkout`, `/orders` | Protected customer flows |
| `/vendor` | Protected vendor dashboard |
| `/vendor/orders`, `/vendor/products` | Protected vendor tools |

## Documentation

| Document | Purpose |
|----------|---------|
| [AGENTS.md](./AGENTS.md) | Canonical repository guidance for coding agents |
| [docs/API_ARCHITECTURE.md](./docs/API_ARCHITECTURE.md) | Implemented API architecture and endpoint workflow |
| [docs/API_GAPS.md](./docs/API_GAPS.md) | Confirmed frontend/backend contract gaps |
| [docs/SESSION.md](./docs/SESSION.md) | Current auth/session lifecycle |
| [docs/VENDOR_ONBOARDING_SPEC.md](./docs/VENDOR_ONBOARDING_SPEC.md) | Vendor-onboarding requirements, prototype state, and production gates |
| [packages/api-client/README.md](./packages/api-client/README.md) | Local API-package workflow |
| [design-reference/README.md](./design-reference/README.md) | Static reference purpose and inventory |

## Design reference

`design-reference/` is static HTML retained for layout and interaction reference. It is not served by
Vite and is not product source.

```bash
npx --yes serve design-reference -p 4173
```

Study the reference, then implement product changes under `src/` and `src/styles/`.
