import { Navigate } from 'react-router-dom'
import { OtpLoginForm } from '@/shared/auth/components/OtpLoginForm'
import { useAuthStore } from '@/shared/auth/store/auth-store'

export function VendorLoginPage() {
  const user = useAuthStore((s) => s.user)

  if (user?.role === 'vendor') {
    return <Navigate to="/vendor" replace />
  }

  return <OtpLoginForm role="vendor" />
}
