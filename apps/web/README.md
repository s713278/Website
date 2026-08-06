# @mithra/web

Production-grade React 19 + TypeScript + Vite shell for MithraDirect.

Maps static HTML surfaces to route areas (no business pages yet):

| Static | Route |
|--------|--------|
| `index.html` | `/` marketing |
| `store.html` | `/store` storefront |
| `onboarding.html` | `/onboarding` vendor setup |
| `dashboard.html` | `/dashboard` vendor/admin (protected) |

## Stack

- React Router 7
- TanStack Query
- Axios
- Zustand (auth)
- Tailwind CSS 4 + shadcn-style UI primitives
- React Hook Form + Zod
- ESLint + Prettier
- Feature-based folders under `src/features/*`
- Shared design tokens mirrored from `assets/css/global.css`

## Develop

```bash
pnpm install
pnpm --filter @mithra/web dev
```

Env: copy `apps/web/.env.example` values into repo-root `.env` (Vite `envDir`).

## Architecture

```
src/
  app/           providers, router, layouts
  features/      auth, marketing, storefront, onboarding, dashboard
  shared/        ui, lib, forms, hooks, types
  styles/        global.css (tokens)
```
