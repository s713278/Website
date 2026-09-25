import type { CartLine } from '@/modules/storefront/types'
import { reverseGeocode as lookupAreaFromCoords } from '@/shared/lib/customer-location'
import { apiGet, apiPatch, apiPost } from '../client'
import { isLiveApi } from '../mode'
import {
  asNumericId,
  CUSTOMER_ORDER_HISTORY_PAGE_SIZE,
  extractAddressId,
  mapCreateOrderFromCartBody,
  mapCustomerOrderDetail,
  mapCustomerOrderHistoryPage,
  mapNameAndAddressRequest,
  mapPlacedOrder,
  parseLocationParts,
} from '../mappers/storefront-order'
import type { ApiEnvelope } from '../types'

export type CustomerOrderItem = {
  name: string
  qty: number
  itemId?: string
  imageUrl?: string
  size?: string
  unitPrice?: number
  listPrice?: number
  lineTotal?: number
  discount?: number
}

export type CustomerOrderBill = {
  itemsCount: number
  grossAmount: number
  discount: number
  deliveryCharges: number
  serviceCharge: number
  taxAmount: number
  amount: number
}

export type CustomerOrder = {
  id: string
  storeId?: string
  storeName: string
  total: number
  status: 'placed' | 'preparing' | 'on_the_way' | 'delivered' | string
  placedAt: string
  items: CustomerOrderItem[]
  addressId?: number
  paymentStatus?: string
  deliveryDate?: string
  deliveryMethod?: string
  notes?: string
  customerName?: string
  customerMobile?: string
  addressLine?: string
  bill?: CustomerOrderBill
}

export type PlaceOrderInput = {
  storeId: string
  storeName: string
  address: string
  phone: string
  note?: string
  lines: CartLine[]
  deliveryFee: number
  total: number
  userId?: string
  userName?: string
  addressId?: string | number | null
  lat?: number | null
  lng?: number | null
  city?: string | null
  country?: string | null
  zipCode?: string | null
  deliveryMethod?: string | null
  deliveryDate?: string | null
  orderTimingType?: string | null
  paymentTypeId?: string | null
  pickupSlot?: string | null
}

const ORDERS_KEY = 'md-customer-orders'
const SCHEDULED_TIMING = new Set(['FIXED_WINDOW', 'CUSTOMER_SELECT_DATE', 'PREDEFINED_DAYS'])

function mapOrderItems(lines: CartLine[]): CustomerOrderItem[] {
  return lines.map((line) => ({
    name: line.name,
    qty: line.qty,
    itemId: line.itemId,
    imageUrl: line.imageUrl,
  }))
}

function readDemoOrders(): CustomerOrder[] {
  try {
    return JSON.parse(localStorage.getItem(ORDERS_KEY) ?? '[]') as CustomerOrder[]
  } catch {
    return []
  }
}

function writeDemoOrders(orders: CustomerOrder[]) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders))
}

async function fillCheckoutAddress(input: PlaceOrderInput) {
  const parsed = parseLocationParts(input.address)
  let city = input.city?.trim() || parsed.city
  let zipCode = input.zipCode?.trim() || parsed.zipCode
  const country = input.country?.trim() || parsed.country || 'India'
  const lat = input.lat
  const lng = input.lng

  if ((!city || !zipCode) && lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    try {
      const area = await lookupAreaFromCoords(lat, lng)
      const areaZip = /^\d{6}$/.test(area.serviceArea)
        ? area.serviceArea
        : area.label.match(/\b(\d{6})\b/)?.[1]
      const areaCity = area.label.replace(/\b\d{6}\b/g, '').trim()
      city = city || (areaCity && !/^\d{6}$/.test(areaCity) ? areaCity : undefined)
      zipCode = zipCode || areaZip
    } catch {
      // Mapper rejects with a customer-facing message if city/pin are still missing.
    }
  }

  return {
    name: input.userName,
    location: input.address,
    lat,
    lng,
    city,
    country,
    zipCode,
  }
}

async function resolveAddressId(input: PlaceOrderInput): Promise<number | null> {
  const existing = asNumericId(input.addressId)
  if (existing) return existing

  const userId = asNumericId(input.userId)
  if (!userId) return null

  const path = `/v1/users/${userId}`
  const profile = await apiGet<ApiEnvelope<unknown>>(path)
  const fromProfile = extractAddressId(profile)
  if (fromProfile) return fromProfile

  const filled = await fillCheckoutAddress(input)
  const saved = await apiPatch<ApiEnvelope<unknown>>(
    path,
    mapNameAndAddressRequest(filled),
    { params: { setAsDefault: true } },
  )
  const fromSave = extractAddressId(saved)
  if (fromSave) return fromSave

  const refreshed = await apiGet<ApiEnvelope<unknown>>(path)
  return extractAddressId(refreshed)
}

