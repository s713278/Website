import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStoreCatalog } from '@/features/storefront/hooks/use-store-catalog';
import { useDebouncedValue } from '@/shared/hooks';
import { filterAndSortProducts, priceBounds } from '@/features/storefront/lib/filter-products';
import type { BrowseMode, ProductFilters, ProductSort } from '@/features/storefront/types';

const DEFAULT_PAGE_SIZE = 8;

export function useStoreProducts() {
  const catalogQuery = useStoreCatalog();
  const products = catalogQuery.data?.products ?? [];
  const bounds = useMemo(() => priceBounds(products), [products]);

  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [categoryId, setCategoryId] = useState('all');
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(10_000);
  const [boundsReady, setBoundsReady] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState<ProductSort>('popular');
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);
  const [browseMode, setBrowseMode] = useState<BrowseMode>('infinite');
  const [visibleCount, setVisibleCount] = useState(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    if (!products.length || boundsReady) return;
    setMinPrice(bounds.min);
    setMaxPrice(bounds.max);
    setBoundsReady(true);
  }, [products.length, bounds.min, bounds.max, boundsReady]);

  const filters: ProductFilters = {
    categoryId,
    search: debouncedSearch,
    minPrice,
    maxPrice,
    inStockOnly,
    sort,
  };

  const filtered = useMemo(
    () => filterAndSortProducts(products, filters),
    [
      products,
      filters.categoryId,
      filters.search,
      filters.minPrice,
      filters.maxPrice,
      filters.inStockOnly,
      filters.sort,
    ],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize) || 1);
  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    if (browseMode === 'pages') {
      const start = (safePage - 1) * pageSize;
      return filtered.slice(start, start + pageSize);
    }
    return filtered.slice(0, visibleCount);
  }, [browseMode, filtered, safePage, pageSize, visibleCount]);

  const hasMore = browseMode === 'infinite' && visibleCount < filtered.length;

  function resetWindow() {
    setPage(1);
    setVisibleCount(pageSize);
  }

  function selectCategory(id: string) {
    setCategoryId(id);
    resetWindow();
  }

  function updateSearch(value: string) {
    setSearchInput(value);
    resetWindow();
  }

  const loadMore = useCallback(() => {
    setVisibleCount((n) => {
      if (n >= filtered.length) return n;
      return Math.min(n + pageSize, filtered.length);
    });
  }, [filtered.length, pageSize]);

  function goToPage(next: number) {
    setPage(Math.min(Math.max(1, next), totalPages));
  }

  function changePageSize(size: number) {
    setPageSize(size);
    setPage(1);
    setVisibleCount(size);
  }

  function changeBrowseMode(mode: BrowseMode) {
    setBrowseMode(mode);
    setPage(1);
    setVisibleCount(pageSize);
  }

  return {
    ...catalogQuery,
    categories: catalogQuery.data?.categories ?? [],
    meta: catalogQuery.data?.meta,
    filters,
    searchInput,
    setSearchInput: updateSearch,
    setCategoryId: selectCategory,
    setMinPrice: (v: number) => {
      setMinPrice(v);
      resetWindow();
    },
    setMaxPrice: (v: number) => {
      setMaxPrice(v);
      resetWindow();
    },
    setInStockOnly: (v: boolean) => {
      setInStockOnly(v);
      resetWindow();
    },
    setSort: (v: ProductSort) => {
      setSort(v);
      resetWindow();
    },
    bounds,
    filtered,
    pageItems,
    page: safePage,
    totalPages,
    pageSize,
    setPageSize: changePageSize,
    goToPage,
    browseMode,
    setBrowseMode: changeBrowseMode,
    hasMore,
    loadMore,
    totalFiltered: filtered.length,
  };
}
