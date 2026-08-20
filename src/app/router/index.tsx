import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { RootLayout, VendorLayout } from '@/app/layouts'
import { ProtectedRoute } from '@/app/router/ProtectedRoute'
import { MarketingLayout } from '@/modules/marketing/components/MarketingLayout'
import { MarketingHomePage } from '@/modules/marketing/pages/MarketingHomePage'
import { NotFoundPage } from '@/modules/marketing/pages/NotFoundPage'
import { CartPage } from '@/modules/storefront/pages/CartPage'
import { CheckoutPage } from '@/modules/storefront/pages/CheckoutPage'
import { OrdersPage } from '@/modules/storefront/pages/OrdersPage'
import { StoreDetailPage } from '@/modules/storefront/pages/StoreDetailPage'
import { StoreListPage } from '@/modules/storefront/pages/StoreListPage'
import { VendorDashboardPage } from '@/modules/vendor/pages/VendorDashboardPage'
import { VendorOrdersPage } from '@/modules/vendor/pages/VendorOrdersPage'
import { VendorProductsPage } from '@/modules/vendor/pages/VendorProductsPage'
import { LoginPage } from '@/shared/auth/pages/LoginPage'
import { RegisterPage } from '@/shared/auth/pages/RegisterPage'
import { Spinner } from '@/shared/components/ui'

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

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Local-only vendor onboarding prototype: outside auth guards, with its shared public header owned by the page. */}
        <Route path="onboarding" element={<Suspense fallback={<OnboardingRouteFallback />}><VendorOnboardingPage /></Suspense>} />
        <Route path="onboarding/preview/:draftSlug" element={<Suspense fallback={<OnboardingRouteFallback />}><VendorOnboardingPreviewPage /></Suspense>} />

        {/* Marketing homepage — own chrome matching brand landing */}
        <Route element={<MarketingLayout />}>
          <Route index element={<MarketingHomePage />} />
        </Route>

        <Route element={<RootLayout />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />

          <Route path="stores" element={<StoreListPage />} />
          <Route path="stores/:storeId" element={<StoreDetailPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route element={<ProtectedRoute roles={['customer']} />}>
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="orders" element={<OrdersPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={['vendor']} />}>
            <Route path="vendor" element={<VendorLayout />}>
              <Route index element={<VendorDashboardPage />} />
              <Route path="orders" element={<VendorOrdersPage />} />
              <Route path="products" element={<VendorProductsPage />} />
            </Route>
          </Route>

          <Route path="home" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
