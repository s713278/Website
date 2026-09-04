# Testing

Owns the test tiers, the rules for writing in each, and what this repository deliberately does not
have. [README.md](../README.md) owns the command list and [AGENTS.md](../AGENTS.md) owns the
verification baseline; both link here instead of restating it.

## Tiers

One runner, one command. `npm run test` runs everything.

| Tier | Environment | Files | Covers |
|------|-------------|-------|--------|
| Logic | node (default) | `src/**/*.test.ts` | Pure domain and presentation logic — onboarding resume, validation, entry routing, payload mapping, wire-to-view-model mappers |
| Component | jsdom (opt-in per file) | `src/**/*.test.tsx` | React effect lifecycle: what a page fetches, when it refetches, and what it does with the response |

There is **no end-to-end runner**. Full-journey behaviour is still verified by running the app.

## Choosing a tier

Push a test as far down as it will go.

- Logic that can be lifted out of a component belongs in a `lib/` module with a node test. Most
  vendor-onboarding rules already live this way.
- Reach for a component test only when the behaviour **is** the React lifecycle — effect re-runs,
  cleanup, teardown ordering, a response arriving after the component moved on. None of that is
  observable without rendering.

## Writing a component test

Opt into the DOM with a docblock on the first line. The default environment stays node, so the
logic suites are never slowed by a DOM they do not touch:

```tsx
// @vitest-environment jsdom
```

Four rules, each with its reason:

1. **Clean up by hand.** Vitest globals are off, so Testing Library's automatic cleanup never
   registers itself. Without an explicit `afterEach(cleanup)` the previous render stays mounted and
   `screen` queries match two copies of the page.

2. **Stub at the `src/shared/api` service seam** with `vi.spyOn` on the exported service object —
   not `vi.mock` of the whole facade, which would also stub helpers like `getErrorMessage` that the
   page imports from that same module.

3. **Never let a test reach the network.** `.env` here carries `VITE_USE_API=true` and is
   `skip-worktree`, so it does not appear in `git status`. A test that escapes the seam hits the
   shared dev backend for real, silently.

4. **Change the session through `applySession()` / `clearSession()`.** A test that writes to the
   auth store directly takes a path production never takes, and can pass while the real one is
   broken.

## Controlling response order

Effect-lifecycle bugs are ordering bugs, so the test has to own the ordering. Hand back promises it
settles itself rather than already-resolved values:

```ts
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}
```

Resolving them out of order reproduces a stale response landing after the component moved on.
`src/modules/vendor/pages/VendorProductsPage.test.tsx` is the worked example: it locks the
contract that all three vendor pages depend on — a torn-down fetch must not overwrite fresh state.

## StrictMode

`src/main.tsx` wraps the app in `<StrictMode>`, which double-invokes effects **in development
only**. A page that fetches in an effect therefore issues two requests per mount under
`npm run dev`, and one in a production build.

Testing Library does not render in StrictMode, so component tests observe a single invocation. Do
not add an assertion that a page fetches exactly once and then read it as evidence about what the
dev server does — the two measure different things.
