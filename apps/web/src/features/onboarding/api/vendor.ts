import {
  getErrorMessage,
  uploadVendorImage,
  vendorsService,
  type ApiEnvelope,
  type VendorProfileRequest,
} from '@mithra/api-client';
import type { OnboardingDraft } from '@/features/onboarding/types';
import {
  dataUrlToFile,
  mapActiveStatus,
  mapDraftToCheckoutOptions,
  mapDraftToVendorProfile,
  mapStoreSlug,
} from '@/features/onboarding/api/map-draft';
import { env } from '@/shared/lib/env';

export type PublishStoreResult = {
  vendorId: number;
  slug: string;
  offline: boolean;
};

function extractVendorId(res: ApiEnvelope<Record<string, unknown>> | Record<string, unknown>): number | null {
  const data = (('data' in res ? res.data : res) || {}) as Record<string, unknown>;
  const id = data.vendor_id ?? data.id ?? data.vendorId;
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function uploadBrandImages(vendorId: number, draft: OnboardingDraft) {
  const logo = await dataUrlToFile(draft.settings.logoDataUrl, 'logo.jpg');
  if (logo) {
    const form = new FormData();
    form.append('file', logo);
    await uploadVendorImage(vendorId, form);
  }
  const banner = await dataUrlToFile(draft.settings.bannerDataUrl, 'banner.jpg');
  if (banner) {
    const form = new FormData();
    form.append('file', banner);
    await uploadVendorImage(vendorId, form);
  }
}

/**
 * Publish store setup: create vendor → checkout options → activate → images.
 * When `VITE_USE_API` is false, completes offline with a local vendor id.
 */
export async function publishStoreSetup(draft: OnboardingDraft): Promise<PublishStoreResult> {
  const slug = mapStoreSlug(draft);

  if (!env.useApi) {
    return {
      vendorId: draft.vendorId || Date.now(),
      slug,
      offline: true,
    };
  }

  const profile = mapDraftToVendorProfile(draft);
  if (!profile.assign_categories?.category_ids?.length) {
    throw new Error('Select at least one catalog category before going live.');
  }

  let vendorId = draft.vendorId;
  try {
    if (!vendorId) {
      const created = await vendorsService.create(profile as unknown as Record<string, unknown>);
      vendorId = extractVendorId(created as ApiEnvelope<Record<string, unknown>>);
      if (!vendorId) throw new Error('Vendor was created but no vendor id was returned.');
    } else {
      await vendorsService.update(vendorId, profile as unknown as Record<string, unknown>);
    }

    await vendorsService.saveCheckoutOptions(vendorId, mapDraftToCheckoutOptions(draft) as unknown as Record<string, unknown>);
    await vendorsService.patchStatus(vendorId, mapActiveStatus() as unknown as Record<string, unknown>);
    await uploadBrandImages(vendorId, draft);

    return { vendorId, slug, offline: false };
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Failed to publish your store. Please retry.'));
  }
}

export function buildVendorProfilePreview(draft: OnboardingDraft): VendorProfileRequest {
  return mapDraftToVendorProfile(draft);
}
