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
    })
  }, [])

  return children
}
