# MithraDirect Web (React + TypeScript monorepo)

Implementation of the [SaaS design doc](docs/MITHRADIRECT_SAAS_DESIGN.md).

## Apps

| App | Port | Command |
|-----|------|---------|
| Marketing | 5173 | `pnpm dev:marketing` |
| Vendor onboarding | 5174 | `pnpm dev:vendor` |
| Storefront | 5175 | `pnpm dev:storefront` |

## Quick start

```bash
# from repo root (pnpm is a local devDependency)
npx pnpm install
npx pnpm fetch:openapi   # optional — needs API reachable
npx pnpm generate:api    # optional — generates schema.d.ts
npx pnpm dev:marketing
npx pnpm dev:vendor
npx pnpm dev:storefront
```

Copy `.env.example` → `.env`. Set `VITE_USE_API=true` and `VITE_SAMPLE_VENDOR_ID` to wire live Spring Boot APIs.

API docs: https://subscriptionapp-wgf8.onrender.com/api/swagger-ui/index.html

## Packages

- `@mithra/ui` — design system tokens + components
- `@mithra/domain` — money, slugify, WA message builder, Sai Ram fixture
- `@mithra/api-client` — typed fetch wrappers for MithraDirect v1

## Prototype (legacy)

Static HTML demos remain at `index.html`, `onboarding.html`, `store.html` for reference until cutover.
