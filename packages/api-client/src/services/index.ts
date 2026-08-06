export { authService } from './auth';
export {
  requestOtp,
  verifyOtp,
  refreshToken,
  getProfile,
  signOut,
  type MobileSignUpRequest,
  type OTPVerificationRequest,
  type RefreshTokenRequest,
} from './auth';

export { vendorsService } from './vendors';
export { catalogService } from './catalog';
export { cartService } from './cart';
export { ordersService } from './orders';
export { usersService } from './users';
export { storefrontService } from './storefront';
export type {
  StorefrontTheme,
  StorefrontBadge,
  StorefrontFulfillment,
  StorefrontCategory,
} from './storefront';
export { subscriptionsService } from './subscriptions';
export { courierService, imagesService, platformService } from './platform';
export { socialService } from './social';
export { adminService } from './admin';
export type {
  VendorStorefront,
  DeliveryEligibility,
  CreateOrderFromCartRequest,
  StorefrontProduct,
} from './legacy';
export {
  createVendor,
  getVendor,
  updateVendor,
  patchVendorStatus,
  putCheckoutOptions,
  getCheckoutOptions,
  getVendorProducts,
  getVendorProductSkus,
  searchVendorSkus,
  getVendorStorefront,
  checkDeliveryEligibility,
  uploadVendorImage,
  createSku,
  getCart,
  addCartItem,
  upsertCartItem,
  updateCartItem,
  removeCartItem,
  clearCart,
  createOrderFromCart,
  getOrder,
  getVendorOrders,
  getCategories,
  getCategoriesGrouped,
  getPublicStoreBySlug,
  loadVendorStorefront,
} from './legacy';
