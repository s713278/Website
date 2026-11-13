# Design standards

Owns the brand basics and the loading and error states of the React app. Design tokens live in
`src/styles/global.css`; [design-reference/README.md](../design-reference/README.md) owns the static
design reference.

## Brand

- Emerald brand colors, Poppins for display text, Inter for body text, Tailwind v4, and shadcn
  variables defined in `src/styles/global.css`.
- Prefer established variables and shared UI over per-screen styling.
- For small-vendor workflows, keep one primary job per screen and make the next action obvious.

## Alert colors

- Amber/yellow-orange: non-blocking cautions, plan limits, and unavailable actions (including
  removing saved onboarding categories/products). Highlight both message and icon.
- Red (`destructive`): validation errors, failed actions/loads, system failures, and highly
  destructive irreversible actions. Keep existing destructive button treatments.
- Neutral: routine guidance and informational states. Green: success and positive confirmations.
- Pair color with meaningful text and an icon where appropriate; support light and dark themes.

### Onboarding action feedback

- Use the wizard-scoped shadcn toast for refused saved-category/product removal, missing choices
  on Steps 3-5, failed saves on Steps 3-5 and 10, in-place saves, and OTP resend success.
- Keep messages concise and regular weight: amber cautions, red errors, green success.
- Show only the latest toast. Warnings/successes last 3 seconds; errors last 5 seconds. Hover/focus
  pauses dismissal; close and swipe remain available. Clear on step changes and wizard exit.
- Wizard toasts sit just above its footer so Continue and upload retry stay reachable; from 1400px
  wide they sit in the corner, clear of the footer's buttons.
- Show each error once. A message tied to one field (Steps 1, 2 and 6-9, including image selection
  errors) is inline only, with first-error focus/scroll. A missing choice on Steps 3-5 (business
  type, category, product) is a toast only, with no inline message or scroll; the exception is a
  category with no product on Step 5, whose panel still opens and scrolls into view. Plan-limit
  messages stay inline and in the toast. The toast
  supplies the announcement; do not duplicate it in another live region.
- A done Step 5 or 6 whose saved catalog has missing work (a saved category without a saved
  product, a saved product without a saved switched-on size) carries a **Needs attention** marker
  on its stepper dot; an unsaved pick never marks another step. The marker is an amber
  (`--md-warning`) ring and a small amber "!" badge in the corner the submitted-store "+" badge
  uses (the current step shows only the badge, keeping its own ring). The bar adds no text; the dot's accessible name and title say "needs attention",
  and the step stays reachable. Inside the step the missing item is marked in place, with no banner:
  a category without a product gets an amber outline and "Needs a product", a product without a
  valid size an amber outline and a warning "Needs a size" badge, and the first such group opens.
- On Steps 4 and 5 an unsaved catalog card (a picked or vendor-authored category or product)
  wears a **dashed outline only**: no tag, badge or extra colour, and saved cards keep the solid
  look. While the step shows any unsaved card, one muted line sits at the top of its list: "Items
  with a dashed outline aren't saved yet. Continue saves them."
- On Step 6 an unsaved size row (a new size, or a saved size with a changed quantity, unit, price
  or on/off state) takes the `--ob-brand-soft` wash and a 3px `--ob-brand` bar on its left edge,
  with no outline or tag. Every row keeps the same padding, so marking one never moves its
  columns. A saved product's blank starter size stays unmarked until the vendor fills it in. The
  key line is a small brand bar glyph and "Rows marked like this aren't saved yet. Continue saves
  them."
- The keys and marks clear once the step saves. Marks are visual only, so an unsaved item's
  accessible name ends with "not saved". Explanations of why a saved item can't be removed stay;
  there is no "Saved to your store" or "Not saved yet" text.
- Successful Continue advances without a toast. Persistent guidance, limits, retryable read errors,
  submission outcomes, and destructive confirmation dialogs keep their contextual presentation.

## Loading and error states

### Which loader

| Load | Use |
|------|-----|
| Cold start (session restore, then the route chunk, then the page), an in-shell route chunk not loaded yet, the onboarding wizard's draft restore and step loads | `PageLoader` |
| Content whose shape is known: vendor lists, dashboard tiles and queue, Order detail, Plan, Settings, payments made, share QR, the marketing store list, the wizard's load-more tiles | `Skeleton` |
| A refetch indicator or a small inline value | `Spinner` |
| An action in progress | `Button` with `pending` |
| A failed read | `LoadError` |

### Components

| Component | Import | Notes |
|-----------|--------|-------|
| `PageLoader`, `PageLoaderScreen` | `@/shared/components` | [PageLoader.tsx](../src/shared/components/PageLoader.tsx). Logo mark in a ring; only prop is the screen-reader `label`. `PageLoaderScreen` fills the viewport. The ring uses `--loader-ring` (`#4caf50`, the logo green, not `--primary`) and the logo is inlined so it draws with the ring. The show delay counts from the start of a chain of loaders, so a cold start shows one continuous loader. |
| `Skeleton` | `@/shared/components` | [skeleton.tsx](../src/components/ui/skeleton.tsx). `aria-hidden`; shimmer from `.md-skeleton` in `global.css`. |
| `RowSkeleton` (vendor) | `@/modules/vendor/components/RowSkeleton` | [RowSkeleton.tsx](../src/modules/vendor/components/RowSkeleton.tsx). Row placeholders under one status label; screen skeletons such as [PlanSkeleton.tsx](../src/modules/vendor/components/PlanSkeleton.tsx) follow the same pattern. |
| `Spinner`, `Button` `pending` | `@/shared/components` | [ui/index.tsx](../src/shared/components/ui/index.tsx). `pending` disables the button, sets `aria-busy` and adds a decorative spinner before the label. |
| `LoadError` | `@/shared/components` | [LoadError.tsx](../src/shared/components/LoadError.tsx). `role="alert"`; defaults to "Something went wrong" and **Try again** (`onRetry`). `message` and `retryLabel` allow contextual failures/retries, such as optional onboarding images; extra actions go in `children`. |
| `RouteErrorBoundary` | `@/app/router/RouteErrorBoundary` | [RouteErrorBoundary.tsx](../src/app/router/RouteErrorBoundary.tsx). Wraps the routes in [router/index.tsx](../src/app/router/index.tsx); a render error or failed route chunk shows `LoadError`, and Try again reloads the page. |
| `useShowAfterDelay` | `@/shared/hooks/useShowAfterDelay` | [useShowAfterDelay.ts](../src/shared/hooks/useShowAfterDelay.ts). Owns the shared delay, `LOADER_SHOW_DELAY_MS`. |

### Rules

- No visible loader text. Each loading region has one `role="status"` with a screen-reader label;
  skeleton blocks are `aria-hidden`.
- `PageLoader` and `Spinner` appear after about 300 ms; skeletons and a button's pending spinner
  appear at once. No minimum display time.
- Under reduced motion, loaders and skeletons are static.
- A skeleton replaces only the region that is loading; `PageLoader` fills the whole content area.
- A refetch (filter or page change, reload after an action) keeps the current results on screen,
  dimmed and `aria-busy`, with a small `Spinner` near the controls.
- Late secondary UI, such as the vendor shell's plan chip and the marketing header's vendor actions,
  intentionally has no placeholder ([SESSION.md](./SESSION.md#temporary-vendor-header-hint--tempvendor-header-hint)).
- A failed read shows `LoadError`. Billing messages that explain a real state stay as they are.
- A spinner inside a button carries no status role. A button that already has a pending label, such
  as "Saving…", keeps it.
