import { PhoneField } from '@/features/onboarding/components/PhoneField';
import { StepShell } from '@/features/onboarding/components/StepShell';
import { useOnboardingRequestOtp } from '@/features/onboarding/hooks/use-onboarding-otp';
import { phoneStepSchema } from '@/features/onboarding/schemas/store-setup-schemas';
import { useOnboardingStore } from '@/features/onboarding/store/onboarding-store';
import { getErrorMessage } from '@mithra/api-client';
import { useZodForm } from '@/shared/forms/use-zod-form';
import { Controller } from 'react-hook-form';

export function StepVerifyPhone() {
  const phone = useOnboardingStore((s) => s.phone);
  const setPhone = useOnboardingStore((s) => s.setPhone);
  const error = useOnboardingStore((s) => s.error);
  const setError = useOnboardingStore((s) => s.setError);
  const requestOtp = useOnboardingRequestOtp();

  const form = useZodForm(phoneStepSchema, {
    defaultValues: { phone },
    mode: 'onChange',
  });

  const displayError =
    form.formState.errors.phone?.message ||
    error ||
    (requestOtp.isError ? getErrorMessage(requestOtp.error) : '');

  const onSend = form.handleSubmit((values) => {
    setPhone(values.phone);
    setError('');
    requestOtp.mutate(values.phone);
  });

  return (
    <StepShell
      title="Verify Mobile Number"
      description="We'll send a one-time password to your phone."
      error={displayError}
      footer={
        <button
          type="button"
          onClick={() => void onSend()}
          disabled={requestOtp.isPending}
          className="mt-6 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 px-8 py-3 font-semibold text-white shadow-md shadow-emerald-500/30 disabled:opacity-60"
        >
          {requestOtp.isPending ? 'Sending…' : 'Send OTP'}
        </button>
      }
    >
      <Controller
        control={form.control}
        name="phone"
        render={({ field }) => (
          <PhoneField
            id="input-phone"
            label="Mobile Number"
            value={field.value}
            onChange={(v) => {
              field.onChange(v);
              setPhone(v);
            }}
            errorId={displayError ? 'phone-error' : undefined}
          />
        )}
      />
      {requestOtp.isError ? (
        <button
          type="button"
          className="mt-3 text-sm font-semibold text-emerald-700 hover:underline"
          onClick={() => void onSend()}
          disabled={requestOtp.isPending}
        >
          Retry send OTP
        </button>
      ) : null}
    </StepShell>
  );
}
