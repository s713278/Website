import { getErrorMessage } from '@mithra/api-client';
import { PhoneField } from '@/features/onboarding/components/PhoneField';
import { StepShell } from '@/features/onboarding/components/StepShell';
import { useOnboardingRequestOtp } from '@/features/onboarding/hooks/use-onboarding-otp';
import { useOnboardingStore } from '@/features/onboarding/store/onboarding-store';

export function StepVerifyPhone() {
  const phone = useOnboardingStore((s) => s.phone);
  const setPhone = useOnboardingStore((s) => s.setPhone);
  const error = useOnboardingStore((s) => s.error);
  const setError = useOnboardingStore((s) => s.setError);
  const requestOtp = useOnboardingRequestOtp();

  const displayError = error || (requestOtp.isError ? getErrorMessage(requestOtp.error) : '');

  function onSend() {
    if (!/^\d{10}$/.test(phone)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    requestOtp.mutate(phone);
  }

  return (
    <StepShell
      title="Verify Mobile Number"
      description="We'll send a one-time password to your phone."
      error={displayError}
      footer={
        <button
          type="button"
          onClick={onSend}
          disabled={requestOtp.isPending}
          className="mt-6 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 px-8 py-3 font-semibold text-white shadow-md shadow-emerald-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {requestOtp.isPending ? 'Sending…' : 'Send OTP'}
        </button>
      }
    >
      <PhoneField
        id="input-phone"
        label="Mobile Number"
        value={phone}
        onChange={setPhone}
        errorId={displayError ? 'phone-error' : undefined}
      />
      {requestOtp.isError ? (
        <button
          type="button"
          className="mt-3 text-sm font-semibold text-emerald-700 hover:underline"
          onClick={onSend}
          disabled={requestOtp.isPending}
        >
          Retry send OTP
        </button>
      ) : null}
    </StepShell>
  );
}
