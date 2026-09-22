import type {
  DeliveryEligibility,
  StorefrontProduct,
  VendorStorefront,
} from '@mithra/api-client';

export type StorefrontSku = {
  sku_id?: number;
  product_id?: number;
  name?: string;
  description?: string;
  is_active?: boolean;
  price?: number;
  mrp?: number;
  price_list?: Array<{ price?: number; mrp?: number; id?: number }>;
};

type Variant = {
  id: string;
  label: string;
  price: number;
  mrp?: number;
  active: boolean;
};

type Product = {
  id: string;
  name: string;
  image: string;
  color: string;
  order: number;
  categoryId: string;
  description: string;
  popular: boolean;
  variants: Variant[];
};

export type ExtendedStoreDraft = {
  phone: string;
  verified: boolean;
  businessType: string;
  categories: Array<{ id: string; name: string; image: string; icon: string }>;
  products: Product[];
  delivery: {
    storePickup: { enabled: boolean };
    homeDelivery: { enabled: boolean; charge: number };
    courierDelivery: { enabled: boolean; charge: number };
  };
  payment: {
    upi: { enabled: boolean };
    bank: { enabled: boolean };
    cod: { enabled: boolean };
  };
  settings: {
    storeName: string;
    tagline: string;
    location: string;
    whatsapp: string;
    logo: string;
    banner: string;
    themeColor: string;
    address: string;
  };
  slug: string;
  isSample: boolean;
  isStatic: boolean;
  vendorId?: number;
  heroBadges?: string[];
  trustStrip?: Array<{ icon?: string; title?: string; subtitle?: string }>;
  fulfillment?: VendorStorefront['fulfillment'];
  shareLink?: string;
};

function firstPrice(sku: StorefrontSku): { price: number; mrp: number } {
  const fromList = sku.price_list?.[0];
  const price = Number(fromList?.price ?? sku.price ?? 0) || 0;
  const mrp = Number(fromList?.mrp ?? sku.mrp ?? price) || price;
  return { price, mrp };
}

function mapVariants(skus: StorefrontSku[], productId: number): Variant[] {
  return skus
    .filter((s) => Number(s.product_id) === productId)
    .map((s) => {
      const { price, mrp } = firstPrice(s);
      return {
        id: String(s.sku_id ?? s.name ?? Math.random()),
        label: s.name || 'Default',
        price,
        mrp,
        active: s.is_active !== false,
      };
    });
}

/**
 * Map GET /v1/vendors/{id}/storefront (+ optional SKUs) into the UI store draft model.
 */
export function mapVendorStorefrontToDraft(
  sf: VendorStorefront,
  skus: StorefrontSku[] = [],
): ExtendedStoreDraft {
  const categories = (sf.categories || []).map((c) => ({
    id: String(c.id ?? c.name ?? ''),
    name: c.name || 'Category',
    image: c.image_path || '',
    icon: '🍽️',
  }));

  const defaultCategoryId = categories[0]?.id || 'all';

  const products: Product[] = (sf.products || []).map((p: StorefrontProduct, index) => {
    const id = Number(p.id);
    const variants = mapVariants(skus, id);
    return {
      id: String(p.id ?? index),
      name: p.name || 'Product',
      image: p.image_path || sf.thumbnail_image || '',
      color: '#ecfdf5',
      order: index,
      categoryId: String(p.category_id ?? defaultCategoryId),
      description: p.description || '',
      popular: index < 6 || !!p.popular,
      variants:
        variants.length > 0
          ? variants
          : [{ id: `sku_${p.id || index}`, label: 'Standard', price: 0, mrp: 0, active: true }],
    };
  });

  const fulfillment = sf.fulfillment || {};
  const themeColor = sf.theme?.primary_color || '#10b981';
  const logo = sf.theme?.logo_image || sf.thumbnail_image || '';
  const whatsapp = (sf.support_whatsapp_number || '').replace(/\D/g, '').slice(-10);

  return {
    phone: whatsapp,
    verified: !!sf.verified,
    businessType: categories[0]?.name || '',
    categories,
    products,
    delivery: {
      storePickup: { enabled: !!fulfillment.store_pickup_available },
      homeDelivery: {
        enabled: !!fulfillment.home_delivery_available,
        charge: 0,
      },
      courierDelivery: { enabled: false, charge: 0 },
    },
    payment: {
      upi: { enabled: true },
      bank: { enabled: false },
      cod: { enabled: true },
    },
    settings: {
      storeName: sf.business_name || 'Store',
      tagline: sf.description || '',
      location: fulfillment.delivery_message || '',
      whatsapp,
      logo,
      banner: sf.banner_image || '',
      themeColor,
      address: '',
    },
    slug: sf.store_identifier || String(sf.vendor_id || ''),
    isSample: false,
    isStatic: false,
    vendorId: sf.vendor_id,
    heroBadges: sf.hero_badges || [],
    trustStrip: sf.trust_strip || [],
    fulfillment,
    shareLink: sf.share_link || '',
  };
}

export function formatEligibilityMessage(e: DeliveryEligibility | null | undefined): string {
  if (!e) return '';
  if (e.deliverable) return e.reason || 'We deliver to your area.';
  return e.reason || 'Sorry, this store does not deliver to your area yet.';
}
