import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  authService,
  clearTokens,
  getAccessToken,
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
  /** Choose the active vendor for a multi-membership identity. Ignores unknown IDs. */
  selectVendor: (vendorId: string) => void
  logout: () => Promise<void>
  setHydrated: (value: boolean) => void
  hasRole: (role: UserRole) => boolean
}

/**
 * Sessions persisted before verified roles and memberships existed carry neither field.
 * Rebuild both from the active role so an older md-auth entry cannot crash a selector, and
 * keep `vendorId` only when it matches a known membership.
 */
function normalizePersistedUser(user: User): User {
  const roles = Array.isArray(user.roles) && user.roles.length ? user.roles : [user.role]
  const vendors = Array.isArray(user.vendors) && user.vendors.length
    ? user.vendors
    : user.vendorId
      ? [{ vendorId: user.vendorId }]
      : []
  const vendorId = vendors.some((entry) => entry.vendorId === user.vendorId)
    ? user.vendorId
    : vendors.length === 1
      ? vendors[0].vendorId
      : undefined

  return { ...user, name: sessionDisplayName(user.role, user.name), roles, vendors, vendorId }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isHydrated: false,

      applySession(session) {
        setTokens(session.token, session.refreshToken ?? null)
        set({ user: session.user, token: session.token })
      },

      clearSession() {
        clearTokens()
        set({ user: null, token: null })
      },

      completeOtpLogin(session) {
        get().applySession(session)
      },

      selectVendor(vendorId) {
        set((state) => {
          if (!state.user?.vendors.some((entry) => entry.vendorId === vendorId)) return {}
          return { user: { ...state.user, vendorId } }
        })
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
          // Only hit server when we still have an access token
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
        return get().user?.roles?.includes(role) ?? false
      },
    }),
    {
      name: 'md-auth',
      // Persist user + access token for UI restore. Refresh token stays in api-client
      // localStorage key only (see docs/SESSION.md) — never wipe it on rehydrate.
      partialize: (state) => ({ user: state.user, token: state.token }),
      onRehydrateStorage: () => (state) => {
        if (!state) return

        const access = state.token || getAccessToken()
        if (access) {
          // Important: do NOT pass refresh=null — that cleared refresh on every reload.
          setTokens(access)
        }

        if (state.user) {
          state.user = normalizePersistedUser(state.user)
        }

        state.setHydrated(true)

        // Persisted user but no access token left → signed out
        queueMicrotask(() => {
          const current = useAuthStore.getState()
          if (current.user && !getAccessToken()) {
            current.clearSession()
          }
        })
      },
    },
  ),
)
