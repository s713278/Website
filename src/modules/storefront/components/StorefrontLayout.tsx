import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { canShopAsCustomer } from '@/app/router/role-home'
import { applyPendingCartAdd } from '@/modules/storefront/lib/apply-pending-cart-add'
import { useAuthStore } from '@/shared/auth/store/auth-store'

/**
 * Shared storefront shell. Does not fetch storefront, catalog, or cart —
 * each page owns the APIs it needs. After login, only a pending add-to-cart is applied.
 */
export function StorefrontLayout() {
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    if (!canShopAsCustomer(user)) return
    void applyPendingCartAdd().catch(() => {
      // pending restored inside apply on failure
    })
  }, [user])

  return (
    <div data-store-mode="light" className="store-shell flex min-h-screen flex-col">
      <Outlet />
    </div>
  )
}
