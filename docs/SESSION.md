# Session handling (JWT)

Shared lifecycle for **Customer** (storefront) and **Vendor / Owner** (store-setup) roles.
This describes what is implemented today. The agreed target model and the backend answers it
still needs are recorded under "Outstanding: the approved target session model" below.

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

**A refused verification clears the tokens.** The package-level `verifyOtp` writes whatever
credentials come back *before* the app service can check `mobile_verified` or `roles`, so both
refusal paths call `clearTokens()` on the way out. Without that the browser keeps a live bearer
token for a login the app rejected — and when a signed-in vendor changes their number from inside
the wizard, the refused number's token would be left sitting under the first vendor's still-persisted
`md-auth` user, so every later request would carry the wrong identity. Tokens are only ever adopted
into a session by `applySession()`.

| Field | Meaning |
|-------|---------|
| `role` | Active audience for this session. Always one of `roles`. |
| `roles` | Every role the backend verified. `hasRole()` and `ProtectedRoute` consult this, never `role` — the same number opens both login forms, so the screen a vendor happened to use must not decide what they may reach. |
| `vendors` | Vendor memberships from the response `vendors[]`. |
| `vendorId` | Set **only** when there is exactly one membership, whichever login form was used — memberships come from the backend, not from the requested role. Several memberships require an explicit `selectVendor()` choice; the first entry is never taken silently. |

## Lifecycle

1. **Login (OTP or demo)** → `applySession` / `completeOtpLogin` → writes access (+ refresh when present) and user
2. **Reload** → Zustand rehydrates the user, then `restoreSession()` completes hydration:
   - an expired-but-present access token is left alone (the interceptor refreshes on the first 401);
   - if only the refresh token remains, refresh once before deciding;
   - a transient refresh failure keeps the session rather than signing the user out;
   - the session is cleared only when **both** credentials are gone.
3. **Expired access** → interceptor refreshes with the refresh token, retries once.
   Access tokens live **600 seconds**, so this path runs constantly during a long form;
   it is a main path, not an edge case.
4. **Refresh fails (400/401/403)** → `clearSession()`; protected routes redirect to the role's login
5. **Refresh fails transiently (network/5xx)** → session kept; the error is normalized to `ApiError`
6. **Refresh returns 200 but no recognizable token** → session kept and the attempt fails. The server
   accepted the credentials, so they are alive; clearing would destroy a working refresh token over a
   response-shape surprise
7. **`403` on a protected call** → `sessionProblem: 'forbidden'`; the session and unsaved work survive
8. **Logout** → optional `POST /v1/auth/signout` (`skipRefresh`), then `clearSession`, then every
   handler registered through `onExplicitSignOut()`
9. **Public storefront** → catalog calls use `{ skipAuth: true }` (no Bearer)

### Refresh response shape

`POST /v1/auth/refresh` answers with the new access token as a **bare string in `data`**:

```json
{ "timestamp": "…", "success": true, "status": 200, "data": "<jwt>" }
```

There is no object to read a field from, and **no new refresh token** — the existing one is reused.
`parseTokenResponse` therefore accepts a JWT-shaped `data` string, gated on three base64url segments
so that endpoints returning a plain sentence in `data` (go-live, for one) can never be mistaken for
credentials. The contract types this operation as a bare `APIResponseObject` with no example, so the
shape is only knowable by calling it — see [API_GAPS.md](./API_GAPS.md).

Route guards wait for `isHydrated`, so they never act on a half-restored session.

## Where a session lands

`resolveLandingPath(user, from)` decides, and sign-in **awaits it before navigating**.

It reads the verified roles, not the form that was used. A vendor signing in through the customer
page still owns a store, so sending them to `/cart` would strand a half-finished setup with no route
back to it. An explicit customer destination in `from` still wins, so a vendor heading to checkout is
not dragged into store setup.

