# Scale hardening (10k storefronts) — frontend checklist

Backend owns Redis/CDN/rate limits; this repo prepares the client for scale.

## Caching

- Public store payloads should be fetched with cache-friendly GETs once `GET /v1/public/stores/{slug}` exists.
- TanStack Query defaults: staleTime 60s for catalog reads (`apps/storefront`).
- Static assets (logo/banner) served from CDN / object storage URLs — never base64 in API responses.

## Observability hooks

- All primary buttons use `data-cta="..."` attributes for analytics (marketing, onboarding, storefront).
- Correlate client errors with API `message` + HTTP status from `ApiError`.

## Rate-limit UX

- OTP buttons disable while `busy`; surface API 429 messages via `ApiError.message`.
- Cart qty capped at 25 (matches API docs).

## Media

- Vendor onboarding should upload via `POST /v1/vendors/{id}/images` (wired when `VITE_USE_API=true`).
- Prefer CDN URLs in store settings.

## Deploy notes

- Build each app independently (`pnpm --filter @mithra/marketing build`, etc.).
- Serve behind CDN; set long cache on hashed Vite assets; short/no-cache on `index.html`.
- Env: `VITE_API_BASE_URL` points at API gateway / Render service.
