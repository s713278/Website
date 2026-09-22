# WhatsApp Phase 2 — Cloud API feature flag

## Channel flag

`VITE_CHECKOUT_CHANNEL=DEEPLINK | CLOUD_API`

- **DEEPLINK (Phase 1, default):** After `POST /v1/orders/from-cart` (`order_source=WHATSAPP_DEEPLINK`), open `wa.me` with structured message (`buildWhatsAppOrderMessage`).
- **CLOUD_API (Phase 2):** Same order create with `order_source=WHATSAPP_CLOUD`; UI skips auto-open (or keeps as fallback). Backend sends templates and receives events on existing:

  - `GET /v1/whatsapp` — webhook verify
  - `POST /v1/whatsapp` — webhook events (`WhatsAppWebhookRequest`)

## Frontend behavior

See `apps/storefront/src/features/checkout/CheckoutView.tsx` and `SuccessView.tsx`.

`resolveCheckoutChannel()` in `@mithra/domain` normalizes the env value.

## Backend (out of scope for this repo)

- Template sender + outbox
- Idempotent order status updates from webhook
- Per-vendor `checkout_channel` preference (overrides env)
