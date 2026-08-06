import { MethodCard } from '@/features/onboarding/components/MethodCard';
import { StepNav } from '@/features/onboarding/components/StepNav';
import { StepShell } from '@/features/onboarding/components/StepShell';
import { useOnboardingStore } from '@/features/onboarding/store/onboarding-store';

const fieldClass =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400';

export function StepPayments() {
  const payment = useOnboardingStore((s) => s.payment);
  const setPayment = useOnboardingStore((s) => s.setPayment);
  const error = useOnboardingStore((s) => s.error);

  return (
    <StepShell
      title="Payment Methods"
      description="Tell customers how they can pay you."
      error={error}
      footer={<StepNav />}
    >
      <div className="max-w-lg space-y-3">
        <MethodCard
          id="pay-upi"
          title="UPI Payment"
          description="Collect via PhonePe, GPay, Paytm, etc."
          checked={payment.upi.enabled}
          onCheckedChange={(enabled) => setPayment({ upi: { ...payment.upi, enabled } })}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="pay-upi-id">
                UPI ID
              </label>
              <input
                id="pay-upi-id"
                type="text"
                value={payment.upi.upiId}
                placeholder="yourname@upi"
                onChange={(e) => setPayment({ upi: { ...payment.upi, upiId: e.target.value } })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="pay-upi-name">
                Payee Name
              </label>
              <input
                id="pay-upi-name"
                type="text"
                value={payment.upi.payeeName}
                placeholder="Account holder name"
                onChange={(e) =>
                  setPayment({ upi: { ...payment.upi, payeeName: e.target.value } })
                }
                className={fieldClass}
              />
            </div>
          </div>
        </MethodCard>

        <MethodCard
          id="pay-bank"
          title="Bank Account"
          description="Share account details for NEFT / IMPS transfers"
          checked={payment.bank.enabled}
          onCheckedChange={(enabled) => setPayment({ bank: { ...payment.bank, enabled } })}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="pay-bank-name">
                Account Holder Name
              </label>
              <input
                id="pay-bank-name"
                type="text"
                value={payment.bank.accountName}
                onChange={(e) =>
                  setPayment({ bank: { ...payment.bank, accountName: e.target.value } })
                }
                className={fieldClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="pay-bank-number">
                Account Number
              </label>
              <input
                id="pay-bank-number"
                type="text"
                inputMode="numeric"
                value={payment.bank.accountNumber}
                onChange={(e) =>
                  setPayment({ bank: { ...payment.bank, accountNumber: e.target.value } })
                }
                className={fieldClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="pay-bank-ifsc">
                IFSC Code
              </label>
              <input
                id="pay-bank-ifsc"
                type="text"
                value={payment.bank.ifsc}
                onChange={(e) =>
                  setPayment({ bank: { ...payment.bank, ifsc: e.target.value.toUpperCase() } })
                }
                className={`${fieldClass} uppercase`}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="pay-bank-bank">
                Bank Name
              </label>
              <input
                id="pay-bank-bank"
                type="text"
                value={payment.bank.bankName}
                onChange={(e) =>
                  setPayment({ bank: { ...payment.bank, bankName: e.target.value } })
                }
                className={fieldClass}
              />
            </div>
          </div>
        </MethodCard>

        <MethodCard
          id="pay-cod"
          title="Cash on Delivery"
          description="Customer pays in cash when they receive the order"
          checked={payment.cod.enabled}
          onCheckedChange={(enabled) => setPayment({ cod: { enabled } })}
        />
      </div>
    </StepShell>
  );
}
