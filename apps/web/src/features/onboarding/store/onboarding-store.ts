import { create } from 'zustand';
import {
  PRODUCT_COLORS,
  TOTAL_STEPS,
  slugify,
  uid,
} from '@/features/onboarding/data/constants';
import { createDemoDraft, createEmptyDraft } from '@/features/onboarding/data/demo-seed';
import { validateOnboardingStep } from '@/features/onboarding/lib/validate-step';
import type {
  CategoryOption,
  OnboardingDraft,
  ProductDraft,
  ProductVariant,
} from '@/features/onboarding/types';

type OnboardingStore = OnboardingDraft & {
  error: string;
  setError: (msg: string) => void;
  clearError: () => void;
  goToStep: (step: number) => void;
  goNext: () => boolean;
  goBack: () => void;
  loadDemo: () => void;
  reset: () => void;
  setPhone: (phone: string) => void;
  markVerified: () => void;
  setBusinessType: (id: string | number, label?: string) => void;
  toggleCategory: (cat: CategoryOption) => void;
  addCustomCategory: (name: string) => void;
  setExpandedProductCat: (id: number | string | null) => void;
  setExpandedSkuCat: (id: number | string | null) => void;
  addProduct: (categoryId: number | string, name?: string) => void;
  updateProduct: (id: string, patch: Partial<ProductDraft>) => void;
  removeProduct: (id: string) => void;
  addVariant: (productId: string) => void;
  updateVariant: (productId: string, variantId: string, patch: Partial<ProductVariant>) => void;
  removeVariant: (productId: string, variantId: string) => void;
  setDelivery: (patch: Partial<OnboardingDraft['delivery']>) => void;
  setPayment: (patch: Partial<OnboardingDraft['payment']>) => void;
  setSettings: (patch: Partial<OnboardingDraft['settings']>) => void;
};

export const useOnboardingStore = create<OnboardingStore>((set, get) => ({
  ...createEmptyDraft(),
  error: '',

  setError: (msg) => set({ error: msg }),
  clearError: () => set({ error: '' }),

  goToStep: (step) => {
    const { maxReachedStep } = get();
    if (step < 1 || step > TOTAL_STEPS || step > maxReachedStep) return;
    set({ currentStep: step, error: '' });
  },

  goNext: () => {
    const state = get();
    const msg = validateOnboardingStep(state);
    if (msg) {
      set({ error: msg });
      return false;
    }
    if (state.currentStep === 1) {
      // OTP send is handled by useOnboardingRequestOtp — do not auto-advance here.
      return true;
    }
    const next = Math.min(TOTAL_STEPS, state.currentStep + 1);
    const settings =
      next === TOTAL_STEPS && !state.settings.whatsapp
        ? { ...state.settings, whatsapp: state.phone }
        : state.settings;
    set({
      currentStep: next,
      maxReachedStep: Math.max(state.maxReachedStep, next),
      error: '',
      settings,
    });
    return true;
  },

  goBack: () => {
    const { currentStep } = get();
    if (currentStep <= 1) return;
    set({ currentStep: currentStep - 1, error: '' });
  },

  loadDemo: () => set({ ...createDemoDraft(), error: '' }),
  reset: () => set({ ...createEmptyDraft(), error: '' }),

  setPhone: (phone) => set({ phone: phone.replace(/\D/g, '').slice(0, 10) }),

  markVerified: () => {
    const { maxReachedStep } = get();
    set({
      verified: true,
      currentStep: 3,
      maxReachedStep: Math.max(maxReachedStep, 3),
      error: '',
    });
  },

  setBusinessType: (id, label) => {
    set({
      businessType: String(id),
      businessTypeLabel: label || '',
      categories: [],
      products: [],
      expandedProductCatId: null,
      expandedSkuCatId: null,
      error: '',
    });
  },

  toggleCategory: (cat) => {
    const { categories } = get();
    const idx = categories.findIndex((c) => c.id === cat.id);
    if (idx >= 0) {
      set({ categories: categories.filter((c) => c.id !== cat.id), error: '' });
      return;
    }
    if (categories.length >= 2) {
      set({ error: 'Maximum 2 categories. Deselect one first.' });
      return;
    }
    set({ categories: [...categories, cat], error: '' });
  },

  addCustomCategory: (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const { categories } = get();
    if (categories.length >= 2) {
      set({ error: 'Maximum 2 categories.' });
      return;
    }
    set({
      categories: [...categories, { id: slugify(trimmed), name: trimmed }],
      error: '',
    });
  },

  setExpandedProductCat: (id) => set({ expandedProductCatId: id }),
  setExpandedSkuCat: (id) => set({ expandedSkuCatId: id }),

  addProduct: (categoryId, name = '') => {
    const { products } = get();
    const color = PRODUCT_COLORS[products.length % PRODUCT_COLORS.length];
    set({
      products: [
        ...products,
        {
          id: uid('prod'),
          categoryId,
          name,
          imageDataUrl: '',
          color,
          variants: [{ id: uid('sku'), label: '1 unit', price: 0, active: true }],
        },
      ],
      error: '',
    });
  },

  updateProduct: (id, patch) => {
    set({
      products: get().products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
  },

  removeProduct: (id) => set({ products: get().products.filter((p) => p.id !== id) }),

  addVariant: (productId) => {
    set({
      products: get().products.map((p) =>
        p.id === productId
          ? {
              ...p,
              variants: [
                ...p.variants,
                { id: uid('sku'), label: '', price: 0, active: true },
              ],
            }
          : p,
      ),
    });
  },

  updateVariant: (productId, variantId, patch) => {
    set({
      products: get().products.map((p) =>
        p.id !== productId
          ? p
          : {
              ...p,
              variants: p.variants.map((v) =>
                v.id === variantId ? { ...v, ...patch } : v,
              ),
            },
      ),
    });
  },

  removeVariant: (productId, variantId) => {
    set({
      products: get().products.map((p) =>
        p.id !== productId
          ? p
          : { ...p, variants: p.variants.filter((v) => v.id !== variantId) },
      ),
    });
  },

  setDelivery: (patch) => set({ delivery: { ...get().delivery, ...patch } }),
  setPayment: (patch) => set({ payment: { ...get().payment, ...patch } }),
  setSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
}));
