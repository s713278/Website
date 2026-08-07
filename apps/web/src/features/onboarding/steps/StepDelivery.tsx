import { MethodCard } from '@/features/onboarding/components/MethodCard';
import { StepNav } from '@/features/onboarding/components/StepNav';
import { StepShell } from '@/features/onboarding/components/StepShell';
import {
  deliveryStepSchema,
  type DeliveryStepValues,
} from '@/features/onboarding/schemas/store-setup-schemas';
import { useOnboardingStore } from '@/features/onboarding/store/onboarding-store';
import { useZodForm } from '@/shared/forms/use-zod-form';

export function StepDelivery() {
  const delivery = useOnboardingStore((s) => s.delivery);
  const setDelivery = useOnboardingStore((s) => s.setDelivery);
  const goNext = useOnboardingStore((s) => s.goNext);
  const setError = useOnboardingStore((s) => s.setError);

  const form = useZodForm(deliveryStepSchema, {
    defaultValues: {
      storePickup: delivery.storePickup.enabled,
      homeDelivery: delivery.homeDelivery.enabled,
      homeCharge: delivery.homeDelivery.charge,
      courierDelivery: delivery.courierDelivery.enabled,
      courierCharge: delivery.courierDelivery.charge,
    },
    mode: 'onChange',
  });

  function apply(values: DeliveryStepValues) {
    setDelivery({
      storePickup: { enabled: values.storePickup },
      homeDelivery: { enabled: values.homeDelivery, charge: values.homeCharge },
      courierDelivery: { enabled: values.courierDelivery, charge: values.courierCharge },
    });
  }

  const values = form.watch();

  return (
    <StepShell
      title="Delivery Methods"
      description="Choose how customers receive orders. Add a charge where it applies."
      error={form.formState.errors.storePickup?.message}
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
          id="del-pickup"
          title="Store Pickup"
          description="Customers collect from your location — free"
          badge="Free"
          checked={values.storePickup}
          onCheckedChange={(enabled) => {
            form.setValue('storePickup', enabled, { shouldValidate: true });
            apply({ ...values, storePickup: enabled });
          }}
        />
        <MethodCard
          id="del-home"
          title="Home Delivery"
          description="Local drop-off with a delivery charge"
          checked={values.homeDelivery}
          onCheckedChange={(enabled) => {
            form.setValue('homeDelivery', enabled, { shouldValidate: true });
            apply({ ...values, homeDelivery: enabled });
          }}
        >
          <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="del-home-charge">
            Delivery charge (₹)
          </label>
          <input
            id="del-home-charge"
            type="number"
            min={0}
            {...form.register('homeCharge', {
              valueAsNumber: true,
              onChange: (e) =>
                apply({ ...values, homeCharge: Number(e.target.value) || 0 }),
            })}
            className="w-36 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </MethodCard>
        <MethodCard
          id="del-courier"
          title="Courier Delivery"
          description="Ship via courier with shipping charges"
          checked={values.courierDelivery}
          onCheckedChange={(enabled) => {
            form.setValue('courierDelivery', enabled, { shouldValidate: true });
            apply({ ...values, courierDelivery: enabled });
          }}
        >
          <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="del-courier-charge">
            Courier charge (₹)
          </label>
          <input
            id="del-courier-charge"
            type="number"
            min={0}
            {...form.register('courierCharge', {
              valueAsNumber: true,
              onChange: (e) =>
                apply({ ...values, courierCharge: Number(e.target.value) || 0 }),
            })}
            className="w-36 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </MethodCard>
      </div>
    </StepShell>
  );
}
