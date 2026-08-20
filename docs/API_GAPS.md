# Backend API gaps (frontend tracking)

Endpoints the frontend wants that the backend doesn't have yet, plus the interim workarounds.

Tracked against [Swagger](https://subscriptionapp-wgf8.onrender.com/api/swagger-ui/index.html).
Claims below were checked against `packages/api-client/openapi.json` (117 paths) and the `src/`
tree. See [API_ARCHITECTURE.md](./API_ARCHITECTURE.md) for how the API layer is put together.

> **Scope note.** Some workarounds here belong to the frozen `design-reference/` static prototype,
> not the React app. Those are marked **(static only)** — don't go looking for them in `src/`.

## Shipped (in the spec, use these)

| Endpoint | Use |
|----------|-----|
| `GET /v1/vendors/{identifier}/storefront` | Full public storefront payload by numeric vendor ID or `store_identifier` (theme, hero badges, fulfillment, categories, products, WhatsApp numbers, share link) |
| `POST /v1/vendors/{vendor_id}/delivery-eligibility` | Pincode / lat-lng deliverability check |
| `GET /v1/vendors/{vendor_id}/products/skus` | SKU list backing the storefront product grid |

Wrapped in `@mithra/api-client` as `storefrontService.get` / `checkDeliveryEligibility`, plus the
flat `getVendorStorefront`, `loadVendorStorefront`, `getVendorProductSkus` in `services/legacy.ts`.

> **The richer storefront payload is not called from `src/` yet.** The package wrappers are aligned,
> but the customer storefront still renders from the older catalog service (`/v1/vendors/…`). The
> onboarding prototype's own preview renders its private same-browser draft; it does not pretend to be this
> public backend response.

## Still open

| Gap | Needed for | Interim workaround |
|-----|------------|--------------------|
| Per-order WhatsApp message | Server-owned WhatsApp order text | Build the string client-side. (A bare `/v1/whatsapp` GET/POST exists but is not a per-order message endpoint.) |
| Rich product attributes on the storefront payload | Ingredients / nutrition / rating on the PDP | None. `ProductDTO` is `id`, `name`, `description`, `measurement_unit_id`, `image_path` — the spec itself calls it "lightweight". Pull detail from the SKU endpoints or fixtures. |
| Guest cart → merge on customer OTP | Browse anonymously, then sign in without losing the cart | Cart is local-only (`md-cart` via `useCartStore`) and never syncs, so there is nothing to merge yet |
| Coupon codes | Cart promo CTA | **(static only)** — `MITHRA50` / `HOME50` are hardcoded in `design-reference/assets/js/storefront.js`. The React app has no coupon UI. |
| Machine-readable onboarding progress | Resuming the wizard at the right step from the server | `GET /v1/vendors/{vendor_id}/context` documents only `onboarding.status` plus a human-readable `description` ("Step 2 is completed"). There is **no** `next_step` field, despite earlier claims. `mapVendorContext` maps `nextStep` only if one ever appears; resume must reconcile real server resources instead of parsing the description string. |
| Assigned-product ID mapping | Create SKUs after assigning platform products (Steps 5-6) | **Blocking.** `PATCH /v1/vendors/{vendor_id}/assign/products` and `GET /v1/vendors/{vendor_id}/products` both return an untyped `APIResponseObject` with no documented example, so the vendor-assigned product ID that `ItemSkuCreateRequest.product_id` requires cannot be resolved — refetching does not close this without guessing field names. Steps 5-6 stay in the local draft and use `draft-sku-*` IDs. Backend must type the assign response or the vendor-products response. |
| Canonical checkout JSON keys | Persist delivery schedules and shipping rules | Keep typed delivery and payment drafts separate, then combine them only at the future mapper boundary |
| Canonical payment-detail keys | Persist UPI holder details and NEFT/IMPS bank-account details | `PaymentOptionRequest.details` is generic JSON and documents only `upi_account`. Keep all values in volatile tab memory; confirm that `ONLINE` represents bank transfer plus the exact account-holder/account-number/IFSC/bank-name keys before enabling protected writes |
| Storefront logo classification | Map the logo control to the intended vendor image field | The contract now documents `HOMEBANNER`, `THUMBNAIL`, `PRODUCT`, `SKU`, and typed `image_url`; keep files in memory until the backend confirms that `THUMBNAIL` is the canonical storefront logo purpose |
| Canonical public web URL | Share the published store across browsers/devices | Offer only a same-browser private preview; link, WhatsApp, and QR sharing remain unavailable until a canonical published URL exists |
| Stable go-live validation contract | Link backend readiness failures to the responsible wizard step | Run the shared local readiness validator and set only `prototype-complete` |
| Vendor role granted at verification | Letting a first-time vendor past Step 2 | `verifyOtp` now requires `VENDOR` in the response `roles`, because the role requested on the login screen is not a grant. It is **not confirmed** whether a first-time vendor receives `VENDOR` at `/request-otp` or only after `/verify-otp`. If the backend does not return it at verification, new vendors are refused with "This number is not registered as a vendor yet." Fail-closed is deliberate; the alternative is granting unverified vendor access. |
| Vendor record for a verified vendor | Any vendor-scoped write (Steps 3+) | If `verify-otp` returns an empty `vendors[]` there is no `vendor_id`, so nothing can be saved. The wizard stops with an explicit "vendor account is not ready" state and keeps the local draft. It never calls `POST /v1/vendors/` — onboarding has no contract for creating a vendor. Backend must confirm when the vendor record is created and what `vendors[]` represents. |

### Deployed catalog sorting behavior

The deployed business-types operation fails when `sortBy=display_order` (the response envelope
reports status 500; the current HTTP status is 417). The onboarding reference hook therefore
requests `sortBy=id&sortOrder=ASC`, which returns HTTP 200. Do not restore `display_order` sorting
unless the backend behavior is fixed and verified.

### Resolved contract alignment: public storefront identifiers

The regenerated contract provides `GET /v1/vendors/{identifier}/storefront`; its identifier accepts
either a numeric ID or a store slug. `storefrontService.get(identifier)` and the legacy
`getPublicStoreBySlug(slug)` now both use that operation. The removed
`GET /v1/public/stores/{slug}` workaround must not be reintroduced.

## Corrections to earlier versions of this file

Previous revisions referenced things that do not exist in this repo. Recorded here so the same
workarounds don't get re-proposed:

- **`@mithra/domain` package** — does not exist. `packages/` contains only `api-client`.
- **`buildWhatsAppOrderMessage()`** — does not exist anywhere in the tree.
- **`mapVendorStorefrontToDraft()`** — does not exist anywhere in the tree.
- **`mithra_store_cart` localStorage key** — belongs to `design-reference/assets/js/store-api.js`.
  The React app's cart key is `md-cart`.
- **"vendor-app pages"** — there is no vendor-app. Vendor screens live in `src/modules/vendor`.
