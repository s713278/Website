import type { VendorOrder, VendorProduct } from '../types'

export const VENDOR_PRODUCTS: VendorProduct[] = [
  { id: 'vp1', name: 'Millet Power Bowl', price: 249, available: true, veg: true },
  { id: 'vp2', name: 'Grilled Paneer Wrap', price: 199, available: true, veg: true },
  { id: 'vp3', name: 'Chicken Peri Bowl', price: 289, available: true, veg: false },
  { id: 'vp4', name: 'Seasonal Soup', price: 129, available: false, veg: true },
]

export const VENDOR_ORDERS: VendorOrder[] = [
  {
    id: 'VO-1042',
    customerName: 'Ananya S.',
    items: [
      { name: 'Millet Power Bowl', qty: 1 },
      { name: 'Grilled Paneer Wrap', qty: 2 },
    ],
    total: 647,
    status: 'new',
    placedAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
  },
  {
    id: 'VO-1041',
    customerName: 'Karthik M.',
    items: [{ name: 'Chicken Peri Bowl', qty: 1 }],
    total: 318,
    status: 'preparing',
    placedAt: new Date(Date.now() - 1000 * 60 * 22).toISOString(),
  },
  {
    id: 'VO-1038',
    customerName: 'Meera P.',
    items: [
      { name: 'Millet Power Bowl', qty: 2 },
      { name: 'Seasonal Soup', qty: 1 },
    ],
    total: 627,
    status: 'completed',
    placedAt: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
  },
]
