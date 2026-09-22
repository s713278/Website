import type { Store } from '@/modules/storefront/types'

const CLOSED_SUBSCRIPTION = new Set(['HALTED', 'CANCELLED', 'EXPIRED'])

export function isStoreClosedForSubscription(status?: string | null): boolean {
  return CLOSED_SUBSCRIPTION.has((status ?? '').trim().toUpperCase())
}

export function storeClosedMessage(store: Pick<Store, 'name' | 'subscriptionStatus'>) {
  const status = (store.subscriptionStatus ?? '').toUpperCase()
  const name = store.name || 'This shop'

  if (status === 'EXPIRED') {
    return {
      title: "This shop isn't taking orders",
      body: `${name}'s subscription has expired. You can look at other shops nearby.`,
    }
  }
  if (status === 'CANCELLED') {
    return {
      title: 'This shop is closed',
      body: `${name} is no longer accepting orders.`,
    }
  }
  return {
    title: 'This shop is paused',
    body: `${name} isn't accepting orders right now. Please check back later.`,
  }
}
