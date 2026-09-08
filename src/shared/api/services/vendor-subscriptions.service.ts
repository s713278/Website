import type { SubscriptionFilterStatus } from '@/modules/vendor/lib/subscription-filters'
import type { VendorSubscriptionPage } from '@/modules/vendor/types/dashboard'
import { apiGet } from '../client'
import { demoVendorSubscriptionsPage } from '../fixtures/vendor-dashboard'
import { mapVendorSubscriptionPage } from '../mappers/vendor-dashboard'
import { isLiveApi } from '../mode'
import { demoDelay } from './demo-delay'

const PAGE_SIZE = 10

export type VendorSubscriptionQuery = {
  page?: number
  status?: SubscriptionFilterStatus | null
}

/** One server-filtered page of the signed-in vendor's recurring subscriptions. */
export async function listVendorSubscriptions(
  vendorId: string | number,
  query: VendorSubscriptionQuery = {},
): Promise<VendorSubscriptionPage> {
  const page = query.page ?? 0

  if (!isLiveApi()) {
    await demoDelay()
    return mapVendorSubscriptionPage(
      demoVendorSubscriptionsPage(page, PAGE_SIZE, { status: query.status ?? undefined }),
    )
  }

  const params = new URLSearchParams({
    page_number: String(page),
    page_size: String(PAGE_SIZE),
  })
  if (query.status) params.set('status', query.status)

  return mapVendorSubscriptionPage(await apiGet(`/v1/vendors/${vendorId}/subs?${params}`))
}

export const vendorSubscriptionsService = {
  list: listVendorSubscriptions,
}
