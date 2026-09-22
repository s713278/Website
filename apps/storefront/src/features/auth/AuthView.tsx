import { useState } from 'react';
import { requestOtp, verifyOtp, ApiError } from '@mithra/api-client';
import { Button, OtpInput, PhoneInput } from '@mithra/ui';
import { USE_API } from '../../config';
import { useStore } from '../home/store-context';

export function AuthView() {
  const { customer, setCustomer, setView } = useStore();
  const [phone, setPhone] = useState(customer.phone);
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function sendOtp() {
    setError('');
    if (phone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setBusy(true);
    try {
      if (USE_API) {
        await requestOtp({
          country_code: '+91',
          mobile_number: phone,
          reg_platform: 'WEB',
          user_role: 'CUSTOMER',
        });
      }
      setCustomer({ ...customer, phone });
      setStep('otp');
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Failed to send OTP');
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setError('');
    if (otp.length !== 6) {
      setError('Enter the 6-digit OTP.');
      return;
    }
    setBusy(true);
    try {
      if (USE_API) {
        await verifyOtp({ country_code: '+91', mobile_number: phone, otp });
      }
      setCustomer({ phone, name: 'Customer', loggedIn: true });
      setView('checkout');
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'OTP verification failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="mb-4 text-4xl">📱</div>
      <h2 className="md-display text-2xl">Login / Signup</h2>
      <p className="mt-1 text-sm text-slate-500">We&apos;ll send a one-time password to your phone</p>
      {!USE_API ? (
        <p className="mt-2 text-xs text-amber-700">Demo: any 6 digits</p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <div className="mt-6 w-full max-w-sm space-y-4 text-left">
        {step === 'phone' ? (
          <>
            <PhoneInput value={phone} onChange={setPhone} />
            <Button className="w-full" disabled={busy} data-cta="send_otp" onClick={sendOtp}>
              Send OTP
            </Button>
          </>
        ) : (
          <>
            <OtpInput value={otp} onChange={setOtp} />
            <Button className="w-full" disabled={busy} data-cta="verify_otp" onClick={verify}>
              Verify & Continue
            </Button>
            <button type="button" className="w-full text-sm text-emerald-700" onClick={sendOtp}>
              Resend OTP
            </button>
          </>
        )}
      </div>
    </div>
  );
}
