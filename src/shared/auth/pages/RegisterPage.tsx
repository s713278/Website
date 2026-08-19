import { Navigate } from 'react-router-dom'
import { homePathForUser, loginPathForRole } from '@/app/router/role-home'
import { useAuthStore } from '@/shared/auth/store/auth-store'

/** OTP is signup. /register is a stable vendor-setup entry. */
export function RegisterPage() {
  const user = useAuthStore((s) => s.user)
  console.log('Registerpage user',user)
  if (user) return <Navigate to={homePathForUser(user)} replace />
  return <Navigate to={loginPathForRole('vendor')} replace />
}
