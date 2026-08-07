import type { ProductFilters, StoreProduct } from '@/features/storefront/types';

export function filterAndSortProducts(
  products: StoreProduct[],
  filters: ProductFilters,
): StoreProduct[] {
  const q = filters.search.trim().toLowerCase();
  const list = products.filter((p) => {
    if (filters.categoryId !== 'all' && String(p.categoryId) !== String(filters.categoryId)) {
      return false;
    }
    if (q && !p.name.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) {
      return false;
    }
    if (p.minPrice < filters.minPrice || p.minPrice > filters.maxPrice) return false;
    if (filters.inStockOnly && !p.inStock) return false;
    return true;
  });

  list.sort((a, b) => {
    switch (filters.sort) {
      case 'price-asc':
        return a.minPrice - b.minPrice;
      case 'price-desc':
        return b.minPrice - a.minPrice;
      case 'name':
        return a.name.localeCompare(b.name);
      case 'popular':
      default:
        if (a.popular !== b.popular) return a.popular ? -1 : 1;
        return b.rating - a.rating || b.reviewCount - a.reviewCount;
    }
  });

  return list;
}

export function priceBounds(products: StoreProduct[]): { min: number; max: number } {
  if (!products.length) return { min: 0, max: 1000 };
  const prices = products.map((p) => p.minPrice);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

export function relatedProducts(
  products: StoreProduct[],
  product: StoreProduct,
  limit = 4,
): StoreProduct[] {
  return products
    .filter((p) => p.id !== product.id && String(p.categoryId) === String(product.categoryId))
    .slice(0, limit);
}
