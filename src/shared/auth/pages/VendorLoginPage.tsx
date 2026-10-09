import { useState } from 'react'
import { VendorLandingRedirect } from '@/app/router/VendorLandingRedirect'
import { OtpLoginForm } from '@/shared/auth/components/OtpLoginForm'
import { useAuthStore } from '@/shared/auth/store/auth-store'

export function VendorLoginPage() {
  const user = useAuthStore((s) => s.user)
  // Only a vendor already signed in on arrival is redirected from here. A sign-in on this page
  // is left to the form, which routes from the `verify-otp` snapshot; swapping it for the
  // redirect would discard that and wait on the vendor context instead.
  const [signedInOnArrival] = useState(() => user?.role === 'vendor')

  // A vendor who already finished setup belongs on their dashboard, not back in it.
  if (signedInOnArrival && user?.role === 'vendor') return <VendorLandingRedirect user={user} />

  return <OtpLoginForm role="vendor" />
}
