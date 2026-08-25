import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { RootLayout, VendorLayout } from '@/app/layouts'
import { ProtectedRoute } from '@/app/router/ProtectedRoute'
import { MarketingLayout } from '@/modules/marketing/components/MarketingLayout'
import { MarketingHomePage } from '@/modules/marketing/pages/MarketingHomePage'
import { NotFoundPage } from '@/modules/marketing/pages/NotFoundPage'
import { StorefrontLayout } from '@/modules/storefront/components'
import { CartPage } from '@/modules/storefront/pages/CartPage'
import { CheckoutPage } from '@/modules/storefront/pages/CheckoutPage'
import { LocationMapPage } from '@/modules/storefront/pages/LocationMapPage'
import { OrderSuccessPage } from '@/modules/storefront/pages/OrderSuccessPage'
import { OrdersPage } from '@/modules/storefront/pages/OrdersPage'
import { ProductDetailPage } from '@/modules/storefront/pages/ProductDetailPage'
import { StoreDetailPage } from '@/modules/storefront/pages/StoreDetailPage'
import { StoreListPage } from '@/modules/storefront/pages/StoreListPage'
import { VendorDashboardPage } from '@/modules/vendor/pages/VendorDashboardPage'
import { VendorOrdersPage } from '@/modules/vendor/pages/VendorOrdersPage'
import { VendorProductsPage } from '@/modules/vendor/pages/VendorProductsPage'
import { LoginPage } from '@/shared/auth/pages/LoginPage'
import { RegisterPage } from '@/shared/auth/pages/RegisterPage'
import { VendorLoginPage } from '@/shared/auth/pages/VendorLoginPage'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
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
          <Route element={<ProtectedRoute roles={['customer']} />}>
            <Route path="stores/:storeId/checkout" element={<CheckoutPage />} />
            <Route path="stores/:storeId/orders/:orderId/success" element={<OrderSuccessPage />} />
          </Route>
        </Route>

        <Route element={<RootLayout />}>
          <Route path="stores" element={<StoreListPage />} />
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
