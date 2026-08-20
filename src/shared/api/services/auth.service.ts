import {
  getProfile as apiGetProfile,
  refreshAccessToken,
  requestOtp as apiRequestOtp,
  unwrapData,
  verifyOtp as apiVerifyOtp,
} from '@mithra/api-client'
import type { User, UserRole, VendorMembership } from '@/shared/types'
import {
  DEMO_CREDENTIALS,
  demoLogin,
  demoRegister,
  type AuthSession,
  type LoginInput,
  type RegisterInput,
} from '@/shared/auth/api/demo-auth'
import { apiPost } from '../client'
import { toApiError } from '../errors'
import { isLiveApi } from '../mode'
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  parseTokenResponse,
  setTokens,
} from '../tokens'

export type { LoginInput, RegisterInput, AuthSession }
export { DEMO_CREDENTIALS }

/** Ticket: public OTP auth always sends Web. */
export const AUTH_REG_PLATFORM = 'Web' as const

export const OTP_LENGTH = 4
export const OTP_RESEND_SECONDS = 30

export type OtpRequestInput = {
  phone: string
  role: UserRole
  countryCode?: string
}

export type OtpVerifyInput = {
  phone: string
  otp: string
  role: UserRole
  countryCode?: string
}

type VendorEntry = {
  vendor_id?: number | string
  vendorId?: number | string
  name?: string
}

type VerifyOtpData = {
  user_id?: number | string
  name?: string | null
  phoneNumber?: string
  roles?: string[]
  vendors?: VendorEntry[]
  mobile_verified?: boolean
}

/**
 * Why a verified session can still be refused. Callers map these to a specific screen
 * instead of a generic "login failed".
 */
export type AuthSessionProblem = 'mobile-unverified' | 'role-not-granted'

export class AuthSessionError extends Error {
  readonly problem: AuthSessionProblem

  constructor(problem: AuthSessionProblem, message: string) {
    super(message)
    this.name = 'AuthSessionError'
    this.problem = problem
  }
}

export function digitsPhone(phone: string) {
  return phone.replace(/\D/g, '').slice(-10)
}

export function isValidMobile(phone: string) {
  return /^[6-9]\d{9}$/.test(digitsPhone(phone))
}

function apiRole(role: UserRole) {
  return role === 'vendor' ? 'VENDOR' : 'USER'
}

/**
 * Map the backend's authority strings onto app roles. Unknown authorities (ADMIN,
 * CUSTOMER_CARE) are dropped rather than granted, and a `ROLE_` prefix is tolerated.
 */
function mapVerifiedRoles(raw: unknown): UserRole[] {
  if (!Array.isArray(raw)) return []
  const roles = new Set<UserRole>()
  for (const entry of raw) {
    const value = String(entry ?? '')
      .trim()
      .toUpperCase()
      .replace(/^ROLE_/, '')
    if (value === 'USER' || value === 'CUSTOMER') roles.add('customer')
    else if (value === 'VENDOR') roles.add('vendor')
  }
  return [...roles]
}

/** Normalise `vendors[]` into stable memberships, dropping entries without a usable ID. */
function mapVendorMemberships(raw: unknown): VendorMembership[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const memberships: VendorMembership[] = []
  for (const entry of raw as VendorEntry[]) {
    const rawId = entry?.vendor_id ?? entry?.vendorId
    if (rawId == null) continue
    const vendorId = String(rawId).trim()
    if (!vendorId || seen.has(vendorId)) continue
    seen.add(vendorId)
    const name = typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : undefined
    memberships.push({ vendorId, name })
  }
  return memberships
}

function isPhoneLikeName(value: string) {
  return digitsPhone(value).length === 10 || value.trim().startsWith('+')
}

/** Welcome User / Welcome Vendor — never show the mobile number as the display name. */
export function sessionDisplayName(role: UserRole, apiName?: string | null) {
  const trimmed = String(apiName || '').trim()
  if (trimmed && !isPhoneLikeName(trimmed)) return trimmed
  return role === 'vendor' ? 'Vendor' : 'User'
}

