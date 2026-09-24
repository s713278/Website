# MithraDirect

MithraDirect is a hyperlocal e-commerce platform connecting nearby customers with independent
vendors. Customers browse local storefronts and place orders, while vendors manage their storefront,
catalog, and order operations. Production identity uses WhatsApp phone-number OTP for customer and
vendor roles. The React 19 + TypeScript frontend consumes a separately maintained Spring Boot API
through an OpenAPI/Axios integration.

> **Current status:** demo mode is the default. Live WhatsApp OTP is wired at `/login` (customer)
> and `/vendor/login` (vendor), with a fixed-code demo flow on those same screens.
> Vendor onboarding at `/onboarding` verifies the vendor's number through the shared OTP session and
> persists account-catalog setup steps in Live API mode. Demo mode uses the explicitly selected sample
> catalog, keeps setup in the browser, and saves a private preview at Step 10. Live API Step 10 submits
> the store for review; the public storefront and sharing unlock only once approved. Remaining
> backend gaps are tracked in [docs/API_GAPS.md](./docs/API_GAPS.md).

## Product surfaces

| Surface | Source | Routes (examples) |
|---------|--------|-------------------|
| Marketing | `src/modules/marketing` | `/` |
| Customer storefront | `src/modules/storefront` | `/stores`, `/cart`, `/checkout`, `/orders` |
| Vendor tools | `src/modules/vendor` | `/vendor`, `/vendor/plan`, `/vendor/orders`, `/vendor/products`, `/vendor/storefront`, `/vendor/settings` |
| Vendor onboarding | `src/modules/vendor` | `/onboarding`, `/onboarding/preview/:draftSlug` |
| Authentication | `src/shared/auth` | `/login`, `/vendor/login`, `/register` (redirect) |
| Development billing preview | `src/modules/vendor` | `/dev/vendor-billing` (development only) |

The [vendor billing preview](./docs/VENDOR_BILLING_PREVIEW.md) opens Razorpay Test Mode subscription
Checkout independently of the missing billing backend. Its trial/access scenarios are fixtures;
it does not add production billing or access restrictions. Those scenarios predate the
[approved hybrid trial](./docs/VENDOR_BILLING_DECISIONS.md); the preview record identifies the
remaining implementation differences.

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
| `VITE_PUBLIC_SITE_URL` | `https://mithradirect.com` | Origin customers open. Vendor shop links, the shareable QR, and the WhatsApp share are built from it |
| `VITE_RAZORPAY_TEST_KEY_ID` | unset | Optional public `rzp_test_…` key for the development billing preview; never a secret |
| `VITE_RAZORPAY_TEST_SUBSCRIPTION_ID` | unset | Optional immediate-start Test subscription ID for that preview |
| `VITE_RAZORPAY_TEST_FUTURE_SUBSCRIPTION_ID` | unset | Optional separate future-start Test subscription ID for the legacy AutoPay setup fixture |

