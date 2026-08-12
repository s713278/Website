import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { configureApiClient } from '@/shared/api/config'
import { useAuthStore } from '@/shared/auth/store/auth-store'

export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    configureApiClient({
      onUnauthorized: () => {
        void useAuthStore.getState().logout()
      },
    })
  }, [])

  return children
}
