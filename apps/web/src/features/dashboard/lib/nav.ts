export type DashRouteMeta = {
  title: string;
  crumbs: Array<{ label: string; to?: string }>;
};

export function getDashRouteMeta(pathname: string): DashRouteMeta {
  const base = { label: 'Dashboard', to: '/dashboard' };

  if (pathname === '/dashboard' || pathname === '/dashboard/') {
    return { title: 'Overview', crumbs: [base, { label: 'Overview' }] };
  }
  if (pathname.startsWith('/dashboard/orders')) {
    return { title: 'Orders', crumbs: [base, { label: 'Orders' }] };
  }
  if (pathname.startsWith('/dashboard/products')) {
    return { title: 'Products', crumbs: [base, { label: 'Products' }] };
  }
  if (pathname.startsWith('/dashboard/store')) {
    return { title: 'Store & Share', crumbs: [base, { label: 'Store & Share' }] };
  }
  if (pathname.startsWith('/dashboard/settings')) {
    return { title: 'Settings', crumbs: [base, { label: 'Settings' }] };
  }
  if (pathname.startsWith('/dashboard/audit-logs')) {
    return { title: 'Audit logs', crumbs: [base, { label: 'Audit logs' }] };
  }
  if (pathname.startsWith('/dashboard/vendors')) {
    return { title: 'Vendors', crumbs: [base, { label: 'Vendors' }] };
  }
  return { title: 'Dashboard', crumbs: [base] };
}
