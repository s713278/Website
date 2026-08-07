import { Link } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useSignOut } from '@/features/auth/hooks/use-auth';
import { useAuditLog } from '@/features/dashboard/hooks/use-audit-log';
import { useDashboardStoreInfo } from '@/features/dashboard/hooks/use-dashboard-vendor';
import { canManageSettings } from '@/features/dashboard/lib/permissions';
import {
  settingsFormSchema,
  type SettingsFormValues,
} from '@/features/dashboard/schemas/product-schema';
import { useDemoDataStore } from '@/features/dashboard/store/demo-data-store';
import { applyVendorTheme } from '@mithra/ui';
import { useZodForm } from '@/shared/forms/use-zod-form';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { env } from '@/shared/lib/env';
import { slugify } from '@/shared/lib/format';

export function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const canEdit = canManageSettings(role);
  const store = useDashboardStoreInfo();
  const updateStore = useDemoDataStore((s) => s.updateStore);
  const signOut = useSignOut();
  const { log } = useAuditLog();

  const form = useZodForm(settingsFormSchema, {
    defaultValues: {
      storeName: store.storeName,
      whatsapp: store.whatsapp,
      location: store.location,
      themeColor: store.themeColor,
    },
  });

  const onSave = form.handleSubmit((values: SettingsFormValues) => {
    if (!canEdit) return;
    if (!env.useApi) {
      updateStore({
        storeName: values.storeName,
        whatsapp: values.whatsapp,
        location: values.location,
        themeColor: values.themeColor,
        slug: slugify(values.storeName),
      });
      applyVendorTheme(values.themeColor);
    }
    log({
      action: 'update',
      entity: 'settings',
      summary: `Updated store settings for ${values.storeName}`,
    });
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Store settings</CardTitle>
          <Button asChild size="sm" variant="secondary">
            <Link to="/onboarding">Edit setup</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSave}>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="set-name">Store name</Label>
              <Input id="set-name" disabled={!canEdit} {...form.register('storeName')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-whatsapp">WhatsApp</Label>
              <Input id="set-whatsapp" disabled={!canEdit} {...form.register('whatsapp')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-location">Location</Label>
              <Input id="set-location" disabled={!canEdit} {...form.register('location')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-theme">Theme color</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="set-theme"
                  type="color"
                  className="h-11 w-16 p-1"
                  disabled={!canEdit}
                  {...form.register('themeColor')}
                />
                <Input disabled={!canEdit} {...form.register('themeColor')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <p className="flex h-11 items-center rounded-xl border border-border bg-secondary/40 px-3 text-sm font-semibold">
                {store.planLabel}
              </p>
            </div>
            {canEdit ? (
              <div className="sm:col-span-2">
                <Button type="submit" size="sm">
                  Save settings
                </Button>
                {!env.useApi ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Demo mode saves locally on this device.
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    API mode logs the change; full settings sync uses onboarding publish.
                  </p>
                )}
              </div>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Account</CardTitle>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold uppercase text-secondary-foreground">
            {role || 'guest'}
          </span>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Signed in
              </dt>
              <dd className="mt-1 font-semibold">{user?.phone || user?.name || user?.id || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Role
              </dt>
              <dd className="mt-1 font-semibold capitalize">{role}</dd>
            </div>
          </dl>
          <Button
            type="button"
            variant="secondary"
            onClick={() => signOut.mutate()}
            disabled={signOut.isPending}
          >
            {signOut.isPending ? 'Logging out…' : 'Log out'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
