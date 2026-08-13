import type { User } from '@/shared/types'
import {
  DEMO_CREDENTIALS,
  demoLogin,
  demoRegister,
  type AuthSession,
  type LoginInput,
  type RegisterInput,
} from '@/shared/auth/api/demo-auth'
import { apiGet, apiPost, unwrapData } from '../client'
import { toApiError } from '../errors'
import { isLiveApi } from '../mode'
import { clearTokens, getAccessToken, parseTokenResponse, setTokens } from '../tokens'
import type { ApiEnvelope } from '../types'

export type { LoginInput, RegisterInput, AuthSession }
export { DEMO_CREDENTIALS }

export type OtpRequestInput = {
  phone: string
  role: User['role']
  countryCode?: string
}

export type OtpVerifyInput = {
  phone: string
  otp: string
  role?: User['role']
  countryCode?: string
}

/** POST /v1/auth/request-otp */
export async function requestOtp(input: OtpRequestInput) {
  if (!isLiveApi()) {
    await new Promise((r) => setTimeout(r, 300))
    return { success: true, message: 'Demo OTP sent (use 1234)' }
  }

  return apiPost<ApiEnvelope>(
    '/v1/auth/request-otp',
    {
      country_code: input.countryCode || '+91',
      mobile_number: input.phone,
      reg_platform: 'Web',
      user_role: input.role === 'customer' ? 'USER' : 'VENDOR',
    },
    { skipAuth: true },
  )
}

/** POST /v1/auth/verify-otp */
export async function verifyOtp(input: OtpVerifyInput): Promise<AuthSession> {
  if (!isLiveApi()) {
    await new Promise((r) => setTimeout(r, 300))
    if (input.otp !== '1234') throw toApiError(new Error('Invalid OTP'), '/v1/auth/verify-otp', 401)
    const role = input.role || 'customer'
    const session: AuthSession = {
      token: `demo-otp-${input.phone}`,
      refreshToken: null,
      user: {
        id: `u-${input.phone}`,
        name: role === 'vendor' ? 'Demo Vendor' : 'Demo Customer',
        email: `${input.phone}@demo.local`,
        role,
        vendorId: role === 'vendor' ? 'r1' : undefined,
      },
    }
    setTokens(session.token, session.refreshToken)
    return session
  }

  const res = await apiPost<ApiEnvelope<Record<string, unknown>>>(
    '/v1/auth/verify-otp',
    {
      country_code: input.countryCode || '+91',
      mobile_number: Number(input.phone),
      otp: input.otp,
    },
    { skipAuth: true },
  )

  const parsed = parseTokenResponse(res)
  if (!parsed.accessToken) {
    throw toApiError(new Error('Login response missing access token'), '/v1/auth/verify-otp')
  }

  setTokens(parsed.accessToken, parsed.refreshToken)
  const data = unwrapData(res) || {}
  const record = data as Record<string, unknown>
  const nestedUser = (record.user || {}) as Partial<User>

  return {
    token: parsed.accessToken,
    refreshToken: parsed.refreshToken,
    user: {
      id: String(nestedUser.id || `u-${input.phone}`),
      name: nestedUser.name || 'User',
      email: nestedUser.email || `${input.phone}@mithra.local`,
      role: input.role || nestedUser.role || 'customer',
      vendorId: nestedUser.vendorId,
    },
  }
}

/** Email/password for demo UI; live mode uses OTP endpoints above. */
export async function login(input: LoginInput): Promise<AuthSession> {
  if (isLiveApi()) {
    throw toApiError(
      new Error(
        'Live API uses OTP login. Call requestOtp / verifyOtp, or set VITE_USE_API=false for demo email login.',
      ),
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
    throw toApiError(
      new Error('Live registration uses OTP. Set VITE_USE_API=false for demo register.'),
      '/auth/register',
      400,
    )
  }

  const session = await demoRegister(input)
  setTokens(session.token, null)
  return session
}

export async function getProfile<T = User>() {
  return apiGet<ApiEnvelope<T>>('/v1/auth/profile')
}

export async function signOut() {
  try {
    // skipRefresh: failed refresh already cleared tokens — avoid 401 → refresh → logout loop
    if (isLiveApi() && getAccessToken()) {
      await apiPost('/v1/auth/signout', undefined, { skipRefresh: true })
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
  getProfile,
  signOut,
}
