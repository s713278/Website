# Design standards

Owns the brand basics and the loading and error states of the React app. Design tokens live in
`src/styles/global.css`; [design-reference/README.md](../design-reference/README.md) owns the static
design reference.

## Brand

- Emerald brand colors, Poppins for display text, Inter for body text, Tailwind v4, and shadcn
  variables defined in `src/styles/global.css`.
- Prefer established variables and shared UI over per-screen styling.
- For small-vendor workflows, keep one primary job per screen and make the next action obvious.

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
| `LoadError` | `@/shared/components` | [LoadError.tsx](../src/shared/components/LoadError.tsx). `role="alert"`, "Something went wrong" and **Try again** (`onRetry`); extra actions go in `children`. |
| `RouteErrorBoundary` | `@/app/router/RouteErrorBoundary` | [RouteErrorBoundary.tsx](../src/app/router/RouteErrorBoundary.tsx). Wraps the routes in [router/index.tsx](../src/app/router/index.tsx); a render error or failed route chunk shows `LoadError`, and Try again reloads the page. |
| `useShowAfterDelay` | `@/shared/hooks/useShowAfterDelay` | [useShowAfterDelay.ts](../src/shared/hooks/useShowAfterDelay.ts). Owns the shared delay, `LOADER_SHOW_DELAY_MS`. |

### Rules

- No visible loader text. Each loading region has one `role="status"` with a screen-reader label;
  skeleton blocks are `aria-hidden`.
- `PageLoader` and `Spinner` appear after about 300 ms; skeletons appear at once. No minimum display
  time.
- Under reduced motion, loaders and skeletons are static.
- A skeleton replaces only the region that is loading; `PageLoader` fills the whole content area.
- A refetch (filter or page change, reload after an action) keeps the current results on screen,
  dimmed and `aria-busy`, with a small `Spinner` near the controls.
- Late secondary UI, such as the vendor shell's plan chip and the marketing header's vendor actions,
  intentionally has no placeholder ([SESSION.md](./SESSION.md#temporary-vendor-header-hint--tempvendor-header-hint)).
- A failed read shows `LoadError`. Billing messages that explain a real state stay as they are.
- A spinner inside a button carries no status role. A button that already has a pending label, such
  as "Saving…", keeps it.