/**
 * Build the session from what the backend verified, not from what the login screen asked
 * for. `vendorId` is set only for an unambiguous single membership — picking `vendors[0]`
 * would silently choose a store for a multi-vendor identity.
 */
function mapSessionUser(
  data: VerifyOtpData,
  input: OtpVerifyInput,
  roles: UserRole[],
  vendors: VendorMembership[],
): User {
  const mobile = digitsPhone(input.phone)
  return {
    id: String(data.user_id ?? `u-${mobile}`),
    name: sessionDisplayName(input.role, data.name),
    email: `${mobile}@mithra.local`,
    role: input.role,
    roles,
    vendors,
    vendorId: input.role === 'vendor' && vendors.length === 1 ? vendors[0].vendorId : undefined,
  }
}

/** POST /v1/auth/request-otp via @mithra/api-client */
export async function requestOtp(input: OtpRequestInput) {
  const mobile = digitsPhone(input.phone)
  if (!isValidMobile(mobile)) {
    throw toApiError(new Error('Enter a valid 10-digit mobile number'), '/v1/auth/request-otp', 400)
  }

  return apiRequestOtp({
    country_code: input.countryCode || '+91',
    mobile_number: mobile,
    reg_platform: AUTH_REG_PLATFORM,
    user_role: apiRole(input.role),
  })
}

/** POST /v1/auth/verify-otp via @mithra/api-client — stores tokens on success */
export async function verifyOtp(input: OtpVerifyInput): Promise<AuthSession> {
  const mobile = digitsPhone(input.phone)
  const otp = input.otp.replace(/\D/g, '')

  const res = await apiVerifyOtp({
    country_code: input.countryCode || '+91',
    mobile_number: Number(mobile),
    otp,
  })

  const parsed = parseTokenResponse(res)
  if (!parsed.accessToken) {
    throw toApiError(new Error('Login response missing access token'), '/v1/auth/verify-otp')
  }

  const data = (unwrapData(res) || {}) as VerifyOtpData

  // An unverified phone must not produce a session even when tokens came back.
  if (data.mobile_verified !== true) {
    throw new AuthSessionError(
      'mobile-unverified',
      'This number is not verified yet. Request a new code and try again.',
    )
  }

  // The role chosen on the login screen is a request, not a grant.
  const roles = mapVerifiedRoles(data.roles)
  if (!roles.includes(input.role)) {
    throw new AuthSessionError(
      'role-not-granted',
      input.role === 'vendor'
        ? 'This number is not registered as a vendor yet.'
        : 'This number is not registered as a customer yet.',
    )
  }

  const vendors = mapVendorMemberships(data.vendors)
  return {
    token: parsed.accessToken,
    refreshToken: parsed.refreshToken,
    user: mapSessionUser(data, input, roles, vendors),
  }
}

/** Uses the shared interceptor refresh (single-flight). */
export async function refreshToken() {
  return refreshAccessToken()
}

/** Email/password kept for demo-only tooling; live UI uses OTP. */
export async function login(input: LoginInput): Promise<AuthSession> {
  if (isLiveApi()) {
    throw toApiError(
      new Error('Live API uses OTP login. Call requestOtp / verifyOtp.'),
      '/auth/login',
      400,
    )
  }
  const session = await demoLogin(input)
  setTokens(session.token, null)
  return session
}

export async function register(input: RegisterInput): Promise<AuthSession> {
  if (isLiveApi()) {
    throw toApiError(new Error('Live registration uses OTP.'), '/auth/register', 400)
  }
  const session = await demoRegister(input)
  setTokens(session.token, null)
  return session
}

export async function getProfile<T = User>() {
  return apiGetProfile<T>()
}

export async function signOut() {
  try {
    const refresh = getRefreshToken()
    if (getAccessToken() || refresh) {
      await apiPost('/v1/auth/signout', { refresh_token: refresh }, { skipRefresh: true })
    }
  } finally {
    clearTokens()
  }
}

export const authService = {
  login,
  register,
  requestOtp,
  verifyOtp,
  refreshToken,
  getProfile,
  signOut,
}
