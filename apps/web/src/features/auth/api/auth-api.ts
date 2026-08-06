/**
 * Feature auth API — thin wrappers over @mithra/api-client.
 * Prefer React Query hooks from `@/shared/api`.
 */
import {
  authService,
  type MobileSignUpRequest,
  type OTPVerificationRequest,
} from '@mithra/api-client';
import type { AuthUser } from '@/shared/types';
import type { OtpRequestValues, OtpVerifyValues } from '@/features/auth/schemas/auth-schemas';

export async function requestOtp(values: OtpRequestValues) {
  const body: MobileSignUpRequest = {
    country_code: '+91',
    mobile_number: values.phone,
    reg_platform: 'Web',
    user_role: values.role === 'customer' ? 'CUSTOMER' : 'ADMIN',
  };
  return authService.requestOtp(body);
}

export async function verifyOtp(
  values: OtpVerifyValues & { role?: AuthUser['role'] },
): Promise<{
  accessToken: string;
  refreshToken: string | null;
  user: AuthUser;
}> {
  const body: OTPVerificationRequest = {
    country_code: '+91',
    mobile_number: values.phone,
    otp: values.otp,
  };
  const res = await authService.verifyOtp(body);
  const data = (res.data || res) as {
    access_token?: string;
    refresh_token?: string;
    token?: string;
    user?: Partial<AuthUser>;
  };
  const accessToken = data.access_token || data.token;
  if (!accessToken) {
    // Demo / offline fallback when API disabled or unexpected shape
    return {
      accessToken: `demo_${values.phone}`,
      refreshToken: null,
      user: {
        id: `user_${values.phone}`,
        phone: values.phone,
        name: 'Demo User',
        role: values.role || 'customer',
      },
    };
  }
  return {
    accessToken,
    refreshToken: data.refresh_token || null,
    user: {
      id: String(data.user?.id || `user_${values.phone}`),
      phone: values.phone,
      name: data.user?.name,
      role: values.role || data.user?.role || 'customer',
    },
  };
}

export async function signOutRemote() {
  await authService.signOut();
}
