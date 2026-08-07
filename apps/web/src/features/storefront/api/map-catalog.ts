import type { VendorStorefront } from '@mithra/api-client';
import type {
  StoreCatalog,
  StoreCategory,
  StoreMeta,
  StoreProduct,
  StoreSku,
} from '@/features/storefront/types';
import { createDemoCatalog } from '@/features/storefront/data/demo-catalog';
import type { PersistedStoreSetupDraft } from '@/features/onboarding/lib/draft-storage';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function str(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value);
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mapSku(raw: unknown, index: number): StoreSku {
  const r = asRecord(raw) || {};
  const id = str(r.id ?? r.sku_id ?? r.skuId, `sku-${index}`);
  const price = num(r.sale_price ?? r.price ?? r.unit_price, 0);
  const listPrice = num(r.list_price ?? r.listPrice, price);
  const active = r.active !== false && r.is_active !== false;
  const inStock =
    r.in_stock !== false &&
    r.inStock !== false &&
    (r.stock == null || num(r.stock, 1) > 0) &&
    (r.quantity_available == null || num(r.quantity_available, 1) > 0);
  return {
    id,
    label: str(r.label ?? r.name ?? r.sku_name ?? r.variant, 'Standard'),
    price,
    listPrice: listPrice > price ? listPrice : undefined,
    active,
    inStock,
  };
}

function mapProduct(raw: unknown, index: number): StoreProduct {
  const r = asRecord(raw) || {};
  const skusRaw = (r.skus ?? r.variants ?? r.product_skus) as unknown;
  const skus = Array.isArray(skusRaw)
    ? skusRaw.map(mapSku).filter((s) => s.active)
    : [
        mapSku(
          {
            id: `sku-${str(r.id, String(index))}-default`,
            label: str(r.measurement_unit ?? r.unit, '1 unit'),
            sale_price: r.sale_price ?? r.price ?? r.min_price ?? 0,
            list_price: r.list_price,
            in_stock: r.in_stock ?? r.available,
          },
          0,
        ),
      ];
  const image = str(r.image ?? r.image_path ?? r.imageDataUrl ?? r.thumbnail);
  const images = Array.isArray(r.images)
    ? (r.images as unknown[]).map((x) => str(x)).filter(Boolean)
    : image
      ? [image]
      : [];
  const minPrice = skus.length ? Math.min(...skus.map((s) => s.price)) : num(r.min_price ?? r.price);
  return {
    id: str(r.id ?? r.product_id, `product-${index}`),
    name: str(r.name ?? r.product_name, 'Product'),
    description: str(r.description ?? r.product_description),
    categoryId: str(r.categoryId ?? r.category_id, 'uncategorized'),
    image,
    images,
    color: str(r.color, '#bbf7d0'),
    icon: str(r.icon, '🫙'),
    rating: num(r.rating, 4.5),
    reviewCount: num(r.reviews ?? r.review_count ?? r.reviewCount, 0),
    popular: Boolean(r.popular),
    skus,
    ingredients: str(r.ingredients) || undefined,
    nutrition: str(r.nutrition) || undefined,
    storage: str(r.storage) || undefined,
    deliveryInfo: str(r.deliveryInfo ?? r.delivery_info) || undefined,
    inStock: skus.some((s) => s.inStock),
    minPrice,
  };
}

function mapCategory(raw: unknown, index: number): StoreCategory {
  const r = asRecord(raw) || {};
  return {
    id: str(r.id ?? r.category_id, `cat-${index}`),
    name: str(r.name ?? r.category_name, 'Category'),
    image: str(r.image ?? r.image_path) || undefined,
    icon: str(r.icon) || undefined,
  };
}

export function mapVendorStorefront(
  data: VendorStorefront | Record<string, unknown> | null | undefined,
  skuRows?: unknown[],
): StoreCatalog {
  const demo = createDemoCatalog();
  const root = asRecord(data) || {};
  const theme = asRecord(root.theme) || {};
  const meta: StoreMeta = {
    vendorId: root.vendor_id != null ? str(root.vendor_id) : null,
    storeName: str(root.business_name ?? root.store_name, demo.meta.storeName),
    tagline: str(root.description ?? root.tagline, demo.meta.tagline),
    location: str(root.location, demo.meta.location),
    whatsapp: str(root.support_whatsapp_number ?? root.whatsapp, demo.meta.whatsapp),
    themeColor: str(theme.primary_color ?? root.theme_color, demo.meta.themeColor),
    logoUrl: str(theme.logo_image ?? root.thumbnail_image ?? root.logo),
    bannerUrl: str(root.banner_image ?? root.banner),
    shareLink: str(root.share_link) || undefined,
  };

  const categories = Array.isArray(root.categories)
    ? root.categories.map(mapCategory)
    : demo.categories;

  let products = Array.isArray(root.products) ? root.products.map(mapProduct) : [];

  if (skuRows?.length) {
    const byProduct = new Map<string, StoreSku[]>();
    skuRows.forEach((row, i) => {
      const r = asRecord(row) || {};
      const productId = str(r.product_id ?? r.productId);
      if (!productId) return;
      const list = byProduct.get(productId) || [];
      list.push(mapSku(row, i));
      byProduct.set(productId, list);
    });
    products = products.map((p) => {
      const skus = byProduct.get(p.id);
      if (!skus?.length) return p;
      const active = skus.filter((s) => s.active);
      return {
        ...p,
        skus: active,
        minPrice: Math.min(...active.map((s) => s.price)),
        inStock: active.some((s) => s.inStock),
      };
    });
  }

  if (!products.length) {
    return { ...demo, meta: { ...demo.meta, ...meta, vendorId: meta.vendorId }, source: 'api' };
  }

  return { meta, categories, products, source: 'api' };
}

/** Map onboarding draft (localStorage) into storefront catalog. */
export function mapDraftToCatalog(draft: PersistedStoreSetupDraft): StoreCatalog {
  const demo = createDemoCatalog();
  const categories = (draft.categories || []).map((c, i) =>
    mapCategory({ id: c.id, name: c.name }, i),
  );
  const products = (draft.products || []).map((p, i) =>
    mapProduct(
      {
        id: p.id,
        name: p.name,
        categoryId: p.categoryId,
        image: p.imageDataUrl,
        color: p.color,
        variants: p.variants,
        popular: i < 4,
        rating: 4.6,
        reviews: 12 + i,
        description: '',
      },
      i,
    ),
  );

  return {
    source: 'draft',
    meta: {
      vendorId: draft.vendorId != null ? String(draft.vendorId) : null,
      storeName: draft.settings.storeName || demo.meta.storeName,
      tagline: draft.settings.tagline || demo.meta.tagline,
      location: draft.settings.location || demo.meta.location,
      whatsapp: draft.settings.whatsapp || demo.meta.whatsapp,
      themeColor: draft.settings.themeColor || demo.meta.themeColor,
      logoUrl: draft.settings.logoDataUrl || '',
      bannerUrl: draft.settings.bannerDataUrl || '',
    },
    categories: categories.length ? categories : demo.categories,
    products: products.length ? products : demo.products,
  };
}

export function unwrapData<T = unknown>(envelope: unknown): T | null {
  const root = asRecord(envelope);
  if (!root) return null;
  if ('data' in root) return (root.data as T) ?? null;
  return envelope as T;
}
