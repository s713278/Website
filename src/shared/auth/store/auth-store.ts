import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  authService,
  clearTokens,
  setTokens,
  type LoginInput,
  type RegisterInput,
} from '@/shared/api'
import type { User } from '@/shared/types'

type AuthState = {
  user: User | null
  token: string | null
  isHydrated: boolean
  login: (input: LoginInput) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  logout: () => Promise<void>
  setHydrated: (value: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isHydrated: false,
      async login(input) {
        const session = await authService.login(input)
        setTokens(session.token, session.refreshToken ?? null)
        set({ user: session.user, token: session.token })
      },
      async register(input) {
        const session = await authService.register(input)
        setTokens(session.token, session.refreshToken ?? null)
        set({ user: session.user, token: session.token })
      },
      async logout() {
        try {
          await authService.signOut()
        } finally {
          clearTokens()
          set({ user: null, token: null })
        }
      },
      setHydrated(value) {
        set({ isHydrated: value })
      },
    }),
    {
      name: 'md-auth',
      partialize: (state) => ({ user: state.user, token: state.token }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) setTokens(state.token, null)
        state?.setHydrated(true)
      },
    },
  ),
)
