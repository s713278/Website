import { useLocation } from 'react-router-dom'
import { VendorLandingRedirect } from '@/app/router/VendorLandingRedirect'
import { getCachedStore } from '@/modules/storefront/hooks/useStorePage'
import { storeIdFromPath } from '@/modules/storefront/lib/store-paths'
import { OtpLoginForm } from '@/shared/auth/components/OtpLoginForm'
import { useAuthStore } from '@/shared/auth/store/auth-store'

type LoginLocationState = {
  from?: string
  shopName?: string
  shopLogoUrl?: string
}

export function LoginPage() {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()
  const state = (location.state as LoginLocationState | null) ?? {}
  const from = state.from
  const shopId = storeIdFromPath(from)
  const cached = shopId ? getCachedStore(shopId) : null
  const shopName = state.shopName || cached?.name
  const shopLogoUrl = state.shopLogoUrl || cached?.theme?.logoImage

  if (user?.role === 'customer') return <VendorLandingRedirect user={user} from={from} />

  return (
    <OtpLoginForm
      role="customer"
      shopName={shopName}
      shopLogoUrl={shopLogoUrl}
      from={from}
    />
  )
}
