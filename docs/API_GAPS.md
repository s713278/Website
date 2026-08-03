# Backend API gaps (frontend tracking)

Tracked against [Swagger](https://subscriptionapp-wgf8.onrender.com/api/swagger-ui/index.html).

## Shipped (use these)

| Endpoint | Use |
|----------|-----|
| `GET /v1/vendors/{vendor_id}/storefront` | Full public storefront payload (theme, badges, fulfillment, categories, products, WhatsApp, share link) |
| `POST /v1/vendors/{vendor_id}/delivery-eligibility` | Pincode / lat-lng deliverability check |

Wired in `@mithra/api-client` (`getVendorStorefront`, `checkDeliveryEligibility`) and storefront/vendor-app pages.

## Still open

| Gap | Needed for | Frontend workaround |
|-----|------------|---------------------|
| `GET /v1/public/stores/{slug}` | Resolve `store_identifier` without knowing `vendor_id` | `?vendor_id=` / numeric path / `VITE_SAMPLE_VENDOR_ID` |
| Guest cart → merge on customer OTP | Browse anonymous then login | Local cart (`mithra_store_cart`) |
| `GET /v1/orders/{id}/whatsapp-message` | Server-owned WA text | `buildWhatsAppOrderMessage` in `@mithra/domain` |
| Rich PDP attrs on storefront products | ingredients / nutrition / rating | Fixture fields; storefront `ProductDTO` is lightweight |
| Coupon codes | Cart promo CTA | Client stub `MITHRA50` / `HOME50` |
| `onboarding_step` on vendor | Resume wizard | Client step state |

Storefront load path: `GET .../storefront` + `GET .../products/skus` → `mapVendorStorefrontToDraft()`.
