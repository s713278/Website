import { ArchitectureShell } from '@/shared/components/ArchitectureShell';

export function MarketingHomePage() {
  return (
    <ArchitectureShell
      surface="marketing"
      title="Marketing shell"
      links={[
        { to: '/store', label: 'Storefront' },
        { to: '/onboarding', label: 'Onboarding' },
        { to: '/auth/login', label: 'Login' },
        { to: '/dashboard', label: 'Dashboard (protected)' },
      ]}
    />
  );
}
