import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  authService,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  sessionDisplayName,
  setTokens,
  type AuthSession,
  type LoginInput,
  type RegisterInput,
} from '@/shared/api'
import type { User, UserRole } from '@/shared/types'

type AuthState = {
  user: User | null
  token: string | null
  isHydrated: boolean
  /** Apply OTP / login / register session — syncs Zustand + api-client token store */
  applySession: (session: AuthSession) => void
  /** Local clear only (no server call) — used after failed refresh */
  clearSession: () => void
  login: (input: LoginInput) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  /** OTP verify helper — stores session for customer or vendor */
  completeOtpLogin: (session: AuthSession) => void
  logout: () => Promise<void>
  setHydrated: (value: boolean) => void
  hasRole: (role: UserRole) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isHydrated: false,

      applySession(session) {
        // Never pass refresh=null — that wipes mithra_refresh_token saved by verify-otp.
        if (session.refreshToken) {
          setTokens(session.token, session.refreshToken)
        } else {
          setTokens(session.token)
        }
        set({ user: session.user, token: session.token })
      },

      clearSession() {
        clearTokens()
        set({ user: null, token: null })
      },

      completeOtpLogin(session) {
        get().applySession(session)
      },

      async login(input) {
        const session = await authService.login(input)
        get().applySession(session)
      },

      async register(input) {
        const session = await authService.register(input)
        get().applySession(session)
      },

      async logout() {
        try {
          if (getAccessToken()) {
            await authService.signOut()
          }
        } catch {
          /* network/signout failures must not block local clear */
        } finally {
          get().clearSession()
        }
      },

      setHydrated(value) {
        set({ isHydrated: value })
      },

      hasRole(role) {
        return get().user?.role === role
      },
    }),
    {
      name: 'md-auth',
      // Persist user + access token for UI restore. Refresh token stays in api-client
      // localStorage key only (see docs/SESSION.md) — never wipe it on rehydrate.
      partialize: (state) => ({ user: state.user, token: state.token }),
      onRehydrateStorage: () => (state) => {
        if (!state) {
          useAuthStore.getState().setHydrated(true)
          return
        }

        const access = state.token || getAccessToken()
        if (access) {
          setTokens(access)
        }

        if (state.user) {
          state.user = {
            ...state.user,
            name: sessionDisplayName(state.user.role, state.user.name),
          }
        }

        state.setHydrated(true)

        queueMicrotask(() => {
          const current = useAuthStore.getState()
          if (current.user && !getAccessToken() && !getRefreshToken()) {
            current.clearSession()
          }
        })
      },
    },
  ),
)
