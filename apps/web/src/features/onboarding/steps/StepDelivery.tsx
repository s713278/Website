import { MethodCard } from '@/features/onboarding/components/MethodCard';
import { StepNav } from '@/features/onboarding/components/StepNav';
import { StepShell } from '@/features/onboarding/components/StepShell';
import { useOnboardingStore } from '@/features/onboarding/store/onboarding-store';

export function StepDelivery() {
  const delivery = useOnboardingStore((s) => s.delivery);
  const setDelivery = useOnboardingStore((s) => s.setDelivery);
  const error = useOnboardingStore((s) => s.error);

  return (
    <StepShell
      title="Delivery Methods"
      description="Choose how customers receive orders. Add a charge where it applies."
      error={error}
      footer={<StepNav />}
    >
      <div className="max-w-lg space-y-3">
        <MethodCard
          id="del-pickup"
          title="Store Pickup"
          description="Customers collect from your location — free"
          badge="Free"
          checked={delivery.storePickup.enabled}
          onCheckedChange={(enabled) =>
            setDelivery({ storePickup: { enabled } })
          }
        />
        <MethodCard
          id="del-home"
          title="Home Delivery"
          description="Local drop-off with a delivery charge"
          checked={delivery.homeDelivery.enabled}
          onCheckedChange={(enabled) =>
            setDelivery({
              homeDelivery: { ...delivery.homeDelivery, enabled },
            })
          }
        >
          <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="del-home-charge">
            Delivery charge (₹)
          </label>
          <input
            id="del-home-charge"
            type="number"
            min={0}
            value={delivery.homeDelivery.charge || ''}
            placeholder="e.g. 40"
            onChange={(e) =>
              setDelivery({
                homeDelivery: {
                  ...delivery.homeDelivery,
                  charge: Number(e.target.value) || 0,
                },
              })
            }
            className="w-36 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </MethodCard>
        <MethodCard
          id="del-courier"
          title="Courier Delivery"
          description="Ship via courier with shipping charges"
          checked={delivery.courierDelivery.enabled}
          onCheckedChange={(enabled) =>
            setDelivery({
              courierDelivery: { ...delivery.courierDelivery, enabled },
            })
          }
        >
          <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="del-courier-charge">
            Courier charge (₹)
          </label>
          <input
            id="del-courier-charge"
            type="number"
            min={0}
            value={delivery.courierDelivery.charge || ''}
            placeholder="e.g. 80"
            onChange={(e) =>
              setDelivery({
                courierDelivery: {
                  ...delivery.courierDelivery,
                  charge: Number(e.target.value) || 0,
                },
              })
            }
            className="w-36 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </MethodCard>
      </div>
    </StepShell>
  );
}
