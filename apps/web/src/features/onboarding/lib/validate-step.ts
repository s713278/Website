import type { OnboardingDraft } from '@/features/onboarding/types';

export function validateOnboardingStep(draft: OnboardingDraft): string | null {
  switch (draft.currentStep) {
    case 1:
      if (!/^\d{10}$/.test(draft.phone)) return 'Enter a valid 10-digit mobile number.';
      return null;
    case 2:
      if (!draft.verified) return 'Enter the 4-digit OTP to continue.';
      return null;
    case 3:
      if (!draft.businessType) return 'Please select a business type.';
      return null;
    case 4:
      if (!draft.categories.length) return 'Select at least one category.';
      if (draft.categories.length > 2) return 'Maximum 2 categories.';
      return null;
    case 5: {
      const ids = new Set(draft.categories.map((c) => c.id));
      if (!draft.products.some((p) => ids.has(p.categoryId) && p.name.trim())) {
        return 'Add at least one product in your selected categories.';
      }
      return null;
    }
    case 6: {
      const priced = draft.products.some((p) =>
        p.variants.some((v) => v.active !== false && Number(v.price) > 0),
      );
      if (!priced) return 'Set at least one size and price.';
      return null;
    }
    case 7: {
      const d = draft.delivery;
      if (!d.storePickup.enabled && !d.homeDelivery.enabled && !d.courierDelivery.enabled) {
        return 'Select at least one delivery method.';
      }
      return null;
    }
    case 8: {
      const p = draft.payment;
      if (!p.upi.enabled && !p.bank.enabled && !p.cod.enabled) {
        return 'Select at least one payment method.';
      }
      if (p.upi.enabled && !p.upi.upiId.trim()) return 'Enter your UPI ID.';
      return null;
    }
    case 9:
      if (!draft.settings.storeName.trim()) return 'Enter a store name.';
      if (!/^\d{10}$/.test(draft.settings.whatsapp || draft.phone)) {
        return 'Enter a valid WhatsApp number.';
      }
      return null;
    default:
      return null;
  }
}
