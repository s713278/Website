import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { RootLayout, VendorLayout } from '@/app/layouts'
import { ProtectedRoute } from '@/app/router/ProtectedRoute'
import { CartPage } from '@/modules/storefront/pages/CartPage'
import { CheckoutPage } from '@/modules/storefront/pages/CheckoutPage'
import { OrdersPage } from '@/modules/storefront/pages/OrdersPage'
import { StoreDetailPage } from '@/modules/storefront/pages/StoreDetailPage'
import { StoreListPage } from '@/modules/storefront/pages/StoreListPage'
import { MarketingHomePage } from '@/modules/marketing/pages/MarketingHomePage'
import { NotFoundPage } from '@/modules/marketing/pages/NotFoundPage'
import { VendorDashboardPage } from '@/modules/vendor/pages/VendorDashboardPage'
import { VendorOrdersPage } from '@/modules/vendor/pages/VendorOrdersPage'
import { VendorProductsPage } from '@/modules/vendor/pages/VendorProductsPage'
import { LoginPage } from '@/shared/auth/pages/LoginPage'
import { RegisterPage } from '@/shared/auth/pages/RegisterPage'

function LegacyRestaurantRedirect() {
  const { storeId } = useParams()
  return <Navigate to={storeId ? `/stores/${storeId}` : '/stores'} replace />
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<RootLayout />}>
          {/* Marketing */}
          <Route index element={<MarketingHomePage />} />

          {/* Auth (shared) */}
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />

          {/* Storefront */}
          <Route path="stores" element={<StoreListPage />} />
          <Route path="stores/:storeId" element={<StoreDetailPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route element={<ProtectedRoute roles={['customer']} />}>
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="orders" element={<OrdersPage />} />
          </Route>

          {/* Vendor */}
          <Route element={<ProtectedRoute roles={['vendor']} />}>
            <Route path="vendor" element={<VendorLayout />}>
              <Route index element={<VendorDashboardPage />} />
              <Route path="orders" element={<VendorOrdersPage />} />
              <Route path="products" element={<VendorProductsPage />} />
            </Route>
          </Route>

          <Route path="restaurants" element={<Navigate to="/stores" replace />} />
          <Route path="restaurants/:storeId" element={<LegacyRestaurantRedirect />} />
          <Route path="home" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
