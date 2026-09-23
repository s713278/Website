import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { applyPendingCartAdd } from '@/modules/storefront/lib/apply-pending-cart-add'
import { syncVendorCart } from '@/modules/storefront/lib/cart-actions'
import { listCachedStoreProducts } from '@/modules/storefront/lib/product-catalog-cache'
import { readPendingCartAdd } from '@/modules/storefront/lib/pending-cart-add'
import { storeIdFromPath } from '@/modules/storefront/lib/store-paths'
import { getCachedStore } from '@/modules/storefront/hooks/useStorePage'
import { isLiveApi } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'

export function StorefrontLayout() {
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    if (user?.role !== 'customer') return
    let cancelled = false

    void (async () => {
      const pending = readPendingCartAdd()
      const storeId = pending?.vendorId ?? storeIdFromPath(window.location.pathname)
      if (storeId && isLiveApi()) {
        const storeName = pending?.storeName || getCachedStore(storeId)?.name || ''
        try {
          await syncVendorCart(storeId, storeName, listCachedStoreProducts(storeId))
        } catch {
          /* pending add can still run */
        }
      }
      if (cancelled) return
      await applyPendingCartAdd().catch(() => {
        // pending restored inside apply on failure
      })
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id, user?.role])

  return (
    <div data-store-mode="light" className="store-shell flex min-h-screen flex-col">
      <Outlet />
    </div>
  )
}
