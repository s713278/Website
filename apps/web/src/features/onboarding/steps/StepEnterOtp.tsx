import { useEffect, useState } from 'react';
import { getErrorMessage } from '@mithra/api-client';
import { OtpInputs } from '@/features/onboarding/components/OtpInputs';
import { useOnboardingRequestOtp, useOnboardingVerifyOtp } from '@/features/onboarding/hooks/use-onboarding-otp';
import { useOnboardingStore } from '@/features/onboarding/store/onboarding-store';

export function StepEnterOtp() {
  const phone = useOnboardingStore((s) => s.phone);
  const error = useOnboardingStore((s) => s.error);
  const setError = useOnboardingStore((s) => s.setError);
  const verifyOtp = useOnboardingVerifyOtp();
  const resendOtp = useOnboardingRequestOtp();
  const [otp, setOtp] = useState('');
  const [seconds, setSeconds] = useState(30);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = window.setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearInterval(id);
  }, [seconds]);

  const displayError =
    error ||
    (verifyOtp.isError ? getErrorMessage(verifyOtp.error) : '') ||
    (resendOtp.isError ? getErrorMessage(resendOtp.error) : '');

  function verify() {
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit OTP to continue.');
      return;
    }
    verifyOtp.mutate(otp);
  }

  function resend() {
    resendOtp.mutate(phone, {
      onSuccess: () => setSeconds(30),
    });
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
        <span className="font-medium text-gray-700">+91 {phone}</span>.
      </p>
      <OtpInputs
        value={otp}
        onChange={setOtp}
        disabled={verifyOtp.isPending}
        aria-describedby={displayError ? 'otp-error' : undefined}
      />
      {displayError ? (
        <p id="otp-error" className="mt-3 text-center text-sm text-red-500" role="alert">
          {displayError}
        </p>
      ) : null}
      {(verifyOtp.isError || resendOtp.isError) && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            className="text-sm font-semibold text-emerald-700 hover:underline"
            onClick={verifyOtp.isError ? verify : resend}
            disabled={verifyOtp.isPending || resendOtp.isPending}
          >
            Retry
          </button>
        </div>
      )}
      <p className="mt-4 text-center text-sm text-gray-500">
        <button
          type="button"
          disabled={seconds > 0 || resendOtp.isPending}
          onClick={resend}
          className="font-medium text-emerald-600 disabled:text-gray-400"
        >
          {resendOtp.isPending
            ? 'Sending…'
            : seconds > 0
              ? `Resend OTP in ${seconds}s`
              : 'Resend OTP'}
        </button>
      </p>
      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={verify}
          disabled={verifyOtp.isPending}
          className="rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 px-8 py-3 font-semibold text-white shadow-md shadow-emerald-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {verifyOtp.isPending ? 'Verifying…' : 'Verify & Continue'}
        </button>
      </div>
    </section>
  );
}
