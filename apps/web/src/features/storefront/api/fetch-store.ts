import { storefrontService, vendorsService, type VendorStorefront } from '@mithra/api-client';
import { env } from '@/shared/lib/env';
import { unwrapEnvelope } from '@/shared/lib/map-utils';
import { createDemoCatalog } from '@/features/storefront/data/demo-catalog';
import { loadPersistedDraft } from '@/features/onboarding/lib/draft-storage';
import { mapDraftToCatalog, mapVendorStorefront } from '@/features/storefront/api/map-catalog';
import type { StoreCatalog, StoreProduct } from '@/features/storefront/types';

function resolveVendorId(explicit?: string | null): string | null {
  if (explicit) return explicit;
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('vendor') || params.get('vendorId');
    if (fromQuery) return fromQuery;
  } catch {
    /* ignore */
  }
  const draft = loadPersistedDraft();
  if (draft?.vendorId != null) return String(draft.vendorId);
  return null;
}

/** Offline / demo path: prefer published onboarding draft, else fixtures. */
export function loadLocalCatalog(): StoreCatalog {
  const draft = loadPersistedDraft();
  if (draft?.products?.length && (draft.published || draft.settings.storeName)) {
    return mapDraftToCatalog(draft);
  }
  return createDemoCatalog();
}

export async function fetchStoreCatalog(vendorId?: string | null): Promise<StoreCatalog> {
  const id = resolveVendorId(vendorId);

  if (!env.useApi || !id) {
    return loadLocalCatalog();
  }

  try {
    const [storefrontRes, productsRes, skusRes] = await Promise.all([
      storefrontService.get(id),
      vendorsService.getProducts(id).catch(() => null),
      vendorsService.getProductSkus(id).catch(() => null),
    ]);

    const storefront = unwrapEnvelope<VendorStorefront>(storefrontRes) || {};
    const productRows = unwrapEnvelope<unknown[]>(productsRes);
    const skuRows = unwrapEnvelope<unknown[]>(skusRes);

    const merged: VendorStorefront = {
      ...storefront,
      vendor_id: storefront.vendor_id ?? (Number(id) || undefined),
      products:
        Array.isArray(productRows) && productRows.length
          ? (productRows as VendorStorefront['products'])
          : storefront.products,
    };

    return mapVendorStorefront(merged, Array.isArray(skuRows) ? skuRows : undefined);
  } catch {
    return loadLocalCatalog();
  }
}

export async function fetchStoreProduct(
  productId: string,
  vendorId?: string | null,
): Promise<{ catalog: StoreCatalog; product: StoreProduct | null }> {
  const catalog = await fetchStoreCatalog(vendorId);
  const product = catalog.products.find((p) => String(p.id) === String(productId)) ?? null;

  if (product || !env.useApi) {
    return { catalog, product };
  }

  const id = resolveVendorId(vendorId);
  if (!id) return { catalog, product };

  try {
    const res = await vendorsService.getProduct(id, productId);
    const raw = unwrapEnvelope(res);
    if (!raw) return { catalog, product: null };
    const mapped = mapVendorStorefront({
      ...catalog.meta,
      vendor_id: Number(id) || undefined,
      business_name: catalog.meta.storeName,
      products: [raw as never],
      categories: catalog.categories,
    }).products[0];
    return { catalog, product: mapped ?? null };
  } catch {
    return { catalog, product: null };
  }
}

export { resolveVendorId };
