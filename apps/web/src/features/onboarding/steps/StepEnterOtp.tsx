import { useEffect, useState } from 'react';
import { OtpInputs } from '@/features/onboarding/components/OtpInputs';
import { useOnboardingStore } from '@/features/onboarding/store/onboarding-store';

export function StepEnterOtp() {
  const phone = useOnboardingStore((s) => s.phone);
  const error = useOnboardingStore((s) => s.error);
  const setError = useOnboardingStore((s) => s.setError);
  const markVerified = useOnboardingStore((s) => s.markVerified);
  const [otp, setOtp] = useState('');
  const [seconds, setSeconds] = useState(30);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = window.setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearInterval(id);
  }, [seconds]);

  function verify() {
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit code (demo: any 6 digits).');
      return;
    }
    markVerified();
  }

  return (
    <section aria-labelledby="otp-title">
      <div className="mb-1 flex items-center gap-2">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm text-emerald-600"
          aria-hidden
        >
          ✓
        </span>
        <h2 id="otp-title" className="font-display text-xl font-bold text-gray-900">
          Enter OTP
        </h2>
      </div>
      <p className="mb-6 text-sm text-gray-500">
        Enter the 6-digit code sent to{' '}
        <span className="font-medium text-gray-700">+91 {phone}</span>.{' '}
        <span className="text-xs text-emerald-600">(Demo: any 6 digits)</span>
      </p>
      <OtpInputs value={otp} onChange={setOtp} aria-describedby={error ? 'otp-error' : undefined} />
      {error ? (
        <p id="otp-error" className="mt-3 text-center text-sm text-red-500" role="alert">
          {error}
        </p>
      ) : null}
      <p className="mt-4 text-center text-sm text-gray-500">
        <button
          type="button"
          disabled={seconds > 0}
          onClick={() => setSeconds(30)}
          className="font-medium text-emerald-600 disabled:text-gray-400"
        >
          {seconds > 0 ? `Resend OTP in ${seconds}s` : 'Resend OTP'}
        </button>
      </p>
      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={verify}
          className="rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 px-8 py-3 font-semibold text-white shadow-md shadow-emerald-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
        >
          Verify &amp; Continue
        </button>
      </div>
    </section>
  );
}
