import {
  PRODUCT_COLORS,
  categoriesForBusiness,
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
    categories: [],
    products: [],
    delivery: emptyDelivery(),
    payment: emptyPayment(),
    settings: emptySettings(),
    expandedProductCatId: null,
    expandedSkuCatId: null,
  };
}

function makeProduct(
  categoryId: string,
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

/** Local demo seed — no API. */
export function createDemoDraft(): OnboardingDraft {
  const cats = categoriesForBusiness('home-kitchen').slice(0, 2);
  const products: ProductDraft[] = [
    makeProduct(cats[0]?.id || 'meals', 'Veg Thali', PRODUCT_COLORS[0], 120),
    makeProduct(cats[0]?.id || 'meals', 'Sambar Rice', PRODUCT_COLORS[2], 80),
    makeProduct(cats[1]?.id || 'snacks', 'Murukku Pack', PRODUCT_COLORS[3], 60),
  ];

  return {
    ...createEmptyDraft(),
    currentStep: 3,
    maxReachedStep: 9,
    phone: '9912149049',
    verified: true,
    businessType: 'home-kitchen',
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
