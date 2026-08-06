import { useMutation } from '@tanstack/react-query';
import { requestOtp, signOutRemote, verifyOtp } from '@/features/auth/api/auth-api';
import { useAuthStore } from '@/features/auth/store/auth-store';
import type { OtpRequestValues, OtpVerifyValues } from '@/features/auth/schemas/auth-schemas';
import type { UserRole } from '@/shared/types';

export function useRequestOtp() {
  return useMutation({
    mutationFn: (values: OtpRequestValues) => requestOtp(values),
  });
}

export function useVerifyOtp() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: (values: OtpVerifyValues & { role?: UserRole }) => verifyOtp(values),
    onSuccess: (result) => {
      setSession({
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    },
  });
}

export function useSignOut() {
  const clearSession = useAuthStore((s) => s.clearSession);
  return useMutation({
    mutationFn: async () => {
      await signOutRemote();
      clearSession();
    },
  });
}
