import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { configureApiClient, setApiErrorLogger } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'

export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    setApiErrorLogger((payload) => {
      console.error('[api]', payload)
    })

    configureApiClient({
      // Failed refresh → clear local session only (no server signout / no logout loop)
      onUnauthorized: () => {
        useAuthStore.getState().clearSession()
      },
      // 403 → authenticated but not permitted for this resource. The session is still
      // valid, so keep it and let the feature decide what to show; signing out here
      // would throw away unsaved work.
      onForbidden: () => {
        useAuthStore.getState().setSessionProblem('forbidden')
      },
    })

    // Must run after configureApiClient so a restoration refresh uses the configured base URL.
    void useAuthStore.getState().restoreSession()
  }, [])

  return children
}
