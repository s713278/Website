import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { fetchStoreCatalog, resolveVendorId } from '@/features/storefront/api/fetch-store';
import { applyStoreTheme } from '@/features/storefront/lib/theme';

export function useStoreCatalog() {
  const [params] = useSearchParams();
  const vendorParam = params.get('vendor') || params.get('vendorId');
  const vendorId = resolveVendorId(vendorParam);

  const query = useQuery({
    queryKey: ['mithra', 'storefront', 'catalog', vendorId || 'local'],
    queryFn: () => fetchStoreCatalog(vendorId),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (query.data?.meta.themeColor) {
      applyStoreTheme(query.data.meta.themeColor);
    }
  }, [query.data?.meta.themeColor]);

  return { ...query, vendorId };
}
