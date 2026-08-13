import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { configureApiClient, setApiErrorLogger } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'

export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Sanitized error hook — swap for telemetry later; never logs tokens/PII fields.
    setApiErrorLogger((payload) => {
      console.error('[api]', payload)
    })

    configureApiClient({
      onUnauthorized: () => {
        void useAuthStore.getState().logout()
      },
    })
  }, [])

  return children
}
