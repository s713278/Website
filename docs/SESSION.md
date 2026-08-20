# Session handling (JWT)

Shared lifecycle for **Customer** (storefront) and **Vendor / Owner** (store-setup) roles.

## Components

| Piece | Location | Role |
|--------|----------|------|
| Token store | `@mithra/api-client` `tokens.ts` | `mithra_access_token` + `mithra_refresh_token` in `localStorage` |
| Request interceptor | `http.ts` | Attaches `Authorization: Bearer <access>` unless `skipAuth` |
| Response interceptor | `http.ts` | HTTP **401** *or* HTTP **200** + `success:false` / `ACCESS_TOKEN_EXPIRED` → single-flight refresh → retry once; else `onUnauthorized` |
| Auth UI state | `src/shared/auth/store/auth-store.ts` | Zustand user + access token; syncs into token store |
| Route gates | `ProtectedRoute` | `customer` → checkout/orders; `vendor` → `/vendor/*`. Stays signed in if **access or refresh** exists; only clears when **both** are gone |

## Lifecycle

1. **Login (OTP or demo)** → `applySession` / `completeOtpLogin` → writes access (+ refresh when present) and user. **Never write `refresh=null`** — that deletes `mithra_refresh_token` and forces logout after access TTL.  
2. **Reload** → Zustand rehydrates user; access token synced to api-client **without clearing refresh**  
3. **Expired access** → interceptor refreshes (HTTP 401 **or** `200` + `ACCESS_TOKEN_EXPIRED` envelope), retries once, syncs Zustand via `onTokenRefreshed`.  
   Note: `/v1/auth/refresh` returns `{ success: true, data: "<access_jwt_string>" }` (not `data.access_token`).  
4. **Refresh fails** → `clearSession()` (tokens + user); protected routes redirect to login  
5. **Logout** → optional `POST /v1/auth/signout` (`skipRefresh`), then `clearSession`  
6. **Public storefront** → catalog calls use `{ skipAuth: true }` (no Bearer)

## Interim XSS posture (important)

**Current:** access + refresh tokens are JS-accessible (`localStorage`). This is an **interim** approach so the SPA and Axios interceptors can attach Bearer headers and refresh on 401.

**Risk:** any XSS can read tokens.

**Future direction:** move to **httpOnly, Secure, SameSite cookies** (or BFF) so refresh/access are not readable from JavaScript; pair with CSRF protections as needed.

Until that migration, keep CSP tight, avoid `dangerouslySetInnerHTML` with untrusted content, and treat XSS as a session-compromise bug.

## Manual test checklist

### Customer
- [ ] `/login` OTP → land on cart/checkout resume path  
- [ ] Reload on `/orders` or `/checkout` → still authenticated  
- [ ] Wait for access TTL (~10m) → open Orders → Network shows refresh then retry; **no login redirect**  
- [ ] Cart → checkout still works after idle (local cart + refresh on protected call)

### Vendor
- [ ] `/vendor/login` OTP → `/vendor` dashboard  
- [ ] Reload on `/vendor` / orders / products → still authenticated  
- [ ] Wait for access TTL → click dashboard/orders → refresh + retry; **no `/vendor/login` redirect**  
- [ ] After login, Local Storage has both `mithra_access_token` and `mithra_refresh_token`

### Shared
- [ ] Invalid/missing refresh on hard 401 → session cleared → role login page  
- [ ] Manual Log out → tokens gone, protected routes redirect  
- [ ] `/stores` public load works without login (`skipAuth`)
