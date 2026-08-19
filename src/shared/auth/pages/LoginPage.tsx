import { Navigate, useLocation } from 'react-router-dom'
import { resumePathAfterLogin } from '@/app/router/role-home'
import { OtpLoginForm } from '@/shared/auth/components/OtpLoginForm'
import { useAuthStore } from '@/shared/auth/store/auth-store'

export function LoginPage() {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from

  if (user?.role === 'customer') {
    return <Navigate to={resumePathAfterLogin('customer', from)} replace />
  }

  return <OtpLoginForm role="customer" />
}
