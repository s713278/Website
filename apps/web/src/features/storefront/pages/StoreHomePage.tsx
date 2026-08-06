import { ArchitectureShell } from '@/shared/components/ArchitectureShell';

export function StoreHomePage() {
  return (
    <ArchitectureShell
      surface="storefront"
      title="Storefront shell"
      links={[
        { to: '/', label: 'Marketing' },
        { to: '/auth/login', label: 'Customer login' },
      ]}
    />
  );
}
