import { VendorLandingRedirect } from '@/app/router/VendorLandingRedirect'
import { OtpLoginForm } from '@/shared/auth/components/OtpLoginForm'
import { useAuthStore } from '@/shared/auth/store/auth-store'

export function VendorLoginPage() {
  const user = useAuthStore((s) => s.user)

  // A vendor who already finished setup belongs on their dashboard, not back in it.
  if (user?.role === 'vendor') return <VendorLandingRedirect user={user} />

  return <OtpLoginForm role="vendor" />
}
