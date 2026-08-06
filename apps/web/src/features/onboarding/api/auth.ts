import {
  authService,
  type MobileSignUpRequest,
  type OTPVerificationRequest,
} from '@mithra/api-client';

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

export async function requestOnboardingOtp(mobileNumber: string) {
  return authService.requestOtp(buildRequestOtpBody(mobileNumber));
}

export async function verifyOnboardingOtp(mobileNumber: string, otp: string) {
  return authService.verifyOtp(buildVerifyOtpBody(mobileNumber, otp));
}
