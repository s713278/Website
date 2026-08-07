import { Controller } from 'react-hook-form';
import { ImageUploadBox } from '@/features/onboarding/components/ImageUploadBox';
import { PhoneField } from '@/features/onboarding/components/PhoneField';
import { StepShell } from '@/features/onboarding/components/StepShell';
import { ThemePicker } from '@/features/onboarding/components/ThemePicker';
import { usePublishStoreSetup } from '@/features/onboarding/hooks/use-publish-store';
import {
  settingsStepSchema,
  type SettingsStepValues,
} from '@/features/onboarding/schemas/store-setup-schemas';
import { useOnboardingStore } from '@/features/onboarding/store/onboarding-store';
import { useZodForm } from '@/shared/forms/use-zod-form';

const inputClass =
  'w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400';

export function StepStoreSettings() {
  const settings = useOnboardingStore((s) => s.settings);
  const phone = useOnboardingStore((s) => s.phone);
  const setSettings = useOnboardingStore((s) => s.setSettings);
  const goBack = useOnboardingStore((s) => s.goBack);
  const setError = useOnboardingStore((s) => s.setError);
  const error = useOnboardingStore((s) => s.error);
  const publishError = useOnboardingStore((s) => s.publishError);
  const publish = usePublishStoreSetup();

  const form = useZodForm(settingsStepSchema, {
    defaultValues: {
      storeName: settings.storeName,
      tagline: settings.tagline,
      location: settings.location,
      whatsapp: settings.whatsapp || phone,
      themeColor: settings.themeColor || '#10b981',
      logoDataUrl: settings.logoDataUrl,
      bannerDataUrl: settings.bannerDataUrl,
    },
    mode: 'onChange',
  });

  function sync(values: Partial<SettingsStepValues>) {
    setSettings({
      storeName: values.storeName ?? form.getValues('storeName'),
      tagline: values.tagline ?? form.getValues('tagline') ?? '',
      location: values.location ?? form.getValues('location') ?? '',
      whatsapp: values.whatsapp ?? form.getValues('whatsapp'),
      themeColor: values.themeColor ?? form.getValues('themeColor'),
      logoDataUrl: values.logoDataUrl ?? form.getValues('logoDataUrl') ?? '',
      bannerDataUrl: values.bannerDataUrl ?? form.getValues('bannerDataUrl') ?? '',
    });
  }

  const onGoLive = form.handleSubmit((values) => {
    setSettings(values);
    setError('');
    publish.mutate();
  });

  const displayError =
    form.formState.errors.storeName?.message ||
    form.formState.errors.whatsapp?.message ||
    form.formState.errors.themeColor?.message ||
    error ||
    publishError;

  return (
    <StepShell
      title="Store Settings"
      description="Name your store, set branding, and pick a theme color."
      error={displayError}
      footer={
        <div className="mt-8 flex justify-between">
          <button
            type="button"
            onClick={goBack}
            disabled={publish.isPending}
            className="rounded-full border border-gray-200 px-5 py-2.5 font-medium text-gray-600 hover:bg-gray-50"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => void onGoLive()}
            disabled={publish.isPending}
            className="rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 px-8 py-2.5 font-semibold text-white shadow-md shadow-emerald-500/30 disabled:opacity-60"
          >
            {publish.isPending ? 'Publishing…' : 'Go Live'}
          </button>
        </div>
      }
    >
      <div className="max-w-lg space-y-4">
        <div>
          <label htmlFor="store-name" className="mb-1 block text-sm font-medium text-gray-700">
            Store Name
          </label>
          <input
            id="store-name"
            {...form.register('storeName', {
              onChange: (e) => sync({ storeName: e.target.value }),
            })}
            placeholder="e.g. Anitha Homemade Pickles"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="tagline" className="mb-1 block text-sm font-medium text-gray-700">
            Store Tagline
          </label>
          <input
            id="tagline"
            {...form.register('tagline', {
              onChange: (e) => sync({ tagline: e.target.value }),
            })}
            placeholder="Traditional • Natural • Homemade"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="location" className="mb-1 block text-sm font-medium text-gray-700">
            Business Location
          </label>
          <input
            id="location"
            {...form.register('location', {
              onChange: (e) => sync({ location: e.target.value }),
            })}
            placeholder="Hyderabad, Telangana"
            className={inputClass}
          />
        </div>
        <Controller
          control={form.control}
          name="whatsapp"
          render={({ field }) => (
            <PhoneField
              id="whatsapp"
              label="WhatsApp Number (For Orders)"
              value={field.value}
              onChange={(v) => {
                field.onChange(v);
                sync({ whatsapp: v });
              }}
            />
          )}
        />
        <ThemePicker
          value={form.watch('themeColor')}
          onChange={(themeColor) => {
            form.setValue('themeColor', themeColor, { shouldValidate: true });
            sync({ themeColor });
          }}
        />
        <div className="grid gap-4 pt-2 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="logoDataUrl"
            render={({ field }) => (
              <ImageUploadBox
                label="Store Logo (1:1)"
                hint="Square logo"
                aspect="square"
                value={field.value || ''}
                onChange={(logoDataUrl) => {
                  field.onChange(logoDataUrl);
                  sync({ logoDataUrl });
                }}
                pickLabel="Upload logo"
              />
            )}
          />
          <Controller
            control={form.control}
            name="bannerDataUrl"
            render={({ field }) => (
              <ImageUploadBox
                label="Home Banner (16:9)"
                hint="Home banner"
                aspect="banner"
                value={field.value || ''}
                onChange={(bannerDataUrl) => {
                  field.onChange(bannerDataUrl);
                  sync({ bannerDataUrl });
                }}
                pickLabel="Upload banner"
              />
            )}
          />
        </div>
      </div>
    </StepShell>
  );
}
