export {
  AUTH_REG_PLATFORM,
  AuthSessionError,
  OTP_LENGTH,
  OTP_RESEND_SECONDS,
  authService,
  DEMO_CREDENTIALS,
  DEMO_OTP,
  digitsPhone,
  getProfile,
  isValidMobile,
  onCredentialsRefused,
  login,
  register,
  refreshToken,
  requestOtp,
  sessionDisplayName,
  signOut,
  verifyOtp,
  type AuthSession,
  type AuthSessionProblem,
  type LoginInput,
  type OtpRequestInput,
  type OtpVerifyInput,
  type RegisterInput,
} from './auth.service'

export {
  catalogService,
  getStore,
  listLandingStores,
  listStoreProducts,
  listStores,
} from './catalog.service'
export { cartService } from './cart.service'
export {
  listMyOrders,
  ordersService,
  placeOrder,
  type CustomerOrder,
  type PlaceOrderInput,
} from './orders.service'
export {
  getVendorInsights,
  getVendorStoreProfile,
  vendorService,
} from './vendor.service'
export {
  cancelVendorOrder,
  getVendorOrder,
  listVendorOrders,
  updateVendorOrder,
  vendorOrdersService,
  type VendorOrderQuery,
} from './vendor-orders.service'
export {
  listVendorSizes,
  updateSizePrice,
  vendorProductsService,
} from './vendor-products.service'
export { demoService, type DemoStoreStateKey } from './demo.service'
export { vendorOnboardingService } from './vendor-onboarding.service'
export type { ReferenceRequestConfig } from './vendor-onboarding.service'
