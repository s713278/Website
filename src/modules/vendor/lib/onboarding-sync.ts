import { vendorOnboardingService, type StorefrontConfigInput } from '@/shared/api'
import type {
  OnboardingRuntimeState,
  OnboardingStep,
  VendorOnboardingDraftV1,
} from '../types/onboarding'

/**
 * Steps persisted to the vendor account on Continue.
 *
 * Steps 5-8 and 10 are absent because their contract is unresolved, not because
 * they are unimportant:
 *  - 5/6: the assign-products response is an untyped APIResponseObject with no
 *    example, so the vendor-assigned product ID that ItemSkuCreateRequest
 *    requires cannot be resolved.
 *  - 7/8: scheduling_config and shipping_config are generic JSON, and the
 *    payment `details` keys for bank/account-holder are undefined.
 *  - 10: go-live has no canonical public URL and only generic error objects.
 *
 * See docs/API_GAPS.md. Sending a guessed payload to a real vendor account is
 * worse than keeping the step in the local draft.
 */
export const LIVE_PERSISTED_STEPS: readonly OnboardingStep[] = [3, 4, 9]

export function isLivePersistedStep(step: OnboardingStep): boolean {
  return LIVE_PERSISTED_STEPS.includes(step)
}

/** Field to focus when a save for this step fails. */
export function stepErrorField(step: OnboardingStep): string {
  if (step === 3) return 'business-type'
  if (step === 4) return 'categories'
  return 'store-name'
}

function toStorefrontInput(
  draft: VendorOnboardingDraftV1,
  runtime: OnboardingRuntimeState,
): StorefrontConfigInput {
  return {
    storeName: draft.storefront.storeName,
    tagline: draft.storefront.tagline,
    businessLocation: draft.storefront.businessLocation,
    instagram: draft.storefront.instagram,
    orderWhatsapp: runtime.orderWhatsapp,
    supportWhatsapp: runtime.supportWhatsapp,
    welcomeMessage: draft.storefront.welcomeMessage,
    announcementBar: draft.storefront.announcementBar,
    heroBadges: draft.storefront.heroBadges,
    trustStrip: draft.storefront.trustStrip,
    theme: {
      primaryColor: draft.storefront.primaryColor,
      accentColor: draft.storefront.accentColor,
      backgroundColor: draft.storefront.backgroundColor,
      textColor: draft.storefront.textColor,
      fontFamily: draft.storefront.fontFamily,
      buttonShape: draft.storefront.buttonShape,
      cardStyle: draft.storefront.cardStyle,
      themePreset: draft.storefront.themePreset,
    },
    // Image upload stays gated: the contract does not say which classification is
    // the storefront logo, and a local object URL must never be sent.
    uploadedLogoUrl: null,
    uploadedBannerUrl: null,
  }
}

/**
 * Persist one step to the vendor account. Throws on failure so the caller keeps the
 * vendor on the step — a failed write must never be reported as local success.
 */
export async function persistStep(
  step: OnboardingStep,
  vendorId: string,
  draft: VendorOnboardingDraftV1,
  runtime: OnboardingRuntimeState,
): Promise<void> {
  if (step === 3) {
    const businessType = draft.business.businessType
    if (!businessType) return
    // `name` holds the exact backend `type` value, not a display label.
    await vendorOnboardingService.saveBusinessType(vendorId, { businessType: businessType.name })
    return
  }

  if (step === 4) {
    await vendorOnboardingService.saveCategories(
      vendorId,
      draft.categories.map((category) => category.id),
    )
    return
  }

  if (step === 9) {
    await vendorOnboardingService.saveStorefront(vendorId, toStorefrontInput(draft, runtime))
    // owner_name and contact_person have no home in the storefront config, so they
    // ride along on the business-type record where the contract defines them.
    const businessType = draft.business.businessType
    if (businessType) {
      await vendorOnboardingService.saveBusinessType(vendorId, {
        businessType: businessType.name,
        businessName: draft.storefront.storeName,
        ownerName: draft.business.ownerName,
        contactPerson: draft.business.contactPerson,
      })
    }
  }
}
