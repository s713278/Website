import type {
  PaymentOptionRequest,
  SaveVendorDeliveryConfigRequest,
  VendorProfileRequest,
  VendorStatusRequest,
} from '@mithra/api-client';
import type { OnboardingDraft } from '@/features/onboarding/types';
import { slugify } from '@/shared/lib/format';

export function mapFulfillmentType(
  delivery: OnboardingDraft['delivery'],
): NonNullable<VendorProfileRequest['fulfillment_type']> {
  const home = delivery.homeDelivery.enabled || delivery.courierDelivery.enabled;
  const pickup = delivery.storePickup.enabled;
  if (home && pickup) return 'BOTH';
  if (home) return 'HOME_DELIVERY';
  return 'STORE_PICKUP';
}

export function mapDraftToVendorProfile(draft: OnboardingDraft): VendorProfileRequest {
  const categoryIds = draft.categories
    .map((c) => Number(c.id))
    .filter((id) => Number.isFinite(id) && id > 0);

  return {
    business_name: draft.settings.storeName.trim(),
    description: draft.settings.tagline.trim() || undefined,
    business_type: draft.businessTypeLabel || draft.businessType,
    contact_number: draft.settings.whatsapp || draft.phone,
    contact_person: draft.settings.storeName.trim() || undefined,
    banner_image: draft.settings.bannerDataUrl || undefined,
    assign_categories: { category_ids: categoryIds },
    fulfillment_type: mapFulfillmentType(draft.delivery),
    business_address: draft.settings.location
      ? { city: draft.settings.location, country: 'India' }
      : undefined,
  };
}

export function mapDraftToCheckoutOptions(
  draft: OnboardingDraft,
): SaveVendorDeliveryConfigRequest {
  const payment_options: PaymentOptionRequest[] = [];

  if (draft.payment.cod.enabled) {
    payment_options.push({
      type: 'CASH_ON_DELIVERY',
      label: 'Cash on Delivery',
      default: true,
      is_default: true,
      display_order: 1,
    });
  }
  if (draft.payment.upi.enabled) {
    payment_options.push({
      type: 'PRE_PAID',
      label: 'UPI',
      default: !draft.payment.cod.enabled,
      is_default: !draft.payment.cod.enabled,
      display_order: 2,
      details: {
        upi_account: draft.payment.upi.upiId,
        payee_name: draft.payment.upi.payeeName,
      } as unknown as PaymentOptionRequest['details'],
    });
  }
  if (draft.payment.bank.enabled) {
    payment_options.push({
      type: 'PRE_PAID',
      label: 'Bank Transfer',
      display_order: 3,
      details: {
        account_name: draft.payment.bank.accountName,
        account_number: draft.payment.bank.accountNumber,
        ifsc: draft.payment.bank.ifsc,
        bank_name: draft.payment.bank.bankName,
      } as unknown as PaymentOptionRequest['details'],
    });
  }

  const charge = draft.delivery.homeDelivery.enabled
    ? draft.delivery.homeDelivery.charge
    : draft.delivery.courierDelivery.charge;

  return {
    fulfillment_type: mapFulfillmentType(draft.delivery),
    payment_options,
    shipping_strategy_type: 'FLAT',
    shipping_config: { charge } as unknown as SaveVendorDeliveryConfigRequest['shipping_config'],
  };
}

export function mapActiveStatus(): VendorStatusRequest {
  return { vendor_status: 'ACTIVE' };
}

export function mapStoreSlug(draft: OnboardingDraft): string {
  return slugify(draft.settings.storeName || 'my-store');
}

export async function dataUrlToFile(dataUrl: string, filename: string): Promise<File | null> {
  if (!dataUrl.startsWith('data:')) return null;
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || 'image/jpeg' });
}