export async function placeOrder(input: PlaceOrderInput): Promise<CustomerOrder> {
  if (!isLiveApi()) {
    await new Promise((r) => setTimeout(r, 400))
    const order: CustomerOrder = {
      id: `ORD-${Date.now().toString().slice(-6)}`,
      storeId: input.storeId,
      storeName: input.storeName,
      total: input.total,
      status: 'placed',
      placedAt: new Date().toISOString(),
      items: mapOrderItems(input.lines),
    }
    writeDemoOrders([order, ...readDemoOrders()])
    return order
  }

  const method = input.deliveryMethod?.trim().toUpperCase()
  const isPickup = method === 'STORE_PICKUP'
  const addressId = isPickup ? null : await resolveAddressId(input)

  if (!isPickup && !addressId) {
    throw new Error(
      asNumericId(input.userId)
        ? 'Could not save your delivery address. Pin the location again and try placing the order.'
        : 'Sign in to place this order.',
    )
  }

  const timing = input.orderTimingType?.trim().toUpperCase() ?? ''
  if (SCHEDULED_TIMING.has(timing) && !input.deliveryDate?.trim()) {
    throw new Error('Choose a delivery date to continue.')
  }

  const body = mapCreateOrderFromCartBody({
    vendorId: input.storeId,
    deliveryMethod: input.deliveryMethod,
    addressId,
    deliveryDate: input.deliveryDate,
    orderTimingType: input.orderTimingType,
    paymentTypeId: input.paymentTypeId,
    notes: input.note,
    pickupSlot: input.pickupSlot,
  })

  const res = await apiPost<ApiEnvelope<unknown>>('/v1/orders/from-cart', body)
  const placed = mapPlacedOrder(res, {
    storeId: input.storeId,
    storeName: input.storeName,
    total: input.total,
  })

  return {
    ...placed,
    items: mapOrderItems(input.lines),
    addressId: body.address_id,
  }
}

export type CustomerOrderHistoryPage = {
  orders: CustomerOrder[]
  pageNumber: number
  pageSize: number
  totalElements: number | null
  totalPages: number | null
  lastPage: boolean
}

function emptyHistoryPage(page = 0, size = CUSTOMER_ORDER_HISTORY_PAGE_SIZE): CustomerOrderHistoryPage {
  return {
    orders: [],
    pageNumber: page,
    pageSize: size,
    totalElements: 0,
    totalPages: 0,
    lastPage: true,
  }
}

function demoHistoryPage(page: number, size: number): CustomerOrderHistoryPage {
  const all = readDemoOrders().map((order) => ({
    ...order,
    storeName:
      order.storeName ||
      (order as { restaurantName?: string }).restaurantName ||
      'Store',
  }))
  const start = Math.max(0, page) * size
  const orders = all.slice(start, start + size)
  return {
    orders,
    pageNumber: page,
    pageSize: size,
    totalElements: all.length,
    totalPages: Math.max(1, Math.ceil(all.length / size) || 1),
    lastPage: start + orders.length >= all.length,
  }
}

const historyPageByKey = new Map<string, Promise<CustomerOrderHistoryPage>>()

/** One page of GET /v1/users/{id}/orders/history/paged (`page` + `size`). */
export async function listMyOrdersPage(
  userId?: string,
  page = 0,
  size = CUSTOMER_ORDER_HISTORY_PAGE_SIZE,
): Promise<CustomerOrderHistoryPage> {
  const pageNumber = Math.max(0, Math.floor(page))
  const pageSize = Math.max(1, Math.floor(size))

  if (!isLiveApi()) {
    await new Promise((r) => setTimeout(r, 200))
    return demoHistoryPage(pageNumber, pageSize)
  }

  if (!userId) return emptyHistoryPage(pageNumber, pageSize)

  const key = `${userId}:${pageNumber}:${pageSize}`
  const existing = historyPageByKey.get(key)
  if (existing) return existing

  const pending = apiGet<ApiEnvelope<unknown>>(`/v1/users/${userId}/orders/history/paged`, {
    params: { page: pageNumber, size: pageSize },
  })
    .then(mapCustomerOrderHistoryPage)
    .finally(() => {
      historyPageByKey.delete(key)
    })
  historyPageByKey.set(key, pending)
  return pending
}

export async function listMyOrders(userId?: string): Promise<CustomerOrder[]> {
  const snap = await listMyOrdersPage(userId, 0)
  return snap.orders
}

const detailByKey = new Map<string, Promise<CustomerOrder | null>>()

export async function getMyOrder(
  userId: string | undefined,
  orderId: string,
): Promise<CustomerOrder | null> {
  if (!isLiveApi()) {
    return readDemoOrders().find((order) => order.id === orderId) ?? null
  }

  const uid = asNumericId(userId)
  const oid = asNumericId(orderId)
  if (!uid || !oid) return null

  const key = `${uid}:${oid}`
  const existing = detailByKey.get(key)
  if (existing) return existing

  const pending = apiGet<ApiEnvelope<unknown>>(`/v1/users/${uid}/orders/${oid}`)
    .then(mapCustomerOrderDetail)
    .finally(() => {
      detailByKey.delete(key)
    })
  detailByKey.set(key, pending)
  return pending
}

export const ordersService = {
  placeOrder,
  listMyOrders,
  listMyOrdersPage,
  getMyOrder,
}
