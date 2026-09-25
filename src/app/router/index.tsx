import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { RootLayout } from '@/app/layouts'
import { ProtectedRoute } from '@/app/router/ProtectedRoute'
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
import { StoreDetailPage } from '@/modules/storefront/pages/StoreDetailPage'
import { StoreListPage } from '@/modules/storefront/pages/StoreListPage'
import { LoginPage } from '@/shared/auth/pages/LoginPage'
import { RegisterPage } from '@/shared/auth/pages/RegisterPage'
import { VendorLoginPage } from '@/shared/auth/pages/VendorLoginPage'
import { Spinner } from '@/shared/components/ui'

const VendorShell = lazy(() =>
  import('@/modules/vendor/components/VendorShell').then((module) => ({
    default: module.VendorShell,
  })),
)
const VendorOverviewPage = lazy(() =>
  import('@/modules/vendor/pages/VendorOverviewPage').then((module) => ({
    default: module.VendorOverviewPage,
  })),
)
const VendorOrdersPage = lazy(() =>
  import('@/modules/vendor/pages/VendorOrdersPage').then((module) => ({
    default: module.VendorOrdersPage,
  })),
)
const VendorOrderDetailPage = lazy(() =>
  import('@/modules/vendor/pages/VendorOrderDetailPage').then((module) => ({
    default: module.VendorOrderDetailPage,
  })),
)
const VendorSubscriptionsPage = lazy(() =>
  import('@/modules/vendor/pages/VendorSubscriptionsPage').then((module) => ({
    default: module.VendorSubscriptionsPage,
  })),
)
const VendorProductsPage = lazy(() =>
  import('@/modules/vendor/pages/VendorProductsPage').then((module) => ({
    default: module.VendorProductsPage,
  })),
)
const VendorPlanPage = lazy(() =>
  import('@/modules/vendor/pages/VendorPlanPage').then((module) => ({
    default: module.VendorPlanPage,
  })),
)
const VendorStorefrontPage = lazy(() =>
  import('@/modules/vendor/pages/VendorStorefrontPage').then((module) => ({
    default: module.VendorStorefrontPage,
  })),
)
const VendorSettingsPage = lazy(() =>
  import('@/modules/vendor/pages/VendorSettingsPage').then((module) => ({
    default: module.VendorSettingsPage,
  })),
)
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

function OnboardingRouteFallback() {
  return <div className="min-h-screen bg-slate-50"><Spinner label="Loading onboarding…" /></div>
}

function VendorRouteFallback() {
  return <div className="min-h-screen bg-slate-50"><Spinner label="Loading your dashboard…" /></div>
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Local-only vendor onboarding prototype: outside auth guards, with its shared public header owned by the page. */}
        <Route path="onboarding" element={<Suspense fallback={<OnboardingRouteFallback />}><VendorOnboardingPage /></Suspense>} />
        <Route path="onboarding/preview/:draftSlug" element={<Suspense fallback={<OnboardingRouteFallback />}><VendorOnboardingPreviewPage /></Suspense>} />

        {/* Vendor dashboard — its own chrome, outside the customer header and cart. */}
        <Route element={<ProtectedRoute roles={['vendor']} />}>
          <Route
            path="vendor"
            element={
              <Suspense fallback={<VendorRouteFallback />}>
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
    </BrowserRouter>
  )
}
