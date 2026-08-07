import { useMemo } from 'react';
import { env } from '@/shared/lib/env';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useOnboardingStore } from '@/features/onboarding/store/onboarding-store';
import { DEMO_VENDOR_ID, DEMO_STORE } from '@/features/dashboard/data/demo-dashboard';
import { useDemoDataStore } from '@/features/dashboard/store/demo-data-store';
import type { StoreShareInfo } from '@/features/dashboard/types';

/** True when live API calls should run (not demo/offline session). */
export function useApiEnabled() {
  const accessToken = useAuthStore((s) => s.accessToken);
  return Boolean(env.useApi && accessToken && !accessToken.startsWith('demo_'));
}

export function useDashboardVendorId() {
  const user = useAuthStore((s) => s.user);
  const draftVendorId = useOnboardingStore((s) => s.vendorId);
  const apiOn = useApiEnabled();

  return useMemo(() => {
    if (apiOn && draftVendorId != null) return String(draftVendorId);
    if (apiOn && user?.id && !String(user.id).startsWith('user_')) return user.id;
    return DEMO_VENDOR_ID;
  }, [apiOn, draftVendorId, user?.id]);
}

export function useVendorApiEnabled() {
  const apiOn = useApiEnabled();
  const vendorId = useDashboardVendorId();
  return Boolean(apiOn && vendorId && vendorId !== DEMO_VENDOR_ID);
}

export function useDashboardStoreInfo(): StoreShareInfo {
  const demoStore = useDemoDataStore((s) => s.store);
  const settings = useOnboardingStore((s) => s.settings);
  const published = useOnboardingStore((s) => s.published);

  return useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    if (!env.useApi) return { ...demoStore, storeUrl: demoStore.storeUrl || `${origin}/store` };
    if (published && settings.storeName) {
      const slug = settings.storeName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      return {
        storeName: settings.storeName,
        slug,
        storeUrl: `${origin}/store`,
        whatsapp: settings.whatsapp || demoStore.whatsapp,
        location: settings.location || demoStore.location,
        themeColor: settings.themeColor || demoStore.themeColor,
        planLabel: 'Free plan',
      };
    }
    return { ...DEMO_STORE, storeUrl: `${origin}/store` };
  }, [demoStore, published, settings]);
}
