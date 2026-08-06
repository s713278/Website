import { ArchitectureShell } from '@/shared/components/ArchitectureShell';
import { Button } from '@/shared/components/ui/button';
import { useSignOut } from '@/features/auth/hooks/use-auth';
import { useAuthStore } from '@/features/auth/store/auth-store';

export function DashboardHomePage() {
  const user = useAuthStore((s) => s.user);
  const signOut = useSignOut();

  return (
    <div className="space-y-4">
      <ArchitectureShell
        surface="dashboard"
        title="Dashboard shell"
        links={[
          { to: '/store', label: 'View storefront' },
          { to: '/onboarding', label: 'Edit setup' },
        ]}
      />
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>
          Signed in as <strong>{user?.phone || user?.name || 'vendor'}</strong> ({user?.role})
        </span>
        <Button type="button" variant="outline" size="sm" onClick={() => signOut.mutate()}>
          Log out
        </Button>
      </div>
    </div>
  );
}
