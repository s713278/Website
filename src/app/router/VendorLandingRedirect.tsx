import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Spinner } from '@/shared/components/ui'
import type { User } from '@/shared/types'
import { landingPathIfKnown, resolveLandingPath } from './vendor-landing'

/**
 * Redirect an already-signed-in user away from a login screen, to wherever their account
 * says they belong. A vendor with a finished store never sees the setup wizard on the way
 * to their dashboard.
 *
 * The spinner is only for the case that genuinely needs a network read. A customer, demo
 * mode, or an account already cached resolves on the first render.
 */
export function VendorLandingRedirect({ user, from }: { user: User; from?: string | null }) {
  const [path, setPath] = useState(() => landingPathIfKnown(user, from))

  useEffect(() => {
    if (path) return
    let ignore = false
    void resolveLandingPath(user, from).then((resolved) => {
      if (!ignore) setPath(resolved)
    })
    return () => {
      ignore = true
    }
  }, [path, user, from])

  if (!path) return <Spinner label="Signing you in…" />
  return <Navigate to={path} replace />
}
