import type { CustomerOrder } from '@/shared/api'

export function orderBelongsToStore(order: Pick<CustomerOrder, 'storeId'>, storeId: string) {
  return !order.storeId || order.storeId === storeId
}

export function mergeOrderPages(current: CustomerOrder[], incoming: CustomerOrder[]) {
  const seen = new Set(current.map((order) => order.id))
  const next = [...current]
  for (const order of incoming) {
    if (seen.has(order.id)) continue
    seen.add(order.id)
    next.push(order)
  }
  return next
}

export type HistoryPageSnap = {
  orders: CustomerOrder[]
  pageNumber: number
  lastPage: boolean
}

/**
 * history/paged has no vendor filter. Walk pages until this shop has rows or last_page.
 */
export async function collectStoreOrdersFromPages(input: {
  storeId: string
  startPage: number
  fetchPage: (page: number) => Promise<HistoryPageSnap>
  isCancelled?: () => boolean
}): Promise<HistoryPageSnap> {
  let page = Math.max(0, input.startPage)
  const matched: CustomerOrder[] = []
  let pageNumber = page
  let lastPage = true

  while (!input.isCancelled?.()) {
    const snap = await input.fetchPage(page)
    if (input.isCancelled?.()) break
    pageNumber = snap.pageNumber
    lastPage = snap.lastPage
    matched.push(...snap.orders.filter((order) => orderBelongsToStore(order, input.storeId)))
    if (matched.length > 0 || snap.lastPage) break
    page += 1
  }

  return { orders: matched, pageNumber, lastPage }
}
