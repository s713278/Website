import { z } from 'zod';

export const moneySchema = z.number().nonnegative();

export function formatMoney(n: number, currency = 'INR'): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `₹${Math.round(n)}`;
  }
}

export function slugify(text: string): string {
  return (
    String(text || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'my-store'
  );
}

export function normalizePhoneDigits(phone: string): string {
  return String(phone || '').replace(/\D/g, '');
}

export function toWhatsAppE164(phone: string, defaultCountry = '91'): string {
  let digits = normalizePhoneDigits(phone);
  if (digits.length === 10) digits = defaultCountry + digits;
  return digits;
}

export function whatsappLink(phone: string, message?: string): string {
  const digits = toWhatsAppE164(phone);
  const text = encodeURIComponent(message || 'Hi, I would like to place an order.');
  return `https://wa.me/${digits}?text=${text}`;
}

export const variantSchema = z.object({
  id: z.string(),
  label: z.string(),
  price: z.number(),
  mrp: z.number().optional(),
  active: z.boolean().default(true),
});

export const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().optional().default(''),
  color: z.string().optional(),
  order: z.number().optional(),
  categoryId: z.string(),
  rating: z.number().optional(),
  description: z.string().optional(),
  ingredients: z.string().optional(),
  nutrition: z.string().optional(),
  storage: z.string().optional(),
  deliveryInfo: z.string().optional(),
  popular: z.boolean().optional(),
  variants: z.array(variantSchema).default([]),
});

export const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().optional(),
  icon: z.string().optional(),
});

export const storeSettingsSchema = z.object({
  storeName: z.string(),
  tagline: z.string().optional().default(''),
  location: z.string().optional().default(''),
  whatsapp: z.string().optional().default(''),
  logo: z.string().optional().default(''),
  banner: z.string().optional().default(''),
  themeColor: z.string().optional().default('#10b981'),
  address: z.string().optional().default(''),
});

export const storeDraftSchema = z.object({
  phone: z.string().optional(),
  verified: z.boolean().optional(),
  businessType: z.string().optional(),
  categories: z.array(categorySchema).default([]),
  products: z.array(productSchema).default([]),
  delivery: z
    .object({
      storePickup: z.object({ enabled: z.boolean() }).optional(),
      homeDelivery: z.object({ enabled: z.boolean(), charge: z.number().optional() }).optional(),
      courierDelivery: z.object({ enabled: z.boolean(), charge: z.number().optional() }).optional(),
    })
    .optional(),
  payment: z
    .object({
      upi: z
        .object({
          enabled: z.boolean(),
          upiId: z.string().optional(),
          payeeName: z.string().optional(),
        })
        .optional(),
      bank: z
        .object({
          enabled: z.boolean(),
          accountName: z.string().optional(),
          accountNumber: z.string().optional(),
          ifsc: z.string().optional(),
          bankName: z.string().optional(),
        })
        .optional(),
      cod: z.object({ enabled: z.boolean() }).optional(),
    })
    .optional(),
  settings: storeSettingsSchema,
  slug: z.string(),
  addresses: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        line: z.string(),
      }),
    )
    .optional(),
  isSample: z.boolean().optional(),
  isStatic: z.boolean().optional(),
});

export type StoreDraft = z.infer<typeof storeDraftSchema>;
export type Product = z.infer<typeof productSchema>;
export type Variant = z.infer<typeof variantSchema>;
export type Category = z.infer<typeof categorySchema>;

export type CartLine = {
  productId: string;
  skuId: string;
  name: string;
  label: string;
  price: number;
  qty: number;
  color?: string;
  image?: string;
};

export type WhatsAppOrderPayload = {
  storeName: string;
  orderId: string;
  customerName: string;
  customerPhone: string;
  address: string;
  paymentLabel: string;
  lines: Array<{ name: string; label: string; qty: number; price: number }>;
  subtotal: number;
  delivery: number;
  discount?: number;
  total: number;
};

export function buildWhatsAppOrderMessage(p: WhatsAppOrderPayload): string {
  const lines = [
    `🛒 *New Order — ${p.storeName}*`,
    '',
    `*Order ID:* ${p.orderId}`,
    `*Customer:* ${p.customerName || 'Guest'}`,
    `*Phone:* +91 ${p.customerPhone}`,
    `*Address:* ${p.address}`,
    `*Payment:* ${p.paymentLabel}`,
    '',
    '*Items:*',
  ];
  p.lines.forEach((l, i) => {
    lines.push(`${i + 1}. ${l.name} (${l.label}) × ${l.qty} — ${formatMoney(l.price * l.qty)}`);
  });
  lines.push('');
  lines.push(`Subtotal: ${formatMoney(p.subtotal)}`);
  lines.push(`Delivery: ${formatMoney(p.delivery)}`);
  if (p.discount) lines.push(`Discount: −${formatMoney(p.discount)}`);
  lines.push(`*Total Amount: ${formatMoney(p.total)}*`);
  lines.push('');
  lines.push('Please confirm my order. Thank you!');
  return lines.join('\n');
}

export function generateClientOrderId(now = new Date()): string {
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `MD${yy}${mm}${dd}${rand}`;
}

export function minPrice(product: Product): number {
  const active = (product.variants || []).filter((v) => v.active !== false);
  const list = active.length ? active : product.variants || [];
  const prices = list.map((v) => Number(v.price) || 0).filter((n) => n > 0);
  return prices.length ? Math.min(...prices) : 0;
}

/** Checkout channel feature flag (hybrid WhatsApp). */
export type CheckoutChannel = 'DEEPLINK' | 'CLOUD_API';

export function resolveCheckoutChannel(
  envValue?: string | null,
): CheckoutChannel {
  return envValue === 'CLOUD_API' ? 'CLOUD_API' : 'DEEPLINK';
}

export const SAMPLE_STORE_SLUG = 'sai-ram-home-foods';

/** Demo slug → vendor_id until public store-by-slug API ships. */
export function resolveVendorIdForSlug(
  slug: string,
  sampleVendorId = 0,
): number | null {
  if (slug === SAMPLE_STORE_SLUG && sampleVendorId > 0) return sampleVendorId;
  return null;
}

export { seedSaiRamDraft } from './fixtures';
