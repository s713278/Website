/**
 * The vendor dashboard's route chunks, loaded by the router's `lazy()` factories.
 *
 * Kept apart from `index.tsx` so sign-in can start the downloads without importing the router,
 * which itself imports the login screens. The specifiers stay dynamic, so the vendor graph
 * never joins the entry bundle, and a repeated call reuses the module the first one fetched.
 */
export const loadVendorShell = () => import('@/modules/vendor/components/VendorShell')
/** A page chunk loader that also remembers the module once it has arrived. */
export type PageChunk<M> = (() => Promise<M>) & { loaded: () => M | undefined }

function pageChunk<M>(load: () => Promise<M>): PageChunk<M> {
  let module: M | undefined
  return Object.assign(() => load().then((loaded) => (module = loaded)), { loaded: () => module })
}

export const loadVendorOverviewPage = pageChunk(() => import('@/modules/vendor/pages/VendorOverviewPage'))
export const loadVendorOrdersPage = pageChunk(() => import('@/modules/vendor/pages/VendorOrdersPage'))
export const loadVendorOrderDetailPage = pageChunk(() => import('@/modules/vendor/pages/VendorOrderDetailPage'))
export const loadVendorSubscriptionsPage = pageChunk(() => import('@/modules/vendor/pages/VendorSubscriptionsPage'))
export const loadVendorProductsPage = pageChunk(() => import('@/modules/vendor/pages/VendorProductsPage'))
export const loadVendorPlanPage = pageChunk(() => import('@/modules/vendor/pages/VendorPlanPage'))
export const loadVendorStorefrontPage = pageChunk(() => import('@/modules/vendor/pages/VendorStorefrontPage'))
export const loadVendorSettingsPage = pageChunk(() => import('@/modules/vendor/pages/VendorSettingsPage'))

/**
 * Starts fetching the dashboard chunks while sign-in still waits for the vendor context, so
 * navigation finds them loaded. Never rejects: a failure is left for the real `lazy()` load
 * to retry and surface through the route's own boundary.
 */
export function preloadVendorDashboard(): void {
  loadVendorShell().catch(() => {})
  loadVendorOverviewPage().catch(() => {})
}

/** The in-shell page chunk the router renders at `pathname`, mirroring the `/vendor` routes. */
function vendorPageLoader(pathname: string): (() => Promise<unknown>) | null {
  const [, root, section, child, ...rest] = pathname.replace(/\/+$/, '').split('/')
  if (root !== 'vendor' || rest.length > 0) return null
  if (!section) return loadVendorOverviewPage
  if (section === 'orders') {
    if (!child) return loadVendorOrdersPage
    return child === 'subscriptions' ? loadVendorSubscriptionsPage : loadVendorOrderDetailPage
  }
  if (child) return null
  const pages: Record<string, () => Promise<unknown>> = {
    products: loadVendorProductsPage,
    plan: loadVendorPlanPage,
    storefront: loadVendorStorefrontPage,
    settings: loadVendorSettingsPage,
  }
  return pages[section] ?? null
}

/**
 * Starts fetching the page chunk for the shell's first route alongside the shell's own chunk, so
 * the page is usually ready when the chrome appears. Only that page's chunk, which its route loads
 * anyway; never rejects, for the same reason as `preloadVendorDashboard`.
 */
export function preloadVendorPage(pathname: string): void {
  vendorPageLoader(pathname)?.().catch(() => {})
}
