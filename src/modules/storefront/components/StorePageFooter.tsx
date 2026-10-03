import { StorefrontFooter } from './StorefrontFooter'
import type { Store } from '@/modules/storefront/types'

export function StorePageFooter({
  store,
  location,
  tagline,
}: {
  store: Store
  location?: string | null
   tagline?: string | null
}) {
  return (
    <StorefrontFooter
      storeName={store.name}
      logoUrl={store.theme?.logoImage}
      tagline={tagline === null ? undefined : tagline ?? store.tagline ?? store.category}
      location={location === null ? undefined : location ?? store.location}
    />
  )
}