For a vendor it then reads the account — one cached, resume-step-sized hydration shared with the
wizard — and routes on what is actually saved: a submitted store (`vendor_status: ACTIVE`) goes to
`/vendor`, anything else to `/onboarding`. The staged read policy and cache lifecycle are documented
in [API_ARCHITECTURE.md](./API_ARCHITECTURE.md#vendor-setup-account-hydration). Routing every vendor
into the wizard and letting it redirect back out is what produced a visible flash through setup for
vendors who had already finished it.

Any failure falls back to the role-only answer, which is `/onboarding`. That direction is deliberate:
being sent to setup wrongly costs a click, while being sent to a dashboard wrongly leaves a
half-finished store with no route back. `resumePathAfterLogin` remains the pure role-only function
underneath, and is what the fallback calls.

## Swapping identity in place

Verifying a second number while already signed in is an identity **swap**, not a sign-out:
`applySession()` replaces the user and tokens, and deliberately does not fire the
`onExplicitSignOut` handlers — the vendor is not leaving, they are moving to another account.
Feature state keyed on the previous identity still has to go, and does: changing `user.vendorId`
is what drives the onboarding draft's ownership check into discarding the old vendor's draft.

Use `logout()` when the user is leaving, `applySession()` when they are changing who they are.

## Browser-local state owned by a session

Features that keep their own browser-local state must not let it outlive the identity that created
it. Two mechanisms cover the two ways a session can end:

| Mechanism | Fires on | Use for |
|-----------|----------|---------|
| `onExplicitSignOut(handler)` | `logout()` only | Dropping local state the moment the user chooses to leave |
| Feature-side ownership check | Any read of that state | Every other path — expiry, failed refresh, a second account in the same browser |

`onExplicitSignOut` is deliberately **not** wired to `clearSession()`: an expired token or a failed
refresh is not a decision to discard work. The ownership check is what makes that safe, so it is the
required half — a feature that only clears on sign-out still leaks across identities after a session
expires.

The vendor onboarding draft implements both, and is the worked example: `useOnboardingDraftSession`
binds the stored draft to the signed-in vendor on every read and remount, an explicit sign-out clears
it, and an involuntary session loss *parks* it — kept in storage, taken off screen, and refused all
writes until the same vendor verifies again. A draft read under the wrong identity is both a
disclosure and a write hazard, because Continue would submit the previous vendor's details to the
account signed in now.

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

## Outstanding: the approved target session model

Tokens are in `localStorage` today. The direction below was accepted by the senior backend developer
as the MVP target and has **not** shipped; it is recorded here because it is the only place it is
written down.

1. `/verify-otp` returns the short-lived access token; the frontend holds it in memory only.
2. The refresh credential lives in a `Secure`, `HttpOnly` cookie that JavaScript never reads.
3. `/refresh` authenticates through that cookie, rotates it, and returns a new access token.
4. Assume the refresh credential is single-use and its predecessor dies on rotation — no grace period.
5. Coordinate refresh across concurrent requests and, if required, across tabs.
6. `/signout` revokes the session and expires the cookie; local state clears even if the call fails.
7. Credentialed CORS, `SameSite`, CSRF, cookie scope and the frontend/API domain topology are one
   design, not separate decisions.
8. The existing mobile token contract must keep working alongside it.

HttpOnly mitigates theft of the long-lived credential by injected JavaScript. It does not eliminate
XSS or CSRF.

Five backend answers are still required before this can be built: the executable contract for all
five `/v1/auth` operations; the exact production frontend/API origins (which decide `SameSite`,
credentialed CORS and the CSRF defence); an authoritative session-restoration payload, since
`/v1/auth/profile` currently returns plain text and cannot serve one; the multi-role and
vendor-context switching rules; and explicit confirmation of the pre-verification invariants — that
an unverified identity is inert, that no credential is issued before verification, and that public
registration cannot request `ADMIN` or `CUSTOMER_CARE`.

## Manual test checklist

- [ ] OTP (or demo) login → reload → still authenticated on protected route
- [ ] With valid refresh, expired access → API call succeeds after silent refresh, tokens still in
      storage afterwards, and in-progress form work intact
- [ ] Invalid/missing refresh on 401 → session cleared → role login
- [ ] Transient network failure during refresh → session survives, error shown
- [ ] `403` on a protected call → still signed in, unsaved work intact
- [ ] `mobile_verified: false` or missing vendor role → no session created **and no tokens left in
      `localStorage`** (check `mithra_access_token` / `mithra_refresh_token` are gone)
- [ ] Signed-in vendor verifies a second number that is refused → not left holding the other
      number's token
- [ ] Identity with several vendors → wizard asks which store, none chosen silently
- [ ] Sign out → tokens gone, protected routes redirect, session-owned local state cleared
- [ ] Second vendor signs in on the same browser → no first-vendor state survives anywhere
- [ ] `/stores` public load works without login (`skipAuth`)
