import { lazy, Suspense, useState, type ComponentType } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { RootLayout } from '@/app/layouts'
import { ProtectedRoute } from '@/app/router/ProtectedRoute'
import { RouteErrorBoundary } from '@/app/router/RouteErrorBoundary'
import {
  loadVendorOrderDetailPage,
  loadVendorOrdersPage,
  loadVendorOverviewPage,
  loadVendorPlanPage,
  loadVendorProductsPage,
  loadVendorSettingsPage,
  loadVendorShell,
  loadVendorStorefrontPage,
  loadVendorSubscriptionsPage,
  preloadVendorPage,
  type PageChunk,
} from '@/app/router/vendor-dashboard-chunks'
import { MarketingLayout } from '@/modules/marketing/components/MarketingLayout'
import { MarketingHomePage } from '@/modules/marketing/pages/MarketingHomePage'
import { NotFoundPage } from '@/modules/marketing/pages/NotFoundPage'
import { StorefrontLayout } from '@/modules/storefront/components'
import { CartPage } from '@/modules/storefront/pages/CartPage'
import { CheckoutPage } from '@/modules/storefront/pages/CheckoutPage'
import { LocationMapPage } from '@/modules/storefront/pages/LocationMapPage'
import { OrderDetailPage } from '@/modules/storefront/pages/OrderDetailPage'
import { OrderSuccessPage } from '@/modules/storefront/pages/OrderSuccessPage'
import { OrdersPage } from '@/modules/storefront/pages/OrdersPage'
import { ProductDetailPage } from '@/modules/storefront/pages/ProductDetailPage'
import { StoreContactPage } from '@/modules/storefront/pages/StoreContactPage'
import { StoreDetailPage } from '@/modules/storefront/pages/StoreDetailPage'
import { StoreListPage } from '@/modules/storefront/pages/StoreListPage'
import { LoginPage } from '@/shared/auth/pages/LoginPage'
import { RegisterPage } from '@/shared/auth/pages/RegisterPage'
import { VendorLoginPage } from '@/shared/auth/pages/VendorLoginPage'
import { PageLoaderScreen } from '@/shared/components'

const VendorShell = lazy(() => {
  // The first page's chunk downloads alongside the shell's instead of after the account read.
  preloadVendorPage(window.location.pathname)
  return loadVendorShell().then((module) => ({
    default: module.VendorShell,
  }))
})

/**
 * An in-shell page that renders at once when its chunk has already arrived. A `lazy()` page
 * suspends on its first render even then, which shows the shell's fallback for a beat.
 */
function shellPage<M>(load: PageChunk<M>, pick: (module: M) => ComponentType) {
  const LazyPage = lazy(() => load().then((module) => ({ default: pick(module) })))
  return function ShellPage() {
    // Chosen once per instance: switching from the lazy page to the loaded one would remount it.
    const [Page] = useState<ComponentType>(() => {
      const module = load.loaded()
      return module ? pick(module) : LazyPage
    })
    return <Page />
  }
}

const VendorOverviewPage = shellPage(loadVendorOverviewPage, (module) => module.VendorOverviewPage)
const VendorOrdersPage = shellPage(loadVendorOrdersPage, (module) => module.VendorOrdersPage)
const VendorOrderDetailPage = shellPage(loadVendorOrderDetailPage, (module) => module.VendorOrderDetailPage)
const VendorSubscriptionsPage = shellPage(loadVendorSubscriptionsPage, (module) => module.VendorSubscriptionsPage)
const VendorProductsPage = shellPage(loadVendorProductsPage, (module) => module.VendorProductsPage)
const VendorPlanPage = shellPage(loadVendorPlanPage, (module) => module.VendorPlanPage)
const VendorBillingPreviewPage = import.meta.env.DEV
  ? lazy(() => import('@/modules/vendor/pages/VendorBillingPreviewPage').then((module) => ({ default: module.VendorBillingPreviewPage })))
  : null
