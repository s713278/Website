import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { getErrorMessage } from '@mithra/api-client';
import { useZodForm } from '@/shared/forms/use-zod-form';
import {
  otpRequestSchema,
  otpVerifySchema,
  type OtpRequestValues,
} from '@/features/auth/schemas/auth-schemas';
import { useRequestOtp, useVerifyOtp } from '@/features/auth/hooks/use-auth';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || '/dashboard';
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<OtpRequestValues['role']>('vendor');

  const requestOtp = useRequestOtp();
  const verifyOtp = useVerifyOtp();

  const phoneForm = useZodForm(otpRequestSchema, {
    defaultValues: { phone: '', role: 'vendor' },
  });
  const otpForm = useZodForm(otpVerifySchema, {
    defaultValues: { phone: '', otp: '' },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Login / Signup</CardTitle>
        <CardDescription>
          OTP scaffolding for customer, vendor, and admin. Demo mode works without API.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 'phone' ? (
          <form
            className="space-y-4"
            onSubmit={phoneForm.handleSubmit(async (values) => {
              try {
                await requestOtp.mutateAsync(values);
                setPhone(values.phone);
                setRole(values.role);
                otpForm.setValue('phone', values.phone);
                setStep('otp');
              } catch (error) {
                phoneForm.setError('phone', { message: getErrorMessage(error) });
              }
            })}
          >
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                className="flex h-11 w-full rounded-xl border border-input bg-white px-3 text-sm"
                {...phoneForm.register('role')}
              >
                <option value="vendor">Vendor</option>
                <option value="admin">Admin</option>
                <option value="customer">Customer</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Mobile number</Label>
              <Input
                id="phone"
                inputMode="numeric"
                maxLength={10}
                placeholder="10-digit mobile"
                {...phoneForm.register('phone')}
              />
              {phoneForm.formState.errors.phone ? (
                <p className="text-xs font-semibold text-destructive">
                  {phoneForm.formState.errors.phone.message}
                </p>
              ) : null}
            </div>
            <Button type="submit" className="w-full" disabled={requestOtp.isPending}>
              {requestOtp.isPending ? 'Sending…' : 'Send OTP'}
            </Button>
          </form>
        ) : (
          <form
            className="space-y-4"
            onSubmit={otpForm.handleSubmit(async (values) => {
              try {
                await verifyOtp.mutateAsync({ ...values, role });
                navigate(role === 'customer' ? '/store' : from, { replace: true });
              } catch (error) {
                otpForm.setError('otp', { message: getErrorMessage(error) });
              }
            })}
          >
            <p className="text-sm text-muted-foreground">OTP sent to +91 {phone}</p>
            <div className="space-y-2">
              <Label htmlFor="otp">Enter OTP</Label>
              <Input
                id="otp"
                inputMode="numeric"
                maxLength={6}
                placeholder="••••••"
                {...otpForm.register('otp')}
              />
              {otpForm.formState.errors.otp ? (
                <p className="text-xs font-semibold text-destructive">
                  {otpForm.formState.errors.otp.message}
                </p>
              ) : null}
            </div>
            <Button type="submit" className="w-full" disabled={verifyOtp.isPending}>
              {verifyOtp.isPending ? 'Verifying…' : 'Verify & continue'}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setStep('phone')}>
              Change number
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
