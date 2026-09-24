import type { CartLine } from '@/modules/storefront/types'
import { reverseGeocode as lookupAreaFromCoords } from '@/shared/lib/customer-location'
import { apiGet, apiPatch, apiPost } from '../client'
import { isLiveApi } from '../mode'
import {
  asNumericId,
  extractAddressId,
  mapCreateOrderFromCartBody,
  mapCustomerOrderDetail,
  mapCustomerOrderHistory,
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

export async function listMyOrders(userId?: string): Promise<CustomerOrder[]> {
  if (!isLiveApi()) {
    await new Promise((r) => setTimeout(r, 200))
    return readDemoOrders().map((order) => ({
      ...order,
      storeName:
        order.storeName ||
        (order as { restaurantName?: string }).restaurantName ||
        'Store',
    }))
  }

  if (!userId) return []
  const res = await apiGet<ApiEnvelope<unknown>>(`/v1/users/${userId}/orders/history`)
  return mapCustomerOrderHistory(res)
}

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

  const res = await apiGet<ApiEnvelope<unknown>>(`/v1/users/${uid}/orders/${oid}`)
  return mapCustomerOrderDetail(res)
}

export const ordersService = {
  placeOrder,
  listMyOrders,
  getMyOrder,
}
