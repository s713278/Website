import type { User, UserRole } from '@/shared/types'

/** Vendor setup route (React page). New vendors run the onboarding wizard first. */
export const VENDOR_ONBOARDING_HREF = '/onboarding'

export function homePathForRole(role: UserRole) {
  return role === 'vendor' ? '/vendor' : '/cart'
}

export function loginPathForRole(role?: UserRole) {
  return role === 'vendor' ? '/vendor/login' : '/login'
}

function isSafePath(path: string) {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('://')
}

export function homePathForUser(user: User) {
  return homePathForRole(user.role)
}

/** Customer resumes checkout/orders/cart. Vendor always continues to store setup. */
export function resumePathAfterLogin(role: UserRole, from?: string | null) {
  if (role === 'vendor') return VENDOR_ONBOARDING_HREF

  if (
    from &&
    isSafePath(from) &&
    (from === '/checkout' || from === '/orders' || from === '/cart' || from.startsWith('/stores'))
  ) {
    return from
  }

  return '/cart'
}
