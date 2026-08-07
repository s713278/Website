import {
  PRODUCT_COLORS,
  uid,
} from '@/features/onboarding/data/constants';
import type { OnboardingDraft, ProductDraft } from '@/features/onboarding/types';

function emptyDelivery(): OnboardingDraft['delivery'] {
  return {
    storePickup: { enabled: true },
    homeDelivery: { enabled: false, charge: 40 },
    courierDelivery: { enabled: false, charge: 80 },
  };
}

function emptyPayment(): OnboardingDraft['payment'] {
  return {
    upi: { enabled: false, upiId: '', payeeName: '' },
    bank: { enabled: false, accountName: '', accountNumber: '', ifsc: '', bankName: '' },
    cod: { enabled: true },
  };
}

function emptySettings(): OnboardingDraft['settings'] {
  return {
    storeName: '',
    tagline: '',
    location: '',
    whatsapp: '',
    themeColor: '#10b981',
    logoDataUrl: '',
    bannerDataUrl: '',
  };
}

export function createEmptyDraft(): OnboardingDraft {
  return {
    currentStep: 1,
    maxReachedStep: 1,
    phone: '',
    verified: false,
    businessType: '',
    businessTypeLabel: '',
    categories: [],
    products: [],
    delivery: emptyDelivery(),
    payment: emptyPayment(),
    settings: emptySettings(),
    expandedProductCatId: null,
    expandedSkuCatId: null,
    vendorId: null,
    published: false,
    saveStatus: 'idle',
    lastSavedAt: null,
    publishError: '',
  };
}

function makeProduct(
  categoryId: number | string,
  name: string,
  color: string,
  price: number,
): ProductDraft {
  return {
    id: uid('prod'),
    categoryId,
    name,
    imageDataUrl: '',
    color,
    variants: [{ id: uid('sku'), label: '250g', price, active: true }],
  };
}

/** Local demo seed — offline only (Load demo data). */
export function createDemoDraft(): OnboardingDraft {
  const cats = [
    { id: 'milk', name: 'Milk Products' },
    { id: 'curd', name: 'Curd & Paneer' },
  ];
  const products: ProductDraft[] = [
    makeProduct(cats[0].id, 'Cow Milk 1L', PRODUCT_COLORS[0], 60),
    makeProduct(cats[0].id, 'Buffalo Milk 1L', PRODUCT_COLORS[2], 70),
    makeProduct(cats[1].id, 'Plain Curd', PRODUCT_COLORS[3], 40),
  ];

  return {
    ...createEmptyDraft(),
    currentStep: 3,
    maxReachedStep: 9,
    phone: '9912149049',
    verified: true,
    businessType: 'dairy',
    businessTypeLabel: 'Dairy & Fresh',
    categories: cats,
    products,
    delivery: {
      storePickup: { enabled: true },
      homeDelivery: { enabled: true, charge: 40 },
      courierDelivery: { enabled: true, charge: 80 },
    },
    payment: {
      upi: { enabled: true, upiId: 'geeta@upi', payeeName: "Geeta's Kitchen" },
      bank: {
        enabled: false,
        accountName: "Geeta's Kitchen",
        accountNumber: '',
        ifsc: '',
        bankName: '',
      },
      cod: { enabled: true },
    },
    settings: {
      storeName: "Geeta's Kitchen",
      tagline: 'Homely Food, Pure Taste',
      location: 'Hyderabad',
      whatsapp: '9912149049',
      themeColor: '#10b981',
      logoDataUrl: '',
      bannerDataUrl: '',
    },
    expandedProductCatId: cats[0]?.id ?? null,
    expandedSkuCatId: cats[0]?.id ?? null,
  };
}
