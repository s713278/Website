import type {
  OnboardingDraft,
  CategoryOption,
  ProductDraft,
  DeliveryDraft,
  PaymentDraft,
  StoreSettingsDraft,
} from '@/features/onboarding/types';
import { createEmptyDraft } from '@/features/onboarding/data/demo-seed';

export const DRAFT_STORAGE_KEY = 'mithra_store_setup_draft_v1';

export type PersistedStoreSetupDraft = Pick<
  OnboardingDraft,
  | 'currentStep'
  | 'maxReachedStep'
  | 'phone'
  | 'verified'
  | 'businessType'
  | 'businessTypeLabel'
  | 'categories'
  | 'products'
  | 'delivery'
  | 'payment'
  | 'settings'
  | 'vendorId'
  | 'published'
  | 'expandedProductCatId'
  | 'expandedSkuCatId'
> & {
  savedAt?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function asCategories(value: unknown): CategoryOption[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((c) => isObject(c) && c.name != null)
    .map((c) => ({
      id: (c as CategoryOption).id,
      name: String((c as CategoryOption).name),
    }));
}

function asProducts(value: unknown): ProductDraft[] {
  if (!Array.isArray(value)) return [];
  return value as ProductDraft[];
}

function asDelivery(value: unknown): DeliveryDraft {
  const empty = createEmptyDraft().delivery;
  if (!isObject(value)) return empty;
  return {
    storePickup: {
      enabled: Boolean((value.storePickup as { enabled?: boolean } | undefined)?.enabled),
    },
    homeDelivery: {
      enabled: Boolean((value.homeDelivery as { enabled?: boolean } | undefined)?.enabled),
      charge: Number((value.homeDelivery as { charge?: number } | undefined)?.charge) || 0,
    },
    courierDelivery: {
      enabled: Boolean((value.courierDelivery as { enabled?: boolean } | undefined)?.enabled),
      charge: Number((value.courierDelivery as { charge?: number } | undefined)?.charge) || 0,
    },
  };
}

function asPayment(value: unknown): PaymentDraft {
  const empty = createEmptyDraft().payment;
  if (!isObject(value)) return empty;
  const upi = (value.upi || {}) as PaymentDraft['upi'];
  const bank = (value.bank || {}) as PaymentDraft['bank'];
  const cod = (value.cod || {}) as PaymentDraft['cod'];
  return {
    upi: {
      enabled: Boolean(upi.enabled),
      upiId: String(upi.upiId || ''),
      payeeName: String(upi.payeeName || ''),
    },
    bank: {
      enabled: Boolean(bank.enabled),
      accountName: String(bank.accountName || ''),
      accountNumber: String(bank.accountNumber || ''),
      ifsc: String(bank.ifsc || ''),
      bankName: String(bank.bankName || ''),
    },
    cod: { enabled: Boolean(cod.enabled) },
  };
}

function asSettings(value: unknown): StoreSettingsDraft {
  const empty = createEmptyDraft().settings;
  if (!isObject(value)) return empty;
  return {
    storeName: String(value.storeName || ''),
    tagline: String(value.tagline || ''),
    location: String(value.location || ''),
    whatsapp: String(value.whatsapp || ''),
    themeColor: String(value.themeColor || empty.themeColor),
    logoDataUrl: String(value.logoDataUrl || ''),
    bannerDataUrl: String(value.bannerDataUrl || ''),
  };
}

export function loadPersistedDraft(): PersistedStoreSetupDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isObject(parsed)) return null;
    return {
      ...createEmptyDraft(),
      currentStep: Number(parsed.currentStep) || 1,
      maxReachedStep: Number(parsed.maxReachedStep) || 1,
      phone: String(parsed.phone || ''),
      verified: Boolean(parsed.verified),
      businessType: String(parsed.businessType || ''),
      businessTypeLabel: String(parsed.businessTypeLabel || ''),
      categories: asCategories(parsed.categories),
      products: asProducts(parsed.products),
      delivery: asDelivery(parsed.delivery),
      payment: asPayment(parsed.payment),
      settings: asSettings(parsed.settings),
      vendorId: parsed.vendorId == null ? null : Number(parsed.vendorId) || null,
      published: Boolean(parsed.published),
      expandedProductCatId: (parsed.expandedProductCatId as number | string | null) ?? null,
      expandedSkuCatId: (parsed.expandedSkuCatId as number | string | null) ?? null,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : undefined,
    };
  } catch {
    return null;
  }
}

export function savePersistedDraft(draft: PersistedStoreSetupDraft): string {
  const savedAt = new Date().toISOString();
  const payload: PersistedStoreSetupDraft = { ...draft, savedAt };
  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
  return savedAt;
}

export function clearPersistedDraft() {
  localStorage.removeItem(DRAFT_STORAGE_KEY);
}
