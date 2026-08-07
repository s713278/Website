import {
  authService,
  type MobileSignUpRequest,
  type OTPVerificationRequest,
} from '@mithra/api-client';
import { env } from '@/shared/lib/env';

const COUNTRY_CODE = '+91';

/** Build OpenAPI MobileSignUpRequest for vendor onboarding. */
export function buildRequestOtpBody(mobileNumber: string): MobileSignUpRequest {
  return {
    country_code: COUNTRY_CODE,
    mobile_number: mobileNumber,
    reg_platform: 'Web',
    user_role: 'VENDOR',
  };
}

/** Build OpenAPI OTPVerificationRequest for vendor onboarding. */
export function buildVerifyOtpBody(mobileNumber: string, otp: string): OTPVerificationRequest {
  return {
    country_code: COUNTRY_CODE,
    mobile_number: Number(mobileNumber),
    otp,
  };
}

export type OnboardingOtpResult = {
  access_token?: string;
  refresh_token?: string;
  user?: { id?: string | number; name?: string; role?: string };
  offline?: boolean;
};

/** Request OTP — offline mode resolves immediately without hitting the API. */
export async function requestOnboardingOtp(mobileNumber: string) {
  if (!env.useApi) {
    return { data: { offline: true, mobile_number: mobileNumber } };
  }
  return authService.requestOtp(buildRequestOtpBody(mobileNumber));
}

/**
 * Verify OTP. Offline / demo: any 4-digit code succeeds with a local session token.
 * API mode: verify remotely; if the envelope lacks a token, still allow a demo session
 * only when the network call succeeded (handled by caller via access_token presence).
 */
export async function verifyOnboardingOtp(
  mobileNumber: string,
  otp: string,
): Promise<{ data: OnboardingOtpResult }> {
  if (!env.useApi) {
    if (!/^\d{4}$/.test(otp)) {
      throw new Error('Enter the 4-digit OTP');
    }
    return {
      data: {
        offline: true,
        access_token: `demo_vendor_${mobileNumber}`,
        refresh_token: null as unknown as string | undefined,
        user: {
          id: `vendor_${mobileNumber}`,
          name: 'Vendor',
          role: 'vendor',
        },
      },
    };
  }

  const res = await authService.verifyOtp(buildVerifyOtpBody(mobileNumber, otp));
  const data = ((res as { data?: OnboardingOtpResult }).data || res) as OnboardingOtpResult;
  return { data };
}
