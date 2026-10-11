/**
 * The route chunks a vendor lands on at `/vendor`, loaded by the router's `lazy()` factories.
 *
 * Kept apart from `index.tsx` so sign-in can start the downloads without importing the router,
 * which itself imports the login screens. The specifiers stay dynamic, so the vendor graph
 * never joins the entry bundle, and a repeated call reuses the module the first one fetched.
 */
export const loadVendorShell = () => import('@/modules/vendor/components/VendorShell')
export const loadVendorOverviewPage = () => import('@/modules/vendor/pages/VendorOverviewPage')

/**
 * Starts fetching the dashboard chunks while sign-in still waits for the vendor context, so
 * navigation finds them loaded. Never rejects: a failure is left for the real `lazy()` load
 * to retry and surface through the route's own boundary.
 */
export function preloadVendorDashboard(): void {
  loadVendorShell().catch(() => {})
  loadVendorOverviewPage().catch(() => {})
}