For the local Plan Test showcase, run `npm run dev:billing-helper` in a separate terminal with
`RAZORPAY_TEST_KEY_ID`, `RAZORPAY_TEST_KEY_SECRET` and `RAZORPAY_TEST_PLAN_ID` (the supplied
monthly Test plan) set in that terminal's environment. Only `rzp_test_` keys are accepted. The
helper listens on `127.0.0.1:4179`; Vite proxies its local HTTP interface during development.
Its scenario store defaults to the ignored local file `vendor-billing-test-store.local`;
`VENDOR_BILLING_TEST_STORE` may point to another locally excluded path. Keep Test credentials out of `VITE_*` variables and repository files.
Plan's explicit Test switch works in demo and authenticated development sessions. Selecting a
scenario persists its fixed sample boundaries across reload and helper restart. Pay Now asks the
helper to create and inspect a Razorpay Test subscription, then opens hosted Test Checkout. The
helper verifies the callback signature server-side, and each Refresh rereads the Test subscription,
invoice and payment. Only provider-confirmed AutoPay or captured platform fees are marked
**Razorpay Test verified**; trial and access remain locally simulated. For renewal exercises, set up
AutoPay in the Paid sample scenario, trigger accelerated charges in the Razorpay Test Dashboard, then
refresh Plan. Renewals and retries count only against the original billing cycle. Cancel AutoPay asks
the helper to stop only the scenario's own Test subscription. Collection is shown stopped only after a
Refresh reads it cancelled, and Pay Now then sets up a replacement at the same boundary. To start
again, use **Reset Test scenario**: after confirmation it cancels only this scenario's own Test
subscriptions and completes once Razorpay Test reads show them closed. Until then it stays pending
with **Retry reset**. Earlier scenarios remain listed as history, and you then choose a new one.
The [dated Plan evidence](./docs/VENDOR_BILLING_PREVIEW.md#plan-test-mode-evidence--23-september-2026)
records which Test card and hosted Checkout steps work for this account.

`VITE_PUBLIC_SITE_URL` falls back to the browser's current origin when unset, which is why it
must be set on every deployment: without it a vendor copies a `localhost` or preview-deployment
link, and the QR they print encodes the same wrong host.

The client currently falls back to the development API base when `VITE_API_BASE_URL` is unset.
Set the value explicitly for live development. Never commit `.env`, credentials, or test tokens.

Live landing-page discovery uses Photon's public OpenStreetMap geocoder and requires no browser API
key. Search requests are debounced and limited, but the public Photon instance is a best-effort
service that may throttle extensive usage. When an exact result has no postcode, the landing flow
uses an agreeing six-digit Indian PIN from bounded nearby address results while retaining the exact
selected coordinates. It does not guess across conflicting PIN boundaries or combine typed text
with fallback coordinates.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Run Vite on port 5173 |
| `npm run typecheck` | Type-check the project references |
| `npm run lint` | Run ESLint over `src` |
| `npm run test` | Run all Vitest logic and component tiers once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run dev:billing-helper` | Run the loopback-only local Plan Test helper |
| `npm run test:billing-helper` | Test its HTTP persistence and restart behavior |
| `npm run build` | Type-check and create `dist/` |
| `npm run preview` | Serve an existing production build |
| `npm run fetch:openapi` | Fetch backend Swagger into `packages/api-client/openapi.json` |
| `npm run generate:api` | Generate `packages/api-client/src/schema.d.ts` |

The [verification baseline in AGENTS.md](./AGENTS.md#verification) defines completion checks for
source and documentation changes. [docs/TESTING.md](./docs/TESTING.md) owns the test tiers, writing
rules, and limits; full journeys still need an app run because there is no end-to-end runner.

The API package also has a separate typecheck command:

```bash
npm --prefix packages/api-client run typecheck
```

`npm run sync:api` currently invokes `pnpm` inside the local package. Until that script is fixed,
run `fetch:openapi` and `generate:api` separately.

## Contributing

Start with [AGENTS.md](./AGENTS.md) for the shared working method, change boundaries, and
task-specific reading guide. It is the source of repository instructions across coding tools.
Use [CONTEXT.md](./CONTEXT.md) for domain terms and the relevant [ADRs](./docs/adr/) for accepted
decisions. Detailed implementation facts belong in the owning document listed below.

Keep changes tied to a verifiable outcome, update affected documentation alongside the work, and
include verification results when handing it over. For a new tool session, carry forward the
outcome, decisions, and remaining work so the next session can resume from the current diff.

## Project structure

```text
.
├── AGENTS.md                 # Canonical tool-neutral workflow and guardrails
├── CONTEXT.md                # Product domain glossary
├── design-reference/         # Frozen static visual/behavior reference
├── docs/                     # API, backend gaps, sessions, testing, and ADRs
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

Placement and import rules live in [AGENTS.md](./AGENTS.md#application-architecture), with
[API-specific placement](./AGENTS.md#api-placement-rules) alongside the API boundary rules.

## API architecture

Pages use the `src/shared/api` facade for demo/live behavior and view models. The source-resolved
`packages/api-client` owns HTTP transport, authentication infrastructure, and backend wrappers.
App services mix raw transport shims with package wrappers and mappers. The generated schema does
not yet provide a fully typed pipeline across both layers.
Read [docs/API_ARCHITECTURE.md](./docs/API_ARCHITECTURE.md) before changing an endpoint or this boundary.

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

Customer and vendor login use WhatsApp OTP at `/login` and `/vendor/login`. `/register` redirects
to vendor login when signed out, or to the signed-in user's home. Sessions use verified backend
roles and vendor memberships; tokens currently live in `localStorage`. The approved move to a
cookie-based refresh credential has not shipped. [docs/SESSION.md](./docs/SESSION.md) owns the
lifecycle, authorization limits, and target model.

With `VITE_USE_API=false`, use a synthetic, valid-format 10-digit mobile number and OTP `1234` on
either login screen; no WhatsApp message is sent. The email/password service actions remain for
demo-only tooling and are not the login UI. Their demo credentials are:

| Role | Email | Password |
|------|-------|----------|
| Customer | `customer@demo.com` | `demo1234` |
| Vendor | `vendor@demo.com` | `demo1234` |

## Routes

| Path | Surface |
|------|---------|
| `/` | Marketing home |
| `/stores` | Store list |
| `/stores/:storeId` | Store detail |
| `/cart` | Cart |
| `/login` | Customer WhatsApp OTP login |
| `/vendor/login` | Vendor WhatsApp OTP login |
| `/register` | Redirect to vendor login or the signed-in user's home |
| `/onboarding` | Ten-step vendor setup; persists in Live API mode or saves a local demo preview |
| `/onboarding/preview/:draftSlug` | Same-browser, non-public storefront preview restored from the safe local draft |
| `/checkout`, `/orders` | Protected customer flows |
| `/vendor` | Protected vendor dashboard |
| `/vendor/plan` | Vendor platform billing status; demo mode is simulated, while live billing awaits backend integration |
| `/vendor/orders`, `/vendor/orders/subscriptions`, `/vendor/orders/:orderId`, `/vendor/products`, `/vendor/storefront`, `/vendor/settings` | Protected vendor dashboard, in its own shell outside the customer chrome |

## Documentation

| Document | Purpose |
|----------|---------|
| [AGENTS.md](./AGENTS.md) | Shared working method, repository guardrails, and verification baseline |
| [CONTEXT.md](./CONTEXT.md) | Product domain glossary for platform, vendor, draft, and storefront concepts |
| [docs/adr/](./docs/adr/) | Accepted decisions, their trade-offs, and removal conditions |
| [docs/API_ARCHITECTURE.md](./docs/API_ARCHITECTURE.md) | Implemented API architecture and endpoint workflow |
| [docs/API_GAPS.md](./docs/API_GAPS.md) | Confirmed frontend/backend contract gaps |
| [docs/VENDOR_BILLING_BACKEND_HANDOFF.md](./docs/VENDOR_BILLING_BACKEND_HANDOFF.md) | Vendor billing backend data/operation requirements and authorised mock responses for development |
| [docs/SESSION.md](./docs/SESSION.md) | Current auth/session lifecycle |
| [docs/TESTING.md](./docs/TESTING.md) | Test tiers and component-test rules |
| [packages/api-client/README.md](./packages/api-client/README.md) | Local API-package workflow |
| [design-reference/README.md](./design-reference/README.md) | Static reference purpose and inventory |

## Design reference

`design-reference/` is static HTML retained for layout and interaction reference. It is not served by
Vite and is not product source.

```bash
npx --yes serve design-reference -p 4173
```

Study the reference, then implement product changes under `src/` and `src/styles/`.
