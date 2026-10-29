export type UserRole = 'customer' | 'vendor'

/** One vendor the backend reported for this identity in the verify-otp `vendors` array. */
export type VendorMembership = {
  vendorId: string
  name?: string
}

export type User = {
  id: string
  name: string
  email: string
  /** 10-digit mobile from OTP login when available. */
  phone?: string
  /**
   * Active audience for this session. Always one of `roles` — the role requested on the
   * login screen is never enough on its own.
   */
  role: UserRole
  /** Every role the backend verified for this identity. */
  roles: UserRole[]
  /** Vendor memberships the backend returned. Empty for a customer-only identity. */
  vendors: VendorMembership[]
  /**
   * Vendor selected for vendor-scoped calls. Set only when the identity has exactly one
   * membership; a multi-vendor identity must choose explicitly.
   */
  vendorId?: string
}
