import { StorefrontFooter } from './StorefrontFooter'
import type { Store } from '@/modules/storefront/types'

function displayPhone(phone?: string) {
  if (!phone) return undefined
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
  }
  return phone
}

export function StorePageFooter({ store }: { store: Store }) {
  return (
    <StorefrontFooter
      storeName={store.name}
      logoUrl={store.theme?.logoImage}
      tagline={store.tagline ?? store.category}
      phone={displayPhone(store.phone)}
    />
  )
}
