import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser, UserRole } from '@/shared/types';

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  setSession: (payload: {
    user: AuthUser;
    accessToken: string;
    refreshToken?: string | null;
  }) => void;
  clearSession: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
  isAuthenticated: () => boolean;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      hydrated: false,
      setHydrated: (value) => set({ hydrated: value }),
      setSession: ({ user, accessToken, refreshToken = null }) =>
        set({ user, accessToken, refreshToken }),
      clearSession: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
        }),
      hasRole: (...roles) => {
        const role = get().user?.role;
        return !!role && roles.includes(role);
      },
      isAuthenticated: () => Boolean(get().accessToken && get().user),
    }),
    {
      name: 'mithra_web_auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
