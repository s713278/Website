import { ArchitectureShell } from '@/shared/components/ArchitectureShell';

export function OnboardingHomePage() {
  return (
    <ArchitectureShell
      surface="onboarding"
      title="Onboarding shell"
      links={[
        { to: '/dashboard', label: 'Dashboard' },
        { to: '/auth/login', label: 'Vendor login' },
      ]}
    />
  );
}
