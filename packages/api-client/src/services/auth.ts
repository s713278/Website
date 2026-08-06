import { apiGet, apiPost, unwrapData } from '../client/http';
import { clearTokens, parseTokenResponse, setTokens } from '../client/tokens';
import type { ApiEnvelope } from '../client/types';
import type {
  MobileSignUpRequest,
  OTPVerificationRequest,
  RefreshTokenRequest,
} from '../schema-types';

export type { MobileSignUpRequest, OTPVerificationRequest, RefreshTokenRequest };

/** POST /v1/auth/request-otp */
export async function requestOtp(body: MobileSignUpRequest) {
  return apiPost<ApiEnvelope>('/v1/auth/request-otp', body, { skipAuth: true });
}

/** POST /v1/auth/verify-otp — stores tokens on success */
export async function verifyOtp(body: OTPVerificationRequest) {
  const res = await apiPost<ApiEnvelope<Record<string, unknown>>>('/v1/auth/verify-otp', body, {
    skipAuth: true,
  });
  const parsed = parseTokenResponse(res);
  if (parsed.accessToken) setTokens(parsed.accessToken, parsed.refreshToken);
  return res;
}

/** POST /v1/auth/refresh */
export async function refreshToken(body: RefreshTokenRequest) {
  const res = await apiPost<ApiEnvelope<Record<string, unknown>>>('/v1/auth/refresh', body, {
    skipAuth: true,
    skipRefresh: true,
  });
  const parsed = parseTokenResponse(res);
  if (parsed.accessToken) setTokens(parsed.accessToken, parsed.refreshToken ?? body.refresh_token);
  return res;
}

/** GET /v1/auth/profile */
export async function getProfile<T = unknown>() {
  return apiGet<ApiEnvelope<T>>('/v1/auth/profile');
}

/** POST /v1/auth/signout */
export async function signOut() {
  try {
    await apiPost('/v1/auth/signout', undefined);
  } finally {
    clearTokens();
  }
}

export const authService = {
  requestOtp,
  verifyOtp,
  refreshToken,
  getProfile,
  signOut,
  unwrap: unwrapData,
};
