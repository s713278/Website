import { useWishlistStore } from '@/features/storefront/store/wishlist-store';

export function useWishlist() {
  const ids = useWishlistStore((s) => s.ids);
  const toggle = useWishlistStore((s) => s.toggle);
  const has = useWishlistStore((s) => s.has);
  return { ids, toggle, has, count: ids.length };
}
