export type UserRole = 'customer' | 'vendor' | 'admin' | 'guest';

export type AuthUser = {
  id: string;
  phone?: string;
  name?: string;
  role: UserRole;
};

export type RouteSurface = 'marketing' | 'storefront' | 'onboarding' | 'dashboard' | 'auth';
