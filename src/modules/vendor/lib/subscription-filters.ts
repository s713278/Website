/** The four subscription states this v1 screen offers as server-side filters. */
export const SUBSCRIPTION_STATUS_FILTERS = [
  'PENDING',
  'ACTIVE',
  'DELETED',
  'EXPIRED',
] as const

export type SubscriptionFilterStatus = (typeof SUBSCRIPTION_STATUS_FILTERS)[number]

export type SubscriptionsQuery = {
  status: SubscriptionFilterStatus | null
  page: number
}

function isSubscriptionFilterStatus(value: string | null): value is SubscriptionFilterStatus {
  return SUBSCRIPTION_STATUS_FILTERS.some((status) => status === value)
}

export function readSubscriptionsQuery(params: URLSearchParams): SubscriptionsQuery {
  const rawStatus = params.get('status')?.toUpperCase() ?? null
  const rawPage = Number(params.get('page'))

  return {
    status: isSubscriptionFilterStatus(rawStatus) ? rawStatus : null,
    page: Number.isInteger(rawPage) && rawPage >= 0 ? rawPage : 0,
  }
}

export function writeSubscriptionsQuery(query: SubscriptionsQuery): URLSearchParams {
  const params = new URLSearchParams()
  if (query.status) params.set('status', query.status)
  if (query.page > 0) params.set('page', String(query.page))
  return params
}
