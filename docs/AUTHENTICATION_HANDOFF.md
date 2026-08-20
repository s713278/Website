# Authentication architecture handoff

> **Status:** Planning context for a future authentication feature session. This document does not
> describe an implemented lifecycle and is not the backend contract. The current implementation is
> documented in [SESSION.md](./SESSION.md); the live `/api/v3/api-docs` document remains authoritative
> for HTTP behavior. Once the feature is implemented, move durable lifecycle facts into `SESSION.md`,
> record unresolved contract problems in [API_GAPS.md](./API_GAPS.md), and retire this handoff.

Last updated: 2026-08-18. It was prepared on `setup/agentic-workflow` while unrelated documentation
changes were already present. Recheck the branch and complete working tree before starting feature
work, and do not alter or discard those existing changes.

## Purpose

Use this file to resume the production authentication work in a new development session without
reconstructing the earlier investigation and backend discussions. Before writing code, read:

- the root [AGENTS.md](../AGENTS.md);
- [SESSION.md](./SESSION.md) for the currently implemented lifecycle;
- [API_ARCHITECTURE.md](./API_ARCHITECTURE.md) for API-layer ownership;
- [API_GAPS.md](./API_GAPS.md) for backend-contract gaps;
- the live [Swagger UI](https://subscriptionapp-wgf8.onrender.com/api/swagger-ui/index.html) and
  [OpenAPI JSON](https://subscriptionapp-wgf8.onrender.com/api/v3/api-docs).

Source code and the current OpenAPI document take precedence if this handoff becomes stale.

## Product and feature scope

MithraDirect is a hyperlocal ecommerce platform with customer and vendor experiences. Production web
identity is intended to use a WhatsApp-capable phone number and OTP, not email/password. A backend
identity can hold more than one role. Authentication must support customer routes, vendor routes, a
future vendor-onboarding flow, session restoration, protected routes, refresh, and logout.

The Spring Boot backend is maintained separately. Treat its OpenAPI document as the frontend contract.
When the required contract is missing or unsuitable, document the backend gap instead of inventing an
endpoint or hiding the problem in a frontend workaround.

## Confirmed current backend behavior

The following describes the development deployment observed during this orientation and information
subsequently supplied by MithraDirect developers. It is evidence about the current backend, not the
approved target web design.

### Authentication operations

The `01. User Authentication API` OpenAPI tag currently contains:

| Method | Path | Current purpose |
|--------|------|-----------------|
| `POST` | `/v1/auth/request-otp` | Request WhatsApp OTP; create or find an identity |
| `POST` | `/v1/auth/verify-otp` | Verify OTP and issue credentials |
| `POST` | `/v1/auth/refresh` | Exchange a refresh token for a new access token |
| `GET` | `/v1/auth/profile` | Bearer-protected authenticated-profile operation |
| `POST` | `/v1/auth/signout` | Revoke the submitted refresh session |

The development API base is `https://subscriptionapp-wgf8.onrender.com/api`; the paths above therefore
resolve under `/api/v1/auth/*`.

### OTP and identity observations

- `/request-otp` creates a database user for a new phone number before OTP verification and returns a
  new `user_id` with `mobile_verified: false`.
- The observed registered-user request returned HTTP and envelope status `200`. OpenAPI documents
  `201` for a newly created user and `200` for an existing user/vendor.
- If `user_role` is omitted, the reported backend default is `USER`. The intended public application
  roles are `USER` and `VENDOR`.
- `/verify-otp` checks the OTP, marks the phone verified, and returns access and refresh credentials.
- A successful vendor test returned or created a vendor record. It is not yet confirmed whether this
  is only a vendor identity/profile shell or also represents a store.
- Failed, expired, or abandoned OTP attempts must not issue credentials. Their effects on the pending
  user, role, and vendor records are not yet confirmed.
- The exact point at which a new `USER`/`VENDOR` role becomes active is not confirmed. In particular,
  it is unknown whether an existing `USER` requesting `VENDOR` gains that role during `/request-otp`
  or only after successful `/verify-otp`.

The presence of `user_id` proves that a record exists by the end of `/request-otp`; it does not prove
that a requested role is active or authorized at that time.

### Current token and logout behavior

Safe calls against the development deployment established that:

- the access credential is an `HS256` JWT with an observed lifetime of 600 seconds;
- observed claims included `sub`, `name`, `roles`, `aud`, `iss`, and `vendor_id`;
- the current `/refresh` response returns only a new access token in `data`;
- the current refresh token can be reused to mint more than one access token;
- no replacement refresh token was observed in the response body, cookies, or credential-bearing
  response headers;
- `/signout` revokes the refresh token, after which refresh returns `401`;
- an already issued access JWT continues authorizing `/profile` until its approximately ten-minute
  expiry.

The continued access-token validity is normal for the backend's current stateless-JWT model. The
current development deployment does **not** exhibit one-time refresh-token rotation.

### Current OpenAPI weaknesses relevant to auth

- `MobileSignUpRequest.mobile_number` is a string, while
  `OTPVerificationRequest.mobile_number` is an integer.
- `OTPVerificationRequest` marks only `country_code` as required even though verification requires a
  phone number and OTP.
- `RefreshTokenRequest.refresh_token` is not marked required.
- Some numeric examples disagree with string schema types.
- Verify, refresh, and sign-out use generic response envelopes rather than typed auth payloads.
- `/profile` is documented as a string and currently returns a non-JSON string with an
  `application/json` content type. It is not sufficient for restoring frontend session state.
- The public request schema advertises `ADMIN` and `CUSTOMER_CARE` as role values even though the web
  application uses only `USER` and `VENDOR`. Backend rejection of privileged public registration has
  not yet been confirmed.
- Observed success envelopes used a numeric `status`, while an observed `401` error envelope used a
  string status.

Do not encode these inconsistencies into permanent frontend types. The backend/OpenAPI contract should
be corrected as part of the production auth work.

## Approved target web-session model

The senior backend developer accepted the proposed browser-security direction as the MVP target. Treat
the following as the agreed architecture direction unless the user reports a revised backend decision:

1. `/verify-otp` returns the short-lived access token to the web client and the frontend holds it only
   in memory.
2. The backend stores the long-lived refresh credential in a `Secure`, `HttpOnly` cookie. Frontend
   JavaScript never receives, reads, persists, logs, or submits its value.
3. `/refresh` authenticates through that cookie, rotates the refresh credential, sets the replacement
   cookie, and returns a new access token.
4. Design the frontend as though a refresh credential is single-use and its predecessor becomes
   invalid after rotation. Do not depend on a backend grace period.
5. Coordinate refresh calls so concurrent requests within the app—and, if required by the final
   design, across browser tabs—do not independently consume the same refresh credential.
6. `/signout` revokes the refresh session and the backend expires the HttpOnly cookie. Local UI/session
   state is cleared even if the network request fails.
7. Already-issued access JWTs may remain usable until their short expiry unless the backend later
   introduces access-token revocation.
8. Credentialed requests, CORS, `SameSite`, CSRF protection, cookie scope, and the frontend/API domain
   topology must be designed together.
9. The existing mobile application's token contract must continue working. The final backend contract
   must explain how web behavior and mobile behavior coexist.

HttpOnly mitigates extraction of the long-lived refresh credential by injected JavaScript; it does not
eliminate XSS or CSRF. The frontend must still prevent XSS, and the backend must implement the chosen
cookie/Origin/CSRF controls.

## Non-negotiable information still needed

The user will provide this information at the start of the authentication feature session. Resolve
these items before freezing interfaces or modifying token/session infrastructure. Smaller OTP-policy
values and error copy can be parameterized later.

### 1. Executable web endpoint contract

Confirm the final request, response, and authentication behavior for all five `/v1/auth` operations,
including:

- what `/verify-otp` returns in JSON in addition to the access token;
- whether `/refresh` is cookie-only and whether it also returns session data;
- whether `/signout` requires an access token, the refresh cookie, or both;
- whether sign-out can still revoke and clear the cookie after access-token expiry;
- how the backend selects web-cookie behavior while preserving the mobile flow;
- when the implemented contract will be deployed to development and reflected in OpenAPI.

Do not implement against verbal examples once a revised OpenAPI contract is available.

### 2. Browser/API origin and CSRF boundary

Obtain the exact development and production frontend and API origins. Confirm whether production will
be same-site, for example `mithradirect.com` plus `api.mithradirect.com`, or cross-site. The answer owns:

- the viable `SameSite` setting;
- credentialed CORS origins;
- cookie domain and path;
- local-development behavior;
- the required Origin/Referer, CSRF-token, or other CSRF defense.

This is architectural: cross-site cookies may be restricted by browser third-party-cookie policies.

### 3. Authoritative session-restoration payload

After a reload, the access token and in-memory user state are gone. The app will call `/refresh`, then
needs an authoritative authenticated-session representation. Confirm whether that comes from a typed
`/profile` response or the refresh response.

At minimum the frontend needs stable fields for:

- user ID;
- normalized phone number and verified state;
- all backend roles;
- active role or audience;
- vendor ID or vendor relationship when applicable;
- a reliable vendor-onboarding status when applicable.

Do not preserve the current fake email/name fallbacks or treat the existing plain-string `/profile` as
a production session contract. JWT claims can assist UI decisions only if the backend declares them
stable; backend authorization remains authoritative.

### 4. Multi-role and vendor-context rules

Confirm:

- whether backend authorization uses `roles`, `aud`, or both;
- whether the existing role hierarchy always fixes the active role;
- whether a `USER` + `VENDOR` identity can switch customer/vendor contexts;
- whether switching requires a newly issued access token;
- whether a vendor can still use customer/storefront operations;
- whether a user can own more than one vendor identity;
- what the vendor returned at verification represents;
- how “verified vendor but onboarding incomplete” is represented.

These answers determine session types, route guards, post-login navigation, and the boundary between
authentication and vendor onboarding.

### 5. Pre-verification authorization invariants

Get explicit backend confirmation that:

- `mobile_verified: false` identities cannot authenticate or call protected operations;
- no access or refresh credential is issued before successful verification;
- public registration permits only `USER` and `VENDOR`, with `ADMIN` and `CUSTOMER_CARE` rejected
  server-side regardless of the request body;
- repeated OTP requests are idempotent for pending user/role/vendor records;
- the point at which roles and vendor records become active is defined.

Cleanup timing for abandoned records can be decided later, but an unverified identity being inert is a
required security boundary.

## Questions that do not block architecture

Track these before production completion, but do not delay the initial architecture solely for them:

- OTP expiry, resend delay, invalidation, and maximum-attempt values;
- rate-limit dimensions and `Retry-After` behavior;
- exact user-facing error wording;
- the unverified-record cleanup interval;
- optional sign-out-from-all-devices support;
- final cookie name and narrow path;
- whether the `200`/`201` distinction should eventually be hidden to reduce phone-number enumeration;
- detailed WhatsApp-provider delivery failure behavior.

These should still receive stable error codes and OpenAPI documentation before production release.

## Current frontend implementation to replace

The production feature starts from an interim implementation, not a blank slate.

### UI, session state, and routes

- `src/shared/auth/pages/LoginPage.tsx` and `RegisterPage.tsx` render demo email/password forms.
- Their Zustand `login`/`register` actions throw in live mode; live OTP UI is not wired.
- `src/shared/api/services/auth.service.ts` already contains demo/live `requestOtp` and `verifyOtp`, but
  it creates placeholder frontend users and derives the active role from the role requested by the UI.
- `src/shared/types/index.ts` models a user with one `customer` or `vendor` role and requires fake
  `name`/`email` fields. It cannot represent the backend's multi-role identity.
- `ProtectedRoute` checks one persisted user role plus a locally stored access token. It does not
  perform cookie-backed session bootstrap.
- `homePathForRole` assumes a single active role and routes vendors directly to `/vendor`.
- `useAuthStore` persists both the UI user and access token under `md-auth`.

### Transport and tokens

- `packages/api-client/src/client/tokens.ts` stores both access and refresh tokens in localStorage under
  `mithra_access_token` and `mithra_refresh_token`.
- `refresh.ts` reads the refresh value in JavaScript, sends it in a JSON body, stores the replacement,
  and provides single-flight coordination only within the current JavaScript context.
- `http.ts` attaches the Bearer access token and retries one request after a successful refresh. The
  Axios instance does not currently enable credentialed cookie requests.
- Token/session data is duplicated between the package token keys and persisted `md-auth` state.
- The app-facing sign-out currently sends no required refresh-token body, then clears local tokens.
- `AppProviders` clears local session state when refresh cannot recover and should continue avoiding a
  recursive server-logout loop.

This lifecycle is documented in [SESSION.md](./SESSION.md). Preserve its behavior until the production
auth task intentionally replaces it; do not partially mix the old localStorage refresh scheme with the
new cookie scheme.

## API-layer ownership for the feature

Read [API_ARCHITECTURE.md](./API_ARCHITECTURE.md) before designing the change. Expected ownership:

| Concern | Owner |
|---------|-------|
| Axios credentials, Bearer attachment, refresh coordination, retry, token memory | `packages/api-client/src/client/` |
| Backend-auth operation wrappers | `packages/api-client/src/services/auth.ts` |
| Demo/live behavior and session payload mapping | `src/shared/api/services/auth.service.ts` |
| Application session state and auth actions | `src/shared/auth/store/` |
| OTP screens and auth UI | `src/shared/auth/pages/` and auth components |
| Startup restoration/provider lifecycle | `src/app/providers/` |
| Protected routes and role-aware navigation | `src/app/router/` |
| Generated request/response declarations | regenerate `openapi.json` and `schema.d.ts` |

Pages and components consume `@/shared/api`; they do not call Axios directly or import
`@mithra/api-client` directly. The repository currently has two service sets that are not a fully typed
stack. Do not redesign that broader boundary accidentally as part of authentication; document any
intentional migration first.

## Planning principles for the next session

1. Model authentication as an explicit state machine rather than a single `user !== null` boolean.
   Account for initial restoration, unauthenticated, requesting OTP, awaiting verification, verifying,
   authenticated, refreshing/recovering, signing out, and terminal session failure.
2. Keep the access token out of persisted Zustand/localStorage state. Persist only non-secret UX data
   if it is genuinely needed, and never treat persisted UI data as proof of authentication.
3. Perform one startup restoration attempt before protected routes decide whether to redirect.
4. Centralize refresh so a burst of 401s cannot start several rotations. Decide and test the cross-tab
   coordination mechanism before relying on single-use rotation.
5. Retry an original request at most once. A refresh failure clears local state and transitions to an
   unauthenticated session without calling refresh recursively.
6. Separate authentication status, backend roles, selected UI context, and vendor-onboarding status.
   They are related but not interchangeable.
7. Backend authorization is authoritative. Frontend route guards improve UX but provide no security.
8. Normalize backend envelopes and identity payloads at the API boundary, not inside pages.
9. Preserve demo mode deliberately or agree to replace it as an explicit part of the feature.
10. Never log or persist access tokens, refresh cookies, OTPs, allow-listed phone numbers, or real user
    data. Use backend-provided safe test identities.

## Suggested next-session sequence

1. Reinspect repository root, branch, remotes, and staged/unstaged/untracked work.
2. Confirm that feature work is on an explicitly approved task branch targeting `integration`; do not
   switch or create a branch without the user's instruction.
3. Read this handoff and the linked source-of-truth documents and code.
4. Collect the five non-negotiable backend answers above and write down the resulting contract.
5. Refresh and inspect OpenAPI only when the user authorizes regeneration and the backend contract has
   been deployed. Never hand-edit generated artifacts.
6. Produce an architecture plan before implementation, including state types, sequence diagrams,
   package/file ownership, migration from persisted tokens, and failure/recovery behavior.
7. Record confirmed missing backend behavior in `API_GAPS.md`. Do not update `SESSION.md` to describe
   the target as though it already exists.
8. Implement incrementally, then update `SESSION.md` to the lifecycle that actually ships.
9. Verify with root typecheck/lint, the package typecheck, and a deliberate live-auth scenario matrix.

## Minimum live-auth scenario matrix

Before calling the feature production-ready, exercise at least:

- new customer OTP request and verification;
- existing customer login;
- new vendor verification and onboarding redirect;
- existing multi-role customer/vendor login and context handling;
- wrong and expired OTP;
- resend and rate-limit behavior;
- reload restoration through the refresh cookie;
- simultaneous protected requests during access expiry;
- concurrent refresh behavior across browser tabs;
- refresh-token rotation and reuse rejection;
- expired/revoked refresh session;
- logout with valid and expired access tokens;
- `401` versus `403` route/API handling;
- failure to restore the profile after a successful refresh;
- demo mode, if it remains supported.

Do not place test credentials or live response bodies in committed fixtures or documentation.
