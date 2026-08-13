# Session handling (JWT)

Shared lifecycle for **Customer** (storefront) and **Vendor / Owner** (store-setup) roles.

## Components

| Piece | Location | Role |
|--------|----------|------|
| Token store | `@mithra/api-client` `tokens.ts` | `mithra_access_token` + `mithra_refresh_token` in `localStorage` |
| Request interceptor | `http.ts` | Attaches `Authorization: Bearer <access>` unless `skipAuth` |
| Response interceptor | `http.ts` | `401` → single-flight refresh → retry once; else `onUnauthorized` |
| Auth UI state | `src/shared/auth/store/auth-store.ts` | Zustand user + access token; syncs into token store |
| Route gates | `ProtectedRoute` | `customer` → checkout/orders; `vendor` → `/vendor/*` |

## Lifecycle

1. **Login (OTP or demo)** → `applySession` / `completeOtpLogin` → writes access (+ refresh when present) and user  
2. **Reload** → Zustand rehydrates user; access token synced to api-client **without clearing refresh**  
3. **Expired access** → interceptor refreshes with refresh token, retries once  
4. **Refresh fails** → `clearSession()` (tokens + user); protected routes redirect to `/login`  
5. **Logout** → optional `POST /v1/auth/signout` (`skipRefresh`), then `clearSession`  
6. **Public storefront** → catalog calls use `{ skipAuth: true }` (no Bearer)

## Interim XSS posture (important)

**Current:** access + refresh tokens are JS-accessible (`localStorage`). This is an **interim** approach so the SPA and Axios interceptors can attach Bearer headers and refresh on 401.

**Risk:** any XSS can read tokens.

**Future direction:** move to **httpOnly, Secure, SameSite cookies** (or BFF) so refresh/access are not readable from JavaScript; pair with CSRF protections as needed.

Until that migration, keep CSP tight, avoid `dangerouslySetInnerHTML` with untrusted content, and treat XSS as a session-compromise bug.

## Manual test checklist

- [ ] OTP (or demo) login → reload → still authenticated on protected route  
- [ ] With valid refresh, expired access → API call succeeds after silent refresh  
- [ ] Invalid/missing refresh on 401 → session cleared → `/login`  
- [ ] Sign out → tokens gone, protected routes redirect  
- [ ] `/stores` public load works without login (`skipAuth`)
