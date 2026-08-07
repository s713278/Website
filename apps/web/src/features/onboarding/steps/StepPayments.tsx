import { MethodCard } from '@/features/onboarding/components/MethodCard';
import { StepNav } from '@/features/onboarding/components/StepNav';
import { StepShell } from '@/features/onboarding/components/StepShell';
import {
  paymentsStepSchema,
  type PaymentsStepValues,
} from '@/features/onboarding/schemas/store-setup-schemas';
import { useOnboardingStore } from '@/features/onboarding/store/onboarding-store';
import { useZodForm } from '@/shared/forms/use-zod-form';

const fieldClass =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400';

export function StepPayments() {
  const payment = useOnboardingStore((s) => s.payment);
  const setPayment = useOnboardingStore((s) => s.setPayment);
  const goNext = useOnboardingStore((s) => s.goNext);
  const setError = useOnboardingStore((s) => s.setError);

  const form = useZodForm(paymentsStepSchema, {
    defaultValues: {
      upiEnabled: payment.upi.enabled,
      upiId: payment.upi.upiId,
      payeeName: payment.upi.payeeName,
      bankEnabled: payment.bank.enabled,
      accountName: payment.bank.accountName,
      accountNumber: payment.bank.accountNumber,
      ifsc: payment.bank.ifsc,
      bankName: payment.bank.bankName,
      codEnabled: payment.cod.enabled,
    },
    mode: 'onChange',
  });

  const values = form.watch();

  function apply(v: PaymentsStepValues) {
    setPayment({
      upi: { enabled: v.upiEnabled, upiId: v.upiId, payeeName: v.payeeName },
      bank: {
        enabled: v.bankEnabled,
        accountName: v.accountName,
        accountNumber: v.accountNumber,
        ifsc: v.ifsc,
        bankName: v.bankName,
      },
      cod: { enabled: v.codEnabled },
    });
  }

  const formError =
    form.formState.errors.upiEnabled?.message || form.formState.errors.upiId?.message;

  return (
    <StepShell
      title="Payment Methods"
      description="Tell customers how they can pay you."
      error={formError}
      footer={
        <StepNav
          onNext={() => {
            void form.handleSubmit((v) => {
              apply(v);
              setError('');
              goNext();
            })();
          }}
        />
      }
    >
      <div className="max-w-lg space-y-3">
        <MethodCard
          id="pay-upi"
          title="UPI Payment"
          description="Collect via PhonePe, GPay, Paytm, etc."
          checked={values.upiEnabled}
          onCheckedChange={(enabled) => {
            form.setValue('upiEnabled', enabled, { shouldValidate: true });
            apply({ ...values, upiEnabled: enabled });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="pay-upi-id">
                UPI ID
              </label>
              <input
                id="pay-upi-id"
                {...form.register('upiId', {
                  onChange: (e) => apply({ ...values, upiId: e.target.value }),
                })}
                placeholder="yourname@upi"
                className={fieldClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="pay-upi-name">
                Payee Name
              </label>
              <input
                id="pay-upi-name"
                {...form.register('payeeName', {
                  onChange: (e) => apply({ ...values, payeeName: e.target.value }),
                })}
                className={fieldClass}
              />
            </div>
          </div>
        </MethodCard>

        <MethodCard
          id="pay-bank"
          title="Bank Account"
          description="Share account details for NEFT / IMPS transfers"
          checked={values.bankEnabled}
          onCheckedChange={(enabled) => {
            form.setValue('bankEnabled', enabled, { shouldValidate: true });
            apply({ ...values, bankEnabled: enabled });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="pay-bank-name">
                Account Holder Name
              </label>
              <input
                id="pay-bank-name"
                {...form.register('accountName', {
                  onChange: (e) => apply({ ...values, accountName: e.target.value }),
                })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="pay-bank-number">
                Account Number
              </label>
              <input
                id="pay-bank-number"
                inputMode="numeric"
                {...form.register('accountNumber', {
                  onChange: (e) => apply({ ...values, accountNumber: e.target.value }),
                })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="pay-bank-ifsc">
                IFSC Code
              </label>
              <input
                id="pay-bank-ifsc"
                {...form.register('ifsc', {
                  onChange: (e) =>
                    apply({ ...values, ifsc: e.target.value.toUpperCase() }),
                })}
                className={`${fieldClass} uppercase`}
              />
            </div>
          </div>
        </MethodCard>

        <MethodCard
          id="pay-cod"
          title="Cash on Delivery"
          description="Customer pays in cash when they receive the order"
          checked={values.codEnabled}
          onCheckedChange={(enabled) => {
            form.setValue('codEnabled', enabled, { shouldValidate: true });
            apply({ ...values, codEnabled: enabled });
          }}
        />
      </div>
    </StepShell>
  );
}
