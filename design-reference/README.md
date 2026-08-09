# Design reference (static HTML)

Frozen snapshots of the original MithraDirect static pages. Use these while rebuilding the React app — **not** served by `npm run dev`.

| File | Surface |
|------|---------|
| `index.html` | Marketing homepage (hero, product loop) |
| `index_backup.html` | Older homepage variant |
| `store.html` | Customer storefront |
| `onboarding.html` | Vendor setup / onboarding |
| `dashboard.html` | Vendor dashboard |
| `privacy.html` | Privacy policy |
| `terms-conditions.html` | Terms |

Styles, scripts, and images live under `assets/` (`css/`, `js/`, `img/`, …). Paths are relative (`assets/...`), so open files from this folder.

```bash
# from repo root
npx --yes serve design-reference -p 4173
# then open http://localhost:4173/index.html
```

Or open any HTML file directly in the browser (some JS may need a local server).

Do not edit these as the product source of truth — mirror look-and-feel into `src/modules/*`.
