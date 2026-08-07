import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEMO_ORDERS,
  DEMO_PRODUCTS,
  DEMO_STORE,
  DEMO_VENDORS,
} from '@/features/dashboard/data/demo-dashboard';
import type {
  DashboardOrder,
  DashboardProduct,
  DashboardVendor,
  OrderStatus,
  ProductStatus,
  StoreShareInfo,
  VendorStatus,
} from '@/features/dashboard/types';

type DemoDataState = {
  orders: DashboardOrder[];
  products: DashboardProduct[];
  vendors: DashboardVendor[];
  store: StoreShareInfo;
  setOrderStatus: (ids: string[], status: OrderStatus) => void;
  upsertProduct: (product: DashboardProduct) => void;
  deleteProducts: (ids: string[]) => void;
  setProductStatus: (ids: string[], status: ProductStatus) => void;
  setVendorStatus: (ids: string[], status: VendorStatus) => void;
  updateStore: (patch: Partial<StoreShareInfo>) => void;
  reset: () => void;
};

export const useDemoDataStore = create<DemoDataState>()(
  persist(
    (set, get) => ({
      orders: DEMO_ORDERS,
      products: DEMO_PRODUCTS,
      vendors: DEMO_VENDORS,
      store: DEMO_STORE,
      setOrderStatus: (ids, status) => {
        const idSet = new Set(ids);
        set({
          orders: get().orders.map((o) => (idSet.has(o.id) ? { ...o, status } : o)),
        });
      },
      upsertProduct: (product) => {
        const exists = get().products.some((p) => p.id === product.id);
        set({
          products: exists
            ? get().products.map((p) => (p.id === product.id ? product : p))
            : [product, ...get().products],
        });
      },
      deleteProducts: (ids) => {
        const idSet = new Set(ids);
        set({ products: get().products.filter((p) => !idSet.has(p.id)) });
      },
      setProductStatus: (ids, status) => {
        const idSet = new Set(ids);
        set({
          products: get().products.map((p) =>
            idSet.has(p.id) ? { ...p, status, updatedAt: new Date().toISOString() } : p,
          ),
        });
      },
      setVendorStatus: (ids, status) => {
        const idSet = new Set(ids);
        set({
          vendors: get().vendors.map((v) => (idSet.has(v.id) ? { ...v, status } : v)),
        });
      },
      updateStore: (patch) => set({ store: { ...get().store, ...patch } }),
      reset: () =>
        set({
          orders: DEMO_ORDERS,
          products: DEMO_PRODUCTS,
          vendors: DEMO_VENDORS,
          store: DEMO_STORE,
        }),
    }),
    {
      name: 'mithra_web_dashboard_demo',
      partialize: (state) => ({
        orders: state.orders,
        products: state.products,
        vendors: state.vendors,
        store: state.store,
      }),
    },
  ),
);
