import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  authService,
  getErrorMessage,
  type MobileSignUpRequest,
  type OTPVerificationRequest,
} from '@mithra/api-client';
import { queryKeys } from '@/shared/api/query-keys';
import { useAuthStore } from '@/features/auth/store/auth-store';

export function useAuthProfile(enabled = true) {
  return useQuery({
    queryKey: queryKeys.auth.profile(),
    queryFn: () => authService.getProfile(),
    enabled,
  });
}

export function useRequestOtpMutation() {
  return useMutation({
    mutationFn: (body: MobileSignUpRequest) => authService.requestOtp(body),
    meta: { errorMessage: 'Failed to send OTP' },
  });
}

export function useVerifyOtpMutation() {
  const setSession = useAuthStore((s) => s.setSession);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (body: OTPVerificationRequest) => authService.verifyOtp(body),
    onSuccess: async (res, vars) => {
      const data = (res.data || res) as {
        access_token?: string;
        refresh_token?: string;
        user?: { id?: string; name?: string; role?: string };
      };
      const access = data.access_token;
      if (access) {
        setSession({
          accessToken: access,
          refreshToken: data.refresh_token || null,
          user: {
            id: String(data.user?.id || `user_${vars.mobile_number}`),
            phone: String(vars.mobile_number),
            name: data.user?.name,
            role: (data.user?.role as 'customer' | 'vendor' | 'admin') || 'customer',
          },
        });
      }
      await qc.invalidateQueries({ queryKey: queryKeys.auth.all });
    },
  });
}

export function useSignOutMutation() {
  const clearSession = useAuthStore((s) => s.clearSession);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => authService.signOut(),
    onSettled: async () => {
      clearSession();
      await qc.clear();
    },
  });
}

export { getErrorMessage };
