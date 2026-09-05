import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { applyPendingCartAdd } from '@/modules/storefront/lib/apply-pending-cart-add'
import { useAuthStore } from '@/shared/auth/store/auth-store'

export function StorefrontLayout() {
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    if (user?.role !== 'customer') return
    applyPendingCartAdd()
  }, [user?.id, user?.role])

  return (
    <div data-store-mode="light" className="store-shell flex min-h-screen flex-col">
      <Outlet />
    </div>
  )
}