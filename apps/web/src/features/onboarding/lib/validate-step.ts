import {
  businessStepSchema,
  categoriesStepSchema,
  deliveryStepSchema,
  otpStepSchema,
  paymentsStepSchema,
  phoneStepSchema,
  productsStepSchema,
  settingsStepSchema,
} from '@/features/onboarding/schemas/store-setup-schemas';
import type { OnboardingDraft } from '@/features/onboarding/types';

/** Zod-backed step validation used by the wizard navigator. */
export function validateOnboardingStep(draft: OnboardingDraft): string | null {
  switch (draft.currentStep) {
    case 1: {
      const r = phoneStepSchema.safeParse({ phone: draft.phone });
      return r.success ? null : r.error.issues[0]?.message || 'Invalid phone';
    }
    case 2: {
      if (!draft.verified) return 'Enter the 4-digit OTP to continue.';
      const r = otpStepSchema.safeParse({ otp: '0000' });
      return r.success || draft.verified ? null : 'Enter the 4-digit OTP to continue.';
    }
    case 3: {
      const r = businessStepSchema.safeParse({ businessType: draft.businessType });
      return r.success ? null : r.error.issues[0]?.message || 'Select a business type';
    }
    case 4: {
      const r = categoriesStepSchema.safeParse({
        categoryIds: draft.categories.map((c) => c.id),
      });
      return r.success ? null : r.error.issues[0]?.message || 'Select categories';
    }
    case 5: {
      const named = draft.products
        .filter((p) => p.name.trim())
        .map((p) => ({ categoryId: p.categoryId, name: p.name }));
      const r = productsStepSchema.safeParse({ products: named });
      return r.success ? null : r.error.issues[0]?.message || 'Add products';
    }
    case 6: {
      const priced = draft.products.some((p) =>
        p.variants.some((v) => v.active !== false && Number(v.price) > 0),
      );
      return priced ? null : 'Set at least one size and price.';
    }
    case 7: {
      const r = deliveryStepSchema.safeParse({
        storePickup: draft.delivery.storePickup.enabled,
        homeDelivery: draft.delivery.homeDelivery.enabled,
        homeCharge: draft.delivery.homeDelivery.charge,
        courierDelivery: draft.delivery.courierDelivery.enabled,
        courierCharge: draft.delivery.courierDelivery.charge,
      });
      return r.success ? null : r.error.issues[0]?.message || 'Select delivery';
    }
    case 8: {
      const r = paymentsStepSchema.safeParse({
        upiEnabled: draft.payment.upi.enabled,
        upiId: draft.payment.upi.upiId,
        payeeName: draft.payment.upi.payeeName,
        bankEnabled: draft.payment.bank.enabled,
        accountName: draft.payment.bank.accountName,
        accountNumber: draft.payment.bank.accountNumber,
        ifsc: draft.payment.bank.ifsc,
        bankName: draft.payment.bank.bankName,
        codEnabled: draft.payment.cod.enabled,
      });
      return r.success ? null : r.error.issues[0]?.message || 'Select payment';
    }
    case 9: {
      const r = settingsStepSchema.safeParse({
        ...draft.settings,
        whatsapp: draft.settings.whatsapp || draft.phone,
      });
      return r.success ? null : r.error.issues[0]?.message || 'Complete store settings';
    }
    default:
      return null;
  }
}
