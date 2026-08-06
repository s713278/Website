import { useMutation } from '@tanstack/react-query';
import { getErrorMessage } from '@mithra/api-client';
import {
  requestOnboardingOtp,
  verifyOnboardingOtp,
} from '@/features/onboarding/api/auth';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useOnboardingStore } from '@/features/onboarding/store/onboarding-store';

export function useOnboardingRequestOtp() {
  const setError = useOnboardingStore((s) => s.setError);
  const clearError = useOnboardingStore((s) => s.clearError);

  return useMutation({
    mutationFn: (phone: string) => requestOnboardingOtp(phone),
    onMutate: () => clearError(),
    onSuccess: () => {
      const maxReached = useOnboardingStore.getState().maxReachedStep;
      useOnboardingStore.setState({
        currentStep: 2,
        maxReachedStep: Math.max(maxReached, 2),
        error: '',
      });
    },
    onError: (error) => {
      setError(getErrorMessage(error, 'Failed to send OTP. Please try again.'));
    },
  });
}

export function useOnboardingVerifyOtp() {
  const setError = useOnboardingStore((s) => s.setError);
  const clearError = useOnboardingStore((s) => s.clearError);
  const markVerified = useOnboardingStore((s) => s.markVerified);
  const setSession = useAuthStore((s) => s.setSession);
  const phone = useOnboardingStore((s) => s.phone);

  return useMutation({
    mutationFn: (otp: string) => verifyOnboardingOtp(phone, otp),
    onMutate: () => clearError(),
    onSuccess: (res) => {
      const data = (res.data || res) as {
        access_token?: string;
        refresh_token?: string;
        user?: { id?: string | number; name?: string; role?: string };
      };
      if (data.access_token) {
        setSession({
          accessToken: data.access_token,
          refreshToken: data.refresh_token || null,
          user: {
            id: String(data.user?.id || `vendor_${phone}`),
            phone,
            name: data.user?.name,
            role: 'vendor',
          },
        });
      }
      clearError();
      markVerified();
    },
    onError: (error) => {
      setError(getErrorMessage(error, 'OTP verification failed. Please try again.'));
    },
  });
}

export { getErrorMessage };
