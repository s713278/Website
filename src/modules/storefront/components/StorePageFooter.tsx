import { StorefrontFooter } from './StorefrontFooter'
import type { Store } from '@/modules/storefront/types'

export function StorePageFooter({ store }: { store: Store }) {
  return (
    <StorefrontFooter
      storeName={store.name}
      logoUrl={store.theme?.logoImage}
      tagline={store.tagline ?? store.category}
    />
  )
}
