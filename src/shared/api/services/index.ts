export {
  authService,
  DEMO_CREDENTIALS,
  getProfile,
  login,
  register,
  requestOtp,
  signOut,
  verifyOtp,
  type AuthSession,
  type LoginInput,
  type OtpRequestInput,
  type OtpVerifyInput,
  type RegisterInput,
} from './auth.service'

export { catalogService, getStore, listStores } from './catalog.service'
export { cartService } from './cart.service'
export {
  listMyOrders,
  ordersService,
  placeOrder,
  type CustomerOrder,
  type PlaceOrderInput,
} from './orders.service'
export {
  getVendorDashboard,
  vendorService,
  type VendorDashboardStats,
} from './vendor.service'
export {
  listVendorOrders,
  updateVendorOrderStatus,
  vendorOrdersService,
} from './vendor-orders.service'
export {
  listVendorProducts,
  setProductAvailability,
  vendorProductsService,
} from './vendor-products.service'
export { vendorOnboardingService } from './vendor-onboarding.service'
export type { ReferenceRequestConfig } from './vendor-onboarding.service'
