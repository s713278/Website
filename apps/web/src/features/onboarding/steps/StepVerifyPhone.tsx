import { PhoneField } from '@/features/onboarding/components/PhoneField';
import { StepShell } from '@/features/onboarding/components/StepShell';
import { useOnboardingStore } from '@/features/onboarding/store/onboarding-store';

export function StepVerifyPhone() {
  const phone = useOnboardingStore((s) => s.phone);
  const setPhone = useOnboardingStore((s) => s.setPhone);
  const error = useOnboardingStore((s) => s.error);
  const goNext = useOnboardingStore((s) => s.goNext);

  return (
    <StepShell
      title="Verify Mobile Number"
      description="We'll send a one-time password to your phone."
      error={error}
      footer={
        <button
          type="button"
          onClick={() => goNext()}
          className="mt-6 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 px-8 py-3 font-semibold text-white shadow-md shadow-emerald-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
        >
          Send OTP
        </button>
      }
    >
      <PhoneField
        id="input-phone"
        label="Mobile Number"
        value={phone}
        onChange={setPhone}
        errorId={error ? 'phone-error' : undefined}
      />
    </StepShell>
  );
}
