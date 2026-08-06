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
  id: string;
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
  categoryId: string;
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

export type OnboardingDraft = {
  currentStep: number;
  maxReachedStep: number;
  phone: string;
  verified: boolean;
  businessType: string;
  categories: CategoryOption[];
  products: ProductDraft[];
  delivery: DeliveryDraft;
  payment: PaymentDraft;
  settings: StoreSettingsDraft;
  expandedProductCatId: string | null;
  expandedSkuCatId: string | null;
};

export type ThemePreset = {
  id: string;
  label: string;
  color: string;
};
