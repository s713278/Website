export type OnboardingStepMeta = {
  n: number;
  label: string;
  time: string;
};

export type BusinessType = {
  id: string;
  label: string;
  icon: string;
  keywords: string;
};

export type CategoryOption = {
  id: number | string;
  name: string;
};

export type ProductVariant = {
  id: string;
  label: string;
  price: number;
  active: boolean;
};

export type ProductDraft = {
  id: string;
  categoryId: number | string;
  name: string;
  imageDataUrl: string;
  color: string;
  variants: ProductVariant[];
};

export type DeliveryDraft = {
  storePickup: { enabled: boolean };
  homeDelivery: { enabled: boolean; charge: number };
  courierDelivery: { enabled: boolean; charge: number };
};

export type PaymentDraft = {
  upi: { enabled: boolean; upiId: string; payeeName: string };
  bank: {
    enabled: boolean;
    accountName: string;
    accountNumber: string;
    ifsc: string;
    bankName: string;
  };
  cod: { enabled: boolean };
};

export type StoreSettingsDraft = {
  storeName: string;
  tagline: string;
  location: string;
  whatsapp: string;
  themeColor: string;
  logoDataUrl: string;
  bannerDataUrl: string;
};

export type DraftSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export type OnboardingDraft = {
  currentStep: number;
  maxReachedStep: number;
  phone: string;
  verified: boolean;
  /** OpenAPI business type id (stringified number from API). */
  businessType: string;
  businessTypeLabel: string;
  categories: CategoryOption[];
  products: ProductDraft[];
  delivery: DeliveryDraft;
  payment: PaymentDraft;
  settings: StoreSettingsDraft;
  expandedProductCatId: number | string | null;
  expandedSkuCatId: number | string | null;
  /** Remote vendor id after create/publish. */
  vendorId: number | null;
  published: boolean;
  saveStatus: DraftSaveStatus;
  lastSavedAt: string | null;
  publishError: string;
};

export type ThemePreset = {
  id: string;
  label: string;
  color: string;
};
