# Backend API gaps (frontend tracking)

Endpoints the frontend wants that the backend doesn't have yet, plus the interim workarounds.

Tracked against [Swagger](https://subscriptionapp-wgf8.onrender.com/api/swagger-ui/index.html).
Claims below were checked against `packages/api-client/openapi.json` (115 paths) and the `src/`
tree. See [API_ARCHITECTURE.md](./API_ARCHITECTURE.md) for how the API layer is put together.

> **Scope note.** Some workarounds here belong to the frozen `design-reference/` static prototype,
> not the React app. Those are marked **(static only)** — don't go looking for them in `src/`.

## Shipped (in the spec, use these)

| Endpoint | Use |
|----------|-----|
| `GET /v1/vendors/{vendor_id}/storefront` | Full public storefront payload (theme, hero badges, fulfillment, categories, products, WhatsApp numbers, share link) |
| `POST /v1/vendors/{vendor_id}/delivery-eligibility` | Pincode / lat-lng deliverability check |
| `GET /v1/vendors/{vendor_id}/products/skus` | SKU list backing the storefront product grid |

Wrapped in `@mithra/api-client` as `storefrontService.get` / `checkDeliveryEligibility`, plus the
flat `getVendorStorefront`, `loadVendorStorefront`, `getVendorProductSkus` in `services/legacy.ts`.

> **None of these are called from `src/` yet.** The wrappers exist; no page imports them. The
> customer storefront currently renders from `catalogService` (`/v1/vendors/…`) instead. Wiring the
> richer `/storefront` payload into the React app is open work, not a gap in the backend.

## Still open

| Gap | Needed for | Interim workaround |
|-----|------------|--------------------|
| `GET /v1/public/stores/{slug}` | Resolve a store from its `store_identifier` without knowing `vendor_id` | Pass `vendor_id` directly. **See the landmine below.** |
| Per-order WhatsApp message | Server-owned WhatsApp order text | Build the string client-side. (A bare `/v1/whatsapp` GET/POST exists but is not a per-order message endpoint.) |
| Rich product attributes on the storefront payload | Ingredients / nutrition / rating on the PDP | None. `ProductDTO` is `id`, `name`, `description`, `measurement_unit_id`, `image_path` — the spec itself calls it "lightweight". Pull detail from the SKU endpoints or fixtures. |
| Guest cart → merge on customer OTP | Browse anonymously, then sign in without losing the cart | Cart is local-only (`md-cart` via `useCartStore`) and never syncs, so there is nothing to merge yet |
| Coupon codes | Cart promo CTA | **(static only)** — `MITHRA50` / `HOME50` are hardcoded in `design-reference/assets/js/storefront.js`. The React app has no coupon UI. |
| `onboarding_step` on vendor | Resume a partially-finished vendor wizard | Client-side step state |

### Landmine: `getPublicStoreBySlug`

`packages/api-client/src/services/legacy.ts:173` implements `getPublicStoreBySlug(slug)` against
`GET /v1/public/stores/{slug}` — an endpoint that **does not exist in the spec**. It looks usable
and will 404 at runtime. Nothing imports it today; don't start.

`VITE_SAMPLE_VENDOR_ID` has been proposed as a fallback for this case but is **not read by any code
in this repo** — it is not a supported env var.

## Corrections to earlier versions of this file

Previous revisions referenced things that do not exist in this repo. Recorded here so the same
workarounds don't get re-proposed:

- **`@mithra/domain` package** — does not exist. `packages/` contains only `api-client`.
- **`buildWhatsAppOrderMessage()`** — does not exist anywhere in the tree.
- **`mapVendorStorefrontToDraft()`** — does not exist anywhere in the tree.
- **`mithra_store_cart` localStorage key** — belongs to `design-reference/assets/js/store-api.js`.
  The React app's cart key is `md-cart`.
- **"vendor-app pages"** — there is no vendor-app. Vendor screens live in `src/modules/vendor`.
