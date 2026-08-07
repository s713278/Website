import type { UserRole } from '@/shared/types';

type Role = Extract<UserRole, 'vendor' | 'admin'>;

export function isDashboardRole(role: UserRole | undefined | null): role is Role {
  return role === 'vendor' || role === 'admin';
}

export function canViewVendors(role: UserRole | undefined | null) {
  return role === 'admin';
}

export function canManageProducts(role: UserRole | undefined | null) {
  return role === 'vendor' || role === 'admin';
}

export function canDeleteProducts(role: UserRole | undefined | null) {
  return role === 'vendor' || role === 'admin';
}

export function canBulkMutate(role: UserRole | undefined | null) {
  return role === 'vendor' || role === 'admin';
}

export function canUpdateOrders(role: UserRole | undefined | null) {
  return role === 'vendor' || role === 'admin';
}

export function canManageSettings(role: UserRole | undefined | null) {
  return role === 'vendor' || role === 'admin';
}

export function canViewAuditLogs(role: UserRole | undefined | null) {
  return role === 'vendor' || role === 'admin';
}

export function canExport(role: UserRole | undefined | null) {
  return role === 'vendor' || role === 'admin';
}

/** Admin-only destructive bulk on vendors. */
export function canAdminBulkVendors(role: UserRole | undefined | null) {
  return role === 'admin';
}
