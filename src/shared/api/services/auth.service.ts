import {
  getProfile as apiGetProfile,
  refreshAccessToken,
  requestOtp as apiRequestOtp,
  unwrapData,
  verifyOtp as apiVerifyOtp,
} from '@mithra/api-client'
import type { User, UserRole } from '@/shared/types'
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

type VerifyOtpData = {
  user_id?: number | string
  name?: string | null
  phoneNumber?: string
  roles?: string[]
  vendors?: Array<{ vendor_id?: number | string; vendorId?: number | string; name?: string }>
  mobile_verified?: boolean
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

function firstVendorId(data: VerifyOtpData): string | undefined {
  const id = data.vendors?.[0]?.vendor_id ?? data.vendors?.[0]?.vendorId
  return id == null ? undefined : String(id)
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

/** Session role is the static login-page role (USER vs VENDOR), not inferred from other roles. */
function mapSessionUser(data: VerifyOtpData, input: OtpVerifyInput): User {
  const mobile = digitsPhone(input.phone)
  return {
    id: String(data.user_id ?? `u-${mobile}`),
    name: sessionDisplayName(input.role, data.name),
    email: `${mobile}@mithra.local`,
    role: input.role,
    vendorId: input.role === 'vendor' ? firstVendorId(data) : undefined,
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
  // Prefer parsed refresh; fall back to whatever verifyOtp already stored in localStorage.
  const refreshToken = parsed.refreshToken ?? getRefreshToken()
  return {
    token: parsed.accessToken,
    refreshToken,
    user: mapSessionUser(data, input),
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
  clearTokens()
  setTokens(session.token)
  return session
}

export async function register(input: RegisterInput): Promise<AuthSession> {
  if (isLiveApi()) {
    throw toApiError(new Error('Live registration uses OTP.'), '/auth/register', 400)
  }
  const session = await demoRegister(input)
  clearTokens()
  setTokens(session.token)
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
