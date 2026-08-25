import { useLocation } from 'react-router-dom'
import { VendorLandingRedirect } from '@/app/router/VendorLandingRedirect'
import { OtpLoginForm } from '@/shared/auth/components/OtpLoginForm'
import { useAuthStore } from '@/shared/auth/store/auth-store'

export function LoginPage() {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from

  if (user?.role === 'customer') return <VendorLandingRedirect user={user} from={from} />

  return <OtpLoginForm role="customer" />
}
