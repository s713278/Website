import type { UserRole } from '@/shared/types'

export function homePathForRole(role: UserRole) {
  return role === 'vendor' ? '/vendor' : '/stores'
}
