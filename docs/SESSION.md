# Session handling (JWT)

Shared lifecycle for **Customer** (storefront) and **Vendor / Owner** (store-setup) roles.
This describes what is implemented today, not the target cookie model — see
[AUTHENTICATION_HANDOFF.md](./AUTHENTICATION_HANDOFF.md) for that.

## Components

| Piece | Location | Role |
|--------|----------|------|
| Token store | `@mithra/api-client` `tokens.ts` | `mithra_access_token` + `mithra_refresh_token` in `localStorage` |
| Request interceptor | `http.ts` | Attaches `Authorization: Bearer <access>` unless `skipAuth` |
| Response interceptor | `http.ts` | `401` → single-flight refresh → retry once; else `onUnauthorized`. `403` → `onForbidden`, session kept |
| Session mapping | `src/shared/api/services/auth.service.ts` | Builds the session from the backend's verified identity |
| Auth UI state | `src/shared/auth/store/auth-store.ts` | Zustand user + access token; syncs into token store |
| Startup restoration | `AppProviders` → `restoreSession()` | One shot; owns `isHydrated` |
| Route gates | `ProtectedRoute` | `customer` → checkout/orders; `vendor` → `/vendor/*` |

## What the session contains

`verify-otp` is the only source of identity. A session is created **only** when:

- `mobile_verified` is `true`; and
- the role being signed in as appears in the response `roles`.

The role chosen on the login screen is a request, not a grant. Unknown authorities
(`ADMIN`, `CUSTOMER_CARE`) are dropped rather than mapped.

| Field | Meaning |
|-------|---------|
| `role` | Active audience for this session. Always one of `roles`. |
| `roles` | Every role the backend verified. `hasRole()` consults this. |
| `vendors` | Vendor memberships from the response `vendors[]`. |
| `vendorId` | Set **only** when there is exactly one membership. Several memberships require an explicit `selectVendor()` choice; the first entry is never taken silently. |

## Lifecycle

1. **Login (OTP or demo)** → `applySession` / `completeOtpLogin` → writes access (+ refresh when present) and user
2. **Reload** → Zustand rehydrates the user, then `restoreSession()` completes hydration:
   - an expired-but-present access token is left alone (the interceptor refreshes on the first 401);
   - if only the refresh token remains, refresh once before deciding;
   - a transient refresh failure keeps the session rather than signing the user out;
   - the session is cleared only when **both** credentials are gone.
3. **Expired access** → interceptor refreshes with the refresh token, retries once
4. **Refresh fails (400/401/403)** → `clearSession()`; protected routes redirect to the role's login
5. **Refresh fails transiently (network/5xx)** → session kept; the error is normalized to `ApiError`
6. **`403` on a protected call** → `sessionProblem: 'forbidden'`; the session and unsaved work survive
7. **Logout** → optional `POST /v1/auth/signout` (`skipRefresh`), then `clearSession`
8. **Public storefront** → catalog calls use `{ skipAuth: true }` (no Bearer)

Route guards wait for `isHydrated`, so they never act on a half-restored session.

## Known limitation: persisted identity is not server-confirmed

`md-auth` persists the user (including `roles`, `vendors` and `vendorId`) in `localStorage`,
which is user-editable. On reload that data is normalized but **not verified against the
backend**, so it is a cache of what the browser was told at login, not proof of authority.
Backend authorization remains the real boundary; route guards are UX only.

The vendor onboarding wizard does confirm itself against
`GET /v1/vendors/{vendor_id}/context` for subscription limits. A general server-backed
session restoration needs a typed profile/session payload — `/v1/auth/profile` currently
returns plain text and cannot serve it.

## Interim XSS posture (important)

**Current:** access + refresh tokens are JS-accessible (`localStorage`). This is an **interim** approach so the SPA and Axios interceptors can attach Bearer headers and refresh on 401.

**Risk:** any XSS can read tokens.

**Future direction:** move to **httpOnly, Secure, SameSite cookies** (or BFF) so refresh/access are not readable from JavaScript; pair with CSRF protections as needed. Feature code must never read a token directly — only `useAuthStore` and `@/shared/api` — so that migration stays invisible to features.

Until that migration, keep CSP tight, avoid `dangerouslySetInnerHTML` with untrusted content, and treat XSS as a session-compromise bug.

## Manual test checklist

- [ ] OTP (or demo) login → reload → still authenticated on protected route
- [ ] With valid refresh, expired access → API call succeeds after silent refresh
- [ ] Invalid/missing refresh on 401 → session cleared → role login
- [ ] Transient network failure during refresh → session survives, error shown
- [ ] `403` on a protected call → still signed in, unsaved work intact
- [ ] `mobile_verified: false` or missing vendor role → no session created
- [ ] Identity with several vendors → wizard asks which store, none chosen silently
- [ ] Sign out → tokens gone, protected routes redirect
- [ ] `/stores` public load works without login (`skipAuth`)
