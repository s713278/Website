import { ImageUploadBox } from '@/features/onboarding/components/ImageUploadBox';
import { PhoneField } from '@/features/onboarding/components/PhoneField';
import { StepNav } from '@/features/onboarding/components/StepNav';
import { StepShell } from '@/features/onboarding/components/StepShell';
import { THEME_PRESETS } from '@/features/onboarding/data/constants';
import { useOnboardingStore } from '@/features/onboarding/store/onboarding-store';
import { cn } from '@/shared/lib/utils';

const inputClass =
  'w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400';

export function StepStoreSettings() {
  const settings = useOnboardingStore((s) => s.settings);
  const phone = useOnboardingStore((s) => s.phone);
  const setSettings = useOnboardingStore((s) => s.setSettings);
  const error = useOnboardingStore((s) => s.error);

  return (
    <StepShell
      title="Store Settings"
      description="Name your store, set branding, and pick a theme color."
      error={error}
      footer={<StepNav nextLabel="Go Live" />}
    >
      <div className="max-w-lg space-y-4">
        <div>
          <label htmlFor="store-name" className="mb-1 block text-sm font-medium text-gray-700">
            Store Name
          </label>
          <input
            id="store-name"
            type="text"
            value={settings.storeName}
            placeholder="e.g. Anitha Homemade Pickles"
            onChange={(e) => setSettings({ storeName: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="tagline" className="mb-1 block text-sm font-medium text-gray-700">
            Store Tagline
          </label>
          <input
            id="tagline"
            type="text"
            value={settings.tagline}
            placeholder="Traditional • Natural • Homemade"
            onChange={(e) => setSettings({ tagline: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="location" className="mb-1 block text-sm font-medium text-gray-700">
            Business Location
          </label>
          <input
            id="location"
            type="text"
            value={settings.location}
            placeholder="Hyderabad, Telangana"
            onChange={(e) => setSettings({ location: e.target.value })}
            className={inputClass}
          />
        </div>
        <PhoneField
          id="whatsapp"
          label="WhatsApp Number (For Orders)"
          value={settings.whatsapp || phone}
          onChange={(whatsapp) => setSettings({ whatsapp })}
          placeholder="WhatsApp number"
        />

        <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-700">Theme Color</span>
            <span className="text-xs text-gray-400">Applies to storefront &amp; dashboard</span>
          </div>
          <p className="mb-3 text-xs text-gray-500">
            Pick a colour that matches your brand — customers will see it on your shop link instantly.
          </p>
          <div className="flex flex-wrap gap-2" role="listbox" aria-label="Theme color presets">
            {THEME_PRESETS.map((preset) => {
              const selected = settings.themeColor.toLowerCase() === preset.color.toLowerCase();
              return (
                <button
                  key={preset.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  aria-label={preset.label}
                  title={preset.label}
                  onClick={() => setSettings({ themeColor: preset.color })}
                  className={cn(
                    'h-9 w-9 rounded-full border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                    selected ? 'border-gray-900 ring-2 ring-offset-1' : 'border-white shadow',
                  )}
                  style={{ backgroundColor: preset.color }}
                />
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <label htmlFor="theme-color" className="text-xs font-medium text-gray-600">
              Custom
            </label>
            <input
              id="theme-color"
              type="color"
              value={settings.themeColor}
              aria-label="Custom theme color"
              onChange={(e) => setSettings({ themeColor: e.target.value })}
              className="h-9 w-12 cursor-pointer rounded border border-gray-200 bg-white"
            />
            <span className="font-mono text-xs text-gray-500">{settings.themeColor}</span>
            <span
              className="rounded-full px-2.5 py-1 text-xs font-semibold text-white"
              style={{ backgroundColor: settings.themeColor }}
            >
              Live preview
            </span>
          </div>
        </div>

        <div className="grid gap-4 pt-2 sm:grid-cols-2">
          <ImageUploadBox
            label="Store Logo (1:1)"
            hint="Square logo"
            aspect="square"
            value={settings.logoDataUrl}
            onChange={(logoDataUrl) => setSettings({ logoDataUrl })}
            pickLabel="Upload logo"
          />
          <ImageUploadBox
            label="Home Banner (16:9)"
            hint="Home banner"
            aspect="banner"
            value={settings.bannerDataUrl}
            onChange={(bannerDataUrl) => setSettings({ bannerDataUrl })}
            pickLabel="Upload banner"
          />
        </div>
      </div>
    </StepShell>
  );
}
