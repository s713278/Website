# Backend API gaps (frontend tracking)

Tracked against [Swagger](https://subscriptionapp-wgf8.onrender.com/api/swagger-ui/index.html) for parity with the Sai Ram sample UX.

| Gap | Needed for | Frontend workaround |
|-----|------------|---------------------|
| `GET /v1/public/stores/{slug}` | Public URLs without `vendor_id` | `seedSaiRamDraft()` + `VITE_SAMPLE_VENDOR_ID` map |
| Public DTO: `themeColor`, `tagline`, `whatsapp`, logo/banner | Branded storefront | Fixture / vendor profile fields when available |
| Guest cart → merge on customer OTP | Browse anonymous then login | Local cart (`mithra_store_cart`) until API guest cart |
| `GET /v1/orders/{id}/whatsapp-message` | Server-owned WA text | `buildWhatsAppOrderMessage` in `@mithra/domain` |
| PDP attributes (ingredients, nutrition, storage, rating, popular) | Rich PDP | Fixture fields; optional JSON attrs later |
| Coupon codes | Cart promo CTA | Client stub `MITHRA50` / `HOME50` |
| `onboarding_step` on vendor | Resume wizard | Client step state |

See also `packages/api-client/src/index.ts` (`getPublicStoreBySlug` stub).
