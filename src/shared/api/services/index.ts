export {
  AUTH_REG_PLATFORM,
  OTP_LENGTH,
  OTP_RESEND_SECONDS,
  authService,
  DEMO_CREDENTIALS,
  digitsPhone,
  getProfile,
  isValidMobile,
  login,
  register,
  refreshToken,
  requestOtp,
  sessionDisplayName,
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