const VendorStorefrontPage = shellPage(loadVendorStorefrontPage, (module) => module.VendorStorefrontPage)
const VendorSettingsPage = shellPage(loadVendorSettingsPage, (module) => module.VendorSettingsPage)
const VendorOnboardingPage = lazy(() =>
  import('@/modules/vendor/pages/VendorOnboardingPage').then((module) => ({
    default: module.VendorOnboardingPage,
  })),
)
const VendorOnboardingPreviewPage = lazy(() =>
  import('@/modules/vendor/pages/VendorOnboardingPreviewPage').then((module) => ({
    default: module.VendorOnboardingPreviewPage,
  })),
)

export function AppRouter() {
  return (
    <BrowserRouter>
      <RouteErrorBoundary>
        <Routes>
          {VendorBillingPreviewPage ? (
            <Route path="dev/vendor-billing" element={<Suspense fallback={<PageLoaderScreen />}><VendorBillingPreviewPage /></Suspense>} />
          ) : null}
          {/* Local-only vendor onboarding prototype: outside auth guards, with its shared public header owned by the page. */}
          <Route path="onboarding" element={<Suspense fallback={<PageLoaderScreen />}><VendorOnboardingPage /></Suspense>} />
          <Route path="onboarding/preview/:draftSlug" element={<Suspense fallback={<PageLoaderScreen />}><VendorOnboardingPreviewPage /></Suspense>} />

          {/* Vendor dashboard — its own chrome, outside the customer header and cart. */}
          <Route element={<ProtectedRoute roles={['vendor']} />}>
            <Route
              path="vendor"
              element={
                <Suspense fallback={<PageLoaderScreen />}>
                  <VendorShell />
                </Suspense>
              }
            >
              <Route index element={<VendorOverviewPage />} />
              <Route path="orders" element={<VendorOrdersPage />} />
              <Route path="orders/subscriptions" element={<VendorSubscriptionsPage />} />
              <Route path="orders/:orderId" element={<VendorOrderDetailPage />} />
              <Route path="products" element={<VendorProductsPage />} />
              <Route path="plan" element={<VendorPlanPage />} />
              <Route path="storefront" element={<VendorStorefrontPage />} />
              <Route path="settings" element={<VendorSettingsPage />} />
            </Route>
          </Route>

          {/* Marketing homepage — own chrome matching brand landing */}
          <Route element={<MarketingLayout />}>
            <Route index element={<MarketingHomePage />} />
          </Route>

          <Route path="login" element={<LoginPage />} />
          <Route path="vendor/login" element={<VendorLoginPage />} />
          <Route path="register" element={<RegisterPage />} />

          <Route element={<StorefrontLayout />}>
            <Route path="stores/:storeId" element={<StoreDetailPage />} />
            <Route path="stores/:storeId/contact" element={<StoreContactPage />} />
            <Route path="stores/:storeId/products/:productId" element={<ProductDetailPage />} />
            <Route path="stores/:storeId/cart" element={<CartPage />} />
            <Route path="stores/:storeId/location" element={<LocationMapPage />} />
            <Route path="stores/:storeId/checkout" element={<CheckoutPage />} />
            <Route path="stores/:storeId/orders/:orderId/success" element={<OrderSuccessPage />} />
            <Route path="stores/:storeId/orders/:orderId" element={<OrderDetailPage />} />
            <Route path="stores/:storeId/orders" element={<OrdersPage />} />
          </Route>

          <Route element={<RootLayout />}>
            <Route path="stores" element={<StoreListPage />} />
            <Route path="cart" element={<CartPage />} />
            <Route element={<ProtectedRoute roles={['customer']} />}>
              <Route path="checkout" element={<CheckoutPage />} />
              <Route path="orders" element={<OrdersPage />} />
            </Route>

            <Route path="home" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </RouteErrorBoundary>
    </BrowserRouter>
  )
}
