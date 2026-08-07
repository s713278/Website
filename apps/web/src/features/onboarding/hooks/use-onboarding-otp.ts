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
      const state = useOnboardingStore.getState();
      // Advance only from step 1 → 2; resend on step 2 must not reset navigation.
      const nextStep = state.currentStep === 1 ? 2 : state.currentStep;
      useOnboardingStore.setState({
        currentStep: nextStep,
        maxReachedStep: Math.max(state.maxReachedStep, 2),
        error: '',
        publishError: '',
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
        offline?: boolean;
      };
      const token = data.access_token;
      if (token) {
        setSession({
          accessToken: token,
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
