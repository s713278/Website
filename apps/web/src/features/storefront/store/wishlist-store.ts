import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type WishlistState = {
  ids: string[];
  toggle: (productId: string) => void;
  has: (productId: string) => boolean;
  clear: () => void;
};

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (productId) =>
        set((state) => {
          const id = String(productId);
          return state.ids.includes(id)
            ? { ids: state.ids.filter((x) => x !== id) }
            : { ids: [...state.ids, id] };
        }),
      has: (productId) => get().ids.includes(String(productId)),
      clear: () => set({ ids: [] }),
    }),
    { name: 'mithra_web_store_wishlist' },
  ),
);
