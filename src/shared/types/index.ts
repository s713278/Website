export type UserRole = 'customer' | 'vendor'

export type User = {
  id: string
  name: string
  email: string
  role: UserRole
  vendorId?: string
}
