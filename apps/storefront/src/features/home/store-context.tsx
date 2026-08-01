import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { CartLine, StoreDraft } from '@mithra/domain';
import { seedSaiRamDraft } from '@mithra/domain';

const CART_KEY = 'mithra_store_cart';
const SESSION_KEY = 'mithra_store_session';

type Customer = { phone: string; name: string; loggedIn: boolean };

type StoreContextValue = {
  draft: StoreDraft;
  view: string;
  setView: (v: string) => void;
  activeCategory: string;
  setActiveCategory: (c: string) => void;
  productId: string | null;
  setProductId: (id: string | null) => void;
  cart: CartLine[];
  addToCart: (productId: string, skuId: string, qty?: number) => void;
  setQty: (skuId: string, qty: number) => void;
  lineQty: (skuId: string) => number;
  cartCount: number;
  subtotal: number;
  deliveryCharge: number;
  discount: number;
  setDiscount: (n: number) => void;
  coupon: string;
  setCoupon: (c: string) => void;
  grandTotal: number;
  customer: Customer;
  setCustomer: (c: Customer) => void;
  address: string;
  setAddress: (a: string) => void;
  addressId: string;
  setAddressId: (id: string) => void;
  orderId: string;
  setOrderId: (id: string) => void;
  orderMessage: string;
  setOrderMessage: (m: string) => void;
  clearCart: () => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({
  draft: draftProp,
  children,
}: {
  draft?: StoreDraft;
  children: ReactNode;
}) {
  const draft = draftProp || seedSaiRamDraft();
  const [view, setView] = useState('home');
  const [activeCategory, setActiveCategory] = useState('all');
  const [productId, setProductId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>(() => {
    try {
      const raw = localStorage.getItem(CART_KEY);
      return raw ? (JSON.parse(raw) as CartLine[]) : [];
    } catch {
      return [];
    }
  });
  const [discount, setDiscount] = useState(0);
  const [coupon, setCoupon] = useState('');
  const [customer, setCustomer] = useState<Customer>(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return { phone: '', name: '', loggedIn: false };
      const s = JSON.parse(raw) as Customer & { address?: string };
      return { phone: s.phone || '', name: s.name || '', loggedIn: !!s.loggedIn };
    } catch {
      return { phone: '', name: '', loggedIn: false };
    }
  });
  const [address, setAddress] = useState(draft.settings.address || '');
  const [addressId, setAddressId] = useState('home');
  const [orderId, setOrderId] = useState('');
  const [orderMessage, setOrderMessage] = useState('');

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ ...customer, address }),
    );
  }, [customer, address]);

  const addToCart = useCallback(
    (productId: string, skuId: string, qty = 1) => {
      const product = draft.products.find((p) => p.id === productId);
      const variant = product?.variants.find((v) => v.id === skuId);
      if (!product || !variant) return;
      setCart((prev) => {
        const existing = prev.find((l) => l.skuId === skuId);
        if (existing) {
          return prev.map((l) =>
            l.skuId === skuId ? { ...l, qty: Math.min(25, l.qty + qty) } : l,
          );
        }
        return [
          ...prev,
          {
            productId,
            skuId,
            name: product.name,
            label: variant.label,
            price: variant.price,
            qty,
            color: product.color,
            image: product.image,
          },
        ];
      });
    },
    [draft.products],
  );

  const setQty = useCallback((skuId: string, qty: number) => {
    setCart((prev) => {
      if (qty <= 0) return prev.filter((l) => l.skuId !== skuId);
      return prev.map((l) => (l.skuId === skuId ? { ...l, qty: Math.min(25, qty) } : l));
    });
  }, []);

  const lineQty = useCallback(
    (skuId: string) => cart.find((l) => l.skuId === skuId)?.qty || 0,
    [cart],
  );

  const cartCount = useMemo(() => cart.reduce((n, l) => n + l.qty, 0), [cart]);
  const subtotal = useMemo(() => cart.reduce((n, l) => n + l.price * l.qty, 0), [cart]);
  const deliveryCharge = draft.delivery?.homeDelivery?.enabled
    ? Number(draft.delivery.homeDelivery.charge || 0)
    : 0;
  const grandTotal = Math.max(0, subtotal + deliveryCharge - discount);

  const clearCart = useCallback(() => setCart([]), []);

  const value: StoreContextValue = {
    draft,
    view,
    setView,
    activeCategory,
    setActiveCategory,
    productId,
    setProductId,
    cart,
    addToCart,
    setQty,
    lineQty,
    cartCount,
    subtotal,
    deliveryCharge,
    discount,
    setDiscount,
    coupon,
    setCoupon,
    grandTotal,
    customer,
    setCustomer,
    address,
    setAddress,
    addressId,
    setAddressId,
    orderId,
    setOrderId,
    orderMessage,
    setOrderMessage,
    clearCart,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore outside provider');
  return ctx;
}
